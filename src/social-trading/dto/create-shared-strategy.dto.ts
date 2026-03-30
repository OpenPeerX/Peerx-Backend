import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSharedStrategyDto {
  @ApiProperty({ example: 42 })
  @IsNumber()
  traderId: number;

  @ApiProperty({ example: 'BTC Swing Breakout' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiProperty({ example: 'Captures continuation moves after range expansion.' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'BTC' })
  @IsString()
  asset: string;

  @ApiPropertyOptional({ default: 'SPOT' })
  @IsOptional()
  @IsString()
  marketType?: string;

  @ApiPropertyOptional({ enum: ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] })
  @IsOptional()
  @IsIn(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'])
  riskLevel?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumCapital?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  allocationPercentage?: number;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLossPercentage?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfitPercentage?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}