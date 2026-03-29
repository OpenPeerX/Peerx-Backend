import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceFund, FundStatus, FundType } from '../entities/insurance-fund.entity';
import { CreateInsuranceFundDto, UpdateInsuranceFundDto } from '../dto/insurance-fund.dto';

@Injectable()
export class InsuranceFundService {
  private readonly logger = new Logger(InsuranceFundService.name);

  constructor(
    @InjectRepository(InsuranceFund)
    private readonly fundRepository: Repository<InsuranceFund>,
  ) {}

  /**
   * Create a new insurance fund
   */
  async createFund(createDto: CreateInsuranceFundDto): Promise<InsuranceFund> {
    // Check if primary fund already exists
    if (createDto.fundType === FundType.PRIMARY) {
      const existing = await this.fundRepository.findOne({
        where: { fundType: FundType.PRIMARY },
      });
      if (existing) {
        throw new ConflictException('Primary insurance fund already exists');
      }
    }

    const fund = this.fundRepository.create({
      ...createDto,
      status: FundStatus.ACTIVE,
      balance: 0,
      totalContributions: 0,
      totalPayouts: 0,
      coverageRatio: createDto.coverageRatio || 75, // Default 75% coverage
      contributionRate: createDto.contributionRate || 0.001, // Default 0.1%
      autoRefillEnabled: createDto.autoRefillEnabled || false,
    });

    return await this.fundRepository.save(fund);
  }

