import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../platform/audit.service';
import { MobileCacheService } from '../platform/mobile-cache.service';
import { CreateLiquidityPoolDto } from './dto/create-liquidity-pool.dto';
import { CreateLiquidityProgramDto } from './dto/create-liquidity-program.dto';
import { StakeLiquidityDto } from './dto/stake-liquidity.dto';
import { LiquidityMiningProgram, LiquidityProgramStatus } from './entities/liquidity-mining-program.entity';
import { LiquidityPool } from './entities/liquidity-pool.entity';
import { LiquidityRewardLedger } from './entities/liquidity-reward-ledger.entity';
import { LiquidityStakePosition, LiquidityStakeStatus } from './entities/liquidity-stake-position.entity';

@Injectable()
export class LiquidityMiningService {
  constructor(
    @InjectRepository(LiquidityPool)
    private readonly poolRepository: Repository<LiquidityPool>,
    @InjectRepository(LiquidityMiningProgram)
    private readonly programRepository: Repository<LiquidityMiningProgram>,
    @InjectRepository(LiquidityStakePosition)
    private readonly stakeRepository: Repository<LiquidityStakePosition>,
    @InjectRepository(LiquidityRewardLedger)
    private readonly rewardRepository: Repository<LiquidityRewardLedger>,
    private readonly auditService: AuditService,
    private readonly mobileCacheService: MobileCacheService,
  ) {}

  async createPool(dto: CreateLiquidityPoolDto): Promise<LiquidityPool> {
    const saved = await this.poolRepository.save(this.poolRepository.create(dto));
    await this.auditService.log({
      domain: 'liquidity-mining',
      action: 'pool.created',
      entityId: saved.id,
      metadata: { pairSymbol: saved.pairSymbol },
    });
    this.invalidateCaches();
    return saved;
  }

  async createProgram(dto: CreateLiquidityProgramDto): Promise<LiquidityMiningProgram> {
    const pool = await this.poolRepository.findOne({ where: { id: dto.poolId } });
    if (!pool) {
      throw new NotFoundException(`Pool ${dto.poolId} not found`);
    }
    const program = await this.programRepository.save(
      this.programRepository.create({
        poolId: dto.poolId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        vestingDays: dto.vestingDays,
        rewardBudget: dto.rewardBudget,
      }),
    );
    await this.auditService.log({
      domain: 'liquidity-mining',
      action: 'program.created',
      entityId: program.id,
      metadata: { poolId: program.poolId, rewardBudget: program.rewardBudget },
    });
    this.invalidateCaches();
    return program;
  }

  async stake(dto: StakeLiquidityDto) {
    const pool = await this.getPoolOrThrow(dto.poolId);
    const program = await this.getProgramOrThrow(dto.programId);
    if (program.status !== LiquidityProgramStatus.ACTIVE) {
      throw new BadRequestException('Program is not active');
    }
    const recentUnstakes = await this.stakeRepository.count({
      where: { userId: dto.userId, poolId: dto.poolId, status: LiquidityStakeStatus.UNSTAKED },
    });
    const position = await this.stakeRepository.save(
      this.stakeRepository.create({
        userId: dto.userId,
        poolId: dto.poolId,
        programId: dto.programId,
        amount: dto.amount,
        rapidCycleCount: recentUnstakes,
        status: recentUnstakes >= 3 ? LiquidityStakeStatus.FLAGGED : LiquidityStakeStatus.ACTIVE,
        stakedAt: new Date(),
        lastAccruedAt: new Date(),
      }),
    );

    const rewardLedger = this.rewardRepository.create({
      stakeId: position.id,
      userId: dto.userId,
      poolId: dto.poolId,
      lastCalculatedAt: new Date(),
    });
    await this.rewardRepository.save(rewardLedger);

    pool.currentDepth = Number(pool.currentDepth) + dto.amount;
    await this.poolRepository.save(pool);

    await this.auditService.log({
      domain: 'liquidity-mining',
      action: 'stake.created',
      actorUserId: dto.userId,
      entityId: position.id,
      metadata: {
        amount: dto.amount,
        fraudFlagged: position.status === LiquidityStakeStatus.FLAGGED,
        contractAddress: pool.contractAddress,
      },
    });

    this.invalidateCaches(dto.userId);
    return {
      position,
      dynamicApr: this.calculateDynamicApr(pool),
      fraudFlagged: position.status === LiquidityStakeStatus.FLAGGED,
    };
  }

