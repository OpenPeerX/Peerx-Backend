# Stellar Module

The `StellarModule` provides a centralized client for interacting with the Stellar Horizon network.

## Features

- **Horizon Client**: Automatically initializes a connection to the Stellar Horizon server using environment-specific URLs.
- **Account Management**: Provides helper methods for loading accounts and fetching asset balances.
- **USDC Asset Configuration**: Centrally manages the USDC issuer address for testnet and production.

## Configuration

Required environment variables:
- `STELLAR_HORIZON_URL`: URL of the Horizon server (e.g., https://horizon-testnet.stellar.org)
- `STELLAR_USDC_ISSUER`: Public key of the USDC issuer account on Stellar.

## Usage

Inject the `StellarService` into your components or services:

```typescript
import { StellarService } from '../stellar/stellar.service';

constructor(private readonly stellarService: StellarService) {}

// Example: Fetch balances
const balances = await this.stellarService.getBalances(publicKey);
console.log('Account balances:', balances);

// Example: Get USDC issuer
const issuer = this.stellarService.getUsdcIssuer();
```
