import { Module } from '@nestjs/common';
import { BlockchainModule } from './dto/blockchain.module';
import { AIOptimizationModule } from './ai-optimization/ai-optimization.module';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [BlockchainModule, AIOptimizationModule],
  providers: [PortfolioService],
  exports: [BlockchainModule, AIOptimizationModule, PortfolioService],
})
export class PortfolioModule { }