  async unstake(stakeId: string) {
    const position = await this.stakeRepository.findOne({ where: { id: stakeId } });
    if (!position) {
      throw new NotFoundException(`Stake ${stakeId} not found`);
    }
    if (position.status === LiquidityStakeStatus.UNSTAKED) {
      throw new BadRequestException('Stake already unstaked');
    }

    await this.refreshRewards(position);
    position.status = LiquidityStakeStatus.UNSTAKED;
    position.cooldownEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.stakeRepository.save(position);

    const pool = await this.getPoolOrThrow(position.poolId);
    pool.currentDepth = Math.max(0, Number(pool.currentDepth) - Number(position.amount));
    await this.poolRepository.save(pool);

    await this.auditService.log({
      domain: 'liquidity-mining',
      action: 'stake.unstaked',
      actorUserId: position.userId,
      entityId: position.id,
      metadata: { cooldownEndsAt: position.cooldownEndsAt?.toISOString() },
    });

    this.invalidateCaches(position.userId);
    return position;
  }

  async claim(stakeId: string) {
    const ledger = await this.rewardRepository.findOne({ where: { stakeId } });
    if (!ledger) {
      throw new NotFoundException(`Reward ledger for stake ${stakeId} not found`);
    }
    const position = await this.stakeRepository.findOneByOrFail({ id: stakeId });
    await this.refreshRewards(position);
    const refreshedLedger = await this.rewardRepository.findOneByOrFail({ stakeId });
    const claimable = Number(refreshedLedger.vestedReward) - Number(refreshedLedger.claimedReward);
    if (claimable <= 0) {
      throw new BadRequestException('No vested rewards available');
    }
    refreshedLedger.claimedReward = Number(refreshedLedger.claimedReward) + claimable;
    await this.rewardRepository.save(refreshedLedger);
    await this.auditService.log({
      domain: 'liquidity-mining',
      action: 'reward.claimed',
      actorUserId: refreshedLedger.userId,
      entityId: refreshedLedger.id,
      metadata: { claimable },
    });
    this.invalidateCaches(refreshedLedger.userId);
    return {
      claimedReward: claimable,
      ledger: refreshedLedger,
    };
  }

  async getDashboard(userId: number) {
    const positions = await this.stakeRepository.find({ where: { userId } });
    const pools = await this.poolRepository.find();
    const poolMap = new Map(pools.map((pool) => [pool.id, pool]));
    const ledgers = await this.rewardRepository.find({ where: { userId } });
    const totalStaked = positions.reduce((sum, position) => sum + Number(position.amount), 0);

    return {
      userId,
      totalStaked,
      positions: positions.map((position) => ({
        ...position,
        dynamicApr: this.calculateDynamicApr(poolMap.get(position.poolId) || undefined),
      })),
      rewards: ledgers,
    };
  }

  async getAnalytics() {
    const pools = await this.poolRepository.find();
    const activePrograms = await this.programRepository.count({
      where: { status: LiquidityProgramStatus.ACTIVE },
    });
    const stakes = await this.stakeRepository.find();
    return {
      activePrograms,
      totalPools: pools.length,
      totalStakedDepth: stakes.reduce((sum, stake) => sum + Number(stake.amount), 0),
      pools: pools.map((pool) => ({
        ...pool,
        dynamicApr: this.calculateDynamicApr(pool),
      })),
    };
  }

