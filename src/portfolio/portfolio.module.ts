import { Module } from '@nestjs/common';
import { BlockchainModule } from './dto/blockchain.module';
import { AIOptimizationModule } from './ai-optimization/ai-optimization.module';

@Module({
  imports: [BlockchainModule, AIOptimizationModule],
  exports: [BlockchainModule, AIOptimizationModule],
})
export class PortfolioModule { }
