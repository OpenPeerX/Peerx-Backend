# Blockchain Settlement Integration

## Overview
Trades settled on Ethereum via HD wallets and settlement contract.

## Setup
1. Set env vars:
```
BLOCKCHAIN_MNEMONIC=your 12/24 word mnemonic
BLOCKCHAIN_ETH_RPC=https://rpc-url
SETTLEMENT_CONTRACT=0x...
TOKEN_CONTRACT=0x...
```

2. npm i ethers@^6

## Flow
1. Trade executed (off-chain)
2. SettlementService.settleTradeOnBlockchain() called
3. HD wallet transfer to settlement contract
4. tx.hash saved to trade.settlementTxHash
5. Status: PENDING → SUCCESS/FAILED

## Services
- **Web3Service**: RPC providers per chain
- **WalletService**: HD wallets from mnemonic
- **SettlementService**: Trade on-chain settlement

## Usage
```
POST /trading/settle/:id
```

## Explorer
tx.${settlementTxHash} on etherscan

## Wallets
User N → deriveWallet(N % 10)

Ready for deposits/withdrawals extension.

