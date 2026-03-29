import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { VoteChoice } from '../entities/governance-vote.entity';

export class CastVoteDto {
  @ApiProperty()
  @IsNumber()
  voterUserId: number;

  @ApiProperty({ enum: VoteChoice })
  @IsEnum(VoteChoice)
  choice: VoteChoice;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
