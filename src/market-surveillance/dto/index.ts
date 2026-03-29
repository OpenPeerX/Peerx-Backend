import { IsString, IsNumber, IsOptional, IsEnum, IsDefined, IsArray, IsUUID, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AnomalyType, SeverityLevel, AlertStatus } from '../entities/anomaly-alert.entity';

/**
 * Request DTOs for Alert Management
 */

export class CreateAnomalyAlertDto {
  @IsString()
  tradingPair: string;

  @IsUUID()
  actorId: string;

  @IsString()
  @IsOptional()
  walletAddress?: string;

  @IsEnum(AnomalyType)
  anomalyType: AnomalyType;

  @IsEnum(SeverityLevel)
  severity: SeverityLevel;

  @IsNumber()
  @Type(() => Number)
  confidenceScore: number; // 0-100

  @IsString()
  description: string;

  @IsOptional()
  detectionMetrics?: Record<string, any>;

  @IsOptional()
  evidenceData?: Record<string, any>;
}

export class GetAlertsFilterDto {
  @IsEnum(AlertStatus)
  @IsOptional()
  status?: AlertStatus;

  @IsEnum(SeverityLevel)
  @IsOptional()
  severity?: SeverityLevel;

  @IsUUID()
  @IsOptional()
  actorId?: string;

  @IsString()
  @IsOptional()
  tradingPair?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 100;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  offset?: number = 0;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt'; // Field to sort by

  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class InvestigateAlertDto {
  @IsUUID()
  alertId: string;

  @IsUUID()
  investigatorId: string;

  @IsString()
  notes: string;
}

export class ConfirmViolationDto {
  @IsUUID()
  alertId: string;

  @IsUUID()
  investigatorId: string;

  @IsString()
  findings: string;
}

export class ResolveAlertDto {
  @IsUUID()
  alertId: string;

  @IsString()
  resolution: string;
}

export class MarkFalsePositiveDto {
  @IsUUID()
  alertId: string;

  @IsString()
  reason: string;
}

export class EscalateAlertDto {
  @IsUUID()
  alertId: string;

  @IsEnum(AlertStatus)
  newStatus: AlertStatus;

  @IsString()
  reason: string;

  @IsUUID()
  escalatedBy: string;
}

/**
 * Response DTOs for Alerts
 */

export class AnomalyAlertResponseDto {
  id: string;
  tradingPair: string;
  actorId: string;
  walletAddress: string;
  anomalyType: AnomalyType;
  severity: SeverityLevel;
  status: AlertStatus;
  confidenceScore: number;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  investigatedAt?: Date;
  escalatedAt?: Date;
}

export class AlertStatsResponseDto {
  total: number;
  byStatus: {
    detected: number;
    investigating: number;
    confirmed: number;
    falsePositives: number;
    resolved: number;
  };
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  falsePositiveRate: number;
  confirmationRate: number;
}

/**
 * Throttling DTOs
 */

export class CheckThrottleDto {
  @IsUUID()
  actorId: string;

  @IsString()
  tradingPair: string;

  @IsNumber()
  @Type(() => Number)
  orderSize: number;

  @IsEnum(['BUY', 'SELL'])
  orderType: 'BUY' | 'SELL';
}

export class ApplyThrottleDto {
  @IsUUID()
  actorId: string;

  @IsEnum(['NONE', 'WARNING', 'LIGHT', 'MODERATE', 'SEVERE', 'SUSPENDED'])
  throttleLevel: string;

  @IsString()
  reason: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  durationMinutes?: number;
}

export class ReduceThrottleDto {
  @IsUUID()
  actorId: string;
}

export class AppealThrottleDto {
  @IsUUID()
  actorId: string;

  @IsString()
  reason: string;

  @IsUUID()
  submittedBy: string;
}

export class DecideAppealDto {
  @IsString()
  appealId: string;

  @IsBoolean()
  approved: boolean;

  @IsString()
  reason: string;

  @IsUUID()
  decisionMaker: string;
}

export class ThrottleStatusResponseDto {
  actorId: string;
  throttleLevel: string;
  throttlePercent: number;
  reason: string;
  throttledUntil?: Date;
  isCurrentlySuspended: boolean;
  riskScore: number;
  riskLevel: string;
}

export class ThrottleStatsResponseDto {
  suspended: number;
  severe: number;
  moderate: number;
  light: number;
  warning: number;
  total: number;
  percentThrottled: number;
}

/**
 * Dashboard/Visualization DTOs
 */

export class GetDashboardDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  hoursBack?: number = 24;
}

export class GetHeatmapDto {
  @IsString()
  tradingPair: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  hoursBack?: number = 24;

  @IsEnum(['HOURLY', 'DAILY'])
  @IsOptional()
  interval?: 'HOURLY' | 'DAILY' = 'HOURLY';
}

