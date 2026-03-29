import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class StakeLiquidityDto {
  @ApiProperty()
  @IsNumber()
  userId: number;

  @ApiProperty()
  @IsString()
  poolId: string;

  @ApiProperty()
  @IsString()
  programId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  amount: number;
}
