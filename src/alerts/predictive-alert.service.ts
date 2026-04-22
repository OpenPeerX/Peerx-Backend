import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PricePredictionService } from '../price-prediction/price-prediction.service';
import { AlertService } from './alert.service';
import { NotificationService } from '../notification/notification.service';
import { PredictionTimeframe } from '../price-prediction/interfaces/price-prediction.interfaces';

@Injectable()
export class PredictiveAlertService {
  private readonly logger = new Logger(PredictiveAlertService.name);

  constructor(
    private readonly pricePredictionService: PricePredictionService,
    private readonly alertService: AlertService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluatePredictiveAlerts(): Promise<void> {
    this.logger.log('Evaluating ML-based predictive alerts...');
    
    const assets = ['BTC', 'ETH', 'XLM', 'USDT'];
    const timeframes: PredictionTimeframe[] = ['1h', '24h'];

    for (const asset of assets) {
      for (const timeframe of timeframes) {
        try {
          const prediction = await this.pricePredictionService.predict(asset, timeframe);
          
          await this.checkPriceMovementAlert(prediction);
          await this.checkVolatilityAlert(prediction);
          await this.checkReversalAlert(prediction);
        } catch (error) {
          this.logger.error(`Failed to evaluate predictive alerts for ${asset} ${timeframe}:`, error);
        }
      }
    }
  }

  private async checkPriceMovementAlert(prediction: any): Promise<void> {
    if (Math.abs(prediction.expectedReturnPct) > 5 && prediction.confidence > 80) {
      this.logger.warn(`Significant predicted movement for ${prediction.symbol}: ${prediction.expectedReturnPct.toFixed(2)}% (Confidence: ${prediction.confidence}%)`);
      
      await this.notificationService.notifyAdmins({
        title: `🚀 Predictive Alert: ${prediction.symbol}`,
        body: `Predicted ${prediction.expectedReturnPct > 0 ? 'UPWARD' : 'DOWNWARD'} movement of ${Math.abs(prediction.expectedReturnPct).toFixed(2)}% in the next ${prediction.timeframe}. Confidence: ${prediction.confidence}%`,
        metadata: { prediction },
      });
    }
  }

  private async checkVolatilityAlert(prediction: any): Promise<void> {
    // Logic for volatility spike detection based on model variance or breakdown
    const modelVariance = this.calculateModelVariance(prediction.modelBreakdown);
    
    if (modelVariance > 0.05 && prediction.confidence < 70) {
      this.logger.warn(`High volatility/model disagreement for ${prediction.symbol}`);
      
      await this.notificationService.notifyAdmins({
        title: `⚠️ Volatility Warning: ${prediction.symbol}`,
        body: `High volatility detected for ${prediction.symbol}. Model disagreement is high (${(modelVariance * 100).toFixed(2)}%). Confidence is low (${prediction.confidence}%).`,
        metadata: { prediction, modelVariance },
      });
    }
  }

  private async checkReversalAlert(prediction: any): Promise<void> {
    // Identify potential market reversals
    const currentSignal = prediction.signal;
    // In a real app, you'd compare with previous signals stored in DB/Cache
    
    if (prediction.confidence > 85 && (currentSignal === 'STRONG_BUY' || currentSignal === 'STRONG_SELL')) {
      this.logger.log(`Potential reversal/strong trend identified for ${prediction.symbol}`);
      
      // We'll simulate reversal detection by checking if signal is contrary to recent trend
      // For now, just trigger if confidence is very high
      await this.notificationService.notifyAdmins({
        title: `🔄 Trend Reversal Alert: ${prediction.symbol}`,
        body: `Strong signal (${currentSignal}) with high confidence (${prediction.confidence}%) for ${prediction.symbol}. Possible trend reversal or continuation.`,
        metadata: { prediction },
      });
    }
  }

  private calculateModelVariance(breakdown: any[]): number {
    if (!breakdown || breakdown.length < 2) return 0;
    const prices = breakdown.filter(b => b.predictedPrice).map(b => b.predictedPrice);
    if (prices.length < 2) return 0;
    
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    return Math.sqrt(variance) / mean;
  }
}
