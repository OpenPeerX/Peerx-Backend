import { BacktestingService } from './backtesting.service';
import { EngineeredSample } from '../interfaces/price-prediction.interfaces';

describe('BacktestingService', () => {
  it('computes validation metrics from historical predictions', () => {
    const service = new BacktestingService();
    const samples: EngineeredSample[] = Array.from({ length: 220 }).map((_, index) => ({
      timestamp: Date.now() + index * 60_000,
      close: 100 + index * 0.5 + Math.sin(index / 8),
      features: [0.1, 0.2, 0.1],
    }));

    const result = service.evaluate(
      'BTC',
      '1m',
      samples,
      2,
      (slice) => {
        const last = slice[slice.length - 1]?.close ?? 0;
        return {
          modelType: 'ensemble',
          version: 'test',
          predictedPrice: last * 1.001,
          expectedReturn: 0.001,
          confidence: 70,
        };
      },
      'ensemble:test',
    );

    expect(result.evaluatedPoints).toBeGreaterThan(50);
    expect(result.mae).toBeGreaterThanOrEqual(0);
    expect(result.directionalAccuracy).toBeGreaterThanOrEqual(0);
    expect(result.directionalAccuracy).toBeLessThanOrEqual(1);
  });
});
