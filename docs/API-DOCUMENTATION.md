# SwapTrade Backend API Documentation

This document provides comprehensive API documentation for all implemented features in the SwapTrade Backend project.

## Table of Contents

1. [Options Trading API](#options-trading-api)
2. [Governance Voting API](#governance-voting-api)
3. [Quantum-Resistant Cryptography API](#quantum-resistant-cryptography-api)
4. [Liquidity Mining API](#liquidity-mining-api)

---

## Options Trading API

### Overview
The Options Trading API provides comprehensive options trading functionality including contract management, order placement, risk analysis, and settlement processing.

### Base URL: `/api/options`

### Endpoints

#### Contract Management

##### Create Option Contract
```http
POST /api/options/contracts
```

**Request Body:**
```json
{
  "underlyingAsset": "BTC",
  "optionType": "CALL",
  "strikePrice": 50000,
  "expiryAt": "2024-05-23T10:00:00.000Z",
  "markPrice": 52000,
  "contractSize": 1,
  "volatility": 0.5
}
```

**Response:**
```json
{
  "id": "uuid",
  "underlyingAsset": "BTC",
  "optionType": "CALL",
  "strikePrice": 50000,
  "expiryAt": "2024-05-23T10:00:00.000Z",
  "markPrice": 52000,
  "contractSize": 1,
  "volatility": 0.5,
  "status": "ACTIVE",
  "createdAt": "2024-04-23T10:00:00.000Z",
  "updatedAt": "2024-04-23T10:00:00.000Z"
}
```

##### Get Option Contract
```http
GET /api/options/contracts/{contractId}
```

##### Update Option Contract
```http
PATCH /api/options/contracts/{contractId}
```

**Request Body:**
```json
{
  "markPrice": 53000,
  "volatility": 0.55,
  "status": "ACTIVE"
}
```

##### Delete Option Contract
```http
DELETE /api/options/contracts/{contractId}
```

#### Order Management

##### Place Option Order
```http
POST /api/options/contracts/{contractId}/orders
```

**Request Body:**
```json
{
  "userId": 1,
  "side": "BUY",
  "orderType": "MARKET",
  "quantity": 10,
  "limitPrice": 1500
}
```

**Response:**
```json
{
  "order": {
    "id": "uuid",
    "contractId": "contract-uuid",
    "userId": 1,
    "side": "BUY",
    "orderType": "MARKET",
    "quantity": 10,
    "filledQuantity": 10,
    "averageFillPrice": 1500,
    "status": "FILLED"
  },
  "matches": [
    {
      "id": "uuid",
      "buyOrderId": "uuid",
      "sellOrderId": "uuid",
      "quantity": 10,
      "price": 1500,
      "timestamp": "2024-04-23T10:00:00.000Z"
    }
  ]
}
```

##### Cancel Option Order
```http
DELETE /api/options/orders/{orderId}
```

**Request Body:**
```json
{
  "reason": "User requested cancellation"
}
```

##### Get User Orders
```http
GET /api/options/orders/user/{userId}
```

#### Risk Management

##### Get User Positions
```http
GET /api/options/positions/user/{userId}
```

**Response:**
```json
{
  "positions": [
    {
      "id": "uuid",
      "contractId": "contract-uuid",
      "userId": 1,
      "longQuantity": 10,
      "shortQuantity": 0,
      "averageEntryPrice": 1500,
      "marginHeld": 5000,
      "realizedPnl": 0,
      "unrealizedPnl": 2000,
      "contract": {
        "underlyingAsset": "BTC",
        "optionType": "CALL",
        "strikePrice": 50000
      },
      "pnl": 2000
    }
  ]
}
```

##### Get User Risk Metrics
```http
GET /api/options/risk/user/{userId}
```

**Response:**
```json
{
  "userId": 1,
  "totalMarginHeld": 5000,
  "totalUnrealizedPnl": 2000,
  "totalRealizedPnl": 0,
  "netPnl": 2000,
  "positionCount": 1,
  "riskBreakdown": [
    {
      "contractId": "uuid",
      "underlyingAsset": "BTC",
      "optionType": "CALL",
      "strikePrice": 50000,
      "greeks": {
        "delta": 0.6,
        "gamma": 0.02,
        "theta": -0.05,
        "vega": 0.3
      }
    }
  ]
}
```

##### Get Contract Greeks
```http
GET /api/options/contracts/{contractId}/greeks
```

**Response:**
```json
{
  "contractId": "uuid",
  "greeks": {
    "delta": 0.6,
    "gamma": 0.02,
    "theta": -0.05,
    "vega": 0.3,
    "rho": 0.1
  },
  "timeToExpiry": 30.5,
  "impliedVolatility": 0.5
}
```

#### Order Book and Analytics

##### Get Order Book
```http
GET /api/options/orderbook/{contractId}
```

**Response:**
```json
{
  "contractId": "uuid",
  "buys": [
    {
      "orderId": "uuid",
      "price": 1500,
      "quantity": 10,
      "total": 15000
    }
  ],
  "sells": [
    {
      "orderId": "uuid",
      "price": 1550,
      "quantity": 5,
      "total": 7750
    }
  ],
  "spread": 50
}
```

##### Get Option Chain
```http
GET /api/options/chain/{underlyingAsset}
```

**Response:**
```json
{
  "contracts": [
    {
      "id": "uuid",
      "underlyingAsset": "BTC",
      "optionType": "CALL",
      "strikePrice": 50000,
      "expiryAt": "2024-05-23T10:00:00.000Z",
      "analytics": {
        "greeks": {
          "delta": 0.6,
          "gamma": 0.02,
          "theta": -0.05,
          "vega": 0.3
        },
        "impliedVolatility": 0.5,
        "timeToExpiry": 30.5
      }
    }
  ]
}
```

#### Expiry Processing

##### Process Expiries
```http
POST /api/options/expiry/process
```

**Request Body:**
```json
{
  "settlementPrices": {
    "BTC": 52000,
    "ETH": 3000
  }
}
```

---

## Governance Voting API

### Overview
The Governance Voting API provides decentralized governance functionality including proposal lifecycle management, voting, tallying, and execution.

### Base URL: `/api/governance`

### Endpoints

#### Staking Management

##### Upsert User Stake
```http
POST /api/governance/stakes
```

**Request Body:**
```json
{
  "userId": 1,
  "stakedAmount": 1000
}
```

##### Get User Stake
```http
GET /api/governance/stakes/{userId}
```

#### Proposal Management

##### Create Proposal
```http
POST /api/governance/proposals
```

**Request Body:**
```json
{
  "title": "Update Fee Structure",
  "description": "This proposal aims to update the trading fee structure",
  "proposerUserId": 1,
  "startAt": "2024-04-23T10:00:00.000Z",
  "endAt": "2024-04-30T10:00:00.000Z",
  "snapshotAt": "2024-04-23T10:00:00.000Z",
  "quorumThreshold": 1000,
  "executable": true
}
```

##### List Proposals
```http
GET /api/governance/proposals
```

##### Get Proposal
```http
GET /api/governance/proposals/{proposalId}
```

##### Update Proposal
```http
PATCH /api/governance/proposals/{proposalId}
```

**Request Body:**
```json
{
  "title": "Updated Proposal Title",
  "description": "Updated description"
}
```

##### Cancel Proposal
```http
DELETE /api/governance/proposals/{proposalId}
```

#### Voting

##### Cast Vote
```http
POST /api/governance/proposals/{proposalId}/votes
```

**Request Body:**
```json
{
  "voterUserId": 1,
  "choice": "YES",
  "idempotencyKey": "unique-key-123"
}
```

##### Get User Votes
```http
GET /api/governance/votes/user/{userId}
```

#### Tallying and Execution

##### Tally Proposal
```http
POST /api/governance/proposals/{proposalId}/tally
```

##### Execute Proposal
```http
POST /api/governance/proposals/{proposalId}/execute
```

#### Security and Audit

##### Get Proposal Status
```http
GET /api/governance/proposals/{proposalId}/status
```

**Response:**
```json
{
  "proposalId": "uuid",
  "title": "Update Fee Structure",
  "status": "ACTIVE",
  "progress": {
    "yesPower": 1500,
    "noPower": 500,
    "abstainPower": 200,
    "quorumThreshold": 1000
  },
  "executable": true
}
```

##### Get Voting Snapshot
```http
GET /api/governance/snapshot/{proposalId}
```

**Response:**
```json
{
  "proposalId": "uuid",
  "snapshotAt": "2024-04-23T10:00:00.000Z",
  "totalVotingPower": 5000,
  "votedPower": 2200,
  "participationRate": 44,
  "uniqueVoters": 15,
  "voteBreakdown": {
    "yes": 1500,
    "no": 500,
    "abstain": 200
  },
  "quorumMet": true
}
```

##### Get Audit Log
```http
GET /api/governance/audit?limit=100
```

---

## Quantum-Resistant Cryptography API

### Overview
The Quantum-Resistant Cryptography API provides post-quantum cryptographic services including key generation, signing, verification, and certificate management.

### Base URL: `/api/quantum-crypto`

### Endpoints

#### Key Management

##### Generate Quantum Key Pair
```http
POST /api/quantum-crypto/keys/generate
```

**Request Body:**
```json
{
  "keyType": "DILITHIUM",
  "usage": "SIGNING",
  "securityLevel": 3,
  "createdFor": "test-purpose"
}
```

**Response:**
```json
{
  "id": "uuid",
  "keyId": "QK_1234567890",
  "userId": "user-123",
  "keyType": "DILITHIUM",
  "usage": "SIGNING",
  "securityLevel": 3,
  "publicKey": "base64-public-key",
  "privateKey": "encrypted-private-key",
  "keySize": 4096,
  "algorithmVersion": "DILITHIUM3",
  "status": "ACTIVE",
  "createdAt": "2024-04-23T10:00:00.000Z",
  "expiresAt": "2025-04-23T10:00:00.000Z",
  "nextRotationAt": "2024-10-23T10:00:00.000Z"
}
```

##### Get User Keys
```http
GET /api/quantum-crypto/keys
```

##### Get Specific Key
```http
GET /api/quantum-crypto/keys/{keyId}
```

##### Rotate Key
```http
POST /api/quantum-crypto/keys/{keyId}/rotate
```

##### Revoke Key
```http
PUT /api/quantum-crypto/keys/{keyId}/revoke
```

**Request Body:**
```json
{
  "reason": "Key compromise suspected"
}
```

#### Cryptographic Operations

##### Sign Data
```http
POST /api/quantum-crypto/sign
```

**Request Body:**
```json
{
  "keyId": "QK_1234567890",
  "data": "base64-encoded-data"
}
```

**Response:**
```json
{
  "signature": "base64-signature"
}
```

##### Verify Signature
```http
POST /api/quantum-crypto/verify
```

**Request Body:**
```json
{
  "keyId": "QK_1234567890",
  "data": "base64-encoded-data",
  "signature": "base64-signature"
}
```

**Response:**
```json
{
  "isValid": true
}
```

##### Perform Key Exchange
```http
POST /api/quantum-crypto/key-exchange
```

**Request Body:**
```json
{
  "keyId": "QK_1234567890",
  "peerPublicKey": "base64-peer-public-key"
}
```

**Response:**
```json
{
  "sharedSecret": "base64-shared-secret",
  "encryptedKey": "base64-encrypted-key"
}
```

#### Certificate Management

##### Issue Certificate
```http
POST /api/quantum-crypto/certificates/issue
```

**Request Body:**
```json
{
  "certificateType": "IDENTITY",
  "subjectDN": "CN=test-user,O=Test Organization,C=US",
  "keyId": "QK_1234567890",
  "validityDays": 365,
  "subjectAlternativeNames": ["test@example.com"],
  "keyUsage": ["digitalSignature", "keyEncipherment"],
  "extendedKeyUsage": ["clientAuth", "serverAuth"]
}
```

##### Get User Certificates
```http
GET /api/quantum-crypto/certificates
```

##### Get Active Certificates
```http
GET /api/quantum-crypto/certificates/active
```

##### Get Specific Certificate
```http
GET /api/quantum-crypto/certificates/{certificateId}
```

##### Verify Certificate
```http
POST /api/quantum-crypto/certificates/{certificateId}/verify
```

##### Revoke Certificate
```http
POST /api/quantum-crypto/certificates/{certificateId}/revoke
```

##### Renew Certificate
```http
POST /api/quantum-crypto/certificates/{certificateId}/renew
```

**Request Body:**
```json
{
  "validityDays": 365
}
```

#### Migration and Analytics

##### Migrate from Traditional Key
```http
POST /api/quantum-crypto/migrate/key
```

**Request Body:**
```json
{
  "traditionalKeyId": "traditional-key-123",
  "quantumKeyType": "DILITHIUM",
  "usage": "SIGNING"
}
```

##### Get Dashboard Summary
```http
GET /api/quantum-crypto/dashboard/summary
```

**Response:**
```json
{
  "totalKeys": 5,
  "activeKeys": 4,
  "totalCertificates": 3,
  "activeCertificates": 2,
  "expiringSoon": 1,
  "quantumMigrationProgress": 75
}
```

---

## Liquidity Mining API

### Overview
The Liquidity Mining API provides comprehensive liquidity mining functionality including pool management, staking, reward distribution, and fraud detection.

### Base URL: `/api/liquidity-mining`

### Endpoints

#### Pool Management

##### Create Liquidity Pool
```http
POST /api/liquidity-mining/pools
```

**Request Body:**
```json
{
  "pairSymbol": "BTC-USDC",
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "rewardToken": "0x0987654321098765432109876543210987654321",
  "currentDepth": 1000000,
  "targetDepth": 5000000,
  "baseApr": 15.5
}
```

**Response:**
```json
{
  "id": "uuid",
  "pairSymbol": "BTC-USDC",
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "rewardToken": "0x0987654321098765432109876543210987654321",
  "currentDepth": 1000000,
  "targetDepth": 5000000,
  "baseApr": 15.5,
  "createdAt": "2024-04-23T10:00:00.000Z",
  "updatedAt": "2024-04-23T10:00:00.000Z"
}
```

#### Program Management

##### Create Mining Program
```http
POST /api/liquidity-mining/programs
```

**Request Body:**
```json
{
  "poolId": "pool-uuid",
  "startAt": "2024-04-23T10:00:00.000Z",
  "endAt": "2024-05-23T10:00:00.000Z",
  "vestingDays": 90,
  "rewardBudget": 100000
}
```

**Response:**
```json
{
  "id": "uuid",
  "poolId": "pool-uuid",
  "status": "ACTIVE",
  "startAt": "2024-04-23T10:00:00.000Z",
  "endAt": "2024-05-23T10:00:00.000Z",
  "vestingDays": 90,
  "rewardBudget": 100000,
  "createdAt": "2024-04-23T10:00:00.000Z",
  "updatedAt": "2024-04-23T10:00:00.000Z"
}
```

#### Staking Operations

##### Stake Liquidity
```http
POST /api/liquidity-mining/stake
```

**Request Body:**
```json
{
  "userId": 1,
  "poolId": "pool-uuid",
  "programId": "program-uuid",
  "amount": 50000
}
```

**Response:**
```json
{
  "position": {
    "id": "uuid",
    "userId": 1,
    "poolId": "pool-uuid",
    "programId": "program-uuid",
    "amount": 50000,
    "status": "ACTIVE",
    "stakedAt": "2024-04-23T10:00:00.000Z"
  },
  "dynamicApr": 18.5,
  "fraudFlagged": false
}
```

##### Unstake Liquidity
```http
POST /api/liquidity-mining/unstake/{positionId}
```

##### Claim Rewards
```http
POST /api/liquidity-mining/claim/{positionId}
```

**Response:**
```json
{
  "ledger": {
    "id": "uuid",
    "positionId": "position-uuid",
    "accruedReward": 1250.50,
    "claimedReward": 1250.50,
    "vestedReward": 1250.50
  },
  "claimedReward": 1250.50
}
```

#### Analytics and Dashboard

##### Get User Dashboard
```http
GET /api/liquidity-mining/dashboard/{userId}
```

**Response:**
```json
{
  "userId": 1,
  "totalStaked": 150000,
  "positions": [
    {
      "id": "uuid",
      "poolId": "pool-uuid",
      "programId": "program-uuid",
      "amount": 50000,
      "dynamicApr": 18.5,
      "status": "ACTIVE"
    }
  ],
  "rewards": [
    {
      "id": "uuid",
      "accruedReward": 1250.50,
      "claimedReward": 500.00,
      "vestedReward": 750.50
    }
  ]
}
```

##### Get Analytics
```http
GET /api/liquidity-mining/analytics
```

**Response:**
```json
{
  "activePrograms": 3,
  "totalPools": 5,
  "totalStakedDepth": 25000000,
  "pools": [
    {
      "id": "uuid",
      "pairSymbol": "BTC-USDC",
      "dynamicApr": 18.5,
      "currentDepth": 5000000,
      "targetDepth": 10000000
    }
  ]
}
```

#### Advanced Features

##### Get Program Analytics
```http
GET /api/liquidity-mining/programs/{programId}/analytics
```

**Response:**
```json
{
  "programId": "uuid",
  "poolId": "pool-uuid",
  "totalStaked": 2500000,
  "activeStakes": 25,
  "totalParticipants": 30,
  "totalRewardsAccrued": 12500,
  "totalRewardsClaimed": 5000,
  "averageStakeSize": 83333,
  "currentApr": 18.5,
  "programEfficiency": 12.5,
  "fraudDetection": {
    "flaggedStakes": 2,
    "rapidCycles": 1
  }
}
```

##### Get Pool Analytics
```http
GET /api/liquidity-mining/pools/{poolId}/analytics
```

**Response:**
```json
{
  "poolId": "uuid",
  "pairSymbol": "BTC-USDC",
  "currentDepth": 5000000,
  "targetDepth": 10000000,
  "depthUtilization": 50,
  "totalStaked": 2500000,
  "activeStakes": 25,
  "baseApr": 15.5,
  "currentApr": 18.5,
  "activePrograms": 2,
  "concentrationRisk": 15,
  "liquidityMetrics": {
    "averageStakeSize": 100000,
    "largestStake": 500000,
    "stakeDistribution": {
      "small": 10,
      "medium": 8,
      "large": 5,
      "whale": 2
    }
  }
}
```

##### Detect Fraudulent Activity
```http
GET /api/liquidity-mining/fraud-detection
```

**Response:**
```json
{
  "timestamp": "2024-04-23T10:00:00.000Z",
  "totalSuspiciousActivities": 5,
  "riskLevel": "MEDIUM",
  "activities": [
    {
      "type": "RAPID_CYCLING",
      "userId": 123,
      "stakeCount": 6,
      "description": "User has performed multiple staking cycles within 7 days"
    },
    {
      "type": "SHORT_TERM_STAKING",
      "userId": 456,
      "unstakeCount": 4,
      "description": "User has multiple stakes lasting less than 24 hours"
    }
  ]
}
```

##### Get Reward Distribution Schedule
```http
GET /api/liquidity-mining/programs/{programId}/schedule
```

**Response:**
```json
{
  "programId": "uuid",
  "totalEstimatedRewards": 50000,
  "schedule": [
    {
      "period": "2024-04",
      "startDate": "2024-04-23T10:00:00.000Z",
      "endDate": "2024-04-30T10:00:00.000Z",
      "estimatedRewards": 8333.33,
      "activeStakes": 25,
      "totalStaked": 2500000
    }
  ]
}
```

---

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Validation failed",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be greater than 0"
    }
  ]
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Standard rate limits:
- `100` requests per minute per user
- `1000` requests per minute per IP address

Rate limit headers are included in responses:
- `X-RateLimit-Limit` - Total requests allowed
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Time when limit resets

---

## Pagination

List endpoints support pagination using query parameters:

```
GET /api/options/contracts?page=1&limit=20&sort=createdAt&order=desc
```

Parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort` - Field to sort by
- `order` - Sort order: `asc` or `desc`

---

## Webhooks

Webhooks are available for real-time notifications:

### Options Trading Webhooks
- `order.filled` - Order completely filled
- `order.partial_filled` - Order partially filled
- `position.created` - New position created
- `position.closed` - Position closed

### Governance Webhooks
- `proposal.created` - New proposal created
- `vote.cast` - Vote cast
- `proposal.executed` - Proposal executed

### Liquidity Mining Webhooks
- `stake.created` - New stake created
- `reward.claimed` - Reward claimed
- `fraud.detected` - Fraudulent activity detected

Configure webhooks in your account settings or via the API.

---

## SDK and Libraries

Official SDKs are available for:
- JavaScript/TypeScript (`@swaptrade/sdk`)
- Python (`swaptrade-python`)
- Go (`github.com/swaptrade/go-sdk`)

---

## Support

For API support and questions:
- Documentation: https://docs.swaptrade.com
- API Status: https://status.swaptrade.com
- Support: api-support@swaptrade.com
- Developer Discord: https://discord.gg/swaptrade
