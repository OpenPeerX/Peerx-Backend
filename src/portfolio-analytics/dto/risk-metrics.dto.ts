import { IsNumber, IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class RiskMetricsResponseDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  @IsOptional()
  var95?: number;

  @IsNumber()
  @IsOptional()
  var99?: number;

  @IsNumber()
  @IsOptional()
  sharpeRatio?: number;

  @IsNumber()
  @IsOptional()
  sortinoRatio?: number;

  @IsNumber()
  @IsOptional()
  calmarRatio?: number;

  @IsNumber()
  @IsOptional()
  maxDrawdown?: number;

  @IsNumber()
  @IsOptional()
  currentDrawdown?: number;

  @IsNumber()
  @IsOptional()
  maxDrawdownDuration?: number;

  @IsNumber()
  @IsOptional()
  volatility?: number;

  @IsNumber()
  @IsOptional()
  annualizedVolatility?: number;

  @IsNumber()
  @IsOptional()
  beta?: number;

  @IsNumber()
  @IsOptional()
  alpha?: number;

  @IsString()
  @IsOptional()
  benchmark?: string;

  @IsDate()
  @Type(() => Date)
  calculatedAt: Date;
}

export class RiskMetricsQueryDto {
  @IsOptional()
  @IsString()
  period?: 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}
