import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InsuranceContribution,
  ContributionType,
  ContributionStatus,
} from '../entities/insurance-contribution.entity';
import { InsuranceFund } from '../entities/insurance-fund.entity';
import { CreateContributionDto } from '../dto/insurance-contribution.dto';

@Injectable()
export class InsuranceContributionService {
  private readonly logger = new Logger(InsuranceContributionService.name);

  constructor(
    @InjectRepository(InsuranceContribution)
    private readonly contributionRepository: Repository<InsuranceContribution>,
    @InjectRepository(InsuranceFund)
    private readonly fundRepository: Repository<InsuranceFund>,
  ) {}

  /**
   * Record a contribution to the insurance fund
   */
  async recordContribution(
    fundId: number,
    createDto: CreateContributionDto,
  ): Promise<InsuranceContribution> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Insurance fund not found: ${fundId}`);
    }

    if (createDto.amount <= 0) {
      throw new BadRequestException('Contribution amount must be positive');
    }

    const contribution = this.contributionRepository.create({
      ...createDto,
      fund,
      status: ContributionStatus.PENDING,
      recordedAt: new Date(),
    });

    return await this.contributionRepository.save(contribution);
  }

  /**
   * Calculate and record TRADE_VOLUME contribution
   */
  async recordTradeContribution(
    fundId: number,
    tradeVolume: number,
    userId: number,
    tradeId: number,
    contributionRate: number,
  ): Promise<InsuranceContribution> {
    const amount = tradeVolume * contributionRate;

    if (amount <= 0) {
      throw new BadRequestException('Calculated contribution must be positive');
    }

    return await this.recordContribution(fundId, {
      fundId,
      contributionType: ContributionType.TRADE_VOLUME,
      amount,
      sourceUserId: userId,
      sourceTradeId: tradeId,
      description: `Automatic contribution from trade (volume: ${tradeVolume.toFixed(2)})`,
    });
  }

  /**
   * Record manual contribution
   */
  async recordManualContribution(
    fundId: number,
    amount: number,
    userId: number,
    reason: string,
  ): Promise<InsuranceContribution> {
    return await this.recordContribution(fundId, {
      fundId,
      contributionType: ContributionType.MANUAL,
      amount,
      sourceUserId: userId,
      description: reason,
    });
  }

  /**
   * Record protocol revenue contribution
   */
  async recordProtocolRevenueContribution(
    fundId: number,
    amount: number,
    percentage: number,
  ): Promise<InsuranceContribution> {
    return await this.recordContribution(fundId, {
      fundId,
      contributionType: ContributionType.PROTOCOL_REVENUE,
      amount,
      description: `Protocol revenue allocation (${percentage.toFixed(2)}%)`,
    });
  }

  /**
   * Record interest earned on fund
   */
  async recordInterestContribution(
    fundId: number,
    amount: number,
    sourcePool: string,
  ): Promise<InsuranceContribution> {
    return await this.recordContribution(fundId, {
      fundId,
      contributionType: ContributionType.INTEREST,
      amount,
      description: `Interest earned from ${sourcePool || 'lending pool'}`,
    });
  }

  /**
   * Record penalty distribution to fund
   */
  async recordPenaltyContribution(
    fundId: number,
    amount: number,
    userId: number,
    penaltyReason: string,
  ): Promise<InsuranceContribution> {
    return await this.recordContribution(fundId, {
      fundId,
      contributionType: ContributionType.PENALTY,
      amount,
      sourceUserId: userId,
      description: `Penalty distribution: ${penaltyReason}`,
    });
  }

  /**
   * Approve a pending contribution
   */
  async approveContribution(contributionId: number): Promise<InsuranceContribution> {
    const contribution = await this.contributionRepository.findOne({
      where: { id: contributionId },
      relations: ['fund'],
    });

    if (!contribution) {
      throw new NotFoundException(`Contribution not found: ${contributionId}`);
    }

    if (contribution.status !== ContributionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve contribution with status: ${contribution.status}`,
      );
    }

    contribution.status = ContributionStatus.APPROVED;
    contribution.approvedAt = new Date();

    // Add to fund balance
    if (contribution.fund) {
      contribution.fund.balance += contribution.amount;
      await this.fundRepository.save(contribution.fund);
    }

    return await this.contributionRepository.save(contribution);
  }

  /**
   * Reject a contribution
   */
  async rejectContribution(
    contributionId: number,
    reason: string,
  ): Promise<InsuranceContribution> {
    const contribution = await this.contributionRepository.findOne({
      where: { id: contributionId },
    });

    if (!contribution) {
      throw new NotFoundException(`Contribution not found: ${contributionId}`);
    }

    if (contribution.status !== ContributionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject contribution with status: ${contribution.status}`,
      );
    }

    contribution.status = ContributionStatus.REJECTED;
    contribution.rejectionReason = reason;

    return await this.contributionRepository.save(contribution);
  }

  /**
   * Batch approve pending contributions
   */
  async batchApproveContributions(fundId: number): Promise<number> {
    const contributions = await this.contributionRepository.find({
      where: {
        fund: { id: fundId },
        status: ContributionStatus.PENDING,
      },
      relations: ['fund'],
    });

    let approvedCount = 0;
    let totalAmount = 0;

    for (const contribution of contributions) {
      contribution.status = ContributionStatus.APPROVED;
      contribution.approvedAt = new Date();
      totalAmount += contribution.amount;
      approvedCount++;
    }

    if (approvedCount > 0) {
      await this.contributionRepository.save(contributions);

      // Update fund balance
      const fund = await this.fundRepository.findOne({
        where: { id: fundId },
      });

      if (fund) {
        fund.balance += totalAmount;
        await this.fundRepository.save(fund);
        this.logger.log(
          `Batch approved ${approvedCount} contributions for fund ${fundId}, added ${totalAmount.toFixed(8)}`,
        );
      }
    }

    return approvedCount;
  }

  /**
   * Get contribution by ID
   */
  async getContributionById(contributionId: number): Promise<InsuranceContribution> {
    const contribution = await this.contributionRepository.findOne({
      where: { id: contributionId },
      relations: ['fund'],
    });

    if (!contribution) {
      throw new NotFoundException(`Contribution not found: ${contributionId}`);
    }

    return contribution;
  }

  /**
   * Get all contributions for a fund
   */
  async getFundContributions(
    fundId: number,
    status?: ContributionStatus,
    limit: number = 100,
    offset: number = 0,
  ): Promise<InsuranceContribution[]> {
    const query = this.contributionRepository.createQueryBuilder('c').where('c.fund.id = :fundId', {
      fundId,
    });

    if (status) {
      query.andWhere('c.status = :status', { status });
    }

    return await query
      .orderBy('c.recordedAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();
  }

  /**
   * Get contributions by type
   */
  async getContributionsByType(
    fundId: number,
    contributionType: ContributionType,
  ): Promise<InsuranceContribution[]> {
    return await this.contributionRepository.find({
      where: {
        fund: { id: fundId },
        contributionType,
      },
      order: { recordedAt: 'DESC' },
    });
  }

  /**
   * Calculate total pending contributions
   */
  async calculatePendingContributions(fundId: number): Promise<number> {
    const result = await this.contributionRepository
      .createQueryBuilder('c')
      .select('SUM(c.amount)', 'total')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status = :status', { status: ContributionStatus.PENDING })
      .getRawOne();

    return result?.total || 0;
  }

  /**
   * Calculate total approved contributions
   */
  async calculateApprovedContributions(fundId: number): Promise<number> {
    const result = await this.contributionRepository
      .createQueryBuilder('c')
      .select('SUM(c.amount)', 'total')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status = :status', { status: ContributionStatus.APPROVED })
      .getRawOne();

    return result?.total || 0;
  }

  /**
   * Get contribution statistics for fund
   */
  async getContributionStats(fundId: number): Promise<{
    totalContributions: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    totalPending: number;
    totalApproved: number;
    contributionsByType: Record<string, number>;
  }> {
    const contributions = await this.contributionRepository.find({
      where: { fund: { id: fundId } },
    });

    const stats = {
      totalContributions: contributions.length,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      totalPending: 0,
      totalApproved: 0,
      contributionsByType: {} as Record<string, number>,
    };

    for (const contrib of contributions) {
      if (contrib.status === ContributionStatus.PENDING) {
        stats.pendingCount++;
        stats.totalPending += contrib.amount;
      } else if (contrib.status === ContributionStatus.APPROVED) {
        stats.approvedCount++;
        stats.totalApproved += contrib.amount;
      } else if (contrib.status === ContributionStatus.REJECTED) {
        stats.rejectedCount++;
      }

      if (!stats.contributionsByType[contrib.contributionType]) {
        stats.contributionsByType[contrib.contributionType] = 0;
      }
      stats.contributionsByType[contrib.contributionType] += contrib.amount;
    }

    return stats;
  }

  /**
   * Get user's contribution history
   */
  async getUserContributionHistory(
    fundId: number,
    userId: number,
  ): Promise<InsuranceContribution[]> {
    return await this.contributionRepository.find({
      where: {
        fund: { id: fundId },
        sourceUserId: userId,
      },
      order: { recordedAt: 'DESC' },
    });
  }

  /**
   * Calculate total user contributions
   */
  async calculateUserTotalContributions(fundId: number, userId: number): Promise<number> {
    const result = await this.contributionRepository
      .createQueryBuilder('c')
      .select('SUM(c.amount)', 'total')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.sourceUserId = :userId', { userId })
      .andWhere('c.status = :status', { status: ContributionStatus.APPROVED })
      .getRawOne();

    return result?.total || 0;
  }
}