export class GetTimeSeriesDto {
  @IsString()
  @IsOptional()
  anomalyType?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  hoursBack?: number = 24;

  @IsEnum(['HOURLY', 'DAILY'])
  @IsOptional()
  interval?: 'HOURLY' | 'DAILY' = 'HOURLY';
}

export class DashboardResponseDto {
  totalAlerts: number;
  alertsBySeverity: Record<string, number>;
  alertsByType: Record<string, number>;
  topTradingPairs: Array<{ pair: string; count: number }>;
  topSuspiciousActors: Array<{
    actorId: string;
    violationCount: number;
    riskScore: number;
  }>;
  heatmaps: Record<string, any>[];
  throttleStats: {
    suspended: number;
    severe: number;
    moderate: number;
  };
}

/**
 * Backtest DTOs
 */

export class RunBacktestDto {
  @IsDefined()
  @Type(() => Date)
  startDate: Date;

  @IsDefined()
  @Type(() => Date)
  endDate: Date;

  @IsArray()
  @IsString({ each: true })
  tradingPairs: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  patterns?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modelIds?: string[];
}

export class AnalyzePatternsDto {
  @IsDefined()
  @Type(() => Date)
  startDate: Date;

  @IsDefined()
  @Type(() => Date)
  endDate: Date;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  patterns?: string[];
}

export class CompareModelsDto {
  @IsDefined()
  @Type(() => Date)
  startDate: Date;

  @IsDefined()
  @Type(() => Date)
  endDate: Date;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modelIds?: string[];
}

export class SimulateDetectionDto {
  @IsDefined()
  @Type(() => Date)
  startDate: Date;

  @IsDefined()
  @Type(() => Date)
  endDate: Date;

  @IsArray()
  @IsString({ each: true })
  tradingPairs: string[];
}

export class BacktestResultResponseDto {
  testId: string;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
  period: { startDate: Date; endDate: Date };
  durationSeconds: number;
  totalAlerts: number;
  confirmedViolations: number;
  falsePositives: number;
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    accuracy: number;
  };
  patternPerformance: Record<string, any>;
  recommendations: string[];
}

/**
 * Pattern Detection Configuration DTOs
 */

export class CreatePatternTemplateDto {
  @IsString()
  name: string;

  @IsEnum(AnomalyType)
  patternType: AnomalyType;

  @IsString()
  description: string;

  @IsDefined()
  rules: {
    timeWindowSeconds: number;
    minOrderCount?: number;
    minCancellationRate?: number;
    minVolumeThreshold?: number;
    maxOrdersPerSecond?: number;
    [key: string]: any;
  };

  @IsDefined()
  scoringConfig: {
    baseScore: number;
    ruleWeights: Record<string, number>;
    minConfidenceThreshold: number;
    [key: string]: any;
  };
}

export class UpdatePatternTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  rules?: Record<string, any>;

  @IsOptional()
  scoringConfig?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PatternTemplateResponseDto {
  id: string;
  name: string;
  patternType: AnomalyType;
  status: string;
  isActive: boolean;
  version: number;
  description: string;
  rules: Record<string, any>;
  scoringConfig: Record<string, any>;
  truePositiveRate: number;
  falsePositiveRate: number;
  detectionRate: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Actor/SuspiciousActor DTOs
 */

export class GetActorsFilterDto {
  @IsEnum(['NONE', 'WARNING', 'LIGHT', 'MODERATE', 'SEVERE', 'SUSPENDED'])
  @IsOptional()
  throttleLevel?: string;

  @IsString()
  @IsOptional()
  riskLevel?: string; // LOW, MEDIUM, HIGH, CRITICAL

  @IsBoolean()
  @IsOptional()
  isUnderInvestigation?: boolean;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 100;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  offset?: number = 0;
}

export class SuspiciousActorResponseDto {
  id: string;
  actorId: string;
  walletAddress: string;
  name: string;
  throttleLevel: string;
  throttlePercent: number;
  riskScore: number;
  riskLevel: string;
  totalViolations: number;
  violationBreakdown: {
    spoofing: number;
    layering: number;
    washTrading: number;
    other: number;
  };
  isUnderInvestigation: boolean;
  lastAlertTime: Date;
  lastViolationTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Export/Report DTOs
 */

export class ExportReportDto {
  @IsEnum(['PDF', 'CSV', 'JSON'])
  format: string;

  @IsDefined()
  @Type(() => Date)
  startDate: Date;

  @IsDefined()
  @Type(() => Date)
  endDate: Date;

  @IsString()
  @IsOptional()
  tradingPair?: string;

  @IsBoolean()
  @IsOptional()
  includeDetails?: boolean = true;
}

export class ReportResponseDto {
  reportId: string;
  format: string;
  period: { startDate: Date; endDate: Date };
  generatedAt: Date;
  downloadUrl: string;
  sizeBytes: number;
}
