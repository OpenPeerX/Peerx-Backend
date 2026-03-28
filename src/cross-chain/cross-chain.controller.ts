import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CrossChainRoutingService } from './cross-chain-routing.service';
import { BridgeService } from './bridge.service';

@Controller('cross-chain')
export class CrossChainController {
  constructor(
    private readonly routingService: CrossChainRoutingService,
    private readonly bridgeService: BridgeService,
  ) {}

  @Get('route')
  getRoute(
    @Query('sourceToken') sourceToken: string,
    @Query('targetToken') targetToken: string,
    @Query('sourceChain') sourceChain: string,
    @Query('targetChain') targetChain: string,
    @Query('amount') amount: string,
  ) {
    return this.routingService.optimizeRoute(sourceToken, targetToken, sourceChain, targetChain, amount);
  }

  @Post('bridge')
  bridgeTokens(@Body() dto: { tokenId: string; sourceChain: string; targetChain: string; amount: string; senderId: string }) {
    return this.bridgeService.bridgeTokens(dto.tokenId, dto.sourceChain, dto.targetChain, dto.amount, dto.senderId);
  }

  @Get('status/:txHash')
  getStatus(@Param('txHash') txHash: string) {
    return this.bridgeService.checkBridgeStatus(txHash);
  }

  @Post('settle')
  settle(@Body() dto: { routeId: string; signedTxs: string[] }) {
    return this.routingService.settleCrossChain(dto.routeId, dto.signedTxs);
  }
}
