import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PredictionQueryDto {
  @IsOptional()
  @IsIn(['1m', '5m', '1h', '1d'])
  timeframe?: '1m' | '5m' | '1h' | '1d';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  horizonSteps?: number;
}

export class RealtimePredictionsQueryDto {
  @IsOptional()
  @IsIn(['1m', '5m', '1h', '1d'])
  timeframe?: '1m' | '5m' | '1h' | '1d';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class BacktestQueryDto {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsIn(['1m', '5m', '1h', '1d'])
  timeframe: '1m' | '5m' | '1h' | '1d';

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(2_000)
  lookbackPoints: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  horizonSteps: number;
}

export class RetrainModelsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['1m', '5m', '1h', '1d'], { each: true })
  timeframes?: Array<'1m' | '5m' | '1h' | '1d'>;
}
