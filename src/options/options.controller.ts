import { Body, Controller, Get, Param, Post, Query, Delete, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateOptionContractDto } from './dto/create-option-contract.dto';
import { PlaceOptionOrderDto } from './dto/place-option-order.dto';
import { OptionsService } from './options.service';
import { CancelOptionOrderDto } from './dto/cancel-option-order.dto';
import { UpdateOptionContractDto } from './dto/update-option-contract.dto';

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

  @Get('contracts/:contractId')
  getContract(@Param('contractId') contractId: string) {
    return this.optionsService.getContract(contractId);
  }

  @Patch('contracts/:contractId')
  updateContract(@Param('contractId') contractId: string, @Body() dto: UpdateOptionContractDto) {
    return this.optionsService.updateContract(contractId, dto);
  }

  @Delete('contracts/:contractId')
  deleteContract(@Param('contractId') contractId: string) {
    return this.optionsService.deleteContract(contractId);
  }

  @Get('orders/:orderId')
  getOrder(@Param('orderId') orderId: string) {
    return this.optionsService.getOrder(orderId);
  }

  @Post('orders/:orderId/cancel')
  cancelOrder(@Param('orderId') orderId: string, @Body() dto: CancelOptionOrderDto) {
    return this.optionsService.cancelOrder(orderId, dto);
  }

  @Get('orders/user/:userId')
  getUserOrders(@Param('userId') userId: string, @Query('status') status?: string) {
    return this.optionsService.getUserOrders(Number(userId), status);
  }

  @Get('risk/:userId')
  getUserRisk(@Param('userId') userId: string) {
    return this.optionsService.getUserRisk(Number(userId));
  }

  @Get('greeks/:contractId')
  getContractGreeks(@Param('contractId') contractId: string) {
    return this.optionsService.getContractGreeks(contractId);
  }

  @Get('orderbook/:contractId')
  getOrderBook(@Param('contractId') contractId: string) {
    return this.optionsService.getOrderBook(contractId);
  }

  @Post('expiry/process')
  processExpiry(@Body() body: { settlementPrices?: Record<string, number> }) {
    return this.optionsService.processExpiries(body?.settlementPrices);
  }
}
