# Insurance Fund API Reference

## Base URL
```
/insurance
```

## Fund Management Endpoints

### Create Fund
**POST** `/fund`

Creates a new insurance fund.

**Request Body:**
```json
{
  "fundType": "PRIMARY|EMERGENCY|USER_CONTRIBUTED",
  "minimumBalance": 1000,
  "targetBalance": 10000,
  "coverageRatio": 75,
  "contributionRate": 0.001,
  "autoRefillEnabled": false
}
```

**Response (201):**
```json
{
  "id": 1,
  "fundType": "PRIMARY",
  "status": "ACTIVE",
  "balance": 0,
  "totalContributions": 0,
  "totalPayouts": 0,
  "minimumBalance": 1000,
  "targetBalance": 10000,
  "coverageRatio": 75,
  "contributionRate": 0.001,
  "autoRefillEnabled": false,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### Get Fund by ID
**GET** `/fund/:fundId`

Retrieves a specific fund by ID.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "id": 1,
  "fundType": "PRIMARY",
  "status": "ACTIVE",
  "balance": 10000,
  "totalContributions": 10000,
  "totalPayouts": 0,
  "minimumBalance": 1000,
  "targetBalance": 10000,
  "coverageRatio": 75
}
```

---

### Get Primary Fund
**GET** `/fund/primary`

Gets the primary insurance fund.

**Response (200):**
```json
{
  "id": 1,
  "fundType": "PRIMARY",
  "status": "ACTIVE",
  "balance": 8500
}
```

---

### Get All Funds
**GET** `/funds`

Lists all insurance funds.

**Response (200):**
```json
[
  {
    "id": 1,
    "fundType": "PRIMARY",
    "status": "ACTIVE",
    "balance": 8500
  },
  {
    "id": 2,
    "fundType": "EMERGENCY",
    "status": "ACTIVE",
    "balance": 2000
  }
]
```

---

### Update Fund Configuration
**PUT** `/fund/:fundId`

Updates fund configuration parameters.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Request Body:**
```json
{
  "coverageRatio": 80,
  "contributionRate": 0.0015,
  "autoRefillEnabled": true
}
```

**Response (200):** Updated fund object

---

### Deposit to Fund
**POST** `/fund/:fundId/deposit`

Adds funds to the insurance pool.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Request Body:**
```json
{
  "amount": 5000
}
```

**Response (200):**
```json
{
  "id": 1,
  "balance": 15000,
  "totalContributions": 15000
}
```

---

### Withdraw from Fund
**POST** `/fund/:fundId/withdraw`

Removes funds from the insurance pool.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Request Body:**
```json
{
  "amount": 2000
}
```

**Response (200):** Updated fund object

---

### Get Fund Status
**GET** `/fund/:fundId/status`

Gets current fund status summary.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "fundId": 1,
  "status": "ACTIVE",
  "balance": 8500,
  "minimumBalance": 1000,
  "isLow": false,
  "fundingLevel": 85,
  "coverageCapacity": 8500
}
```

---

### Pause Fund
**POST** `/fund/:fundId/pause`

Pauses the fund (stops coverage and contributions).

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "id": 1,
  "status": "PAUSED"
}
```

---

### Resume Fund
**POST** `/fund/:fundId/resume`

Resumes a paused fund.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "id": 1,
  "status": "ACTIVE"
}
```

---

### Get Fund Statistics
**GET** `/statistics`

Gets aggregate statistics across all funds.

**Response (200):**
```json
{
  "totalFunds": 3,
  "totalBalance": 35500,
  "totalContributions": 45000,
  "totalPayouts": 9500,
  "averageHealth": "82.5%"
}
```

---

## Contribution Endpoints

### Record Contribution
**POST** `/contribution`

Records a generic contribution to a fund.

**Request Body:**
```json
{
  "fundId": 1,
  "contributionType": "MANUAL|TRADE_VOLUME|PROTOCOL_REVENUE|INTEREST|PENALTY",
  "amount": 1000,
  "sourceUserId": 123,
  "description": "Manual contribution"
}
```

**Response (201):**
```json
{
  "id": 42,
  "fundId": 1,
  "contributionType": "MANUAL",
  "amount": 1000,
  "status": "PENDING",
  "recordedAt": "2024-01-15T10:35:00Z"
}
```

---

### Record Trade Contribution
**POST** `/contribution/trade`

Records automatic contribution from trade volume.

**Request Body:**
```json
{
  "fundId": 1,
  "userId": 123,
  "tradeId": 999,
  "tradeVolume": 100000,
  "contributionRate": 0.001
}
```

**Response (201):**
```json
{
  "id": 43,
  "fundId": 1,
  "contributionType": "TRADE_VOLUME",
  "amount": 100,
  "sourceUserId": 123,
  "sourceTradeId": 999,
  "status": "PENDING"
}
```

---

### Record Manual Contribution
**POST** `/contribution/manual`

Records user manual contribution.

**Request Body:**
```json
{
  "fundId": 1,
  "userId": 123,
  "amount": 500,
  "reason": "Supporting insurance fund"
}
```

**Response (201):** Contribution object

---

### Approve Contribution
**POST** `/contribution/:contributionId/approve`

Approves a pending contribution.

**Parameters:**
- `contributionId` (path, required): Contribution identifier

**Response (200):**
```json
{
  "id": 43,
  "status": "APPROVED",
  "approvedAt": "2024-01-15T10:40:00Z"
}
```

---

### Reject Contribution
**POST** `/contribution/:contributionId/reject`

Rejects a pending contribution.

**Parameters:**
- `contributionId` (path, required): Contribution identifier

**Request Body:**
```json
{
  "reason": "Duplicate contribution"
}
```

**Response (200):** Rejected contribution object

---

### Batch Approve Contributions
**POST** `/fund/:fundId/contributions/batch-approve`

Approves all pending contributions for a fund.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "approvedCount": 12,
  "totalAmount": 5600
}
```

