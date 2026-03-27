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
  @ApiResponse({ 
    status: 200, 
    description: 'USDC balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        publicKey: { type: 'string' },
        asset: { type: 'string', example: 'USDC' },
        balance: { type: 'string', example: '100.50' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid public key' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getUsdcBalance(@Param('publicKey') publicKey: string) {
    // Validate public key format
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
        throw new BadRequestException('Invalid Stellar public key format');
      }
    } catch (e) {
      throw new BadRequestException('Invalid Stellar public key format');
    }

    try {
      this.logger.debug(`Fetching USDC balance for ${publicKey}`);
      const balance = await this.stellarService.getUsdcBalance(publicKey);
      
      return {
        publicKey,
        asset: 'USDC',
        balance,
      };
    } catch (error) {
      // Handle the case where the account doesn't exist on the network
      if (error.response && error.response.status === 404) {
        throw new HttpException(
          `Stellar account ${publicKey} not found on the network.`, 
          HttpStatus.NOT_FOUND
        );
      }
      
      this.logger.error(`Error fetching Stellar balance for ${publicKey}: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to fetch balance from Stellar network',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
