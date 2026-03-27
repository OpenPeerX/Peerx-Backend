import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { WalletService } from './dto/wallet.service';

@Injectable()
export class PortfolioWalletService {
    private readonly logger = new Logger(PortfolioWalletService.name);

    constructor(private hdWalletService: WalletService) { }

    async verifyExternalWallet(address: string, signature: string, message: string): Promise<boolean> {
        try {
            const recovered = ethers.verifyMessage(message, signature);
            return recovered.toLowerCase() === address.toLowerCase();
        } catch {
            return false;
        }
    }

    // Poll for deposits to platform wallet
    async checkDeposits() {
        // Implementation for deposit detection
        return [];
    }
}