---

### Get Fund Contributions
**GET** `/fund/:fundId/contributions`

Gets contributions for a fund.

**Parameters:**
- `fundId` (path, required): Fund identifier
- `status` (query, optional): Filter by status
- `limit` (query, optional): Max results (default 100)
- `offset` (query, optional): Pagination offset (default 0)

**Response (200):**
```json
[
  {
    "id": 43,
    "fundId": 1,
    "contributionType": "TRADE_VOLUME",
    "amount": 100,
    "status": "APPROVED",
    "recordedAt": "2024-01-15T10:35:00Z"
  }
]
```

---

### Get Contribution Statistics
**GET** `/fund/:fundId/contributions/stats`

Gets contribution statistics for a fund.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "totalContributions": 150,
  "pendingCount": 15,
  "approvedCount": 130,
  "rejectedCount": 5,
  "totalPending": 7500,
  "totalApproved": 65000,
  "contributionsByType": {
    "TRADE_VOLUME": 50000,
    "MANUAL": 10000,
    "PROTOCOL_REVENUE": 5000
  }
}
```

---

### Get User Contributions
**GET** `/user/:userId/contributions/fund/:fundId`

Gets contribution history for a user.

**Parameters:**
- `userId` (path, required): User identifier
- `fundId` (path, required): Fund identifier

**Response (200):** Array of contribution objects

---

## Claim Endpoints

### Submit Claim
**POST** `/claim`

Submits an insurance claim for losses.

**Request Body:**
```json
{
  "fundId": 1,
  "claimantUserId": 123,
  "originalLoss": 5000,
  "claimReason": "LIQUIDATION_LOSS|SLIPPAGE_PROTECTION|COUNTERPARTY_DEFAULT|TECHNICAL_ERROR|VOLATILITY_EVENT",
  "description": "Loss from flash crash liquidation",
  "linkedLiquidationId": 99
}
```

**Response (201):**
```json
{
  "id": 501,
  "fundId": 1,
  "claimantUserId": 123,
  "originalLoss": 5000,
  "claimReason": "LIQUIDATION_LOSS",
  "coverageAmount": 3750,
  "uncoveredLoss": 1250,
  "coveragePercentage": 75,
  "status": "PENDING",
  "submittedAt": "2024-01-15T10:45:00Z"
}
```

---

### Get Claim
**GET** `/claim/:claimId`

Retrieves a specific claim.

**Parameters:**
- `claimId` (path, required): Claim identifier

**Response (200):** Claim object

---

### Approve Claim
**POST** `/claim/:claimId/approve`

Approves a pending claim for payout.

**Parameters:**
- `claimId` (path, required): Claim identifier

**Request Body:**
```json
{
  "approverUserId": 1,
  "notes": "Verified loss. Coverage approved."
}
```

**Response (200):**
```json
{
  "id": 501,
  "status": "APPROVED",
  "approvedAt": "2024-01-15T10:50:00Z",
  "approverUserId": 1
}
```

---

### Process Payout
**POST** `/claim/:claimId/payout`

Processes approved claim payout.

**Parameters:**
- `claimId` (path, required): Claim identifier

**Request Body:**
```json
{
  "operatorId": 2
}
```

**Response (200):**
```json
{
  "id": 501,
  "status": "PAID",
  "paidAmount": 3750,
  "paidAt": "2024-01-15T10:55:00Z"
}
```

---

### Reject Claim
**POST** `/claim/:claimId/reject`

Rejects a pending claim.

**Parameters:**
- `claimId` (path, required): Claim identifier

**Request Body:**
```json
{
  "rejector": 1,
  "reason": "Loss not verified"
}
```

**Response (200):** Rejected claim object

---

### Cancel Claim
**POST** `/claim/:claimId/cancel`

Cancels a claim.

**Parameters:**
- `claimId` (path, required): Claim identifier

**Request Body:**
```json
{
  "reason": "User requested cancellation"
}
```

**Response (200):** Cancelled claim object

---

### Get Fund Claims
**GET** `/fund/:fundId/claims`

Gets claims for a fund.

**Parameters:**
- `fundId` (path, required): Fund identifier
- `status` (query, optional): Filter by status
- `limit` (query, optional): Max results
- `offset` (query, optional): Pagination offset

**Response (200):** Array of claim objects

---

### Get Claim Statistics
**GET** `/fund/:fundId/claims/stats`

Gets claim statistics for a fund.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "totalClaims": 150,
  "pendingCount": 12,
  "approvedCount": 80,
  "paidCount": 55,
  "rejectedCount": 3,
  "cancelledCount": 0,
  "totalOriginalLoss": 750000,
  "totalCoverageAmount": 562500,
  "totalUncoveredLoss": 187500,
  "averageCoveragePercentage": 75
}
```

