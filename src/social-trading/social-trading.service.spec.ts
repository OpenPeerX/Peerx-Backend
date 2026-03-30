import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { SocialTradingService } from './social-trading.service';
import { User } from '../user/entities/user.entity';
import { Trade } from '../trading/entities/trade.entity';
import { SocialTraderProfile } from './entities/social-trader-profile.entity';
import { SharedStrategy } from './entities/shared-strategy.entity';
import { TraderFollow } from './entities/trader-follow.entity';
import { CopyTradingRelationship } from './entities/copy-trading-relationship.entity';
import { CopiedTrade, CopiedTradeStatus } from './entities/copied-trade.entity';
import { StrategyComment } from './entities/strategy-comment.entity';
import { StrategyLike } from './entities/strategy-like.entity';
import { TraderRevenueShare } from './entities/trader-revenue-share.entity';

function createRepositoryMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    remove: jest.fn(async (value) => value),
  };
}

describe('SocialTradingService', () => {
  let service: SocialTradingService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let followRepository: ReturnType<typeof createRepositoryMock>;
  let copyRelationshipRepository: ReturnType<typeof createRepositoryMock>;
  let copiedTradeRepository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialTradingService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(Trade), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(SocialTraderProfile), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(SharedStrategy), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(TraderFollow), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(CopyTradingRelationship), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(CopiedTrade), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(StrategyComment), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(StrategyLike), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(TraderRevenueShare), useValue: createRepositoryMock() },
      ],
    }).compile();

    service = module.get<SocialTradingService>(SocialTradingService);
    userRepository = module.get(getRepositoryToken(User));
    profileRepository = module.get(getRepositoryToken(SocialTraderProfile));
    followRepository = module.get(getRepositoryToken(TraderFollow));
    copyRelationshipRepository = module.get(getRepositoryToken(CopyTradingRelationship));
    copiedTradeRepository = module.get(getRepositoryToken(CopiedTrade));

    userRepository.findOne.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      id: where.id,
      username: `user-${where.id}`,
      email: `user-${where.id}@example.com`,
      role: 'USER',
    }));
    profileRepository.findOne.mockResolvedValue(null);
    profileRepository.save.mockImplementation(async (value: any) => value);
    profileRepository.create.mockImplementation((value: any) => value);
    followRepository.count.mockResolvedValue(0);
    copyRelationshipRepository.find.mockResolvedValue([]);
  });

  it('creates a follow relationship for a trader', async () => {
    followRepository.findOne.mockResolvedValue(null);

    const result = await service.followTrader({ followerId: 100, traderId: 42 });

    expect(result).toEqual({ followerId: 100, traderId: 42 });
    expect(followRepository.save).toHaveBeenCalledWith({ followerId: 100, traderId: 42 });
  });

  it('copies a trade while enforcing risk caps', async () => {
    copyRelationshipRepository.find.mockResolvedValue([
      {
        id: 1,
        traderId: 42,
        followerId: 100,
        strategyId: null,
        maxAllocationPercentage: 50,
        maxTradeAmount: 1000,
        stopLossPercentage: 5,
        dailyLossLimitPercentage: 10,
        copyRatio: 1,
        slippageTolerancePercentage: 1,
        autoExecute: true,
        isActive: true,
        totalCopiedTrades: 0,
        copiedVolume: 0,
      },
    ]);
    copiedTradeRepository.save.mockImplementation(async (value: any) => ({ id: 77, ...value }));

    const [copiedTrade] = await service.synchronizeTradeExecution({
      tradeId: 10,
      userId: 42,
      asset: 'BTC',
      amount: 4,
      price: 300,
      type: 'BUY',
      executedAt: new Date(),
      notionalValue: 1200,
      pnl: -1200,
    });

    expect(copiedTrade.status).toBe(CopiedTradeStatus.EXECUTED);
    expect(copiedTrade.executedAmount).toBeCloseTo(2, 8);
    expect(copyRelationshipRepository.save).toHaveBeenCalled();
  });

  it('skips a copied trade when the estimated loss exceeds the daily budget', async () => {
    copyRelationshipRepository.find.mockResolvedValue([
      {
        id: 3,
        traderId: 42,
        followerId: 101,
        strategyId: null,
        maxAllocationPercentage: 100,
        maxTradeAmount: 1000,
        stopLossPercentage: 30,
        dailyLossLimitPercentage: 1,
        copyRatio: 1,
        slippageTolerancePercentage: 1,
        autoExecute: true,
        isActive: true,
        totalCopiedTrades: 0,
        copiedVolume: 0,
      },
    ]);
    copiedTradeRepository.save.mockImplementation(async (value: any) => ({ id: 88, ...value }));

    const [copiedTrade] = await service.synchronizeTradeExecution({
      tradeId: 11,
      userId: 42,
      asset: 'ETH',
      amount: 2,
      price: 500,
      type: 'BUY',
      executedAt: new Date(),
      notionalValue: 1000,
      pnl: -1000,
    });

    expect(copiedTrade.status).toBe(CopiedTradeStatus.SKIPPED);
    expect(copiedTrade.failureReason).toContain('Daily loss budget');
  });
});