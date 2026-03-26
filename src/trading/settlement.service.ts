import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, TradeStatus } from './entities/trade.entity';
import { BlockchainModule, Web3Service, WalletService } from '../portfolio/dto/blockchain.module';
import { ethers } from 'ethers';

const SETTLEMENT_ABI = ['function settleTrade(uint tradeId, address buyer, address seller, uint amount, address token)'];

@Injectable()
export class SettlementService {
    private readonly logger = new Logger(SettlementService.name);

    constructor(
        @InjectRepository(Trade)
        private tradeRepo: Repository<Trade>,
        private web3Service: Web3Service,
        private walletService: WalletService,
    ) { }

    async settleTradeOnBlockchain(tradeId: number, chainId: number = 1) {
        const trade = await this.tradeRepo.findOne({ where: { id: tradeId, status: TradeStatus.EXECUTED } });
        if (!trade) throw new Error('Trade not ready for settlement');

        trade.settlementStatus = 'PENDING';
        await this.tradeRepo.save(trade);

        try {
            const provider = this.web3Service.getProvider(chainId);
            const contract = this.web3Service.getContract(
                process.env.SETTLEMENT_CONTRACT || '0x...',
                SETTLEMENT_ABI,
                chainId
            );

            const walletIndex = trade.userId % 10; // Deterministic per user
            const wallet = this.walletService.deriveWallet(walletIndex).connect(provider);

            const tx = await contract.settleTrade(
                trade.id,
                trade.buyerId as `0x${string}`,
                trade.sellerId as `0x${string}`,
                ethers.parseEther(trade.amount.toString()),
                process.env.TOKEN_CONTRACT || '0x...'
            );

            trade.settlementTxHash = tx.hash;
            trade.settlementStatus = 'SUCCESS';
            trade.settledAt = new Date();
            await this.tradeRepo.save(trade);

            this.logger.log(`Trade ${tradeId} settled on-chain: ${tx.hash}`);
            return tx.hash;
        } catch (error) {
            trade.settlementStatus = 'FAILED';
            await this.tradeRepo.save(trade);
            this.logger.error(`Blockchain settlement failed for trade ${tradeId}:`, error);
            throw error;
        }
    }
}
