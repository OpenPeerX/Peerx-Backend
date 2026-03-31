import { Test, TestingModule } from '@nestjs/testing';
import { PricePredictionService } from './price-prediction.service';
import { LstmPriceModelService } from './models/lstm-price-model.service';
import { TransformerPriceModelService } from './models/transformer-price-model.service';
import { BacktestingService } from './services/backtesting.service';
import { DataIngestionService } from './services/data-ingestion.service';
import { FeatureEngineeringService } from './services/feature-engineering.service';
import { ModelRegistryService } from './services/model-registry.service';
import { PredictionCacheService } from './services/prediction-cache.service';
import { TradingSignalService } from './services/trading-signal.service';

const mockDataIngestionService = {
  fetchUnifiedContext: jest.fn(async (symbol: string, timeframe: '1m' | '5m' | '1h' | '1d') => {
    const step = timeframe === '1m' ? 60_000 : timeframe === '5m' ? 300_000 : timeframe === '1h' ? 3_600_000 : 86_400_000;
    const now = Date.now();
    const candles = Array.from({ length: 700 }).map((_, index) => {
      const close = 60_000 + index * 5 + Math.sin(index / 12) * 120;
      return {
        timestamp: now - (700 - index) * step,
        open: close * 0.998,
        high: close * 1.004,
        low: close * 0.996,
        close,
        volume: 100_000 + index * 100,
      };
    });

    return {
      symbol,
      timeframe,
      candles,
      sentiment: {
        score: 58,
        volume: 40_000,
        sourceBreakdown: { x: 0.4, reddit: 0.2, telegram: 0.1, news: 0.3 },
      },
      onChain: {
        activeAddresses: 250_000,
        transactionCount: 420_000,
        exchangeNetflow: -1_800,
        whaleTransferScore: 64,
      },
      macro: {
        usdIndex: 103.2,
        us10yYield: 4.1,
        inflationNowcast: 2.7,
        riskOnScore: 57,
      },
      fetchedAt: new Date().toISOString(),
      dataSources: ['mock'],
    };
  }),
};

describe('PricePredictionService', () => {
  let service: PricePredictionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricePredictionService,
        {
          provide: DataIngestionService,
          useValue: mockDataIngestionService,
        },
        FeatureEngineeringService,
        LstmPriceModelService,
        TransformerPriceModelService,
        ModelRegistryService,
        PredictionCacheService,
        TradingSignalService,
        BacktestingService,
      ],
    }).compile();

    service = module.get<PricePredictionService>(PricePredictionService);
  });

  it('should return supported top-50 asset universe', () => {
    const assets = service.getSupportedAssets();
    expect(assets.length).toBe(50);
    expect(assets).toContain('BTC');
  });

  it('should generate prediction with confidence and signal', async () => {
    const prediction = await service.predict('BTC', '5m', 3);
    expect(prediction.symbol).toBe('BTC');
    expect(prediction.timeframe).toBe('5m');
    expect(prediction.modelBreakdown.length).toBe(3);
    expect(prediction.confidence).toBeGreaterThanOrEqual(30);
    expect(['BUY', 'SELL', 'HOLD']).toContain(prediction.signal);
  });
});
