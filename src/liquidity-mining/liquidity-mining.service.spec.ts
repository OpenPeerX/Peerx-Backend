import { LiquidityMiningService } from './liquidity-mining.service';
import { LiquidityProgramStatus } from './entities/liquidity-mining-program.entity';
import { LiquidityStakeStatus } from './entities/liquidity-stake-position.entity';

describe('LiquidityMiningService', () => {
  const createRepository = () => ({
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
  });

  it('flags rapid reward-farming behavior when recent unstake cycles are high', async () => {
    const poolRepository = createRepository();
    const programRepository = createRepository();
    const stakeRepository = createRepository();
    const rewardRepository = createRepository();
    const auditService = { log: jest.fn() };
    const mobileCacheService = { invalidateTag: jest.fn() };

    poolRepository.findOne.mockResolvedValue({
      id: 'pool-1',
      currentDepth: 1000,
      targetDepth: 2000,
      baseApr: 12,
      contractAddress: '0xpool',
    });
    poolRepository.save.mockImplementation(async (value) => value);
    programRepository.findOne.mockResolvedValue({
      id: 'program-1',
      status: LiquidityProgramStatus.ACTIVE,
    });
    stakeRepository.count.mockResolvedValue(3);
    stakeRepository.save.mockImplementation(async (value) => ({ id: 'stake-1', ...value }));
    rewardRepository.save.mockImplementation(async (value) => value);

    const service = new LiquidityMiningService(
      poolRepository as never,
      programRepository as never,
      stakeRepository as never,
      rewardRepository as never,
      auditService as never,
      mobileCacheService as never,
    );

    const result = await service.stake({
      userId: 1,
      poolId: 'pool-1',
      programId: 'program-1',
      amount: 100,
    });

    expect(result.position.status).toBe(LiquidityStakeStatus.FLAGGED);
    expect(result.fraudFlagged).toBe(true);
  });
});
