import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OptionContractStatus } from '../entities/option-contract.entity';

export class UpdateOptionContractDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  markPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  volatility?: number;

  @ApiProperty({ enum: OptionContractStatus, required: false })
  @IsOptional()
  @IsEnum(OptionContractStatus)
  status?: OptionContractStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  settlementPrice?: number;
}
