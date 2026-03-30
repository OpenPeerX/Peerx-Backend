import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength } from 'class-validator';

export class AddStrategyCommentDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  userId: number;

  @ApiProperty({ example: 'Clear entry logic. How do you adapt to low-liquidity sessions?' })
  @IsString()
  @MaxLength(500)
  content: string;
}