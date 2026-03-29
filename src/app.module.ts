import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GovernanceModule } from './governance/governance.module';
import { OptionsModule } from './options/options.module';
import { LiquidityMiningModule } from './liquidity-mining/liquidity-mining.module';
import { MobileModule } from './mobile/mobile.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AuditEntry } from './platform/entities/audit-entry.entity';
import { GovernanceProposal } from './governance/entities/governance-proposal.entity';
import { GovernanceVote } from './governance/entities/governance-vote.entity';
import { GovernanceStake } from './governance/entities/governance-stake.entity';
import { OptionContract } from './options/entities/option-contract.entity';
import { OptionOrder } from './options/entities/option-order.entity';
import { OptionPosition } from './options/entities/option-position.entity';
import { LiquidityPool } from './liquidity-mining/entities/liquidity-pool.entity';
import { LiquidityMiningProgram } from './liquidity-mining/entities/liquidity-mining-program.entity';
import { LiquidityStakePosition } from './liquidity-mining/entities/liquidity-stake-position.entity';
import { LiquidityRewardLedger } from './liquidity-mining/entities/liquidity-reward-ledger.entity';
import { PrivacyProfile } from './privacy/entities/privacy-profile.entity';
import { EncryptedOrder } from './privacy/entities/encrypted-order.entity';
import { PrivacyAuditLog } from './privacy/entities/privacy-audit-log.entity';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'swaptrade.db',
      entities: [
        AuditEntry,
        GovernanceProposal,
        GovernanceVote,
        GovernanceStake,
        OptionContract,
        OptionOrder,
        OptionPosition,
        LiquidityPool,
        LiquidityMiningProgram,
        LiquidityStakePosition,
        LiquidityRewardLedger,
        PrivacyProfile,
        EncryptedOrder,
        PrivacyAuditLog,
      ],
      synchronize: true,
    }),
    PlatformModule,
    GovernanceModule,
    OptionsModule,
    LiquidityMiningModule,
    MobileModule,
    PrivacyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
