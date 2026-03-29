import { IsNumber, IsOptional, IsEnum, IsString } from 'class-validator';
import { ContributionType } from '../entities/insurance-contribution.entity';

export class CreateContributionDto {
  @IsNumber()
  fundId: number;

  @IsNumber()
  @IsOptional()
  userId?: number;

  @IsEnum(ContributionType)
  type: ContributionType;

  @IsNumber()
  amount: number;

  @IsNumber()
  @IsOptional()
  baseAmount?: number;

  @IsString()
  @IsOptional()
  sourceReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ContributionResponseDto {
  id: number;
  fundId: number;
  userId?: number;
  type: ContributionType;
  status: string;
  amount: number;
  rate?: number;
  createdAt: Date;
}