---

### Get User Claims
**GET** `/user/:userId/claims/fund/:fundId`

Gets claim history for a user.

**Parameters:**
- `userId` (path, required): User identifier
- `fundId` (path, required): Fund identifier

**Response (200):** Array of claim objects

---

### Get High-Value Claims
**GET** `/fund/:fundId/claims/high-value`

Gets high-value claims above threshold.

**Parameters:**
- `fundId` (path, required): Fund identifier
- `threshold` (query, optional): Amount threshold (default 1000)

**Response (200):** Array of claim objects

---

### Batch Approve Claims
**POST** `/fund/:fundId/claims/batch-approve`

Approves multiple pending claims up to available balance.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Request Body:**
```json
{
  "approverUserId": 1
}
```

**Response (200):**
```json
{
  "approvedCount": 8,
  "totalApprovedAmount": 28500
}
```

---

## Liquidation Coverage Endpoints

### Record Liquidation Event
**POST** `/liquidation/record`

Records a liquidation event for insurance coverage evaluation.

**Request Body:**
```json
{
  "fundId": 1,
  "userId": 123,
  "totalLoss": 10000,
  "reason": "Position liquidated - maintenance margin breach",
  "metadata": {
    "positionId": 456,
    "symbol": "BTC/USD",
    "entryPrice": 50000,
    "exitPrice": 45000,
    "leverage": 5
  }
}
```

**Response (201):**
```json
{
  "liquidationEvent": {
    "id": 88,
    "userId": 123,
    "totalLoss": 10000,
    "status": "IN_PROGRESS",
    "volatilityIndex": 45,
    "cascadeRiskLevel": "MEDIUM"
  },
  "coverageDecision": {
    "canCover": true,
    "coverageAmount": 7500,
    "uncoveredAmount": 2500,
    "failSafeTriggered": false
  }
}
```

---

### Finalize Liquidation
**POST** `/liquidation/:liquidationId/finalize`

Finalizes a liquidation event.

**Parameters:**
- `liquidationId` (path, required): Liquidation event identifier

**Request Body:**
```json
{
  "claimId": 501
}
```

**Response (200):**
```json
{
  "id": 88,
  "status": "FULLY_COVERED",
  "completedAt": "2024-01-15T11:00:00Z"
}
```

---

### Get Liquidation History
**GET** `/fund/:fundId/liquidations`

Gets liquidation events for a fund.

**Parameters:**
- `fundId` (path, required): Fund identifier
- `status` (query, optional): Filter by status
- `limit` (query, optional): Max results

**Response (200):** Array of liquidation event objects

---

### Get Cascade Risk Assessment
**GET** `/fund/:fundId/cascade-risk`

Gets current cascade liquidation risk metrics.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "level": "MEDIUM",
  "volatilityIndex": 45,
  "activeLiquidations": 25,
  "fundingLevel": 0.85,
  "cascadeImminent": false,
  "thresholds": {
    "warningThreshold": 50,
    "criticalThreshold": 30,
    "maxSimultaneousLiquidations": 100
  }
}
```

---

### Check Cascade Imminent
**GET** `/fund/:fundId/cascade-imminent`

Checks if cascade liquidation is imminent.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "imminent": false
}
```

