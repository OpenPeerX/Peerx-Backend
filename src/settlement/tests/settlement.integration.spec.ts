import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';
import { SettlementBatch, BatchStatus } from '../entities/settlement-batch.entity';
import { FXRate } from '../entities/fx-rate.entity';
import { CurrencyConfig } from '../entities/currency-config.entity';
import { SettlementService } from '../services/settlement.service';
import { SettlementBatchService } from '../services/settlement-batch.service';
import { FXRateService } from '../services/fx-rate.service';
import { CurrencyComplianceService } from '../services/currency-compliance.service';

describe('Settlement Engine Integration Tests', () => {
  let app: INestApplication;
  let settlementService: SettlementService;
  let batchService: SettlementBatchService;
  let fxRateService: FXRateService;
  let complianceService: CurrencyComplianceService;
  let settlementRepo: Repository<Settlement>;
  let batchRepo: Repository<SettlementBatch>;
  let fxRateRepo: Repository<FXRate>;
  let currencyConfigRepo: Repository<CurrencyConfig>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'password',
          database: process.env.DB_NAME || 'swaptrade_test',
          entities: [Settlement, SettlementBatch, FXRate, CurrencyConfig],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Settlement, SettlementBatch, FXRate, CurrencyConfig]),
      ],
      providers: [
        SettlementService,
        SettlementBatchService,
        FXRateService,
        CurrencyComplianceService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    settlementService = moduleFixture.get<SettlementService>(SettlementService);
    batchService = moduleFixture.get<SettlementBatchService>(SettlementBatchService);
    fxRateService = moduleFixture.get<FXRateService>(FXRateService);
    complianceService = moduleFixture.get<CurrencyComplianceService>(CurrencyComplianceService);

    settlementRepo = moduleFixture.get<Repository<Settlement>>(getRepositoryToken(Settlement));
    batchRepo = moduleFixture.get<Repository<SettlementBatch>>(getRepositoryToken(SettlementBatch));
    fxRateRepo = moduleFixture.get<Repository<FXRate>>(getRepositoryToken(FXRate));
    currencyConfigRepo = moduleFixture.get<Repository<CurrencyConfig>>(getRepositoryToken(CurrencyConfig));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await settlementRepo.delete({});
    await batchRepo.delete({});
    await fxRateRepo.delete({});
  });

  describe('Settlement Creation and Processing', () => {
    it('should create a settlement', async () => {
      const settlement = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 1000,
        currency: 'USD',
      });

      expect(settlement).toBeDefined();
      expect(settlement.status).toBe(SettlementStatus.PENDING);
      expect(settlement.amount).toBe(1000);
    });

    it('should process settlement through complete workflow', async () => {
      const settlement = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 5000,
        currency: 'USD',
      });

      // Initiate
      let status = await settlementService.initiateSettlement(settlement.id);
      expect(status.status).toBe(SettlementStatus.INITIATED);

      // Convert
      status = await settlementService.executeConversion(settlement.id);
      expect(status.status).toBe(SettlementStatus.CONVERTING);

      // Route
      status = await settlementService.routeSettlement(settlement.id);
      expect(status.status).toBe(SettlementStatus.ROUTING);

      // Complete
      status = await settlementService.completeSettlement(settlement.id, 5000);
      expect(status.status).toBe(SettlementStatus.COMPLETED);
    });

    it('should handle settlement failure and retry', async () => {
      const settlement = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 1000,
        currency: 'USD',
      });

      // Fail settlement
      let failed = await settlementService.failSettlement(settlement.id, 'Network error');
      expect(failed.status).toBe(SettlementStatus.FAILED);
      expect(failed.retryCount).toBe(1);

      // Retry
      const retried = await settlementService.retrySettlement(settlement.id);
      expect(retried.status).toBe(SettlementStatus.PENDING);
    });
  });

  describe('FX Rate and Conversion', () => {
    it('should create and retrieve FX rate', async () => {
      const rate = await fxRateService.upsertFXRate({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.92,
        source: 'CoinGecko',
      });

      expect(rate).toBeDefined();
      expect(rate.rate).toBe(0.92);
    });

    it('should convert amount between currencies', async () => {
      await fxRateService.upsertFXRate({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.92,
        source: 'CoinGecko',
      });

      const conversion = await fxRateService.convertAmount(100, 'USD', 'EUR');
      expect(conversion.convertedAmount).toBeCloseTo(92, 1);
      expect(conversion.fxRate).toBe(0.92);
    });

    it('should handle identity conversion (same currency)', async () => {
      const conversion = await fxRateService.convertAmount(100, 'USD', 'USD');
      expect(conversion.convertedAmount).toBe(100);
      expect(conversion.fxRate).toBe(1);
    });

    it('should calculate volatility index', async () => {
      // Create multiple rates over time
      for (let i = 0; i < 30; i++) {
        await fxRateService.upsertFXRate({
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          rate: 0.92 + (Math.random() * 0.02 - 0.01), // Vary by ±1%
          source: 'CoinGecko',
        });
      }

      const volatility = await fxRateService.calculateVolatilityIndex('USD', 'EUR');
      expect(volatility).toBeGreaterThan(0);
      expect(volatility).toBeLessThanOrEqual(100);
    });
  });

  describe('Batch Processing', () => {
    it('should create and process batch', async () => {
      // Create settlements
      const settlement1 = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 1000,
        currency: 'USD',
      });

      const settlement2 = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440003',
        toAddress: '550e8400-e29b-41d4-a716-446655440004',
        amount: 2000,
        currency: 'USD',
      });

      // Create batch
      const batch = await batchService.createBatch({
        currency: 'USD',
        totalAmount: 3000,
        settlementIds: [settlement1.id, settlement2.id],
      });

      expect(batch).toBeDefined();
      expect(batch.status).toBe(BatchStatus.CREATED);
      expect(batch.settlementCount).toBe(2);
    });

    it('should submit and approve batch', async () => {
      const settlement = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 1000,
        currency: 'USD',
      });

      const batch = await batchService.createBatch({
        currency: 'USD',
        totalAmount: 1000,
        settlementIds: [settlement.id],
      });

      // Submit
      let submitted = await batchService.submitBatch({
        batchId: batch.id,
        approvalNotes: 'Test batch',
      });
      expect(submitted.status).toBe(BatchStatus.SUBMITTED);

      // Approve
      const approved = await batchService.approveBatch(
        {
          batchId: batch.id,
          approvalNotes: 'Approved',
        },
        'user-123',
      );
      expect(approved.approvedBy).toBe('user-123');
    });

    it('should handle batch failure and retry', async () => {
      const settlement = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 1000,
        currency: 'USD',
      });

      const batch = await batchService.createBatch({
        currency: 'USD',
        totalAmount: 1000,
        settlementIds: [settlement.id],
      });

      await batchService.submitBatch({
        batchId: batch.id,
      });

      // Simulate failure
      let failed = await batchService.rejectBatch(
        {
          batchId: batch.id,
          rejectionReason: 'Test error',
        },
        'user-123',
      );
      expect(failed.status).toBe(BatchStatus.FAILED);

      // Retry
      const retried = await batchService.retryBatch(batch.id);
      expect(retried.status).toBe(BatchStatus.SUBMITTED);
      expect(retried.retryCount).toBe(1);
    });
  });

  describe('Compliance Checks', () => {
    it('should perform compliance check', async () => {
      const result = await complianceService.performComplianceCheck({
        currency: 'USD',
        amount: 5000,
      });

      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.flaggedForReview).toBeDefined();
    });

    it('should flag high-amount transactions', async () => {
      const result = await complianceService.performComplianceCheck({
        currency: 'USD',
        amount: 1000000000, // Very large amount
      });

      expect(result.flaggedForReview).toBe(true);
      expect(result.requiresManualApproval).toBe(true);
    });

    it('should check settlement limits', async () => {
      const result = await complianceService.checkSettlementLimits('USD', 100000000); // 100M USD
      expect(result).toBeDefined();
      expect(result.isWithinLimits).toBeDefined();
    });
  });

  describe('High-Volume Processing', () => {
    it('should handle 100 concurrent settlements', async () => {
      const promises = [];

      for (let i = 0; i < 100; i++) {
        const settlementPromise = settlementService.createSettlement({
          fromAddress: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}01`,
          toAddress: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}02`,
          amount: 1000 + i,
          currency: 'USD',
        });
        promises.push(settlementPromise);
      }

      const settlements = await Promise.all(promises);
      expect(settlements).toHaveLength(100);
      expect(settlements.every((s) => s.status === SettlementStatus.PENDING)).toBe(true);
    });

    it('should process large batch (1000 settlements)', async () => {
      // Create 1000 settlements
      const settlementIds = [];
      let totalAmount = new (require('decimal.js'))(0);

      for (let i = 0; i < 1000; i++) {
        const settlement = await settlementService.createSettlement({
          fromAddress: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}01`,
          toAddress: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}02`,
          amount: 1000,
          currency: 'USD',
        });
        settlementIds.push(settlement.id);
        totalAmount = totalAmount.plus(1000);
      }

      // Create batch
      const batch = await batchService.createBatch({
        currency: 'USD',
        totalAmount: totalAmount.toNumber(),
        settlementIds,
      });

      expect(batch.settlementCount).toBe(1000);
    });
  });

  describe('Error Scenarios', () => {
    it('should fail settlement with out-of-range amount', async () => {
      const promise = settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: -100, // Negative amount
        currency: 'USD',
      });

      await expect(promise).rejects.toThrow();
    });

    it('should fail on unsupported currency', async () => {
      const promise = settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 1000,
        currency: 'INVALID',
      });

      await expect(promise).rejects.toThrow();
    });

    it('should prevent double-spending in batch', async () => {
      const settlement = await settlementService.createSettlement({
        fromAddress: '550e8400-e29b-41d4-a716-446655440001',
        toAddress: '550e8400-e29b-41d4-a716-446655440002',
        amount: 1000,
        currency: 'USD',
      });

      // Try to double-spend by including in two batches
      await batchService.createBatch({
        currency: 'USD',
        totalAmount: 1000,
        settlementIds: [settlement.id],
      });

      const promise = batchService.createBatch({
        currency: 'USD',
        totalAmount: 1000,
        settlementIds: [settlement.id],
      });

      // Should fail because settlement is already in batch
      await expect(promise).rejects.toThrow();
    });
  });

  describe('Performance and Load', () => {
    it('should measure settlement creation performance', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        await settlementService.createSettlement({
          fromAddress: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}01`,
          toAddress: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}02`,
          amount: 1000,
          currency: 'USD',
        });
      }

      const duration = Date.now() - startTime;
      console.log(`Created 50 settlements in ${duration}ms (${(duration / 50).toFixed(2)}ms per settlement)`);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});
