import { IsNumber, IsString, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class AttributionResponseDto {
  @IsNumber()
  userId: number;

  @IsString()
  period: string;

  assetClassAttribution: Array<{
    assetClass: string;
    contribution: number;
    weight: number;
    return: number;
  }>;

  strategyAttribution: Array<{
    strategy: string;
    contribution: number;
    trades: number;
    winRate: number;
  }>;

  totalReturn: number;
  benchmarkReturn: number;
  activeReturn: number;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;
}

export class SnapshotCreateDto {
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timestamp?: Date;
}
