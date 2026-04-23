import { Injectable, Logger } from '@nestjs/common';
import { PatternDetectionService, DetectionResult, MarketSnapshot } from './pattern-detection.service';
import { MLInferenceService, DetectionFeatures } from './ml-inference.service';
import { AlertingService } from './alerting.service';
import { ActorThrottlingService } from './actor-throttling.service';
import { VisualizationService } from './visualization.service';
import { AnomalyType, SeverityLevel } from '../entities/anomaly-alert.entity';

@Injectable()
export class AnomalyDetectionPipeline {
  private readonly logger = new Logger(AnomalyDetectionPipeline.name);

  constructor(
    private patternDetectionService: PatternDetectionService,
    private mlInferenceService: MLInferenceService,
    private alertingService: AlertingService,
    private throttlingService: ActorThrottlingService,
    private visualizationService: VisualizationService,
  ) {}

  /**
   * Process a market snapshot through the detection pipeline
   */
  async processSnapshot(snapshot: MarketSnapshot): Promise<void> {
    try {
      this.logger.debug(`Processing market snapshot for ${snapshot.tradingPair}`);

      // 1. Run heuristic pattern detection
      const heuristicDetections = await this.patternDetectionService.analyzeOrderBook(snapshot);

      // 2. Enhance with ML scoring if anomalies detected
      for (const detection of heuristicDetections) {
        const features = this.extractFeatures(snapshot, detection);
        const mlScores = await this.mlInferenceService.scoreAnomalies(features);
        
        // Find ensemble score
        const ensembleScore = mlScores.find(s => s.isEnsemblePrediction);
        
        if (ensembleScore && ensembleScore.anomalyProbability > 0.6) {
          // 3. Generate alert for significant anomalies
          const alert = await this.alertingService.createAlert({
            tradingPair: snapshot.tradingPair,
            anomalyType: detection.anomalyType,
            severity: this.combineSeverity(detection.severity, ensembleScore.severity),
            confidenceScore: Math.round((detection.confidenceScore + ensembleScore.confidence) / 2),
            description: detection.description,
            actorId: this.identifyPrimaryActor(snapshot, detection),
            evidenceData: {
              ...detection.evidenceData,
              mlScores: mlScores.map(s => ({ model: s.modelId, prob: s.anomalyProbability })),
              explanation: ensembleScore.explanation,
            },
          });

          // 4. Trigger automated throttling if critical
          if (alert.severity === SeverityLevel.CRITICAL) {
            await this.throttlingService.autoThrottleIfNeeded(alert.actorId);
          }

          // 5. Update visualization metrics
          await this.visualizationService.aggregateHeatmapMetrics(
            snapshot.tradingPair,
            snapshot.midPrice,
            snapshot.timestamp,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in anomaly detection pipeline: ${error.message}`);
    }
  }

  /**
   * Extract features for ML inference from snapshot and detection context
   */
  private extractFeatures(snapshot: MarketSnapshot, detection: DetectionResult): DetectionFeatures {
    return {
      orderSize: detection.detectionMetrics.averageOrderSizePercent || 0,
      orderDuration: detection.detectionMetrics.avgDurationSeconds || 0,
      cancellationRate: detection.detectionMetrics.cancellationRate || 0,
      bidAskSpread: 0.05, // Should be calculated from snapshot
      bidAskImbalance: Math.abs(snapshot.bidVolume - snapshot.askVolume) / (snapshot.bidVolume + snapshot.askVolume || 1),
      volatility: 0.02, // Should be calculated from history
      volume: snapshot.bidVolume + snapshot.askVolume,
      timeOfDay: snapshot.timestamp.getHours(),
      dayOfWeek: snapshot.timestamp.getDay(),
      actorHistoricalCancellationRate: 0.3,
      actorHistoricalViolations: 0,
      actorTradeFrequency: 100,
      spoofingIndicator: detection.anomalyType === AnomalyType.SPOOFING ? 1 : 0,
      layeringIndicator: detection.anomalyType === AnomalyType.LAYERING ? 1 : 0,
      washTradingIndicator: detection.anomalyType === AnomalyType.WASH_TRADING ? 1 : 0,
      pumpDumpIndicator: detection.anomalyType === AnomalyType.PUMP_AND_DUMP ? 1 : 0,
      quoteSuffingIndicator: detection.anomalyType === AnomalyType.QUOTE_STUFFING ? 1 : 0,
      marketStress: 0.5,
      liquidityScore: 0.7,
      priceDeviation: 0.5,
    };
  }

  /**
   * Combine heuristic and ML severity
   */
  private combineSeverity(hSeverity: SeverityLevel, mlSeverity: SeverityLevel): SeverityLevel {
    const severityMap = {
      [SeverityLevel.CRITICAL]: 4,
      [SeverityLevel.HIGH]: 3,
      [SeverityLevel.MEDIUM]: 2,
      [SeverityLevel.LOW]: 1,
    };

    const combinedScore = Math.max(severityMap[hSeverity], severityMap[mlSeverity]);
    
    return Object.keys(severityMap).find(key => severityMap[key] === combinedScore) as SeverityLevel;
  }

  /**
   * Identify primary suspicious actor from detection evidence
   */
  private identifyPrimaryActor(snapshot: MarketSnapshot, detection: DetectionResult): string {
    // In a real system, this would analyze order IDs in evidenceData
    return snapshot.orders[0]?.actorId || 'unknown_actor';
  }
}
