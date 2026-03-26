import { IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { LearningLevel } from '../entities/learning-profile.entity';

export class LeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(LearningLevel)
  level?: LearningLevel;

  @IsOptional()
  timeFrame?: 'all' | 'week' | 'month' | 'year';
}