  private async refreshRewards(position: LiquidityStakePosition): Promise<void> {
    const pool = await this.getPoolOrThrow(position.poolId);
    const program = await this.getProgramOrThrow(position.programId);
    const ledger = await this.rewardRepository.findOneByOrFail({ stakeId: position.id });

    const now = new Date();
    const elapsedMs = now.getTime() - new Date(position.lastAccruedAt).getTime();
    const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
    const apr = this.calculateDynamicApr(pool);
    const newlyAccrued = (Number(position.amount) * (apr / 100) * elapsedDays) / 365;

    ledger.accruedReward = Number(ledger.accruedReward) + newlyAccrued;

    const stakingDays = Math.max(
      0,
      (now.getTime() - new Date(position.stakedAt).getTime()) / (24 * 60 * 60 * 1000),
    );
    const vestingRatio = Math.min(1, stakingDays / program.vestingDays);
    const concentrationPenalty = Number(position.amount) > Number(pool.targetDepth) * 0.5 ? 0.8 : 1;
    ledger.vestedReward = Number(ledger.accruedReward) * vestingRatio * concentrationPenalty;
    ledger.lastCalculatedAt = now;
    position.lastAccruedAt = now;

    await this.rewardRepository.save(ledger);
    await this.stakeRepository.save(position);
  }

  private calculateDynamicApr(pool?: LiquidityPool): number {
    if (!pool) {
      return 0;
    }
    const depthRatio = Number(pool.targetDepth) / Math.max(Number(pool.currentDepth), 1);
    const normalized = Math.max(0.5, Math.min(3, depthRatio));
    return Number((Number(pool.baseApr) * normalized).toFixed(4));
  }

  private async getPoolOrThrow(poolId: string): Promise<LiquidityPool> {
    const pool = await this.poolRepository.findOne({ where: { id: poolId } });
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    return pool;
  }

  private async getProgramOrThrow(programId: string): Promise<LiquidityMiningProgram> {
    const program = await this.programRepository.findOne({ where: { id: programId } });
    if (!program) {
      throw new NotFoundException(`Program ${programId} not found`);
    }
    return program;
  }

  async getProgramAnalytics(programId: string): Promise<any> {
    const program = await this.getProgramOrThrow(programId);
    const stakes = await this.stakeRepository.find({ where: { programId } });
    const ledgers = await this.rewardRepository.find({ where: { programId } });
    const pool = await this.getPoolOrThrow(program.poolId);
    
    const totalStaked = stakes.reduce((sum, stake) => sum + Number(stake.amount), 0);
    const totalRewardsAccrued = ledgers.reduce((sum, ledger) => sum + Number(ledger.accruedReward), 0);
    const totalRewardsClaimed = ledgers.reduce((sum, ledger) => sum + Number(ledger.claimedReward), 0);
    const activeStakes = stakes.filter(s => s.status === LiquidityStakeStatus.ACTIVE).length;
    
    return {
      programId,
      poolId: program.poolId,
      totalStaked,
      activeStakes,
      totalParticipants: stakes.length,
      totalRewardsAccrued,
      totalRewardsClaimed,
      averageStakeSize: stakes.length > 0 ? totalStaked / stakes.length : 0,
      currentApr: this.calculateDynamicApr(pool),
      programEfficiency: program.rewardBudget > 0 ? (totalRewardsAccrued / program.rewardBudget) * 100 : 0,
      fraudDetection: {
        flaggedStakes: stakes.filter(s => s.status === LiquidityStakeStatus.FLAGGED).length,
        rapidCycles: stakes.filter(s => s.rapidCycleCount > 3).length,
      },
    };
  }

