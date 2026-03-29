import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateGovernanceProposalDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  title: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  proposerUserId: number;

  @ApiProperty()
  @IsDateString()
  startAt: string;

  @ApiProperty()
  @IsDateString()
  endAt: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  quorumThreshold: number;

  @ApiProperty({ default: true })
  @IsBoolean()
  executable: boolean;
}
