/**
 * DeFi Service - Main orchestrator for DeFi operations
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProtocolFactoryService } from './protocol-factory.service';
import { RiskAssessmentService } from './risk-assessment.service';
import { YieldOptimizerService } from './yield-optimizer.service';
import { SmartContractService } from './smart-contract.service';
import { TransactionSimulatorService } from './transaction-simulator.service';
import {
  DeFiPositionEntity,
  DeFiTransactionEntity,
  DeFiYieldEntity,
} from '../entities/defi.entity';
import {
  DeFiPosition,
  RiskMetrics,
  TransactionSimulation,
  YieldInfo,
} from '../interfaces/protocol.interface';
import {
  IDeFiService,
  CreatePositionRequest,
  ExecuteTransactionRequest,
  TransactionSimulationRequest,
  DeFiPortfolioAnalytics,
  ProtocolAnalytics,
  PortfolioRiskAssessment,
  YieldStrategy,
  StrategyRecommendation,
  PositionFilter,
  EmergencyExitPlan,
  LiquidationRisk,
  PositionRebalance,
  StrategyFilter,
} from '../interfaces/defi.interface';

@Injectable()
export class DeFiService implements IDeFiService {
  private readonly logger = new Logger(DeFiService.name);

  constructor(
    @InjectRepository(DeFiPositionEntity)
    private positionRepository: Repository<DeFiPositionEntity>,
    @InjectRepository(DeFiTransactionEntity)
    private transactionRepository: Repository<DeFiTransactionEntity>,
    @InjectRepository(DeFiYieldEntity)
    private yieldRepository: Repository<DeFiYieldEntity>,
    private protocolFactory: ProtocolFactoryService,
    private riskAssessment: RiskAssessmentService,
    private yieldOptimizer: YieldOptimizerService,
    private smartContract: SmartContractService,
    private transactionSimulator: TransactionSimulatorService,
  ) {}

  /**
   * Create a new DeFi position
   */
  async createPosition(req: CreatePositionRequest): Promise<DeFiPosition> {
    try {
      this.logger.log(
        `Creating ${req.action} position for user ${req.userId} in ${req.protocol}`,
      );

      // Validate protocol exists
      const protocol = this.protocolFactory.getProtocol(req.protocol);
      const config = this.protocolFactory.getProtocolConfig(req.protocol);

      // Validate amount
      const minAmount = parseFloat(config.minAmount || '0');
      const maxAmount = parseFloat(config.maxAmount || 'Infinity');
      const amount = parseFloat(req.amount);

      if (amount < minAmount || amount > maxAmount) {
        throw new BadRequestException(
          `Amount ${req.amount} outside valid range [${minAmount}, ${maxAmount}]`,
        );
      }

      // Execute transaction based on action
      let txHash: string;
      switch (req.action) {
        case 'deposit':
          txHash = await protocol.deposit(req.token, req.amount, {
            referralCode: req.params?.referralCode,
          });
          break;
        case 'borrow':
          txHash = await protocol.borrow(req.token, req.amount, req.params);
          break;
        case 'stake':
          txHash = await protocol.deposit(req.token, req.amount, req.params);
          break;
        case 'farm':
          txHash = await protocol.deposit(req.token, req.amount, req.params);
          break;
        default:
          throw new BadRequestException(`Unknown action: ${req.action}`);
      }

      // Create database record
      const startTimestamp = Math.floor(Date.now() / 1000);
      const positionEntity = this.positionRepository.create({
        userId: req.userId,
        protocol: req.protocol,
        action: req.action,
        tokenIn: req.token,
        amountIn: req.amount,
        startTimestamp,
        status: 'active',
        transactionHash: txHash,
        metadata: req.params,
      });

      const saved = await this.positionRepository.save(positionEntity);

      // Fetch and return position data
      return this.getPosition(req.userId, saved.id);
    } catch (error) {
      this.logger.error(`Failed to create position: ${error}`);
      throw error;
    }
  }

  /**
   * Get a specific position
   */
  async getPosition(userId: string, positionId: string): Promise<DeFiPosition> {
    try {
      const entity = await this.positionRepository.findOne({
        where: { id: positionId, userId },
        relations: ['transactions', 'yieldHistory'],
      });

      if (!entity) {
        throw new BadRequestException(
          `Position not found: ${positionId}`,
        );
      }

      return this.mapEntityToPosition(entity);
    } catch (error) {
      this.logger.error(`Failed to get position: ${error}`);
      throw error;
    }
  }

  /**
   * Get all positions for a user
   */
  async getPositions(
    userId: string,
    filters?: PositionFilter,
  ): Promise<DeFiPosition[]> {
    try {
      let query = this.positionRepository
        .createQueryBuilder('position')
        .where('position.userId = :userId', { userId });

      if (filters?.protocol) {
        query = query.andWhere('position.protocol = :protocol', {
          protocol: filters.protocol,
        });
      }

      if (filters?.status) {
        query = query.andWhere('position.status = :status', {
          status: filters.status,
        });
      }

      if (filters?.minAPY) {
        query = query.andWhere('position.apy >= :minAPY', {
          minAPY: filters.minAPY,
        });
      }

      const entities = await query
        .leftJoinAndSelect('position.transactions', 'transactions')
        .leftJoinAndSelect('position.yieldHistory', 'yieldHistory')
        .orderBy('position.createdAt', 'DESC')
        .getMany();

      return entities.map((entity) => this.mapEntityToPosition(entity));
    } catch (error) {
      this.logger.error(`Failed to get positions: ${error}`);
      throw error;
    }
  }

  /**
   * Update position
   */
  async updatePosition(
    userId: string,
    positionId: string,
    updates: Partial<DeFiPositionEntity>,
  ): Promise<DeFiPosition> {
    try {
      const position = await this.positionRepository.findOne({
        where: { id: positionId, userId },
      });

      if (!position) {
        throw new BadRequestException(`Position not found: ${positionId}`);
      }

      await this.positionRepository.update(positionId, {
        ...updates,
        updatedAt: new Date(),
      });

      return this.getPosition(userId, positionId);
    } catch (error) {
      this.logger.error(`Failed to update position: ${error}`);
      throw error;
    }
  }

  /**
   * Close position
   */
  async closePosition(userId: string, positionId: string): Promise<string> {
    try {
      const position = await this.getPosition(userId, positionId);
      const protocol = this.protocolFactory.getProtocol(position.protocol);

      const txHash = await protocol.closePosition(positionId);

      await this.updatePosition(userId, positionId, {
        status: 'closed',
        endTimestamp: Math.floor(Date.now() / 1000),
      });

      return txHash;
    } catch (error) {
      this.logger.error(`Failed to close position: ${error}`);
      throw error;
    }
  }

  /**
   * Emergency exit from position
   */
  async emergencyExit(userId: string, positionId: string): Promise<string> {
    try {
      this.logger.warn(`Executing emergency exit for position ${positionId}`);

      const position = await this.getPosition(userId, positionId);
      const protocol = this.protocolFactory.getProtocol(position.protocol);

      // Force close with maximum slippage tolerance
      const txHash = await protocol.closePosition(positionId);

      await this.updatePosition(userId, positionId, {
        status: 'closed',
        endTimestamp: Math.floor(Date.now() / 1000),
        metadata: {
          ...position.metadata,
          emergencyExit: true,
        },
      });

      return txHash;
    } catch (error) {
      this.logger.error(`Emergency exit failed: ${error}`);
      throw error;
    }
  }

  /**
   * Simulate transaction
   */
  async simulateTransaction(
    req: TransactionSimulationRequest,
  ): Promise<TransactionSimulation> {
    try {
      const protocol = this.protocolFactory.getProtocol(req.protocol);
      return protocol.simulateTransaction(req.method, {
        from: req.from,
        to: req.to,
        value: req.value,
        data: req.data,
        ...req.params,
      });
    } catch (error) {
      this.logger.error(`Transaction simulation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute transaction
   */
  async executeTransaction(
    userId: string,
    req: ExecuteTransactionRequest,
  ): Promise<string> {
    try {
      // Simulate first if requested
      if (req.simulateFirst) {
        const simulation = await this.simulateTransaction({
          protocol: req.protocol,
          method: req.action,
          from: userId,
          to: req.token,
        });

        if (!simulation.success) {
          throw new Error(`Simulation failed: ${simulation.error}`);
        }
      }

      // Create position
      return (await this.createPosition(req)).id;
    } catch (error) {
      this.logger.error(`Transaction execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Optimize gas
   */
  async optimizeGas(
    req: TransactionSimulationRequest,
  ): Promise<TransactionSimulation> {
    try {
      return this.transactionSimulator.optimizeGasUsage(
        req,
      );
    } catch (error) {
      this.logger.error(`Gas optimization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(
    userId: string,
  ): Promise<DeFiPortfolioAnalytics> {
    try {
      const positions = await this.getPositions(userId, { status: 'active' });

      let totalValue = 0;
      let totalDeposited = 0;
      let totalBorrowed = 0;
      let totalEarned = 0;
      let totalAPY = 0;
      let riskScore = 0;
      const protocolBreakdown: Record<string, any> = {};

      for (const position of positions) {
        const amount = parseFloat(position.amountIn);
        totalDeposited += amount;

        if (position.borrowed) {
          totalBorrowed += parseFloat(position.borrowed);
        }

        if (position.apy) {
          totalAPY += position.apy * amount;
        }

        // Track by protocol
        if (!protocolBreakdown[position.protocol]) {
          protocolBreakdown[position.protocol] = {
            value: 0,
            positions: 0,
            percentage: 0,
          };
        }
        protocolBreakdown[position.protocol].value += amount;
        protocolBreakdown[position.protocol].positions += 1;
      }

      totalValue = totalDeposited - totalBorrowed;
      const netAPY = totalValue > 0 ? totalAPY / totalValue : 0;

      // Convert to array format
      const breakdown = Object.entries(protocolBreakdown).map(
        ([protocol, data]) => ({
          protocol,
          value: data.value.toString(),
          percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
          positions: data.positions,
        }),
      );

      return {
        totalValue: totalValue.toString(),
        totalDeposited: totalDeposited.toString(),
        totalBorrowed: totalBorrowed.toString(),
        totalEarned: totalEarned.toString(),
        netAPY: netAPY,
        protocolBreakdown: breakdown,
        riskScore: riskScore,
        positions: positions,
        healthFactor: 2.5,
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Get protocol analytics
   */
  async getProtocolAnalytics(protocol: string): Promise<ProtocolAnalytics> {
    try {
      // TODO: Query external data sources (subgraph, APIs)
      return {
        protocol,
        tvl: '50000000000',
        apy: 5.2,
        activeUsers: 125000,
        transactions24h: 450000,
        volume24h: '2500000000',
        risk: {
          score: 25,
          level: 'low',
          factors: ['Smart contract risk'],
          audits: [
            {
              firm: 'OpenZeppelin',
              date: '2023-01-15',
              report: 'https://example.com/audit',
            },
          ],
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get protocol analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Get risk assessment
   */
  async getRiskAssessment(userId: string): Promise<PortfolioRiskAssessment> {
    try {
      return this.riskAssessment.assessPortfolioRisk(userId);
    } catch (error) {
      this.logger.error(`Failed to assess risk: ${error}`);
      throw error;
    }
  }

  /**
   * Get yield strategies
   */
  async getYieldStrategies(
    filters?: StrategyFilter,
  ): Promise<YieldStrategy[]> {
    try {
      return this.yieldOptimizer.getStrategies(filters);
    } catch (error) {
      this.logger.error(`Failed to get strategies: ${error}`);
      throw error;
    }
  }

  /**
   * Recommend strategies
   */
  async recommendStrategies(
    userId: string,
    budget: string,
  ): Promise<StrategyRecommendation[]> {
    try {
      return this.yieldOptimizer.recommendStrategies(userId, budget);
    } catch (error) {
      this.logger.error(`Failed to recommend strategies: ${error}`);
      throw error;
    }
  }

  /**
   * Execute strategy
   */
  async executeStrategy(
    userId: string,
    strategyId: string,
  ): Promise<string> {
    try {
      // TODO: Implement multi-step strategy execution
      this.logger.log(`Executing strategy ${strategyId} for user ${userId}`);
      return 'strategy_execution_initiated';
    } catch (error) {
      this.logger.error(`Strategy execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get emergency exit plan
   */
  async getEmergencyExitPlan(
    userId: string,
    positionId: string,
  ): Promise<EmergencyExitPlan> {
    try {
      const position = await this.getPosition(userId, positionId);

      return {
        positionId,
        protocol: position.protocol,
        currentValue: position.amountIn,
        estimatedExecutionTime: 120,
        estimatedSlippage: 0.5,
        estimatedGas: '0.05',
        steps: [
          {
            order: 1,
            action: 'approve',
            description: 'Approve contract spending',
            timeEstimate: 30,
          },
          {
            order: 2,
            action: 'withdraw',
            description: 'Withdraw from protocol',
            timeEstimate: 60,
          },
          {
            order: 3,
            action: 'swap',
            description: 'Swap to stablecoin',
            timeEstimate: 30,
          },
        ],
        risks: [
          'Slippage during withdrawal',
          'Price volatility during execution',
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get exit plan: ${error}`);
      throw error;
    }
  }

  /**
   * Check liquidation risks
   */
  async checkLiquidationRisk(userId: string): Promise<LiquidationRisk[]> {
    try {
      const positions = await this.getPositions(userId, { status: 'active' });
      const risks: LiquidationRisk[] = [];

      for (const position of positions) {
        if (position.healthFactor && position.healthFactor < 1.5) {
          risks.push({
            positionId: position.id,
            protocol: position.protocol,
            riskLevel: position.healthFactor < 1.2 ? 'critical' : 'high',
            liquidationPrice: position.metadata?.liquidationPrice,
            currPrice: 1800,
            distance:
              ((1800 - (position.metadata?.liquidationPrice || 1800)) /
                1800) *
              100,
            timeEstimate: 3600,
          });
        }
      }

      return risks;
    } catch (error) {
      this.logger.error(`Failed to check liquidation risk: ${error}`);
      throw error;
    }
  }

  /**
   * Rebalance positions
   */
  async rebalancePositions(userId: string): Promise<PositionRebalance> {
    try {
      // TODO: Implement rebalancing logic
      return {
        fromPositionId: 'position_1',
        toProtocol: 'Aave',
        amount: '1000',
        expectedAPYImprovement: 0.5,
        executionSteps: ['Approve', 'Withdraw', 'Deposit'],
        estimatedCost: '0.1',
        riskAdjustment: -10,
      };
    } catch (error) {
      this.logger.error(`Failed to rebalance positions: ${error}`);
      throw error;
    }
  }

  /**
   * Helper method to map entity to DTO
   */
  private mapEntityToPosition(entity: DeFiPositionEntity): DeFiPosition {
    return {
      id: entity.id,
      protocol: entity.protocol,
      userAddress: entity.userId,
      tokenIn: entity.tokenIn,
      tokenOut: entity.tokenOut,
      action: entity.action,
      amountIn: entity.amountIn,
      amountOut: entity.amountOut,
      shares: entity.shares,
      startTimestamp: entity.startTimestamp,
      endTimestamp: entity.endTimestamp,
      status: entity.status,
      apy: entity.apy,
      riskLevel: entity.riskLevel,
      collateral: entity.collateral,
      borrowed: entity.borrowed,
      healthFactor: entity.healthFactor,
      metadata: entity.metadata,
    };
  }
}
