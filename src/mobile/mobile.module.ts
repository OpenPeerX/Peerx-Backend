import { Module } from '@nestjs/common';
import { GovernanceModule } from '../governance/governance.module';
import { LiquidityMiningModule } from '../liquidity-mining/liquidity-mining.module';
import { OptionsModule } from '../options/options.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [GovernanceModule, OptionsModule, LiquidityMiningModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