---

### Prevent Cascade Manually
**POST** `/fund/:fundId/prevent-cascade`

Manually triggers cascade prevention measures.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "preventionActivated": true,
  "currentStatus": "PAUSED",
  "failSafeLevel": "CRITICAL - FUND PAUSED"
}
```

---

### Analyze Liquidation Patterns
**GET** `/fund/:fundId/liquidation-patterns`

Analyzes historical liquidation patterns for risk assessment.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "totalLiquidations": 50,
  "fullyCovered": 42,
  "partiallyCovered": 6,
  "uncovered": 2,
  "averageLoss": 5000,
  "averageCoveragePercentage": 88.5,
  "cascadeEventsDetected": 2,
  "riskLevel": "LOW"
}
```

---

### Get Fail-Safe Status
**GET** `/fund/:fundId/failsafe-status`

Gets current fail-safe mechanism status.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "allFailSafesActive": true,
  "fundStatus": "ACTIVE",
  "minimumBalanceProtected": true,
  "cascadeProtectionActive": false,
  "liquidationStormDetected": false,
  "emergencyModeTriggered": false
}
```

---

## Health Monitoring Endpoints

### Get Fund Health Status
**GET** `/fund/:fundId/health`

Gets current fund health metrics.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "fundingLevel": 85,
  "burnRate": 45.5,
  "daysToDepletion": 7.82,
  "activeThreatCount": 12,
  "volatilityIndex": 35,
  "healthStatus": "WARNING",
  "coverageRatio": 92.5
}
```

---

### Get Comprehensive Health Report
**GET** `/fund/:fundId/health/report`

Gets comprehensive fund health report.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "fund": {
    "id": 1,
    "type": "PRIMARY",
    "status": "ACTIVE",
    "balance": 8500,
    "targetBalance": 10000,
    "minimumBalance": 1000
  },
  "metrics": {
    "fundingLevel": "85.00%",
    "burnRate": "45.50/hour",
    "daysToDepletion": "7.82 days",
    "activeThreatCount": 12,
    "volatilityIndex": 35,
    "healthStatus": "WARNING",
    "coverageRatio": "94.17%"
  },
  "alert": {
    "alertGenerated": true,
    "alertLevel": "MEDIUM",
    "message": "Fund WARNING. Funding: 85.00%",
    "recommendation": "Monitor closely - consider increasing contribution rate"
  },
  "autoRefill": {
    "enabled": true,
    "needsRefill": true,
    "refillAmount": 1500
  },
  "recent": {
    "claimsLast24h": 8,
    "totalClaimedLast24h": 2400
  }
}
```

---

### Update Health Metrics
**POST** `/fund/:fundId/health/update`

Manually triggers health metrics calculation.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):** Updated health metrics object

---

### Check Auto-Refill Status
**GET** `/fund/:fundId/auto-refill`

Checks if auto-refill is needed.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "needsRefill": true,
  "currentBalance": 8500,
  "targetBalance": 10000,
  "refillAmount": 1500
}
```

---

### Trigger Auto-Refill
**POST** `/fund/:fundId/trigger-auto-refill`

Manually triggers auto-refill if enabled and needed.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "triggered": true,
  "refillAmount": 1500,
  "newBalance": 10000
}
```

---

### Get Health Alert
**GET** `/fund/:fundId/alert`

Gets current health alert for fund.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "alertGenerated": true,
  "alertLevel": "MEDIUM",
  "message": "Fund WARNING. Funding: 85.00%",
  "recommendation": "Monitor closely - consider increasing contribution rate"
}
```

---

### Detect Anomalies
**GET** `/fund/:fundId/anomalies`

Detects anomalies in fund behavior.

**Parameters:**
- `fundId` (path, required): Fund identifier

**Response (200):**
```json
{
  "detected": true,
  "anomalies": [
    "Rapid depletion detected: 45.5% paid in 24h",
    "Concentrated claims: User 123 claimed 22.5%"
  ]
}
```

---

### Get All Health Metrics
**GET** `/health/all`

Gets health metrics for all funds.

**Response (200):** Array of health metrics objects

---

### Get Critical Funds
**GET** `/health/critical`

Gets funds requiring immediate attention.

**Response (200):**
```json
[
  {
    "fundId": 2,
    "healthStatus": "CRITICAL",
    "fundingLevel": 35,
    "daysToDepletion": 2.5
  }
]
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Deposit amount must be positive",
  "error": "Bad Request"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Insurance fund not found: 999",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Primary insurance fund already exists",
  "error": "Conflict"
}
```

---

**Last Updated**: 2024
**Version**: 1.0.0
**Base URL**: `/insurance`
