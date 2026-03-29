import { IsString, IsDecimal, IsBoolean, IsOptional, IsArray, IsObject, IsNumber } from 'class-validator';
import { ComplianceLevel, SettlementRailType } from '../entities/currency-config.entity';

export class CreateCurrencyConfigDto {
  @IsString()
  currency: string;

  @IsString()
  name: string;

  @IsString()
  currencyType: string; // FIAT, STABLECOIN, CRYPTO

  @IsDecimal({ decimal_digits: '1,8' })
  minSettlementAmount: number;

  @IsDecimal({ decimal_digits: '1,8' })
  maxSettlementAmount: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  dailyLimitAmount?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  monthlyLimitAmount?: number;

  @IsString()
  complianceLevel: ComplianceLevel;

  @IsOptional()
  @IsString()
  nativeCurrency?: string;

  @IsOptional()
  @IsArray()
  supportedRails?: SettlementRailType[];

  @IsOptional()
  @IsString()
  preferredRail?: SettlementRailType;

  @IsOptional()
  @IsBoolean()
  requiresFxConversion?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAmlCheck?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresKycVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresManualApproval?: boolean;

  @IsOptional()
  @IsNumber()
  feePercent?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  flatFee?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateCurrencyConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  minSettlementAmount?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  maxSettlementAmount?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  dailyLimitAmount?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  monthlyLimitAmount?: number;

  @IsOptional()
  @IsString()
  complianceLevel?: ComplianceLevel;

  @IsOptional()
  @IsArray()
  supportedRails?: SettlementRailType[];

  @IsOptional()
  @IsString()
  preferredRail?: SettlementRailType;

  @IsOptional()
  @IsBoolean()
  requiresFxConversion?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresAmlCheck?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresKycVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresManualApproval?: boolean;

  @IsOptional()
  @IsNumber()
  feePercent?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  flatFee?: number;

  @IsOptional()
  @IsString()
  fxRoutingPath?: string;

  @IsOptional()
  @IsNumber()
  maxFxSpread?: number;

  @IsOptional()
  @IsNumber()
  settlementTimeframeHours?: number;

  @IsOptional()
  @IsNumber()
  maxProcessingTimeHours?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CurrencyConfigResponseDto {
  id: string;
  currency: string;
  name: string;
  currencyType: string;
  isEnabled: boolean;
  minSettlementAmount: number;
  maxSettlementAmount: number;
  dailyLimitAmount?: number;
  monthlyLimitAmount?: number;
  nativeCurrency?: string;
  requiresFxConversion: boolean;
  fxRoutingPath: string;
  maxFxSpread: number;
  supportedRails: SettlementRailType[];
  preferredRail: SettlementRailType;
  complianceLevel: ComplianceLevel;
  feePercent?: number;
  flatFee?: number;
  requiresAmlCheck: boolean;
  requiresKycVerification: boolean;
  requiresManualApproval: boolean;
  settlementTimeframeHours: number;
  maxProcessingTimeHours: number;
  isBatchEnabled: boolean;
  maxBatchSize: number;
  batchFrequency: string;
  reconciliationType: string;
  reconciliationDelayHours: number;
  tolerancePercent: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CurrencyLimitCheckDto {
  currency: string;
  amount: number;
  dailyUsed: number;
  monthlyUsed: number;
  dailyAvailable: number;
  monthlyAvailable: number;
  isWithinLimits: boolean;
  warnings: string[];
}

export class BulkCurrencyConfigDto {
  @IsArray()
  configs: CreateCurrencyConfigDto[];
}

export class CurrencyComplianceCheckDto {
  @IsString()
  currency: string;

  @IsDecimal({ decimal_digits: '1,8' })
  amount: number;

  @IsString()
  recipientCountry?: string;

  @IsString()
  senderCountry?: string;

  @IsOptional()
  @IsString()
  transactionPurpose?: string;
}

export class ComplianceCheckResultDto {
  currency: string;
  amount: number;
  complianceLevel: ComplianceLevel;
  requiresAml: boolean;
  requiresKyc: boolean;
  requiresManualApproval: boolean;
  recommendations: string[];
  riskLevel: string; // LOW, MEDIUM, HIGH, CRITICAL
  flaggedForReview: boolean;
}
