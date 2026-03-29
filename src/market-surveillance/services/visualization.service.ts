import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { HeatmapMetric } from '../entities/heatmap-metric.entity';
import { AnomalyAlert, AnomalyType, SeverityLevel } from '../entities/anomaly-alert.entity';
import { SuspiciousActor } from '../entities/suspicious-actor.entity';

/**
 * Heatmap response for visualization
 */
export interface HeatmapData {
  tradingPair: string;
  timeWindow: Date;
  priceLevel: number;
  priceBucket: string;
  anomalyCounts: number;
  riskScore: number;
  riskLevel: string;
  visualizationColor: string;
  visualizationIntensity: string;
  isHotspot: boolean;
  anomalyDetails: {
    spoofing: number;
    layering: number;
    washTrading: number;
    other: number;
  };
}

/**
 * Dashboard summary data
 */
export interface DashboardSummary {
  period: {
    startTime: Date;
    endTime: Date;
  };
  totalAlerts: number;
  alertsBySeverity: Record<SeverityLevel, number>;
  alertsByType: Record<string, number>;
  topTradingPairs: Array<{ pair: string; count: number }>;
  topSuspiciousActors: Array<{ actorId: string; violationCount: number; riskScore: number }>;
  alertsTimeSeries: Array<{ timestamp: Date; count: number }>;
  heatmap: HeatmapData[];
  throttleStats: {
    suspended: number;
    severe: number;
    moderate: number;
  };
}

/**
 * Time-series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

/**
 * Risk distribution
 */
