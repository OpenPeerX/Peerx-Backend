import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiquidityMiningModule } from '../src/liquidity-mining/liquidity-mining.module';
import { LiquidityMiningService } from '../src/liquidity-mining/liquidity-mining.service';
import { LiquidityMiningController } from '../src/liquidity-mining/liquidity-mining.controller';
import { LiquidityPool } from '../src/liquidity-mining/entities/liquidity-pool.entity';
import { LiquidityMiningProgram, LiquidityProgramStatus } from '../src/liquidity-mining/entities/liquidity-mining-program.entity';
import { LiquidityStakePosition, LiquidityStakeStatus } from '../src/liquidity-mining/entities/liquidity-stake-position.entity';
import { LiquidityRewardLedger } from '../src/liquidity-mining/entities/liquidity-reward-ledger.entity';
import { CreateLiquidityPoolDto } from '../src/liquidity-mining/dto/create-liquidity-pool.dto';
import { CreateLiquidityProgramDto } from '../src/liquidity-mining/dto/create-liquidity-program.dto';
import { StakeLiquidityDto } from '../src/liquidity-mining/dto/stake-liquidity.dto';

describe('Liquidity Mining Program Integration Tests', () => {
  let module: TestingModule;
  let liquidityService: LiquidityMiningService;
  let liquidityController: LiquidityMiningController;

  beforeAll(async () => {
    const testConfig = {
      type: 'sqlite',
      database: ':memory:',
      entities: [LiquidityPool, LiquidityMiningProgram, LiquidityStakePosition, LiquidityRewardLedger],
      synchronize: true,
    };

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testConfig),
        LiquidityMiningModule,
      ],
    }).compile();

    liquidityService = module.get<LiquidityMiningService>(LiquidityMiningService);
    liquidityController = module.get<LiquidityMiningController>(LiquidityMiningController);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Liquidity Pool Management', () => {
    it('should create a new liquidity pool', async () => {
      const dto: CreateLiquidityPoolDto = {
        pairSymbol: 'BTC-USDC',
        contractAddress: '0x1234567890123456789012345678901234567890',
        currentDepth: 1000000,
        targetDepth: 5000000,
        baseApr: 15.5,
      };

      const pool = await liquidityController.createPool(dto);
      
      expect(pool).toBeDefined();
      expect(pool.pairSymbol).toBe(dto.pairSymbol);
      expect(pool.contractAddress).toBe(dto.contractAddress);
      expect(pool.currentDepth).toBe(dto.currentDepth);
      expect(pool.targetDepth).toBe(dto.targetDepth);
      expect(pool.baseApr).toBe(dto.baseApr);
    });

    it('should get pool analytics', async () => {
      const poolDto: CreateLiquidityPoolDto = {
        pairSymbol: 'ETH-USDT',
        contractAddress: '0x0987654321098765432109876543210987654321',
        currentDepth: 2000000,
        targetDepth: 4000000,
        baseApr: 12.0,
      };

      const pool = await liquidityController.createPool(poolDto);
      const analytics = await liquidityService.getPoolAnalytics(pool.id);
      
      expect(analytics).toBeDefined();
      expect(analytics.poolId).toBe(pool.id);
      expect(analytics.pairSymbol).toBe(poolDto.pairSymbol);
      expect(analytics.currentDepth).toBe(poolDto.currentDepth);
      expect(analytics.targetDepth).toBe(poolDto.targetDepth);
      expect(analytics.depthUtilization).toBe(50); // 2M / 4M * 100
      expect(analytics.baseApr).toBe(poolDto.baseApr);
      expect(analytics.currentApr).toBeDefined();
      expect(analytics.activePrograms).toBe(0);
      expect(analytics.concentrationRisk).toBeDefined();
      expect(analytics.liquidityMetrics).toBeDefined();
    });
  });

  describe('Liquidity Mining Programs', () => {
    let poolId: string;

    beforeEach(async () => {
      const poolDto: CreateLiquidityPoolDto = {
        pairSymbol: 'BTC-USDC',
        contractAddress: '0x1111111111111111111111111111111111111111',
        currentDepth: 1000000,
        targetDepth: 5000000,
        baseApr: 15.5,
      };

      const pool = await liquidityController.createPool(poolDto);
      poolId = pool.id;
    });

    it('should create a liquidity mining program', async () => {
      const dto: CreateLiquidityProgramDto = {
        poolId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        vestingDays: 90,
        rewardBudget: 100000,
      };

      const program = await liquidityController.createProgram(dto);
      
      expect(program).toBeDefined();
      expect(program.poolId).toBe(poolId);
      expect(program.status).toBe(LiquidityProgramStatus.ACTIVE);
      expect(program.vestingDays).toBe(dto.vestingDays);
      expect(program.rewardBudget).toBe(dto.rewardBudget);
    });

    it('should get program analytics', async () => {
      const programDto: CreateLiquidityProgramDto = {
        poolId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        vestingDays: 60,
        rewardBudget: 50000,
      };

      const program = await liquidityController.createProgram(programDto);
      const analytics = await liquidityService.getProgramAnalytics(program.id);
      
      expect(analytics).toBeDefined();
      expect(analytics.programId).toBe(program.id);
      expect(analytics.poolId).toBe(poolId);
      expect(analytics.totalStaked).toBe(0);
      expect(analytics.activeStakes).toBe(0);
      expect(analytics.totalParticipants).toBe(0);
      expect(analytics.totalRewardsAccrued).toBe(0);
      expect(analytics.totalRewardsClaimed).toBe(0);
      expect(analytics.averageStakeSize).toBe(0);
      expect(analytics.currentApr).toBeDefined();
      expect(analytics.programEfficiency).toBe(0);
      expect(analytics.fraudDetection).toBeDefined();
    });
  });

  describe('Liquidity Staking', () => {
    let poolId: string;
    let programId: string;

    beforeEach(async () => {
      // Create pool
      const poolDto: CreateLiquidityPoolDto = {
        pairSymbol: 'ETH-USDT',
        contractAddress: '0x2222222222222222222222222222222222222222',
        currentDepth: 3000000,
        targetDepth: 6000000,
        baseApr: 18.0,
      };

      const pool = await liquidityController.createPool(poolDto);
      poolId = pool.id;

      // Create program
      const programDto: CreateLiquidityProgramDto = {
        poolId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        vestingDays: 120,
        rewardBudget: 200000,
      };

      const program = await liquidityController.createProgram(programDto);
      programId = program.id;
    });

    it('should stake liquidity', async () => {
      const dto: StakeLiquidityDto = {
        userId: 1,
        poolId,
        programId,
        amount: 50000,
      };

      const result = await liquidityController.stake(dto);
      
      expect(result).toBeDefined();
      expect(result.position).toBeDefined();
      expect(result.position.userId).toBe(dto.userId);
      expect(result.position.poolId).toBe(poolId);
      expect(result.position.programId).toBe(programId);
      expect(result.position.amount).toBe(dto.amount);
      expect(result.position.status).toBe(LiquidityStakeStatus.ACTIVE);
      expect(result.dynamicApr).toBeDefined();
      expect(result.fraudFlagged).toBe(false);
    });

    it('should detect potential fraud patterns', async () => {
      const userId = 2;
      
      // Create multiple stakes to trigger fraud detection
      for (let i = 0; i < 4; i++) {
        // First stake and unstake to create history
        const stakeDto: StakeLiquidityDto = {
          userId,
          poolId,
          programId,
          amount: 1000,
        };

        const position = await liquidityController.stake(stakeDto);
        await liquidityController.unstake(position.position.id);
      }

      // This stake should be flagged due to rapid cycling
      const flaggedStakeDto: StakeLiquidityDto = {
        userId,
        poolId,
        programId,
        amount: 5000,
      };

      const result = await liquidityController.stake(flaggedStakeDto);
      
      expect(result.fraudFlagged).toBe(true);
      expect(result.position.status).toBe(LiquidityStakeStatus.FLAGGED);
    });

    it('should unstake liquidity', async () => {
      const userId = 3;
      const stakeDto: StakeLiquidityDto = {
        userId,
        poolId,
        programId,
        amount: 25000,
      };

      const staked = await liquidityController.stake(stakeDto);
      const unstaked = await liquidityController.unstake(staked.position.id);
      
      expect(unstaked).toBeDefined();
      expect(unstaked.status).toBe(LiquidityStakeStatus.UNSTAKED);
      expect(unstaked.cooldownEndsAt).toBeDefined();
    });

    it('should claim rewards', async () => {
      const userId = 4;
      const stakeDto: StakeLiquidityDto = {
        userId,
        poolId,
        programId,
        amount: 75000,
      };

      const staked = await liquidityController.stake(stakeDto);
      
      // Wait a bit and then claim (in real scenario, time would pass)
      const claimed = await liquidityController.claim(staked.position.id);
      
      expect(claimed).toBeDefined();
      expect(claimed.ledger).toBeDefined();
      expect(claimed.claimedReward).toBeDefined();
      expect(claimed.claimedReward).toBeGreaterThanOrEqual(0);
    });

    it('should get user dashboard', async () => {
      const userId = 5;
      const stakes = [
        { amount: 10000 },
        { amount: 25000 },
        { amount: 15000 },
      ];

      // Create multiple stakes
      for (const stake of stakes) {
        const stakeDto: StakeLiquidityDto = {
          userId,
          poolId,
          programId,
          amount: stake.amount,
        };

        await liquidityController.stake(stakeDto);
      }

      const dashboard = await liquidityController.getDashboard(userId);
      
      expect(dashboard).toBeDefined();
      expect(dashboard.userId).toBe(userId);
      expect(dashboard.totalStaked).toBe(50000);
      expect(Array.isArray(dashboard.positions)).toBe(true);
      expect(dashboard.positions.length).toBe(3);
      expect(Array.isArray(dashboard.rewards)).toBe(true);
    });
  });

  describe('Fraud Detection and Security', () => {
    let poolId: string;
    let programId: string;

    beforeEach(async () => {
      const poolDto: CreateLiquidityPoolDto = {
        pairSymbol: 'BTC-USDC',
        contractAddress: '0x3333333333333333333333333333333333333333',
        currentDepth: 2000000,
        targetDepth: 4000000,
        baseApr: 20.0,
      };

      const pool = await liquidityController.createPool(poolDto);
      poolId = pool.id;

      const programDto: CreateLiquidityProgramDto = {
        poolId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        vestingDays: 180,
        rewardBudget: 300000,
      };

      const program = await liquidityController.createProgram(programDto);
      programId = program.id;
    });

    it('should detect fraudulent activity patterns', async () => {
      // Create suspicious user activity
      const suspiciousUserId = 999;
      
      // Rapid cycling pattern
      for (let i = 0; i < 6; i++) {
        const stakeDto: StakeLiquidityDto = {
          userId: suspiciousUserId,
          poolId,
          programId,
          amount: 1000,
        };

        const position = await liquidityController.stake(stakeDto);
        await liquidityController.unstake(position.position.id);
      }

      // Short-term staking pattern
      const shortTermUserId = 998;
      for (let i = 0; i < 4; i++) {
        const stakeDto: StakeLiquidityDto = {
          userId: shortTermUserId,
          poolId,
          programId,
          amount: 500,
        };

        const position = await liquidityController.stake(stakeDto);
        await liquidityController.unstake(position.position.id);
      }

      // Pool concentration pattern
      const concentrationUserId = 997;
      for (let i = 0; i < 12; i++) {
        // Create different pools for concentration test
        const poolDto: CreateLiquidityPoolDto = {
          pairSymbol: `PAIR-${i}`,
          contractAddress: `0x${i.toString().padStart(40, '0')}`,
          currentDepth: 1000000,
          targetDepth: 2000000,
          baseApr: 10.0 + i,
        };

        const newPool = await liquidityController.createPool(poolDto);
        
        const programDto: CreateLiquidityProgramDto = {
          poolId: newPool.id,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          vestingDays: 30,
          rewardBudget: 10000,
        };

        const newProgram = await liquidityController.createProgram(programDto);

        const stakeDto: StakeLiquidityDto = {
          userId: concentrationUserId,
          poolId: newPool.id,
          programId: newProgram.id,
          amount: 100,
        };

        await liquidityController.stake(stakeDto);
      }

      const fraudDetection = await liquidityService.detectFraudulentActivity();
      
      expect(fraudDetection).toBeDefined();
      expect(fraudDetection.timestamp).toBeDefined();
      expect(fraudDetection.totalSuspiciousActivities).toBeGreaterThan(0);
      expect(Array.isArray(fraudDetection.activities)).toBe(true);
      expect(fraudDetection.riskLevel).toMatch(/LOW|MEDIUM|HIGH|CRITICAL/);
      
      // Check for specific fraud types
      const rapidCycling = fraudDetection.activities.find(a => a.type === 'RAPID_CYCLING');
      const shortTermStaking = fraudDetection.activities.find(a => a.type === 'SHORT_TERM_STAKING');
      const poolConcentration = fraudDetection.activities.find(a => a.type === 'POOL_CONCENTRATION');
      
      expect(rapidCycling).toBeDefined();
      expect(shortTermStaking).toBeDefined();
      expect(poolConcentration).toBeDefined();
    });

    it('should get reward distribution schedule', async () => {
      const userId = 6;
      const stakeDto: StakeLiquidityDto = {
        userId,
        poolId,
        programId,
        amount: 100000,
      };

      await liquidityController.stake(stakeDto);
      
      const schedule = await liquidityService.getRewardDistributionSchedule(programId);
      
      expect(schedule).toBeDefined();
      expect(schedule.programId).toBe(programId);
      expect(schedule.totalEstimatedRewards).toBeDefined();
      expect(Array.isArray(schedule.schedule)).toBe(true);
      expect(schedule.schedule.length).toBeGreaterThan(0);
      
      const firstPeriod = schedule.schedule[0];
      expect(firstPeriod.period).toBeDefined();
      expect(firstPeriod.startDate).toBeDefined();
      expect(firstPeriod.endDate).toBeDefined();
      expect(firstPeriod.estimatedRewards).toBeDefined();
      expect(firstPeriod.activeStakes).toBeDefined();
      expect(firstPeriod.totalStaked).toBeDefined();
    });

    it('should create smart contract interaction', async () => {
      const interactionData = {
        type: 'STAKE',
        amount: 50000,
      };

      const interaction = await liquidityService.createSmartContractInteraction(poolId, interactionData);
      
      expect(interaction).toBeDefined();
      expect(interaction.interactionId).toBeDefined();
      expect(interaction.poolId).toBe(poolId);
      expect(interaction.contractAddress).toBeDefined();
      expect(interaction.interactionType).toBe(interactionData.type);
      expect(interaction.transactionHash).toBeDefined();
      expect(interaction.status).toBe('PENDING');
      expect(interaction.createdAt).toBeDefined();
      expect(interaction.gasUsed).toBeDefined();
      expect(interaction.blockNumber).toBeDefined();
    });
  });

  describe('Analytics and Reporting', () => {
    it('should get overall analytics', async () => {
      // Create pools and programs for analytics
      const pools = [
        { pairSymbol: 'BTC-USDC', baseApr: 15.5 },
        { pairSymbol: 'ETH-USDT', baseApr: 18.0 },
        { pairSymbol: 'BNB-BUSD', baseApr: 12.5 },
      ];

      const createdPools = [];
      for (const poolData of pools) {
        const poolDto: CreateLiquidityPoolDto = {
          pairSymbol: poolData.pairSymbol,
          contractAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
          currentDepth: 1000000,
          targetDepth: 5000000,
          baseApr: poolData.baseApr,
        };

        const pool = await liquidityController.createPool(poolDto);
        createdPools.push(pool);

        const programDto: CreateLiquidityProgramDto = {
          poolId: pool.id,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          vestingDays: 90,
          rewardBudget: 100000,
        };

        await liquidityController.createProgram(programDto);
      }

      const analytics = await liquidityController.getAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.activePrograms).toBe(3);
      expect(analytics.totalPools).toBe(3);
      expect(analytics.totalStakedDepth).toBe(0);
      expect(Array.isArray(analytics.pools)).toBe(true);
      expect(analytics.pools.length).toBe(3);
      
      // Check pool analytics
      for (const poolAnalytics of analytics.pools) {
        expect(poolAnalytics.dynamicApr).toBeDefined();
        expect(poolAnalytics.pairSymbol).toBeDefined();
      }
    });
  });
});
