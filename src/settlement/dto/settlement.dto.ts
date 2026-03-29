import { IsString, IsDecimal, IsUUID, IsOptional, IsEnum, IsObject } from 'class-validator';
import { SettlementStatus, ComplianceStatus } from '../entities/settlement.entity';

export class CreateSettlementDto {
  @IsUUID()
  fromAddress: string;

  @IsUUID()
  toAddress: string;

  @IsDecimal({ decimal_digits: '1,8' })
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  sourceCurrency?: string;

  @IsOptional()
  @IsString()
  routingPath?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateSettlementDto {
  @IsOptional()
  @IsString()
  status?: SettlementStatus;

  @IsOptional()
  @IsString()
  complianceStatus?: ComplianceStatus;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  executedAmount?: number;

  @IsOptional()
  @IsObject()
  auditTrail?: any;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SettlementResponseDto {
  id: string;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  batchId?: string;
  sourceCurrency?: string;
  fxRate?: number;
  convertedAmount?: number;
  fxSource?: string;
  routingPath?: string;
  complianceStatus: ComplianceStatus;
  complianceNotes?: string;
  auditTrail?: any;
  settlementReference?: string;
  executedAmount?: number;
  failureReason?: string;
  settlementMethod?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  reconciledAt?: Date;
  retryCount: number;
}

export class SettlementBatchQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  skip?: number;

  @IsOptional()
  take?: number;
}

export class SettlementQueryDto {
  @IsOptional()
  @IsString()
  status?: SettlementStatus;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsString()
  complianceStatus?: ComplianceStatus;

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
