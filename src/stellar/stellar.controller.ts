// src/stellar/stellar.controller.ts
import { Controller, Get, Param, HttpException, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { StellarService } from './stellar.service';
import * as StellarSdk from 'stellar-sdk';

@ApiTags('Stellar')
@Controller('stellar')
export class StellarController {
  private readonly logger = new Logger(StellarController.name);

  constructor(private readonly stellarService: StellarService) {}

  /**
   * Fetch Stellar account USDC balance
   */
  @Get('balance/:publicKey')
  @ApiOperation({ summary: 'Fetch USDC balance for a Stellar public key' })
  @ApiParam({ name: 'publicKey', description: 'Stellar Public Key (e.g. G...)' })
  @ApiResponse({ status: 200, description: 'USDC balance retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid public key' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getUsdcBalance(@Param('publicKey') publicKey: string) {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
        throw new BadRequestException('Invalid Stellar public key format');
      }
    } catch (e) {
      throw new BadRequestException('Invalid Stellar public key format');
    }

    try {
      const balance = await this.stellarService.getUsdcBalance(publicKey);
      return { publicKey, asset: 'USDC', balance };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpException(`Stellar account ${publicKey} not found on the network.`, HttpStatus.NOT_FOUND);
      }
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error fetching Stellar balance for ${publicKey}: ${error.message}`);
      throw new HttpException('Failed to fetch balance from Stellar network', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get transaction status by hash
   */
  @Get('transaction/:txHash')
  @ApiOperation({ summary: 'Get Stellar transaction status by hash' })
  @ApiParam({ name: 'txHash', description: 'Stellar transaction hash (64 hex chars)' })
  @ApiResponse({ status: 200, description: 'Transaction status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionStatus(@Param('txHash') txHash: string) {
    if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new BadRequestException('Invalid transaction hash format');
    }

    try {
      const status = await this.stellarService.getTransactionStatus(txHash);
      return status;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error fetching transaction ${txHash}: ${error.message}`);
      throw new HttpException('Failed to fetch transaction from Stellar network', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Verify a transaction was successful on-chain
   */
  @Get('transaction/:txHash/verify')
  @ApiOperation({ summary: 'Verify a Stellar transaction was successful on-chain' })
  @ApiParam({ name: 'txHash', description: 'Stellar transaction hash (64 hex chars)' })
  @ApiResponse({ status: 200, description: 'Verification result' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async verifyTransaction(@Param('txHash') txHash: string) {
    if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new BadRequestException('Invalid transaction hash format');
    }

    try {
      const successful = await this.stellarService.verifyTransaction(txHash);
      return { txHash, verified: successful };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error verifying transaction ${txHash}: ${error.message}`);
      throw new HttpException('Failed to verify transaction on Stellar network', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
