import { Module } from '@nestjs/common';
import { BlockchainModule } from './dto/blockchain.module';

@Module({
  imports: [BlockchainModule],
  exports: [BlockchainModule],
})
export class PortfolioModule { }

