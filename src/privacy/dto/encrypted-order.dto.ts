import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { EncryptedOrderStatus } from '../entities/encrypted-order.entity';

export class CreateEncryptedOrderDto {
  @IsString()
  encryptedOrderDetails: string;

  @IsString()
  orderHash: string;

  @IsString()
  encryptionNonce: string;

  @IsObject()
  @IsOptional()
  orderMetadata?: {
    symbol?: string;
    side?: 'BUY' | 'SELL';
    orderType?: 'MARKET' | 'LIMIT' | 'STOP';
    estimatedAmount?: string;
  };

  @IsString()
  @IsOptional()
  encryptedZKProof?: string;
}

export class UpdateEncryptedOrderDto {
  @IsEnum(EncryptedOrderStatus)
  @IsOptional()
  status?: EncryptedOrderStatus;

  @IsString()
  @IsOptional()
  linkedOrderId?: string;

  @IsString()
  @IsOptional()
  encryptedMatchDetails?: string;
}

export class EncryptedOrderResponseDto {
  id: string;
  pseudonymousId: string;
  orderHash: string;
  orderMetadata?: {
    symbol?: string;
    side?: 'BUY' | 'SELL';
    orderType?: 'MARKET' | 'LIMIT' | 'STOP';
    estimatedAmount?: string;
  };
  status: EncryptedOrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class DecryptedOrderDto {
  id: string;
  pseudonymousId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  expiration: Date;
  slippage: number;
  conditions?: object;
  status: EncryptedOrderStatus;
  createdAt: Date;
}
