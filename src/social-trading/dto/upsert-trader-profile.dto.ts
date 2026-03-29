import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTraderProfileDto {
  @ApiProperty({ example: 'Macro Momentum Desk' })
  @IsString()
  @MaxLength(120)
  displayName: string;

  @ApiPropertyOptional({ example: 'Systematic macro trader focused on liquid majors.' })
  @IsOptional()
  @IsString()
  biography?: string;

  @ApiPropertyOptional({ example: 'Momentum and breakout strategies' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ enum: ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] })
  @IsOptional()
  @IsIn(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'])
  riskAppetite?: string;

  @ApiPropertyOptional({ enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'] })
  @IsOptional()
  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'])
  experienceLevel?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}