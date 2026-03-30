import { Injectable } from '@nestjs/common';
import { mean, standardDeviation } from 'simple-statistics';
import {
  EngineeredSample,
  UnifiedMarketContext,
} from '../interfaces/price-prediction.interfaces';

@Injectable()
export class FeatureEngineeringService {
  buildSamples(context: UnifiedMarketContext): EngineeredSample[] {
    const closes = context.candles.map((candle) => candle.close);
    const volumes = context.candles.map((candle) => candle.volume);
    const priceStd = standardDeviation(closes) || 1;
    const volumeMean = mean(volumes) || 1;
    const volumeStd = standardDeviation(volumes) || 1;

    const samples: EngineeredSample[] = [];
    for (let i = 20; i < context.candles.length; i += 1) {
      const current = context.candles[i];
      const prev = context.candles[i - 1];
      const returnsWindow = this.sliceReturns(closes, i - 20, i);
      const shortTrend = this.percentageChange(closes[i - 5], closes[i]);
      const longTrend = this.percentageChange(closes[i - 20], closes[i]);
      const rollingVolatility = standardDeviation(returnsWindow) || 0;
      const momentum = this.safeDivide(closes[i] - closes[i - 3], closes[i - 3]);
      const volumeZ = this.safeDivide(current.volume - volumeMean, volumeStd);
      const intrabarRange = this.safeDivide(current.high - current.low, current.close);
      const normalizedPrice = this.safeDivide(current.close - mean(closes), priceStd);
      const closeToOpen = this.safeDivide(current.close - current.open, current.open);

      samples.push({
        timestamp: current.timestamp,
        close: current.close,
        features: [
          this.safeDivide(current.close - prev.close, prev.close),
          shortTrend,
          longTrend,
          rollingVolatility,
          momentum,
          volumeZ,
          intrabarRange,
          normalizedPrice,
          closeToOpen,
          context.sentiment.score / 100,
          this.normalizeSentimentVolume(context.sentiment.volume),
          this.normalizeOnChainMetric(context.onChain.activeAddresses, 1_000_000),
          this.normalizeOnChainMetric(context.onChain.transactionCount, 3_000_000),
          context.onChain.exchangeNetflow / 100_000,
          context.onChain.whaleTransferScore / 100,
          context.macro.usdIndex / 120,
          context.macro.us10yYield / 10,
          context.macro.inflationNowcast / 10,
          context.macro.riskOnScore / 100,
        ],
      });
    }

    return samples;
  }

  private sliceReturns(values: number[], from: number, to: number): number[] {
    const window: number[] = [];
    for (let i = Math.max(1, from); i <= to; i += 1) {
      window.push(this.safeDivide(values[i] - values[i - 1], values[i - 1]));
    }
    return window;
  }

  private percentageChange(from: number, to: number): number {
    return this.safeDivide(to - from, from);
  }

  private normalizeSentimentVolume(value: number): number {
    return Math.min(1, Math.max(0, value / 100_000));
  }

  private normalizeOnChainMetric(value: number, baseline: number): number {
    return Math.min(2, Math.max(0, value / baseline));
  }

  private safeDivide(value: number, divisor: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor === 0) {
      return 0;
    }
    return value / divisor;
  }
}
