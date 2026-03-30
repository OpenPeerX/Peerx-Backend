import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class FollowTraderDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  followerId: number;

  @ApiProperty({ example: 42 })
  @IsNumber()
  traderId: number;
}