  async getPoolAnalytics(poolId: string): Promise<any> {
    const pool = await this.getPoolOrThrow(poolId);
    const stakes = await this.stakeRepository.find({ where: { poolId } });
    const programs = await this.programRepository.find({ where: { poolId } });
    
    const totalStaked = stakes.reduce((sum, stake) => sum + Number(stake.amount), 0);
    const activeStakes = stakes.filter(s => s.status === LiquidityStakeStatus.ACTIVE);
    
    return {
      poolId,
      pairSymbol: pool.pairSymbol,
      currentDepth: Number(pool.currentDepth),
      targetDepth: Number(pool.targetDepth),
      depthUtilization: (Number(pool.currentDepth) / Number(pool.targetDepth)) * 100,
      totalStaked,
      activeStakes: activeStakes.length,
      baseApr: Number(pool.baseApr),
      currentApr: this.calculateDynamicApr(pool),
      activePrograms: programs.filter(p => p.status === LiquidityProgramStatus.ACTIVE).length,
      concentrationRisk: this.calculateConcentrationRisk(activeStakes),
      liquidityMetrics: {
        averageStakeSize: activeStakes.length > 0 ? totalStaked / activeStakes.length : 0,
        largestStake: activeStakes.length > 0 ? Math.max(...activeStakes.map(s => Number(s.amount))) : 0,
        stakeDistribution: this.calculateStakeDistribution(activeStakes),
      },
    };
  }

