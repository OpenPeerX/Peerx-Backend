import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { RiskModule } from './risk/risk.module';
import { RiskProfile } from './risk/entities/risk-profile.entity';
import { RiskOrder } from './risk/entities/risk-order.entity';
import { DidModule } from './did/did.module';
import { DidDocument } from './did/entities/did-document.entity';
import { VerifiableCredential } from './did/entities/verifiable-credential.entity';
import { AdvancedAnalyticsModule } from './advanced-analytics/advanced-analytics.module';
import { PricePredictionModule } from './price-prediction/price-prediction.module';
import { User } from './user/entities/user.entity';
import { Trade } from './trading/entities/trade.entity';
import { SocialTradingModule } from './social-trading/social-trading.module';
import { SocialTraderProfile } from './social-trading/entities/social-trader-profile.entity';
import { SharedStrategy } from './social-trading/entities/shared-strategy.entity';
import { TraderFollow } from './social-trading/entities/trader-follow.entity';
import { CopyTradingRelationship } from './social-trading/entities/copy-trading-relationship.entity';
import { CopiedTrade } from './social-trading/entities/copied-trade.entity';
import { StrategyComment } from './social-trading/entities/strategy-comment.entity';
import { StrategyLike } from './social-trading/entities/strategy-like.entity';
import { TraderRevenueShare } from './social-trading/entities/trader-revenue-share.entity';

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
        User,
        Trade,
        RiskOrder,
        RiskProfile,
        DidDocument,
        VerifiableCredential,
        PrivacyProfile,
        EncryptedOrder,
        PrivacyAuditLog,
        SocialTraderProfile,
        SharedStrategy,
        TraderFollow,
        CopyTradingRelationship,
        CopiedTrade,
        StrategyComment,
        StrategyLike,
        TraderRevenueShare,
      ],
      synchronize: true,
    }),
    PlatformModule,
    GovernanceModule,
    OptionsModule,
    LiquidityMiningModule,
    MobileModule,
    ScheduleModule.forRoot(),
    RiskModule,
    DidModule,
    AdvancedAnalyticsModule,
    PricePredictionModule,
    PrivacyModule,
    SocialTradingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
