#!/bin/bash
# Local Anvil chain for testing blockchain settlement
echo \"Starting Anvil...\"
anvil --host 0.0.0.0 --port 8545 --mnemonic \"test test test test test test test test test test test junk\" &

sleep 2
echo \"Deploying Settlement contract...\"
forge create --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 src/contracts/Settlement.sol:Settlement --legacy

echo \"Contract deployed. Set SETTLEMENT_CONTRACT=0x... (check anvil output) BLOCKCHAIN_LOCAL_RPC=http://127.0.0.1:8545 BLOCKCHAIN_MNEMONIC=\\\"test test...junk\\\" in .env\"
echo \"Run npm run start:dev to test settlement.\"

