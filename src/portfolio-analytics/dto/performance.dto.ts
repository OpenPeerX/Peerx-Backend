import { IsNumber, IsOptional, IsString, IsDate, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PerformancePeriod } from '../entities/performance-history.entity';

export class PerformanceMetricsDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  totalReturn: number;

  @IsNumber()
  annualizedReturn: number;

  @IsNumber()
  @IsOptional()
  benchmarkReturn?: number;

  @IsNumber()
  @IsOptional()
  excessReturn?: number;

  @IsNumber()
  @IsOptional()
  volatility?: number;

  @IsNumber()
  @IsOptional()
  sharpeRatio?: number;

  @IsNumber()
  @IsOptional()
  maxDrawdown?: number;

  @IsNumber()
  @IsOptional()
  winRate?: number;

  @IsNumber()
  @IsOptional()
  totalTrades?: number;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;
}

export class PerformanceHistoryQueryDto {
  @IsEnum(PerformancePeriod)
  @IsOptional()
  period?: PerformancePeriod;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

export class PerformanceAttributionDto {
  @IsString()
  assetClass: string;

  @IsNumber()
  contribution: number;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsNumber()
  @IsOptional()
  return?: number;
}
