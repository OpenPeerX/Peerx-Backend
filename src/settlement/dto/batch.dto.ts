import { IsString, IsDecimal, IsArray, IsOptional, IsObject, IsUUID } from 'class-validator';
import { BatchStatus, ReconciliationStatus } from '../entities/settlement-batch.entity';

export class CreateSettlementBatchDto {
  @IsString()
  currency: string;

  @IsDecimal({ decimal_digits: '1,8' })
  totalAmount: number;

  @IsArray()
  @IsUUID('4', { each: true })
  settlementIds: string[];

  @IsOptional()
  @IsString()
  sourceCurrency?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SubmitBatchDto {
  @IsUUID()
  batchId: string;

  @IsOptional()
  @IsString()
  approvalNotes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ApproveBatchDto {
  @IsUUID()
  batchId: string;

  @IsString()
  approvalNotes: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RejectBatchDto {
  @IsUUID()
  batchId: string;

  @IsString()
  rejectionReason: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SettlementBatchResponseDto {
  id: string;
  batchNumber: string;
  status: BatchStatus;
  currency: string;
  totalAmount: number;
  settlementCount: number;
  totalProcessedAmount: number;
  totalFailedAmount: number;
  successCount: number;
  failedCount: number;
  sourceCurrency?: string;
  averageFxRate?: number;
  totalConvertedAmount?: number;
  reconciliationStatus: ReconciliationStatus;
  submittedAt?: Date;
  processedAt?: Date;
  settledAt?: Date;
  reconciledAt?: Date;
  settlementReference?: string;
  bankBatchId?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BatchReconciliationDto {
  @IsUUID()
  batchId: string;

  @IsOptional()
  @IsString()
  reconciliationType?: string;

  @IsOptional()
  @IsObject()
  manualAdjustments?: Record<string, any>;
}

export class BatchStatusUpdateDto {
  @IsString()
  status: BatchStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BatchQueryDto {
  @IsOptional()
  @IsString()
  status?: BatchStatus;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  reconciliationStatus?: ReconciliationStatus;

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
