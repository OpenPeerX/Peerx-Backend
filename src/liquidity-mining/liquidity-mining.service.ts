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
        dynamicApr: this.calculateDynamicApr(poolMap.get(position.poolId)),
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

  private invalidateCaches(userId?: number): void {
    this.mobileCacheService.invalidateTag('mobile-dashboard');
    this.mobileCacheService.invalidateTag('mobile-liquidity');
    if (userId !== undefined) {
      this.mobileCacheService.invalidateTag(`mobile-user:${userId}`);
    }
  }
}
