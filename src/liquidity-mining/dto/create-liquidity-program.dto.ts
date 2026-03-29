import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsString, Min } from 'class-validator';

export class CreateLiquidityProgramDto {
  @ApiProperty()
  @IsString()
  poolId: string;

  @ApiProperty()
  @IsDateString()
  startAt: string;

  @ApiProperty()
  @IsDateString()
  endAt: string;

  @ApiProperty({ default: 30 })
  @IsNumber()
  @Min(1)
  vestingDays: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  rewardBudget: number;
}
