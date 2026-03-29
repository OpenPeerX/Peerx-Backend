import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateOptionContractDto } from './dto/create-option-contract.dto';
import { PlaceOptionOrderDto } from './dto/place-option-order.dto';
import { OptionsService } from './options.service';

@ApiTags('options')
@Controller('options')
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @Post('contracts')
  createContract(@Body() dto: CreateOptionContractDto) {
    return this.optionsService.createContract(dto);
  }

  @Get('chain')
  getOptionChain(@Query('underlyingAsset') underlyingAsset: string) {
    return this.optionsService.getOptionChain(underlyingAsset);
  }

  @Post('contracts/:contractId/orders')
  placeOrder(@Param('contractId') contractId: string, @Body() dto: PlaceOptionOrderDto) {
    return this.optionsService.placeOrder(contractId, dto);
  }

  @Get('positions/:userId')
  getPositions(@Param('userId') userId: string) {
    return this.optionsService.getPositions(Number(userId));
  }

  @Post('expiry/process')
  processExpiry(@Body() body: { settlementPrices?: Record<string, number> }) {
    return this.optionsService.processExpiries(body?.settlementPrices);
  }
}