  /**
   * Get fund by ID
   */
  async getFundById(fundId: number): Promise<InsuranceFund> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Insurance fund not found: ${fundId}`);
    }

    return fund;
  }

  /**
   * Get primary fund
   */
  async getPrimaryFund(): Promise<InsuranceFund> {
    const fund = await this.fundRepository.findOne({
      where: { fundType: FundType.PRIMARY },
    });

    if (!fund) {
      throw new NotFoundException('Primary insurance fund not found');
    }

    return fund;
  }

  /**
   * Get all funds
   */
  async getAllFunds(): Promise<InsuranceFund[]> {
    return await this.fundRepository.find({
      order: { fundType: 'ASC', createdAt: 'DESC' },
    });
  }

  /**
   * Update fund configuration
   */
  async updateFund(fundId: number, updateDto: UpdateInsuranceFundDto): Promise<InsuranceFund> {
    const fund = await this.getFundById(fundId);

    Object.assign(fund, updateDto);

    return await this.fundRepository.save(fund);
  }

  /**
   * Deposit to fund
   */
  async depositToFund(fundId: number, amount: number): Promise<InsuranceFund> {
    if (amount <= 0) {
      throw new BadRequestException('Deposit amount must be positive');
    }

    const fund = await this.getFundById(fundId);

    fund.balance += amount;
    fund.totalContributions += amount;

    return await this.fundRepository.save(fund);
  }

  /**
   * Withdraw from fund
   */
  async withdrawFromFund(fundId: number, amount: number): Promise<InsuranceFund> {
    const fund = await this.getFundById(fundId);

    if (amount > fund.balance) {
      throw new BadRequestException('Insufficient fund balance');
    }

    fund.balance -= amount;

    return await this.fundRepository.save(fund);
  }

  /**
   * Pay out claim from fund
   */
  async payoutClaim(fundId: number, claimAmount: number, claimId: number): Promise<InsuranceFund> {
    const fund = await this.getFundById(fundId);

    if (claimAmount > fund.balance) {
      throw new BadRequestException('Insufficient fund balance for payout');
    }

    fund.balance -= claimAmount;
    fund.totalPayouts += claimAmount;
    fund.claimCount++;

    return await this.fundRepository.save(fund);
  }

  /**
   * Mark liquidation as covered
   */
  async recordLiquidationCoverage(fundId: number): Promise<InsuranceFund> {
    const fund = await this.getFundById(fundId);
    fund.liquidationsCovered++;
    return await this.fundRepository.save(fund);
  }

  /**
   * Check if fund balance is below minimum
   */
  isLowBalance(fund: InsuranceFund): boolean {
    return fund.balance < fund.minimumBalance;
  }

  /**
   * Check if fund needs auto-refill
   */
  needsAutoRefill(fund: InsuranceFund): boolean {
    return (
      fund.autoRefillEnabled &&
      fund.balance < fund.targetBalance &&
      fund.balance < fund.minimumBalance
    );
  }

  /**
   * Check if fund is in emergency state
   */
  isEmergencyState(fund: InsuranceFund): boolean {
    const criticalLevel = fund.targetBalance * 0.1; // 10% of target
    return fund.balance < criticalLevel;
  }

  /**
   * Calculate max potential coverage
   */
  getMaxCoverage(fund: InsuranceFund, loss: number): number {
    const maxAllowed = (loss * fund.coverageRatio) / 100;
    return Math.min(maxAllowed, fund.balance);
  }

  /**
   * Calculate funding level (balance as % of target)
   */
  getFundingLevel(fund: InsuranceFund): number {
    if (fund.targetBalance === 0) return 100;
    return (fund.balance / fund.targetBalance) * 100;
  }

  /**
   * Pause fund (stop accepting contributions and payouts)
   */
  async pauseFund(fundId: number): Promise<InsuranceFund> {
    const fund = await this.getFundById(fundId);
    fund.status = FundStatus.PAUSED;
    return await this.fundRepository.save(fund);
  }

  /**
   * Resume fund
   */
  async resumeFund(fundId: number): Promise<InsuranceFund> {
    const fund = await this.getFundById(fundId);
    if (fund.status === FundStatus.DEPLETED) {
      fund.status = FundStatus.RECOVERING;
    } else {
      fund.status = FundStatus.ACTIVE;
    }
    return await this.fundRepository.save(fund);
  }

  /**
   * Mark fund as depleted
   */
  async markDepleted(fundId: number): Promise<InsuranceFund> {
    const fund = await this.getFundById(fundId);
    fund.status = FundStatus.DEPLETED;
    this.logger.warn(`Insurance fund ${fundId} marked as DEPLETED`);
    return await this.fundRepository.save(fund);
  }

  /**
   * Get fund status summary
   */
  async getFundStatus(fundId: number): Promise<{
    fundId: number;
    status: FundStatus;
    balance: number;
    minimumBalance: number;
    isLow: boolean;
    fundingLevel: number;
    coverageCapacity: number;
  }> {
    const fund = await this.getFundById(fundId);

    return {
      fundId: fund.id,
      status: fund.status,
      balance: fund.balance,
      minimumBalance: fund.minimumBalance,
      isLow: this.isLowBalance(fund),
      fundingLevel: this.getFundingLevel(fund),
      coverageCapacity: fund.balance,
    };
  }

  /**
   * Calculate contribution base on trade volume
   */
  calculateContribution(tradeVolume: number, contributionRate: number): number {
    return tradeVolume * contributionRate;
  }

  /**
   * Check if fund can cover loss
   */
  canCoverLoss(fund: InsuranceFund, loss: number): boolean {
    const maxCoverage = this.getMaxCoverage(fund, loss);
    return maxCoverage > 0;
  }

  /**
   * Get all funds statistics
   */
  async getStatistics(): Promise<{
    totalFunds: number;
    totalBalance: number;
    totalContributions: number;
    totalPayouts: number;
    averageHealth: string;
  }> {
    const funds = await this.getAllFunds();

    const totalBalance = funds.reduce((sum, f) => sum + parseFloat(f.balance.toString()), 0);
    const totalContributions = funds.reduce(
      (sum, f) => sum + parseFloat(f.totalContributions.toString()),
      0,
    );
    const totalPayouts = funds.reduce((sum, f) => sum + parseFloat(f.totalPayouts.toString()), 0);

    let healthyCount = 0;
    for (const fund of funds) {
      if (fund.status === FundStatus.ACTIVE && !this.isLowBalance(fund)) {
        healthyCount++;
      }
    }

    const averageHealth =
      funds.length > 0
        ? ((healthyCount / funds.length) * 100).toFixed(1)
        : '0';

    return {
      totalFunds: funds.length,
      totalBalance,
      totalContributions,
      totalPayouts,
      averageHealth: `${averageHealth}%`,
    };
  }
}
