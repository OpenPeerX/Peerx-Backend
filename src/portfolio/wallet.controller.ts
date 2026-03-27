import { Controller, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { Web3Service } from './dto/web3.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolio/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
    constructor(
        private walletService: WalletService,
        private web3Service: Web3Service,
    ) { }

    @Post('balance/:chainId')
    async getBalance(@CurrentUser('sub') userId: number, @Param('chainId', ParseIntPipe) chainId: number) {
        const walletIndex = userId % 10;
        const wallet = this.walletService.deriveWallet(walletIndex);
        return this.walletService.getBalance(chainId, wallet.address);
    }

    @Post('withdraw/:chainId')
    async withdraw(
        @CurrentUser('sub') userId: number,
        @Param('chainId', ParseIntPipe) chainId: number,
        @Body('to') to: string,
        @Body('amount') amount: string,
    ) {
        const walletIndex = userId % 10;
        return this.walletService.sendNativeToken(chainId, walletIndex, to, amount);
    }

    @Post('deposit/verify')
    async verifyDeposit(@Body('address') address: string, @Body('signature') signature: string, @Body('message') message: string) {
        // Verify user owns external wallet via sig
        return this.walletService.verifyExternalWallet(address, signature, message);
    }
}

