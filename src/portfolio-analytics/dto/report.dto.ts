import { IsString, IsOptional, IsEnum, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { PerformancePeriod } from '../entities/performance-history.entity';

export enum ReportFormat {
  CSV = 'csv',
  JSON = 'json',
  PDF = 'pdf',
}

export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class ReportQueryDto {
  @IsEnum(ReportPeriod)
  @IsOptional()
  period?: ReportPeriod;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;
}

export class DashboardDataDto {
  @IsString()
  period: string;

  portfolioValue: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  totalReturn: number;
  
  riskMetrics: {
    var95: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  };

  performanceHistory: Array<{
    date: string;
    value: number;
    return: number;
  }>;

  assetAllocation: Record<string, number>;
  topPerformers: Array<{
    asset: string;
    return: number;
  }>;
  worstPerformers: Array<{
    asset: string;
    return: number;
  }>;
}
