import { Module } from '@nestjs/common';
import { CrossChainRoutingService } from './cross-chain-routing.service';
import { BridgeService } from './bridge.service';
import { CrossChainController } from './cross-chain.controller';

@Module({
  imports: [],
  controllers: [CrossChainController],
  providers: [CrossChainRoutingService, BridgeService],
  exports: [CrossChainRoutingService, BridgeService],
})
export class CrossChainModule {}
