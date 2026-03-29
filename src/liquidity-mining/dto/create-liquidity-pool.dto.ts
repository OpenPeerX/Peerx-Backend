import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class CreateLiquidityPoolDto {
  @ApiProperty()
  @IsString()
  pairSymbol: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  currentDepth: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  targetDepth: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  baseApr: number;

  @ApiProperty()
  @IsString()
  rewardToken: string;

  @ApiProperty()
  @IsString()
  contractAddress: string;
}
