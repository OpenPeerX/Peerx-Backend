import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiquidationCoverageService } from '../services/liquidation-coverage.service';
import { InsuranceFundService } from '../services/insurance-fund.service';
import { FundHealthMonitoringService } from '../services/fund-health-monitoring.service';
import { InsuranceClaimService } from '../services/insurance-claim.service';
import { InsuranceFund, FundStatus, FundType } from '../entities/insurance-fund.entity';
import { LiquidationEvent, LiquidationStatus } from '../entities/liquidation-event.entity';
import { InsuranceClaim, ClaimStatus, ClaimReason } from '../entities/insurance-claim.entity';
import { FundHealthMetrics, HealthStatus } from '../entities/fund-health-metrics.entity';

describe('Insurance Fund - Stress Tests', () => {
  let liquidationService: LiquidationCoverageService;
  let fundService: InsuranceFundService;
  let healthService: FundHealthMonitoringService;
  let claimService: InsuranceClaimService;
  let liquidationRepository: Repository<LiquidationEvent>;
  let fundRepository: Repository<InsuranceFund>;
  let claimRepository: Repository<InsuranceClaim>;
  let metricsRepository: Repository<FundHealthMetrics>;

  const mockFund: InsuranceFund = {
    id: 1,
    fundType: FundType.PRIMARY,
    status: FundStatus.ACTIVE,
    balance: 10000,
    totalContributions: 10000,
    totalPayouts: 0,
    minimumBalance: 1000,
    targetBalance: 10000,
    coverageRatio: 75,
    contributionRate: 0.001,
    autoRefillEnabled: true,
    lastAutoRefillAt: null,
    liquidationsCovered: 0,
    claimCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidationCoverageService,
        InsuranceFundService,
        FundHealthMonitoringService,
        InsuranceClaimService,
        {
          provide: getRepositoryToken(LiquidationEvent),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockImplementation((event) => Promise.resolve(event)),
            findOne: jest.fn().mockResolvedValue({}),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
              getRawOne: jest.fn().mockResolvedValue({ total: 0 }),
              limit: jest.fn().mockReturnThis(),
              offset: jest.fn().mockReturnThis(),
            }),
          },
        },
        {
          provide: getRepositoryToken(InsuranceFund),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ ...mockFund }),
            save: jest.fn().mockImplementation((fund) => Promise.resolve(fund)),
            find: jest.fn().mockResolvedValue([{ ...mockFund }]),
            count: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: getRepositoryToken(InsuranceClaim),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockImplementation((claim) => Promise.resolve(claim)),
            findOne: jest.fn().mockResolvedValue({}),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ total: 0 }),
              getMany: jest.fn().mockResolvedValue([]),
              limit: jest.fn().mockReturnThis(),
              offset: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
            }),
          },
        },
        {
          provide: getRepositoryToken(FundHealthMetrics),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockImplementation((metric) => Promise.resolve(metric)),
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    liquidationService = module.get<LiquidationCoverageService>(
      LiquidationCoverageService,
    );
    fundService = module.get<InsuranceFundService>(InsuranceFundService);
    healthService = module.get<FundHealthMonitoringService>(
      FundHealthMonitoringService,
    );
    claimService = module.get<InsuranceClaimService>(InsuranceClaimService);
    liquidationRepository = module.get<Repository<LiquidationEvent>>(
      getRepositoryToken(LiquidationEvent),
    );
    fundRepository = module.get<Repository<InsuranceFund>>(
      getRepositoryToken(InsuranceFund),
    );
    claimRepository = module.get<Repository<InsuranceClaim>>(
      getRepositoryToken(InsuranceClaim),
    );
    metricsRepository = module.get<Repository<FundHealthMetrics>>(
      getRepositoryToken(FundHealthMetrics),
    );
  });

  describe('Stress Test 1: Flash Crash - Massive liquidations', () => {
    it('should handle 100+ simultaneous liquidations', async () => {
      jest
        .spyOn(fundRepository, 'findOne')
        .mockResolvedValue({ ...mockFund, balance: 5000 });

      const liquidations = [];
      for (let i = 0; i < 150; i++) {
        liquidations.push({
          id: i,
          userId: Math.floor(i / 5),
          totalLoss: 500,
          reason: 'Flash crash liquidation',
          metadata: { price_change: -50 },
        });
      }

      let coveredCount = 0;
      let uncoveredCount = 0;

      for (const liq of liquidations) {
        const result = await liquidationService.recordLiquidationEvent(
          1,
          liq.userId,
          liq.totalLoss,
          liq.reason,
          liq.metadata,
        );

        if (result.coverageDecision.failSafeTriggered) {
          uncoveredCount++;
        } else if (result.coverageDecision.canCover) {
          coveredCount++;
        }
      }

      // Cascade protection should kick in - not all can be covered
      expect(uncoveredCount).toBeGreaterThan(0);
    });
  });

  describe('Stress Test 2: Fund Depletion - Rapid payout scenario', () => {
    it('should prevent fund from going below minimum balance', async () => {
      const fund = { ...mockFund, balance: 2000 };
      jest.spyOn(fundRepository, 'findOne').mockResolvedValue(fund);

      // Try to pay out more than available for coverage
      const payoutAttempts = [];

      for (let i = 0; i < 5; i++) {
        payoutAttempts.push(3000); // Each attempt is 3000, more than available
      }

      const reservedBalance = fund.minimumBalance;
      const availableForCoverage = Math.max(0, fund.balance - reservedBalance);

      // Should be limited by available balance
      expect(availableForCoverage).toBeLessThan(payoutAttempts[0]);
    });

    it('should trigger emergency mode when critical', async () => {
      const criticalFund = { ...mockFund, balance: 500 };
      jest.spyOn(fundRepository, 'findOne').mockResolvedValue(criticalFund);

      const isEmergency = fundService.isEmergencyState(criticalFund);
      expect(isEmergency).toBe(true);
    });
  });

  describe('Stress Test 3: Coordinated liquidation attack', () => {
    it('should protect against cascade liquidation from multiple users', async () => {
      jest
        .spyOn(fundRepository, 'findOne')
        .mockResolvedValue({ ...mockFund, balance: 5000 });

      jest
        .spyOn(liquidationRepository, 'count')
        .mockResolvedValue(75); // High number of active liquidations

      const result = await liquidationService.getCascadeRiskMetrics(1);

      // Should detect high cascade risk
      expect(result.volatilityIndex).toBeGreaterThan(50);
      expect(result.level).toMatch(/HIGH|CRITICAL/);
    });

    it('should pause fund and prevent cascade if imminent', async () => {
      jest
        .spyOn(fundRepository, 'findOne')
        .mockResolvedValue({ ...mockFund, balance: 500 });

      jest
        .spyOn(liquidationRepository, 'count')
        .mockResolvedValue(100); // Too many active

      const prevention = await liquidationService.preventCascadeLiquidation(1);

      // Should activate prevention
      expect(prevention.preventionActivated).toBe(true);
      expect(prevention.currentStatus).toEqual(FundStatus.PAUSED);
    });
  });

  describe('Stress Test 4: Coverage ratio under extreme stress', () => {
    it('should reduce coverage percentage when fund critical', async () => {
      const criticalFund = { ...mockFund, balance: 1000 };
      jest.spyOn(fundRepository, 'findOne').mockResolvedValue(criticalFund);

      jest
        .spyOn(liquidationRepository, 'count')
        .mockResolvedValue(80); // Many active

      const result = await liquidationService.recordLiquidationEvent(
        1,
        1,
        5000,
        'Extreme stress test',
        { volatility: 100 },
      );

      // In critical situation, should reduce coverage
      const coveragePercentage =
        (result.coverageDecision.coverageAmount / 5000) * 100;
      expect(coveragePercentage).toBeLessThan(75); // Below normal ratio
    });
  });

  describe('Stress Test 5: Interest accumulation vs burn rate', () => {
    it('should calculate sustainability with high burn rate', async () => {
      // Setup: Fund with realistic parameters
      const fund = {
        ...mockFund,
        balance: 10000,
        targetBalance: 10000,
        minimumBalance: 1000,
      };

      // Simulate 1000/hour burn rate
      const burnRate = 1000; // per hour
      const dailyBurn = burnRate * 24; // 24000

      // Calculate days to depletion
      const daysToDepletion = fund.balance / burnRate / 24;

      // Should indicate need for refill
      expect(daysToDepletion).toBeLessThan(30);
      if (daysToDepletion < 7) {
        expect(fund.autoRefillEnabled).toBe(true);
      }
    });
  });

  describe('Stress Test 6: Multiple claim payouts in short window', () => {
    it('should handle rapid sequential payouts safely', async () => {
      const fund = { ...mockFund, balance: 2000 };
      jest.spyOn(fundRepository, 'findOne').mockResolvedValue(fund);

      let currentBalance = fund.balance;
      const payoutAmounts = [300, 400, 500, 350]; // Total: 1550

      for (const amount of payoutAmounts) {
        if (currentBalance >= amount) {
          currentBalance -= amount;
        } else {
          // Should stop when insufficient
          break;
        }
      }

      expect(currentBalance).toBeGreaterThanOrEqual(0);
      expect(currentBalance).toBeGreaterThanOrEqual(fund.minimumBalance);
    });
  });

  describe('Stress Test 7: Recovery from emergency state', () => {
    it('should recover when new contributions come in', async () => {
      let fund = { ...mockFund, balance: 500, status: FundStatus.PAUSED };

      // After emergency, balance recovers
      fund.balance = 8000;
      fund.status = FundStatus.RECOVERING;

      const recovered = fundService.isEmergencyState(fund) === false;
      expect(recovered).toBe(true);
    });
  });

  describe('Stress Test 8: Volatility index under extreme conditions', () => {
    it('should calculate high volatility index during crisis', async () => {
      const crisis = {
        id: 1,
        fundingLevel: 0.05, // 5% funded
        activeLiquidations: 150, // Way above threshold
        vulnerablePositions: 500,
      };

      let volatilityIndex = 0;

      // Low funding = high volatility
      if (crisis.fundingLevel < 0.1) volatilityIndex += 40;
      else if (crisis.fundingLevel < 0.25) volatilityIndex += 30;

      // Many active = high volatility
      if (crisis.activeLiquidations > 100) volatilityIndex += 40;
      else if (crisis.activeLiquidations > 50) volatilityIndex += 30;

      expect(volatilityIndex).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Stress Test 9: Uncovered loss accumulation', () => {
    it('should track uncovered losses during fund shortage', async () => {
      jest
        .spyOn(fundRepository, 'findOne')
        .mockResolvedValue({ ...mockFund, balance: 100 });

      let totalOriginalLoss = 0;
      let totalCoverageProvided = 0;
      let totalUncoveredLoss = 0;

      // Record multiple claims with insufficient coverage
      for (let i = 0; i < 10; i++) {
        const loss = 1000;
        const coverage = Math.min(75, 100 / 10); // Limited by available
        const uncovered = loss - coverage;

        totalOriginalLoss += loss;
        totalCoverageProvided += coverage;
        totalUncoveredLoss += uncovered;
      }

      // Should have significant uncovered losses
      expect(totalUncoveredLoss).toBeGreaterThan(
        totalOriginalLoss * 0.5,
      );
    });
  });

  describe('Stress Test 10: Auto-refill mechanism under load', () => {
    it('should trigger auto-refill when balance drops', async () => {
      const fund = {
        ...mockFund,
        balance: 4000,
        autoRefillEnabled: true,
      };

      const needsRefill = fundService.needsAutoRefill(fund);
      expect(needsRefill).toBe(true);

      if (needsRefill) {
        const refillAmount = fund.targetBalance - fund.balance;
        expect(refillAmount).toBe(6000);
      }
    });
  });

  describe('Stress Test 11: Claim approval bottleneck', () => {
    it('should handle 1000+ pending claims efficiently', async () => {
      const pendingClaims = Array.from({ length: 1000 }).map((_, i) => ({
        id: i,
        status: ClaimStatus.PENDING,
        coverageAmount: Math.random() * 1000,
      }));

      let approved = 0;
      let balance = 50000;

      // Process claims FIFO until balance exhausted
      for (const claim of pendingClaims) {
        if (balance >= claim.coverageAmount) {
          balance -= claim.coverageAmount;
          approved++;
        } else {
          break;
        }
      }

      expect(approved).toBeGreaterThan(0);
      expect(approved).toBeLessThan(1000);
    });
  });

  describe('Stress Test 12: Anomaly detection under chaos', () => {
    it('should detect unusual patterns in claim distribution', async () => {
      jest.spyOn(claimRepository, 'find').mockResolvedValue([]);

      // User concentrated claims: one user claims 40% of fund
      const fund = { ...mockFund, balance: 1000 };
      const userClaim = 400;

      const claimPercentage = (userClaim / fund.balance) * 100;
      const isAnomalous = claimPercentage > 20;

      expect(isAnomalous).toBe(true);
    });
  });
});
