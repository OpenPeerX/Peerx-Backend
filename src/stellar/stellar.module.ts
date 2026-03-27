// src/stellar/stellar.module.ts
import { Global, Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { StellarController } from './stellar.controller';

/**
 * Global module for Stellar integration
 */
@Global()
@Module({
  controllers: [StellarController],
  providers: [StellarService],
  exports: [StellarService],
})
export class StellarModule {}
