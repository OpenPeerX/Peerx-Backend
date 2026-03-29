import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { OptionOrderSide, OptionOrderType } from '../entities/option-order.entity';

export class PlaceOptionOrderDto {
  @ApiProperty()
  @IsNumber()
  userId: number;

  @ApiProperty({ enum: OptionOrderSide })
  @IsEnum(OptionOrderSide)
  side: OptionOrderSide;

  @ApiProperty({ enum: OptionOrderType })
  @IsEnum(OptionOrderType)
  orderType: OptionOrderType;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  limitPrice?: number;
}
