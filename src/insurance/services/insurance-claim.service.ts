import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InsuranceClaim,
  ClaimStatus,
  ClaimReason,
} from '../entities/insurance-claim.entity';
import { InsuranceFund } from '../entities/insurance-fund.entity';
import { CreateClaimDto } from '../dto/insurance-claim.dto';

@Injectable()
export class InsuranceClaimService {
  private readonly logger = new Logger(InsuranceClaimService.name);

  constructor(
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    @InjectRepository(InsuranceFund)
    private readonly fundRepository: Repository<InsuranceFund>,
  ) {}

  /**
   * Submit a new insurance claim
   */
  async submitClaim(fundId: number, createDto: CreateClaimDto): Promise<InsuranceClaim> {
    const fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Insurance fund not found: ${fundId}`);
    }

    if (createDto.originalLoss <= 0) {
      throw new BadRequestException('Original loss must be positive');
    }

    // Calculate coverage amount
    const maxCoverage = (createDto.originalLoss * fund.coverageRatio) / 100;
    const coverageAmount = Math.min(maxCoverage, fund.balance);

    if (coverageAmount === 0) {
      throw new BadRequestException('Fund has insufficient balance to cover any portion of this loss');
    }

    const claim = this.claimRepository.create({
      ...createDto,
      fund,
      status: ClaimStatus.PENDING,
      coverageAmount,
      uncoveredLoss: createDto.originalLoss - coverageAmount,
      coveragePercentage: (coverageAmount / createDto.originalLoss) * 100,
      submittedAt: new Date(),
    });

    return await this.claimRepository.save(claim);
  }

  /**
   * Get claim by ID
   */
  async getClaimById(claimId: number): Promise<InsuranceClaim> {
    const claim = await this.claimRepository.findOne({
      where: { id: claimId },
      relations: ['fund', 'liquidationEvent'],
    });

    if (!claim) {
      throw new NotFoundException(`Claim not found: ${claimId}`);
    }

    return claim;
  }

  /**
   * Approve a claim
   */
  async approveClaim(
    claimId: number,
    approverUserId: number,
    approvalNotes?: string,
  ): Promise<InsuranceClaim> {
    const claim = await this.getClaimById(claimId);

    if (claim.status !== ClaimStatus.PENDING) {
      throw new ConflictException(`Claim already processed with status: ${claim.status}`);
    }

    if (claim.fund.balance < claim.coverageAmount) {
      throw new BadRequestException('Insufficient fund balance for approved coverage amount');
    }

    claim.status = ClaimStatus.APPROVED;
    claim.approverUserId = approverUserId;
    claim.approvalNotes = approvalNotes;
    claim.approvedAt = new Date();

    return await this.claimRepository.save(claim);
  }

  /**
   * Process payout for approved claim
   */
  async payoutClaim(claimId: number, operatorId: number): Promise<InsuranceClaim> {
    const claim = await this.getClaimById(claimId);

    if (claim.status !== ClaimStatus.APPROVED) {
      throw new ConflictException(`Claim must be approved before payout. Current status: ${claim.status}`);
    }

    const fund = claim.fund;

    if (fund.balance < claim.coverageAmount) {
      throw new BadRequestException('Insufficient fund balance for payout');
    }

    // Process payout
    fund.balance -= claim.coverageAmount;
    fund.totalPayouts += claim.coverageAmount;
    fund.claimCount++;

    claim.status = ClaimStatus.PAID;
    claim.paidAt = new Date();
    claim.paidAmount = claim.coverageAmount;

    await this.fundRepository.save(fund);
    return await this.claimRepository.save(claim);
  }

  /**
   * Reject a claim
   */
  async rejectClaim(
    claimId: number,
    rejector: number,
    reason: string,
  ): Promise<InsuranceClaim> {
    const claim = await this.getClaimById(claimId);

    if (claim.status !== ClaimStatus.PENDING) {
      throw new ConflictException(`Cannot reject claim with status: ${claim.status}`);
    }

    claim.status = ClaimStatus.REJECTED;
    claim.rejectionReason = reason;
    claim.approverUserId = rejector;
    claim.approvedAt = new Date(); // Record time of decision

    return await this.claimRepository.save(claim);
  }

  /**
   * Cancel a claim
   */
  async cancelClaim(claimId: number, reason: string): Promise<InsuranceClaim> {
    const claim = await this.getClaimById(claimId);

    if (claim.status === ClaimStatus.PAID || claim.status === ClaimStatus.CANCELLED) {
      throw new ConflictException(`Cannot cancel claim with status: ${claim.status}`);
    }

    claim.status = ClaimStatus.CANCELLED;
    claim.rejectionReason = reason;

    return await this.claimRepository.save(claim);
  }

  /**
   * Get all claims for a fund
   */
  async getFundClaims(
    fundId: number,
    status?: ClaimStatus,
    limit: number = 100,
    offset: number = 0,
  ): Promise<InsuranceClaim[]> {
    const query = this.claimRepository.createQueryBuilder('c').where('c.fund.id = :fundId', {
      fundId,
    });

    if (status) {
      query.andWhere('c.status = :status', { status });
    }

    return await query
      .orderBy('c.submittedAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();
  }

  /**
   * Get user claim history
   */
  async getUserClaimHistory(fundId: number, userId: number): Promise<InsuranceClaim[]> {
    return await this.claimRepository.find({
      where: {
        fund: { id: fundId },
        claimantUserId: userId,
      },
      order: { submittedAt: 'DESC' },
      relations: ['fund'],
    });
  }

  /**
   * Get claims by reason
   */
  async getClaimsByReason(fundId: number, reason: ClaimReason): Promise<InsuranceClaim[]> {
    return await this.claimRepository.find({
      where: {
        fund: { id: fundId },
        claimReason: reason,
      },
      order: { submittedAt: 'DESC' },
    });
  }

  /**
   * Calculate total pending claims value
   */
  async calculatePendingClaimsValue(fundId: number): Promise<number> {
    const result = await this.claimRepository
      .createQueryBuilder('c')
      .select('SUM(c.coverageAmount)', 'total')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status = :status', { status: ClaimStatus.PENDING })
      .getRawOne();

    return result?.total || 0;
  }

  /**
   * Calculate total paid out claims
   */
  async calculateTotalPaidClaims(fundId: number): Promise<number> {
    const result = await this.claimRepository
      .createQueryBuilder('c')
      .select('SUM(c.paidAmount)', 'total')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status = :status', { status: ClaimStatus.PAID })
      .getRawOne();

    return result?.total || 0;
  }

  /**
   * Get claim statistics
   */
  async getClaimStats(fundId: number): Promise<{
    totalClaims: number;
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
    rejectedCount: number;
    cancelledCount: number;
    totalOriginalLoss: number;
    totalCoverageAmount: number;
    totalUncoveredLoss: number;
    averageCoveragePercentage: number;
  }> {
    const claims = await this.claimRepository.find({
      where: { fund: { id: fundId } },
    });

    const stats = {
      totalClaims: claims.length,
      pendingCount: 0,
      approvedCount: 0,
      paidCount: 0,
      rejectedCount: 0,
      cancelledCount: 0,
      totalOriginalLoss: 0,
      totalCoverageAmount: 0,
      totalUncoveredLoss: 0,
      averageCoveragePercentage: 0,
    };

    for (const claim of claims) {
      if (claim.status === ClaimStatus.PENDING) stats.pendingCount++;
      if (claim.status === ClaimStatus.APPROVED) stats.approvedCount++;
      if (claim.status === ClaimStatus.PAID) stats.paidCount++;
      if (claim.status === ClaimStatus.REJECTED) stats.rejectedCount++;
      if (claim.status === ClaimStatus.CANCELLED) stats.cancelledCount++;

      stats.totalOriginalLoss += claim.originalLoss;
      stats.totalCoverageAmount += claim.coverageAmount;
      stats.totalUncoveredLoss += claim.uncoveredLoss;
      stats.averageCoveragePercentage += claim.coveragePercentage;
    }

    if (stats.totalClaims > 0) {
      stats.averageCoveragePercentage = stats.averageCoveragePercentage / stats.totalClaims;
    }

    return stats;
  }

  /**
   * Get high-value claims (above threshold)
   */
  async getHighValueClaims(fundId: number, threshold: number): Promise<InsuranceClaim[]> {
    return await this.claimRepository.find({
      where: {
        fund: { id: fundId },
      },
      order: { coverageAmount: 'DESC' },
    }).then(claims => claims.filter(c => c.coverageAmount >= threshold));
  }

  /**
   * Get recent claims for monitoring
   */
  async getRecentClaims(fundId: number, hoursBack: number = 24): Promise<InsuranceClaim[]> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    return await this.claimRepository
      .createQueryBuilder('c')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.submittedAt >= :since', { since })
      .orderBy('c.submittedAt', 'DESC')
      .getMany();
  }

  /**
   * Calculate average claim coverage
   */
  async getAverageCoverage(fundId: number): Promise<number> {
    const result = await this.claimRepository
      .createQueryBuilder('c')
      .select('AVG(c.coveragePercentage)', 'avgCoverage')
      .where('c.fund.id = :fundId', { fundId })
      .getRawOne();

    return result?.avgCoverage || 0;
  }

  /**
   * Get total uncovered losses
   */
  async getTotalUncoveredLosses(fundId: number): Promise<number> {
    const result = await this.claimRepository
      .createQueryBuilder('c')
      .select('SUM(c.uncoveredLoss)', 'total')
      .where('c.fund.id = :fundId', { fundId })
      .andWhere('c.status IN (:...statuses)', {
        statuses: [ClaimStatus.PAID, ClaimStatus.APPROVED],
      })
      .getRawOne();

    return result?.total || 0;
  }

  /**
   * Check if specific loss type claims have been made
   */
  async hasClaimsByReason(fundId: number, reason: ClaimReason): Promise<boolean> {
    const count = await this.claimRepository.count({
      where: {
        fund: { id: fundId },
        claimReason: reason,
      },
    });

    return count > 0;
  }

  /**
   * Batch approve pending claims up to available balance
   */
  async batchApproveClaims(fundId: number, approverUserId: number): Promise<number> {
    let fund = await this.fundRepository.findOne({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund not found: ${fundId}`);
    }

    const pendingClaims = await this.claimRepository.find({
      where: {
        fund: { id: fundId },
        status: ClaimStatus.PENDING,
      },
      order: { submittedAt: 'ASC' }, // FIFO
    });

    let approvedCount = 0;
    let remainingBalance = fund.balance;

    for (const claim of pendingClaims) {
      if (remainingBalance >= claim.coverageAmount) {
        await this.approveClaim(claim.id, approverUserId, 'Batch approved');
        remainingBalance -= claim.coverageAmount;
        approvedCount++;
      }
    }

    if (approvedCount > 0) {
      this.logger.log(`Batch approved ${approvedCount} claims for fund ${fundId}`);
    }

    return approvedCount;
  }
}
