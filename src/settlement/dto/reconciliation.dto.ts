import { IsString, IsDecimal, IsUUID, IsOptional, IsArray, IsObject, IsBoolean } from 'class-validator';
import { DiscrepancyType, ResolutionStatus } from '../entities/settlement-reconciliation.entity';

export class InitiateReconciliationDto {
  @IsUUID()
  batchId: string;

  @IsOptional()
  @IsString()
  reconciliationType?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ReconciliationDiscrepancyDto {
  @IsString()
  discrepancyType: DiscrepancyType;

  @IsOptional()
  @IsUUID()
  settlementId?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  expectedAmount?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  actualAmount?: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  requiresManualReview?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ResolveDiscrepancyDto {
  @IsUUID()
  discrepancyId: string;

  @IsString()
  resolutionStatus: ResolutionStatus;

  @IsString()
  resolutionNotes: string;

  @IsOptional()
  @IsString()
  approvalReference?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SettlementReconciliationResponseDto {
  id: string;
  batchId: string;
  discrepancyType: DiscrepancyType;
  settlementId?: string;
  settlementReference?: string;
  expectedAmount?: number;
  actualAmount?: number;
  varianceAmount?: number;
  variancePercent?: number;
  expectedCurrency?: string;
  actualCurrency?: string;
  expectedStatus?: string;
  actualStatus?: string;
  description: string;
  resolutionStatus: ResolutionStatus;
  resolutionNotes?: string;
  investigatedBy?: string;
  investigatedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  isSystematic: boolean;
  requiresManualReview: boolean;
  impactsReconciliation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ReconciliationSummaryDto {
  batchId: string;
  totalSettlements: number;
  matchedCount: number;
  discrepancyCount: number;
  discrepancyTypes: {
    type: DiscrepancyType;
    count: number;
  }[];
  totalVarianceAmount: number;
  totalVariancePercent: number;
  systematicIssuesDetected: boolean;
  requiresManualIntervention: boolean;
  resolutionStatus: string;
  timestamp: Date;
}

export class BulkReconciliationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  batchIds: string[];

  @IsOptional()
  @IsString()
  reconciliationType?: string;
}

export class ReconciliationReportDto {
  reportId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalBatchesProcessed: number;
  totalSettlementsReconciled: number;
  matchRate: number; // Percentage
  discrepancyRate: number; // Percentage
  systematiIssues: {
    issueType: string;
    occurrenceCount: number;
    severity: string;
  }[];
  totalVarianceAmount: number;
  averageResolutionTime: number; // Hours
  manualInterventionRequired: boolean;
}

export class DiscrepancyFilterDto {
  @IsOptional()
  @IsString()
  discrepancyType?: DiscrepancyType;

  @IsOptional()
  @IsString()
  resolutionStatus?: ResolutionStatus;

  @IsOptional()
  @IsBoolean()
  requiresManualReview?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystematic?: boolean;

  @IsOptional()
  skip?: number;

  @IsOptional()
  take?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

export class ExceptionHandlingDto {
  @IsUUID()
  discrepancyId: string;

  @IsString()
  exceptionType: string; // AUTO_RESOLVED, MANUAL_OVERRIDE, WAIVED, ESCALATED

  @IsString()
  justification: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
