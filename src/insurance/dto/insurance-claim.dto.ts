import { IsNumber, IsOptional, IsEnum, IsString, IsDecimal } from 'class-validator';
import { ClaimReason, ClaimStatus } from '../entities/insurance-claim.entity';

export class CreateClaimDto {
  @IsNumber()
  fundId: number;

  @IsNumber()
  userId: number;

  @IsEnum(ClaimReason)
  reason: ClaimReason;

  @IsNumber()
  claimAmount: number;

  @IsNumber()
  @IsOptional()
  originalLoss?: number;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  liquidationEventReference?: string;
}

export class ApproveClaimDto {
  @IsNumber()
  claimId: number;

  @IsNumber()
  approverUserId: number;

  @IsNumber()
  @IsOptional()
  paidAmount?: number;
}

export class ClaimResponseDto {
  id: number;
  fundId: number;
  userId: number;
  status: ClaimStatus;
  reason: ClaimReason;
  claimAmount: number;
  paidAmount: number;
  coveragePercentage?: number;
  createdAt: Date;
  paidAt?: Date;
}