export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);

  // Color mapping for heatmaps
  private readonly colorMapping = {
    critical: '#FF0000', // Red
    high: '#FFA500', // Orange
    medium: '#FFFF00', // Yellow
    low: '#90EE90', // Light green
  };

  // Intensity mapping
  private readonly intensityMapping = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
  };

  constructor(
    @InjectRepository(HeatmapMetric)
    private heatmapRepository: Repository<HeatmapMetric>,
    @InjectRepository(AnomalyAlert)
    private anomalyAlertRepository: Repository<AnomalyAlert>,
    @InjectRepository(SuspiciousActor)
    private suspiciousActorRepository: Repository<SuspiciousActor>,
  ) {}

  /**
   * Generate heatmap for visualization
   */
  async generateHeatmap(
    tradingPair: string,
    hoursBack: number = 24,
    interval: 'HOURLY' | 'DAILY' = 'HOURLY',
  ): Promise<HeatmapData[]> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 3600000);
      const endTime = new Date();

      const metrics = await this.heatmapRepository.find({
        where: {
          tradingPair,
          timeWindow: Between(startTime, endTime),
        },
        order: { timeWindow: 'ASC', priceLevel: 'ASC'},
      });

      const heatmapData: HeatmapData[] = metrics.map(m => ({
        tradingPair: m.tradingPair,
        timeWindow: m.timeWindow,
        priceLevel: m.priceLevel,
        priceBucket: m.priceBucket,
        anomalyCounts: m.anomalyCounts,
        riskScore: m.riskScore,
        riskLevel: m.riskLevel,
        visualizationColor: m.visualizationColor,
        visualizationIntensity: m.visualizationIntensity,
        isHotspot: m.isHotspot,
        anomalyDetails: {
          spoofing: m.spoofingCount,
          layering: m.layeringCount,
          washTrading: m.washTradingCount,
          other: m.otherAnomalyCount,
        },
      }));

      this.logger.log(
        `Generated heatmap for ${tradingPair}: ${heatmapData.length} data points`,
      );

      return heatmapData;
    } catch (error) {
      this.logger.error(`Error generating heatmap: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate dashboard summary
   */
  async getDashboardSummary(hoursBack: number = 24): Promise<DashboardSummary> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 3600000);
      const endTime = new Date();

      // Total alerts
      const totalAlerts = await this.anomalyAlertRepository.count({
        where: {
          createdAt: Between(startTime, endTime),
        },
      });

      // Alerts by severity
      const alertsBySeverity: Record<SeverityLevel, number> = {
        [SeverityLevel.CRITICAL]: 0,
        [SeverityLevel.HIGH]: 0,
        [SeverityLevel.MEDIUM]: 0,
        [SeverityLevel.LOW]: 0,
      };

      for (const severity of Object.values(SeverityLevel)) {
        alertsBySeverity[severity] = await this.anomalyAlertRepository.count({
          where: {
            severity,
            createdAt: Between(startTime, endTime),
          },
        });
      }

      // Alerts by type
      const alertsByType: Record<string, number> = {};
      for (const anomalyType of Object.values(AnomalyType)) {
        alertsByType[anomalyType] = await this.anomalyAlertRepository.count({
          where: {
            anomalyType,
            createdAt: Between(startTime, endTime),
          },
        });
      }

      // Top trading pairs
      const allAlerts = await this.anomalyAlertRepository.find({
        where: {
          createdAt: Between(startTime, endTime),
        },
      });

      const pairCounts = new Map<string, number>();
      allAlerts.forEach(alert => {
        pairCounts.set(alert.tradingPair, (pairCounts.get(alert.tradingPair) || 0) + 1);
      });

      const topTradingPairs = Array.from(pairCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pair, count]) => ({ pair, count }));

      // Top suspicious actors
      const actors = await this.suspiciousActorRepository.find({
        order: { totalViolations: 'DESC' },
        take: 10,
      });

      const topActors = actors.map(actor => ({
        actorId: actor.actorId,
        violationCount: actor.totalViolations,
        riskScore: actor.riskScore,
      }));

      // Time series
      const alertsTimeSeries = await this.generateTimeSeries(startTime, endTime, 'HOURLY');

      // Heatmap for all pairs
      const heatmaps: HeatmapData[] = [];
      const uniquePairs = [...new Set(allAlerts.map(a => a.tradingPair))];

      for (const pair of uniquePairs.slice(0, 5)) {
        const pairHeatmap = await this.generateHeatmap(pair, hoursBack, 'HOURLY');
        heatmaps.push(...pairHeatmap.slice(0, 20)); // Top 20 per pair
      }

      // Throttle stats
      const throttleStats = {
        suspended: await this.suspiciousActorRepository.count({
          where: { throttleLevel: 'SUSPENDED' },
        }),
        severe: await this.suspiciousActorRepository.count({
          where: { throttleLevel: 'SEVERE' },
        }),
        moderate: await this.suspiciousActorRepository.count({
          where: { throttleLevel: 'MODERATE' },
        }),
      };

      return {
        period: { startTime, endTime },
        totalAlerts,
        alertsBySeverity,
        alertsByType,
        topTradingPairs,
        topSuspiciousActors: topActors,
        alertsTimeSeries,
        heatmap: heatmaps,
        throttleStats,
      };
    } catch (error) {
      this.logger.error(`Error generating dashboard summary: ${error.message}`);
      return {
        period: { startTime: new Date(), endTime: new Date() },
        totalAlerts: 0,
        alertsBySeverity: {
          [SeverityLevel.CRITICAL]: 0,
          [SeverityLevel.HIGH]: 0,
          [SeverityLevel.MEDIUM]: 0,
          [SeverityLevel.LOW]: 0,
        },
        alertsByType: {},
        topTradingPairs: [],
        topSuspiciousActors: [],
        alertsTimeSeries: [],
        heatmap: [],
        throttleStats: { suspended: 0, severe: 0, moderate: 0 },
      };
    }
  }

  /**
   * Get anomaly type distribution
   */
  async getAnomalyDistribution(
    hoursBack: number = 24,
  ): Promise<Record<string, { count: number; percentage: number }>> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 3600000);

      const distribution: Record<string, { count: number; percentage: number }> = {};
      let total = 0;

      for (const anomalyType of Object.values(AnomalyType)) {
        const count = await this.anomalyAlertRepository.count({
          where: {
            anomalyType,
            createdAt: MoreThan(startTime),
          },
        });

        distribution[anomalyType] = { count, percentage: 0 };
        total += count;
      }

      // Calculate percentages
      Object.entries(distribution).forEach(([type, data]) => {
        data.percentage = total > 0 ? (data.count / total) * 100 : 0;
      });

      return distribution;
    } catch (error) {
      this.logger.error(`Error getting anomaly distribution: ${error.message}`);
      return {};
    }
  }

  /**
   * Get severity distribution
   */
  async getSeverityDistribution(hoursBack: number = 24): Promise<RiskDistribution> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 3600000);

      return {
        critical: await this.anomalyAlertRepository.count({
          where: {
            severity: SeverityLevel.CRITICAL,
            createdAt: MoreThan(startTime),
          },
        }),
        high: await this.anomalyAlertRepository.count({
          where: {
            severity: SeverityLevel.HIGH,
            createdAt: MoreThan(startTime),
          },
        }),
        medium: await this.anomalyAlertRepository.count({
          where: {
            severity: SeverityLevel.MEDIUM,
            createdAt: MoreThan(startTime),
          },
        }),
        low: await this.anomalyAlertRepository.count({
          where: {
            severity: SeverityLevel.LOW,
            createdAt: MoreThan(startTime),
          },
        }),
      };
    } catch (error) {
      this.logger.error(`Error getting severity distribution: ${error.message}`);
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
  }

  /**
   * Get alerts over time (time series)
   */
  async getAlertsOverTime(
    startTime: Date,
    endTime: Date,
    interval: 'HOURLY' | 'DAILY' = 'HOURLY',
    anomalyType?: AnomalyType,
  ): Promise<TimeSeriesPoint[]> {
    try {
      const timeSeries: TimeSeriesPoint[] = [];

      const intervalMs = interval === 'HOURLY' ? 3600000 : 86400000;
      let currentTime = new Date(startTime);

      while (currentTime < endTime) {
        const nextTime = new Date(currentTime.getTime() + intervalMs);

        let query = this.anomalyAlertRepository
          .createQueryBuilder('alert')
          .where('alert.createdAt >= :start', { start: currentTime })
          .andWhere('alert.createdAt < :end', { end: nextTime });

        if (anomalyType) {
          query = query.andWhere('alert.anomalyType = :anomalyType', { anomalyType });
        }

        const count = await query.getCount();

        timeSeries.push({
          timestamp: new Date(currentTime),
          value: count,
          label: this.formatTimeLabel(currentTime, interval),
        });

        currentTime = nextTime;
      }

      return timeSeries;
    } catch (error) {
      this.logger.error(`Error getting alerts over time: ${error.message}`);
      return [];
    }
  }

  /**
   * Get price-level heatmap for a specific time period
   */
  async getPriceLevelHeatmap(
    tradingPair: string,
    startTime: Date,
    endTime: Date,
  ): Promise<Map<string, HeatmapData>> {
    try {
      const metrics = await this.heatmapRepository.find({
        where: {
          tradingPair,
          timeWindow: Between(startTime, endTime),
        },
      });

      const heatmap = new Map<string, HeatmapData>();

      metrics.forEach(m => {
        const key = `${m.timeWindow.toISOString()}:${m.priceLevel}`;
        heatmap.set(key, {
          tradingPair: m.tradingPair,
          timeWindow: m.timeWindow,
          priceLevel: m.priceLevel,
          priceBucket: m.priceBucket,
          anomalyCounts: m.anomalyCounts,
          riskScore: m.riskScore,
          riskLevel: m.riskLevel,
          visualizationColor: m.visualizationColor,
          visualizationIntensity: m.visualizationIntensity,
          isHotspot: m.isHotspot,
          anomalyDetails: {
            spoofing: m.spoofingCount,
            layering: m.layeringCount,
            washTrading: m.washTradingCount,
            other: m.otherAnomalyCount,
          },
        });
      });

      return heatmap;
    } catch (error) {
      this.logger.error(`Error getting price level heatmap: ${error.message}`);
      return new Map();
    }
  }

  /**
   * Get actor risk distribution
   */
  async getActorRiskDistribution(): Promise<{
    critical: number;
    high: number;
    medium: number;
    low: number;
  }> {
    try {
      return {
        critical: await this.suspiciousActorRepository.count({
          where: { riskLevel: 'CRITICAL' },
        }),
        high: await this.suspiciousActorRepository.count({
          where: { riskLevel: 'HIGH' },
        }),
        medium: await this.suspiciousActorRepository.count({
          where: { riskLevel: 'MEDIUM' },
        }),
        low: await this.suspiciousActorRepository.count({
          where: { riskLevel: 'LOW' },
        }),
      };
    } catch (error) {
      this.logger.error(`Error getting actor risk distribution: ${error.message}`);
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
  }

  /**
   * Generate time series data
   */
  private async generateTimeSeries(
    startTime: Date,
    endTime: Date,
    interval: 'HOURLY' | 'DAILY',
  ): Promise<TimeSeriesPoint[]> {
    return await this.getAlertsOverTime(startTime, endTime, interval);
  }

  /**
   * Format time label for display
   */
  private formatTimeLabel(date: Date, interval: 'HOURLY' | 'DAILY'): string {
    if (interval === 'HOURLY') {
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });
  }

  /**
   * Get color for risk level
   */
  getColorForRiskLevel(riskLevel: string): string {
    return this.colorMapping[riskLevel.toLowerCase()] || '#808080'; // Default gray
  }

  /**
   * Get intensity for risk level
   */
  getIntensityForRiskLevel(riskLevel: string): string {
    return this.intensityMapping[riskLevel.toLowerCase()] || 'LOW';
  }

  /**
   * Check if point is hotspot
   */
  isHotspot(riskScore: number, threshold: number = 75): boolean {
    return riskScore >= threshold;
  }

  /**
   * Aggregate metrics for heatmap cell
   */
  async aggregateHeatmapMetrics(
    tradingPair: string,
    priceLevel: number,
    timeWindow: Date,
  ): Promise<void> {
    try {
      // Get alerts for this bucket
      const bucketStart = new Date(
        Math.floor(timeWindow.getTime() / 3600000) * 3600000,
      );
      const bucketEnd = new Date(bucketStart.getTime() + 3600000);

      const priceBucketSize = 0.1; // 0.1% bucket
      const priceLevelBucket = Math.floor(priceLevel / priceBucketSize) * priceBucketSize;
      const priceBucketEnd = priceLevelBucket + priceBucketSize;

      const alerts = await this.anomalyAlertRepository.find({
        where: {
          tradingPair,
          createdAt: Between(bucketStart, bucketEnd),
        },
      });

      // Create or update heatmap metric
      let metric = await this.heatmapRepository.findOne({
        where: {
          tradingPair,
          timeWindow: bucketStart,
          priceLevel: priceLevelBucket,
        },
      });

      if (!metric) {
        metric = new HeatmapMetric();
        metric.tradingPair = tradingPair;
        metric.timeWindow = bucketStart;
        metric.priceLevel = priceLevelBucket;
        metric.priceBucket = `${priceLevelBucket.toFixed(2)}-${priceBucketEnd.toFixed(2)}`;
      }

      // Update metrics
      metric.anomalyCounts = alerts.length;
      metric.spoofingCount = alerts.filter(a => a.anomalyType === AnomalyType.SPOOFING).length;
      metric.layeringCount = alerts.filter(a => a.anomalyType === AnomalyType.LAYERING).length;
      metric.washTradingCount = alerts.filter(
        a => a.anomalyType === AnomalyType.WASH_TRADING,
      ).length;
      metric.otherAnomalyCount = alerts.length -
        metric.spoofingCount -
        metric.layeringCount -
        metric.washTradingCount;

      // Calculate risk score
      metric.riskScore = Math.min(100, alerts.length * 10);
      metric.riskLevel = metric.riskScore >= 80
        ? 'CRITICAL'
        : metric.riskScore >= 60
          ? 'HIGH'
          : metric.riskScore >= 40
            ? 'MEDIUM'
            : 'LOW';

      metric.isHotspot = metric.riskScore >= 75;
      metric.visualizationColor = this.getColorForRiskLevel(metric.riskLevel);
      metric.visualizationIntensity = this.getIntensityForRiskLevel(metric.riskLevel);

      await this.heatmapRepository.save(metric);

      this.logger.debug(
        `Aggregated heatmap metrics for ${tradingPair} at ${priceLevel}`,
      );
    } catch (error) {
      this.logger.error(`Error aggregating heatmap metrics: ${error.message}`);
    }
  }
}
