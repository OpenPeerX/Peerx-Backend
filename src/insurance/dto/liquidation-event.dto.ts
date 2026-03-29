import { IsNumber, IsOptional, IsEnum, IsString } from 'class-validator';

export class LiquidationEventDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  tradeId: number;

  @IsString()
  asset: string;

  @IsNumber()
  positionSize: number;

  @IsNumber()
  liquidationPrice: number;

  @IsNumber()
  totalLoss: number;

  @IsNumber()
  volatilityIndex: number;

  @IsString()
  @IsOptional()
  triggerReason?: string;
}

export class LiquidationEventResponseDto {
  id: number;
  userId: number;
  tradeId: number;
  asset: string;
  status: string;
  positionSize: number;
  liquidationPrice: number;
  totalLoss: number;
  coveredByInsurance: boolean;
  insuranceCoverage: number;
  createdAt: Date;
}

export class CoverageRequestDto {
  @IsNumber()
  liquidationEventId: number;

  @IsNumber()
  requestedAmount: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
