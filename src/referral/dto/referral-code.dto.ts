import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class GenerateReferralCodeDto {
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}

export class ReferralCodeResponseDto {
  code: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  qrCodeUrl?: string;
}
