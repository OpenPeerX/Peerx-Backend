import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { BotTradingController } from './bot-trading.controller';
import { TradingService } from './trading.service';
import { SettlementService } from './settlement.service';
import { MatchingEngineService } from './matching-engine.service';
import { UserBadgeModule } from '../rewards/user-badge.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { CacheModule } from '../common/cache/cache.module';
import { MatchingEngineModule } from './matching-engine/matching-engine.module';
import { BlockchainModule } from '../portfolio/dto/blockchain.module';
import { Trade } from './entities/trade.entity';
import { VirtualAsset } from './entities/virtual-asset.entity';
import { OrderBook } from './entities/order-book.entity';
import { MultiSigWallet } from './entities/multisig-wallet.entity';
import { EscrowAgreement } from './entities/escrow-agreement.entity';
import { MultiSigApproval } from './entities/multisig-approval.entity';
import { MultiSigWalletService } from './multisig-wallet.service';
import { MultiSigWalletController } from './multisig-wallet.controller';
import { AuditLog } from '../portfolio/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trade,
      VirtualAsset,
      OrderBook,
      MultiSigWallet,
      EscrowAgreement,
      MultiSigApproval,
      AuditLog,
    ]),
    UserBadgeModule,
    UserModule,
    NotificationModule,
    CacheModule,
    MatchingEngineModule,
    BlockchainModule,
  ],
  controllers: [TradingController, BotTradingController, MultiSigWalletController],
  providers: [TradingService, MatchingEngineService, SettlementService, MultiSigWalletService],
  exports: [TradingService],
})
export class TradingModule { }