  async detectFraudulentActivity(): Promise<any> {
    const stakes = await this.stakeRepository.find();
    const suspiciousActivities: Array<{
      type: string;
      userId: number;
      stakeCount?: number;
      unstakeCount?: number;
      poolCount?: number;
      description: string;
    }> = [];
    
    // Group stakes by user
    const userStakes = new Map<number, LiquidityStakePosition[]>();
    stakes.forEach(stake => {
      const userStakeList = userStakes.get(stake.userId) || [];
      userStakeList.push(stake);
      userStakes.set(stake.userId, userStakeList);
    });
    
    // Check for suspicious patterns
    userStakes.forEach((userStakeList, userId) => {
      // Check for rapid staking/unstaking cycles
      const recentStakes = userStakeList.filter(stake => {
        const daysSinceStake = (Date.now() - new Date(stake.stakedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceStake < 7;
      });
      
      if (recentStakes.length > 5) {
        suspiciousActivities.push({
          type: 'RAPID_CYCLING',
          userId,
          stakeCount: recentStakes.length,
          description: 'User has performed multiple staking cycles within 7 days',
        });
      }
      
      // Check for stake timing patterns
      const unstakes = userStakeList.filter(s => s.status === LiquidityStakeStatus.UNSTAKED);
      const shortTermUnstakes = unstakes.filter(unstake => {
        const stakeDuration = (new Date(unstake.cooldownEndsAt!).getTime() - new Date(unstake.stakedAt).getTime()) / (1000 * 60 * 60 * 24);
        return stakeDuration < 1; // Less than 1 day
      });
      
      if (shortTermUnstakes.length > 3) {
        suspiciousActivities.push({
          type: 'SHORT_TERM_STAKING',
          userId,
          unstakeCount: shortTermUnstakes.length,
          description: 'User has multiple stakes lasting less than 24 hours',
        });
      }
      
      // Check for concentration across multiple pools
      const uniquePools = new Set(userStakeList.map(s => s.poolId));
      if (uniquePools.size > 10) {
        suspiciousActivities.push({
          type: 'POOL_CONCENTRATION',
          userId,
          poolCount: uniquePools.size,
          description: 'User is staking across an unusually high number of pools',
        });
      }
    });
    
    return {
      timestamp: new Date().toISOString(),
      totalSuspiciousActivities: suspiciousActivities.length,
      activities: suspiciousActivities,
      riskLevel: this.calculateFraudRiskLevel(suspiciousActivities.length),
    };
  }

  async getRewardDistributionSchedule(programId: string): Promise<any> {
    const program = await this.getProgramOrThrow(programId);
    const stakes = await this.stakeRepository.find({ where: { programId, status: LiquidityStakeStatus.ACTIVE } });
    
    const schedule: Array<{
      period: string;
      startDate: string;
      endDate: string;
      estimatedRewards: number;
      activeStakes: number;
      totalStaked: number;
    }> = [];
    const now = new Date();
    const programEnd = new Date(program.endAt);
    
    // Generate monthly distribution schedule
    let currentDate = new Date(Math.max(now.getTime(), new Date(program.startAt).getTime()));
    
    while (currentDate <= programEnd) {
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const periodEnd = new Date(Math.min(monthEnd.getTime(), programEnd.getTime()));
      
      // Calculate estimated rewards for this period
      let periodRewards = 0;
      for (const stake of stakes) {
        const daysInPeriod = (periodEnd.getTime() - Math.max(currentDate.getTime(), new Date(stake.stakedAt).getTime())) / (1000 * 60 * 60 * 24);
        const pool = await this.getPoolOrThrow(stake.poolId);
        const apr = this.calculateDynamicApr(pool);
        const estimatedReward = (Number(stake.amount) * (apr / 100) * daysInPeriod) / 365;
        periodRewards += estimatedReward;
      }
      
      schedule.push({
        period: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
        startDate: currentDate.toISOString(),
        endDate: periodEnd.toISOString(),
        estimatedRewards: periodRewards,
        activeStakes: stakes.length,
        totalStaked: stakes.reduce((sum, stake) => sum + Number(stake.amount), 0),
      });
      
      currentDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 1);
    }
    
    return {
      programId,
      totalEstimatedRewards: schedule.reduce((sum, period) => sum + period.estimatedRewards, 0),
      schedule,
    };
  }

  async createSmartContractInteraction(poolId: string, interactionData: any): Promise<any> {
    const pool = await this.getPoolOrThrow(poolId);
    
    // Mock smart contract interaction
    const interaction = {
      interactionId: `SC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      poolId,
      contractAddress: pool.contractAddress,
      interactionType: interactionData.type,
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      gasUsed: Math.floor(Math.random() * 100000) + 50000,
      blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
    };
    
    await this.auditService.log({
      domain: 'liquidity-mining',
      action: 'smart-contract.interaction',
      entityId: interaction.interactionId,
      metadata: { poolId, interactionType: interactionData.type },
    });
    
    return interaction;
  }

  private calculateConcentrationRisk(stakes: LiquidityStakePosition[]): number {
    if (stakes.length === 0) return 0;
    
    const totalStaked = stakes.reduce((sum, stake) => sum + Number(stake.amount), 0);
    const largestStake = Math.max(...stakes.map(s => Number(s.amount)));
    
    // Calculate concentration risk as percentage of total staking held by largest stake
    return (largestStake / totalStaked) * 100;
  }

  private calculateStakeDistribution(stakes: LiquidityStakePosition[]): any {
    const distribution = {
      small: 0, // < 1000
      medium: 0, // 1000-10000
      large: 0, // 10000-100000
      whale: 0, // > 100000
    };
    
    stakes.forEach(stake => {
      const amount = Number(stake.amount);
      if (amount < 1000) distribution.small++;
      else if (amount < 10000) distribution.medium++;
      else if (amount < 100000) distribution.large++;
      else distribution.whale++;
    });
    
    return distribution;
  }

  private calculateFraudRiskLevel(activityCount: number): string {
    if (activityCount === 0) return 'LOW';
    if (activityCount <= 5) return 'MEDIUM';
    if (activityCount <= 15) return 'HIGH';
    return 'CRITICAL';
  }

  private invalidateCaches(userId?: number): void {
    this.mobileCacheService.invalidateTag('mobile-dashboard');
    this.mobileCacheService.invalidateTag('mobile-liquidity');
    if (userId !== undefined) {
      this.mobileCacheService.invalidateTag(`mobile-user:${userId}`);
    }
  }
}
