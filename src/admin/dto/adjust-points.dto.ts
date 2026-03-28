import { IsInt, IsString, IsNotEmpty, Min, Max } from 'class-validator';

export class AdjustPointsDto {
  @IsInt()
  @Min(-1000)
  @Max(1000)
  delta: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
