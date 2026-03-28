import { IsEnum, IsObject, IsOptional, IsNumber, Min, Max, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiskTolerance } from '../entities/portfolio-optimization.entity';

export class AssetConstraintDto {
  @ApiProperty({ description: 'Asset symbol (e.g., BTC, ETH, AAPL)' })
  @IsOptional()
  symbol?: string;

  @ApiProperty({ description: 'Minimum allocation percentage', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  minAllocation: number;

  @ApiProperty({ description: 'Maximum allocation percentage', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxAllocation: number;
}

export class OptimizationConstraintsDto {
  @ApiPropertyOptional({ description: 'Maximum number of assets in portfolio' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxAssets?: number;

  @ApiPropertyOptional({ description: 'Minimum allocation per asset (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minAllocationPerAsset?: number;

  @ApiPropertyOptional({ description: 'Maximum allocation per asset (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxAllocationPerAsset?: number;

  @ApiPropertyOptional({ description: 'Asset-specific constraints', type: [AssetConstraintDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetConstraintDto)
  assetConstraints?: AssetConstraintDto[];

  @ApiPropertyOptional({ description: 'Sector constraints' })
  @IsOptional()
  @IsObject()
  sectorConstraints?: Record<string, { min: number; max: number }>;

  @ApiPropertyOptional({ description: 'Geographic constraints' })
  @IsOptional()
  @IsObject()
  geographicConstraints?: Record<string, { min: number; max: number }>;
}

export class OptimizationRequestDto {
  @ApiProperty({ description: 'Risk tolerance level', enum: RiskTolerance })
  @IsEnum(RiskTolerance)
  riskTolerance: RiskTolerance;

  @ApiPropertyOptional({ description: 'Investment horizon in years' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(30)
  investmentHorizon?: number;

  @ApiPropertyOptional({ description: 'Target annual return (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetReturn?: number;

  @ApiPropertyOptional({ description: 'Maximum risk tolerance (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxRisk?: number;

  @ApiPropertyOptional({ description: 'Rebalancing frequency in days' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  rebalancingFrequency?: number;

  @ApiPropertyOptional({ description: 'Optimization constraints', type: OptimizationConstraintsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptimizationConstraintsDto)
  constraints?: OptimizationConstraintsDto;

  @ApiPropertyOptional({ description: 'Whether to use ML predictions' })
  @IsOptional()
  useMLPredictions?: boolean;

  @ApiPropertyOptional({ description: 'Whether to include alternative assets' })
  @IsOptional()
  includeAlternativeAssets?: boolean;
}
