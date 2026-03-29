import { IsString, IsDecimal, IsOptional, IsNumber, IsBoolean, IsObject } from 'class-validator';

export class FXRateDto {
  id?: string;

  @IsString()
  fromCurrency: string;

  @IsString()
  toCurrency: string;

  @IsDecimal({ decimal_digits: '1,8' })
  rate: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  minRate?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  maxRate?: number;

  @IsString()
  source: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsNumber()
  changePercent24h?: number;

  @IsOptional()
  @IsNumber()
  changePercent7d?: number;

  @IsOptional()
  @IsNumber()
  volatilityIndex?: number;

  @IsOptional()
  @IsNumber()
  volume24h?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateFXRateDto {
  @IsString()
  fromCurrency: string;

  @IsString()
  toCurrency: string;

  @IsDecimal({ decimal_digits: '1,8' })
  rate: number;

  @IsString()
  source: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  minRate?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  maxRate?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateFXRateDto {
  @IsOptional()
  @IsDecimal({ decimal_digits: '1,8' })
  rate?: number;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class FXRateQueryDto {
  @IsOptional()
  @IsString()
  fromCurrency?: string;

  @IsOptional()
  @IsString()
  toCurrency?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  skip?: number;

  @IsOptional()
  take?: number;
}

export class ConvertAmountDto {
  @IsDecimal({ decimal_digits: '1,8' })
  amount: number;

  @IsString()
  fromCurrency: string;

  @IsString()
  toCurrency: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class ConversionResultDto {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  fxRate: number;
  source: string;
  confidence: number;
  timestamp: Date;
  expiration: Date;
  volatilityIndex?: number;
}

export class BulkFXRateDto {
  rates: FXRateDto[];

  @IsOptional()
  @IsString()
  source?: string;
}

export class FXRateHistoryDto {
  @IsString()
  fromCurrency: string;

  @IsString()
  toCurrency: string;

  @IsOptional()
  @IsNumber()
  days?: number; // Default 30

  @IsOptional()
  @IsNumber()
  skipRecords?: number;

  @IsOptional()
  @IsNumber()
  takeRecords?: number;
}

export class HistoricalFXRateDto {
  timestamp: Date;
  rate: number;
  minRate?: number;
  maxRate?: number;
  source: string;
  confidence: number;
  volatilityIndex?: number;
}

export class VolatilityAlertDto {
  fromCurrency: string;
  toCurrency: string;
  currentVolatility: number;
  threshold: number;
  changePercent24h: number;
  changePercent7d: number;
  severity: string; // LOW, MEDIUM, HIGH, CRITICAL
}
