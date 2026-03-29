/**
 * DeFi Controller - API endpoints for DeFi operations
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DeFiService } from './services/defi.service';
import {
  CreateDeFiPositionDto,
  UpdateDeFiPositionDto,
  DeFiPositionResponseDto,
  TransactionSimulationDto,
  SimulationResponseDto,
  DeFiAnalyticsDto,
  ProtocolAnalyticsDto,
  RiskAssessmentDto,
  YieldStrategyDto,
  StrategyRecommendationDto,
  StrategyFilterDto,
  EmergencyExitDto,
  LiquidationRiskDto,
  PositionRebalanceDto,
  ExecuteTransactionDto,
  PositionFilterDto,
} from './dto/defi.dto';
import { ProtocolFactoryService } from './services/protocol-factory.service';

@ApiTags('DeFi Integration')
@ApiBearerAuth()
@Controller('defi')
export class DeFiController {
  constructor(
    private defiService: DeFiService,
    private protocolFactory: ProtocolFactoryService,
  ) {}

  /**
   * Get available protocols
   */
  @Get('protocols')
  @ApiOperation({ summary: 'Get list of available DeFi protocols' })
  @ApiResponse({
    status: 200,
    description: 'List of available protocols',
    schema: {
      type: 'object',
      properties: {
        protocols: { type: 'array', items: { type: 'string' } },
        stats: { type: 'object' },
      },
    },
  })
  getAvailableProtocols() {
    return {
      protocols: this.protocolFactory.getAvailableProtocols(),
      stats: this.protocolFactory.getProtocolStats(),
    };
  }

  /**
   * Create DeFi position
   */
  @Post('positions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new DeFi position' })
  @ApiResponse({
    status: 201,
    description: 'Position created successfully',
    type: DeFiPositionResponseDto,
  })
  async createPosition(
    @Request() req: any,
    @Body() dto: CreateDeFiPositionDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.createPosition({
      ...dto,
      userId,
    });
  }

  /**
   * Get user's positions
   */
  @Get('positions')
  @ApiOperation({ summary: 'Get all DeFi positions for user' })
  @ApiResponse({
    status: 200,
    description: 'List of positions',
    type: [DeFiPositionResponseDto],
  })
  async getPositions(
    @Request() req: any,
    @Query() filters: PositionFilterDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.getPositions(userId, filters);
  }

  /**
   * Get specific position
   */
  @Get('positions/:id')
  @ApiOperation({ summary: 'Get details of a specific position' })
  @ApiResponse({
    status: 200,
    description: 'Position details',
    type: DeFiPositionResponseDto,
  })
  async getPosition(
    @Request() req: any,
    @Param('id') positionId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.getPosition(userId, positionId);
  }

  /**
   * Update position
   */
  @Put('positions/:id')
  @ApiOperation({ summary: 'Update a DeFi position' })
  @ApiResponse({
    status: 200,
    description: 'Position updated successfully',
    type: DeFiPositionResponseDto,
  })
  async updatePosition(
    @Request() req: any,
    @Param('id') positionId: string,
    @Body() dto: UpdateDeFiPositionDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.updatePosition(userId, positionId, dto);
  }

  /**
   * Close position
   */
  @Delete('positions/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Close a DeFi position' })
  @ApiResponse({
    status: 200,
    description: 'Position closed successfully',
    schema: { type: 'object', properties: { txHash: { type: 'string' } } },
  })
  async closePosition(
    @Request() req: any,
    @Param('id') positionId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    const txHash = await this.defiService.closePosition(
      userId,
      positionId,
    );
    return { txHash };
  }

  /**
   * Emergency exit
   */
  @Post('positions/:id/emergency-exit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Perform emergency exit from position' })
  @ApiResponse({
    status: 200,
    description: 'Emergency exit initiated',
    schema: { type: 'object', properties: { txHash: { type: 'string' } } },
  })
  async emergencyExit(
    @Request() req: any,
    @Param('id') positionId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    const txHash = await this.defiService.emergencyExit(
      userId,
      positionId,
    );
    return { txHash };
  }

  /**
   * Get emergency exit plan
   */
  @Get('positions/:id/emergency-plan')
  @ApiOperation({ summary: 'Get emergency exit plan for position' })
  @ApiResponse({
    status: 200,
    description: 'Emergency exit plan',
    type: EmergencyExitDto,
  })
  async getEmergencyExitPlan(
    @Request() req: any,
    @Param('id') positionId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.getEmergencyExitPlan(
      userId,
      positionId,
    );
  }

  /**
   * Simulate transaction
   */
  @Post('simulate')
  @ApiOperation({ summary: 'Simulate a DeFi transaction' })
  @ApiResponse({
    status: 200,
    description: 'Transaction simulation result',
    type: SimulationResponseDto,
  })
  async simulateTransaction(
    @Body() dto: TransactionSimulationDto,
  ) {
    return this.defiService.simulateTransaction(dto);
  }

  /**
   * Optimize gas
   */
  @Post('optimize-gas')
  @ApiOperation({ summary: 'Optimize gas for transaction' })
  @ApiResponse({
    status: 200,
    description: 'Optimized gas estimate',
    type: SimulationResponseDto,
  })
  async optimizeGas(
    @Body() dto: TransactionSimulationDto,
  ) {
    return this.defiService.optimizeGas(dto);
  }

  /**
   * Execute transaction
   */
  @Post('execute')
  @HttpCode(201)
  @ApiOperation({ summary: 'Execute a DeFi transaction' })
  @ApiResponse({
    status: 201,
    description: 'Transaction executed',
    schema: { type: 'object', properties: { positionId: { type: 'string' } } },
  })
  async executeTransaction(
    @Request() req: any,
    @Body() dto: ExecuteTransactionDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    const positionId = await this.defiService.executeTransaction(
      userId,
      {
        ...dto,
        userId,
      },
    );

    return { positionId };
  }

  /**
   * Get portfolio analytics
   */
  @Get('analytics/portfolio')
  @ApiOperation({ summary: 'Get DeFi portfolio analytics' })
  @ApiResponse({
    status: 200,
    description: 'Portfolio analytics',
    type: DeFiAnalyticsDto,
  })
  async getPortfolioAnalytics(
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.getPortfolioAnalytics(userId);
  }

  /**
   * Get protocol analytics
   */
  @Get('analytics/protocol/:name')
  @ApiOperation({ summary: 'Get analytics for a specific protocol' })
  @ApiResponse({
    status: 200,
    description: 'Protocol analytics',
    type: ProtocolAnalyticsDto,
  })
  async getProtocolAnalytics(
    @Param('name') protocol: string,
  ) {
    return this.defiService.getProtocolAnalytics(protocol);
  }

  /**
   * Get risk assessment
   */
  @Get('risk-assessment')
  @ApiOperation({ summary: 'Get portfolio risk assessment' })
  @ApiResponse({
    status: 200,
    description: 'Risk assessment',
    type: RiskAssessmentDto,
  })
  async getRiskAssessment(
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.getRiskAssessment(userId);
  }

  /**
   * Check liquidation risks
   */
  @Get('risk-assessment/liquidation')
  @ApiOperation({ summary: 'Check liquidation risks' })
  @ApiResponse({
    status: 200,
    description: 'Liquidation risks',
    type: [LiquidationRiskDto],
  })
  async checkLiquidationRisk(
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.checkLiquidationRisk(userId);
  }

  /**
   * Get yield strategies
   */
  @Get('strategies')
  @ApiOperation({ summary: 'Get available yield strategies' })
  @ApiResponse({
    status: 200,
    description: 'List of strategies',
    type: [YieldStrategyDto],
  })
  async getStrategies(
    @Query() filters: StrategyFilterDto,
  ) {
    return this.defiService.getYieldStrategies(filters);
  }

  /**
   * Get recommended strategies
   */
  @Get('strategies/recommendations')
  @ApiOperation({ summary: 'Get recommended strategies for user' })
  @ApiResponse({
    status: 200,
    description: 'Recommended strategies',
    type: [StrategyRecommendationDto],
  })
  async getRecommendedStrategies(
    @Request() req: any,
    @Query('budget') budget: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    if (!budget) {
      throw new BadRequestException('Budget parameter required');
    }

    return this.defiService.recommendStrategies(userId, budget);
  }

  /**
   * Execute strategy
   */
  @Post('strategies/:id/execute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Execute a yield strategy' })
  @ApiResponse({
    status: 200,
    description: 'Strategy execution initiated',
    schema: { type: 'object', properties: { executionId: { type: 'string' } } },
  })
  async executeStrategy(
    @Request() req: any,
    @Param('id') strategyId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    const executionId = await this.defiService.executeStrategy(
      userId,
      strategyId,
    );

    return { executionId };
  }

  /**
   * Rebalance positions
   */
  @Post('rebalance')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rebalance DeFi positions' })
  @ApiResponse({
    status: 200,
    description: 'Rebalancing plan',
    type: PositionRebalanceDto,
  })
  async rebalancePositions(
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }

    return this.defiService.rebalancePositions(userId);
  }
}
