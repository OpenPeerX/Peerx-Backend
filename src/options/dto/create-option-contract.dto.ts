import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { OptionType } from '../entities/option-contract.entity';

export class CreateOptionContractDto {
  @ApiProperty()
  @IsString()
  underlyingAsset: string;

  @ApiProperty({ enum: OptionType })
  @IsEnum(OptionType)
  optionType: OptionType;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  strikePrice: number;

  @ApiProperty()
  @IsDateString()
  expiryAt: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  markPrice: number;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(0.0001)
  contractSize: number;

  @ApiProperty({ default: 0.5 })
  @IsNumber()
  @Min(0.01)
  volatility: number;
}
