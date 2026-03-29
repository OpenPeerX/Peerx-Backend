import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiquidityMiningProgram } from './entities/liquidity-mining-program.entity';
import { LiquidityPool } from './entities/liquidity-pool.entity';
import { LiquidityRewardLedger } from './entities/liquidity-reward-ledger.entity';
import { LiquidityStakePosition } from './entities/liquidity-stake-position.entity';
import { LiquidityMiningController } from './liquidity-mining.controller';
import { LiquidityMiningService } from './liquidity-mining.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiquidityPool,
      LiquidityMiningProgram,
      LiquidityStakePosition,
      LiquidityRewardLedger,
    ]),
  ],
  controllers: [LiquidityMiningController],
  providers: [LiquidityMiningService],
  exports: [LiquidityMiningService],
})
export class LiquidityMiningModule {}
