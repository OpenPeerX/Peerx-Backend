// src/stellar/stellar.module.ts
import { Global, Module } from '@nestjs/common';
import { StellarService } from './stellar.service';

/**
 * Global module for Stellar integration
 */
@Global()
@Module({
  providers: [StellarService],
  exports: [StellarService],
})
export class StellarModule {}
