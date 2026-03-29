import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { CustodyModel } from '../entities/multisig-wallet.entity';

export enum SignatureScheme {
  ECDSA = 'ECDSA',
  EDDSA = 'EDDSA',
  SCHNORR = 'SCHNORR',
}

export class CreateMultiSigWalletDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(1)
  chainId: number;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  signers: string[];

  @IsInt()
  @Min(2)
  threshold: number;

  @IsOptional()
  @IsEnum(CustodyModel)
  custodyModel?: CustodyModel;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SignatureScheme, { each: true })
  supportedSignatureSchemes?: SignatureScheme[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  hardwareRequiredAbove?: number;
}

export class RegisterHardwareWalletDto {
  @IsString()
  @IsNotEmpty()
  signerAddress: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fingerprint: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  publicKey?: string;
}

export class CreateEscrowDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  tradeId?: number;

  @IsString()
  @IsNotEmpty()
  walletId: string;

  @IsInt()
  @Min(1)
  chainId: number;

  @IsString()
  @IsNotEmpty()
  buyer: string;

  @IsString()
  @IsNotEmpty()
  seller: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  asset: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  tokenAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredApprovals?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class SubmitApprovalDto {
  @IsString()
  @IsNotEmpty()
  signerAddress: string;

  @IsString()
  @IsNotEmpty()
  payload: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsEnum(SignatureScheme)
  signatureScheme: SignatureScheme;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/)
  hardwareWalletFingerprint?: string;
}
