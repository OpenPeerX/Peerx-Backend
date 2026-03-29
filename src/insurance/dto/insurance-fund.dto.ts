import { IsNumber, IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { FundStatus, FundType } from '../entities/insurance-fund.entity';

export class CreateInsuranceFundDto {
  @IsEnum(FundType)
  fundType: FundType;

  @IsNumber()
  minimumBalance: number;

  @IsNumber()
  targetBalance: number;

  @IsNumber()
  @IsOptional()
  coverageRatio?: number;

  @IsNumber()
  @IsOptional()
  contributionRate?: number;

  @IsBoolean()
  @IsOptional()
  autoRefillEnabled?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateInsuranceFundDto {
  @IsEnum(FundStatus)
  @IsOptional()
  status?: FundStatus;

  @IsNumber()
  @IsOptional()
  minimumBalance?: number;

  @IsNumber()
  @IsOptional()
  targetBalance?: number;

  @IsNumber()
  @IsOptional()
  coverageRatio?: number;

  @IsNumber()
  @IsOptional()
  contributionRate?: number;

  @IsBoolean()
  @IsOptional()
  autoRefillEnabled?: boolean;
}

export class InsuranceFundResponseDto {
  id: number;
  fundType: FundType;
  status: FundStatus;
  balance: number;
  minimumBalance: number;
  targetBalance: number;
  totalContributions: number;
  totalPayouts: number;
  claimCount: number;
  liquidationsCovered: number;
  coverageRatio: number;
  contributionRate: number;
  createdAt: Date;
  updatedAt: Date;
}
