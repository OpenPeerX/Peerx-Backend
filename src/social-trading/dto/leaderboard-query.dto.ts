import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ enum: ['BALANCED', 'RETURNS', 'CONSISTENCY'], default: 'BALANCED' })
  @IsOptional()
  @IsIn(['BALANCED', 'RETURNS', 'CONSISTENCY'])
  ranking?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}