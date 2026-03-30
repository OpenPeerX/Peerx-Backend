import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class ConfigureCopyTradingDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  followerId: number;

  @ApiProperty({ example: 42 })
  @IsNumber()
  traderId: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsNumber()
  strategyId?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAllocationPercentage?: number;

  @ApiPropertyOptional({ default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTradeAmount?: number;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLossPercentage?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyLossLimitPercentage?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  copyRatio?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  slippageTolerancePercentage?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoExecute?: boolean;
}