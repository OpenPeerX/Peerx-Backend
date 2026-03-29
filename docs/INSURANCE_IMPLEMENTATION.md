# Insurance Fund Implementation Guide

## Quick Start

### 1. Enable Insurance Module in App

```typescript
// app.module.ts
import { InsuranceModule } from './insurance/insurance.module';

@Module({
  imports: [
    // ... other modules
    InsuranceModule,
  ],
})
export class AppModule {}
```

### 2. Create Primary Fund

```bash
POST /insurance/fund
Content-Type: application/json

{
  "fundType": "PRIMARY",
  "minimumBalance": 1000,
  "targetBalance": 10000,
  "coverageRatio": 75,
  "contributionRate": 0.001,
  "autoRefillEnabled": true
}
```

Response:
```json
{
  "id": 1,
  "fundType": "PRIMARY",
  "status": "ACTIVE",
  "balance": 0,
  "targetBalance": 10000,
  "minimumBalance": 1000,
  "coverageRatio": 75,
  "contributionRate": 0.001
}
```

### 3. Seed Initial Fund

```bash
POST /insurance/fund/1/deposit
Content-Type: application/json

{
  "amount": 10000
}
```

## Fund Management Workflows

### Recording Trade-Based Contributions

When a trade is executed, automatically contribute to insurance fund:

```typescript
// In trading service
async executeTrade(tradeInput: TradeInput): Promise<Trade> {
  // ... execute trade logic
  const trade = await this.saveTradeEntity(tradeInput);
  
  // Record insurance contribution
  const contribution = await this.insuranceService.recordTradeContribution(
    foundId: 1,  // Primary fund
    tradeVolume: trade.volume,
    userId: trade.userId,
    tradeId: trade.id,
    contributionRate: 0.001  // 0.1% of volume
  );
  
  return trade;
}
```

### Recording Liquidation Events

When liquidation is triggered, record with insurance system:

```typescript
// In liquidation service
async liquidatePosition(userId: number, positionId: number) {
  const position = await this.getPosition(positionId);
  const loss = this.calculateLoss(position);
  
  // Record liquidation event
  const result = await this.liquidationCoverageService.recordLiquidationEvent(
    fundId: 1,
    userId,
    totalLoss: loss,
    reason: `Position liquidation - ${position.symbol}`,
    metadata: {
      positionId,
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      exitPrice: position.currentPrice,
      leverage: position.leverage,
    }
  );
  
  // Check cascade risk
  if (result.coverageDecision.failSafeTriggered) {
    this.logger.warn(`Cascade protection engaged for user ${userId}`);
  }
  
  // Auto-claim for covered portion
  if (result.coverageDecision.coverageAmount > 0) {
    this.sendClaimToPayout(result.liquidationEvent.id);
  }
}
```

### Monitoring Fund Health

Periodically check fund health and generate alerts:

```typescript
// In health monitoring cron job (every 5 minutes)
async updateFundHealthMetrics(): Promise<void> {
  const fund = await this.fundService.getPrimaryFund();
  
  // Update metrics
  const metrics = await this.healthService.calculateHealthMetrics(fund.id);
  
  // Check for alerts
  const alert = await this.healthService.generateHealthAlert(fund.id);
  if (alert.alertGenerated) {
    await this.notificationService.alertAdmins({
      level: alert.alertLevel,
      message: alert.message,
      recommendation: alert.recommendation,
    });
  }
  
  // Check for anomalies
  const anomalies = await this.healthService.detectAnomalies(fund.id);
  if (anomalies.detected) {
    await this.notificationService.flagSuspiciousActivity(anomalies);
  }
  
  // Trigger auto-refill if needed
  if (fund.autoRefillEnabled) {
    const refillResult = await this.healthService.triggerAutoRefill(fund.id);
    if (refillResult.triggered) {
      this.logger.log(`Auto-refill triggered: +${refillResult.refillAmount}`);
    }
  }
}
```

## API Usage Patterns

### Fund Status Reporting

Get comprehensive fund status:

```bash
GET /insurance/fund/1/health/report
```

Response:
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

### Claiming Insurance for Liquidation Loss

1. Submit claim:
```bash
POST /insurance/claim
Content-Type: application/json

{
  "fundId": 1,
  "claimantUserId": 123,
  "originalLoss": 5000,
  "claimReason": "LIQUIDATION_LOSS",
  "description": "Liquidation from flash crash"
}
```

2. Claim is auto-approved (if configured) or needs admin approval:
```bash
POST /insurance/claim/42/approve
Content-Type: application/json

{
  "approverUserId": 1,
  "notes": "Loss verified. Approving full coverage."
}
```

3. Process payout:
```bash
POST /insurance/claim/42/payout
Content-Type: application/json

{
  "operatorId": 2
}
```

### Checking Cascade Risk

Monitor cascade liquidation threat:

```bash
GET /insurance/fund/1/cascade-risk
```

Response:
```json
{
  "level": "MEDIUM",
  "volatilityIndex": 45,
  "activeLiquidations": 28,
  "fundingLevel": 0.87,
  "cascadeImminent": false,
  "thresholds": {
    "warningThreshold": 50,
    "criticalThreshold": 30,
    "maxSimultaneousLiquidations": 100
  }
}
```

### Preventing Cascade Manually

If cascade imminent, manually trigger prevention:

```bash
POST /insurance/fund/1/prevent-cascade
```

Response:
```json
{
  "preventionActivated": true,
  "currentStatus": "PAUSED",
  "failSafeLevel": "CRITICAL - FUND PAUSED"
}
```

## Integration Checklist

### ✅ Phase 1: Setup
- [ ] Create InsuranceModule and add to AppModule
- [ ] Create primary fund via API
- [ ] Seed initial fund balance from protocol treasury
- [ ] Configure all parameters (coverage ratio, contribution rate, etc.)

### ✅ Phase 2: Contribution Integration
- [ ] Hook trade execution to auto-record contributions
- [ ] Hook protocol revenue collection to record protocol contributions
- [ ] Add manual contribution endpoint for users
- [ ] Test contribution flow with sample trades

### ✅ Phase 3: Liquidation Integration  
- [ ] Hook liquidation service to record events
- [ ] Implement liquidation event recording
- [ ] Test coverage decision engine
- [ ] Verify auto-claim creation

### ✅ Phase 4: Monitoring Integration
- [ ] Set up 5-minute health check cron job
- [ ] Implement anomaly detection notifications
- [ ] Add auto-refill trigger logic
- [ ] Configure alert thresholds

### ✅ Phase 5: Testing
- [ ] Unit test all services
- [ ] Integration test with trading module
- [ ] Stress test cascade scenarios
- [ ] Load test claim processing

## Common Operations

### Adding Manual Fund Deposit

```bash
POST /insurance/contribution/manual
Content-Type: application/json

{
  "fundId": 1,
  "userId": 100,
  "amount": 5000,
  "reason": "Strategic fund contribution"
}
```

### Getting Claim History for User

```bash
GET /insurance/user/123/claims/fund/1
```

### Batch Approving Claims

```bash
POST /insurance/fund/1/claims/batch-approve
Content-Type: application/json

{
  "approverUserId": 1
}
```

### Recording Interest Income

```bash
POST /insurance/contribution
Content-Type: application/json

{
  "fundId": 1,
  "contributionType": "INTEREST",
  "amount": 125.50,
  "description": "Interest from USDC lending pool"
}
```

### Analyzing Liquidation Patterns

```bash
GET /insurance/fund/1/liquidation-patterns
```

Response:
```json
{
  "totalLiquidations": 45,
  "fullyCovered": 38,
  "partiallyCovered": 5,
  "uncovered": 2,
  "averageLoss": 2850,
  "averageCoveragePercentage": 92.5,
  "cascadeEventsDetected": 3,
  "riskLevel": "LOW"
}
```

## Error Handling

### Common Errors and Recovery

**1. Insufficient Fund Balance**
```
Status: 400
Message: "Insufficient fund balance for payout"

Recovery:
- Check fund balance and funding level
- Trigger auto-refill or manual deposit
- Reduce coverage ratio
```

**2. Fund Paused**
```
Status: 400  
Message: "Fund status is PAUSED"

Recovery:
- Contact admins to investigate pause reason
- Fix underlying issue (e.g., cascade threat)
- Resume fund via admin endpoint
```

**3. Cascade Prevention Active**
```
Status: 400
Message: "Liquidation storm detected - cascade prevention activated"

Recovery:
- Wait for volatility index to drop
- Fund will automatically resume
- Or manually prevent cascade after investigation
```

**4. Claim Already Processed**
```
Status: 409
Message: "Claim already processed with status: PAID"

Recovery:
- Cannot reprocess claim
- Submit new claim for additional loss
```

## Monitoring Dashboard Queries

### Admin Dashboard Queries

```typescript
// Get fund status summary
const fundStatus = await this.fundService.getFundStatus(1);

// Get all funds
const allFunds = await this.fundService.getAllFunds();

// Get fund statistics
const stats = await this.fundService.getStatistics();

// Get health report
const healthReport = await this.healthService.getHealthReport(1);

// Get critical funds requiring attention
const criticalFunds = await this.healthService.getFundsRequiringAttention();

// Get claim statistics
const claimStats = await this.claimService.getClaimStats(1);

// Get liquidation patterns
const patterns = await this.liquidationService.analyzeLiquidationPatterns(1);

// Get cascade risk metrics
const cascadeRisk = await this.liquidationService.getCascadeRiskMetrics(1);

// Get fail-safe status
const failSafeStatus = await this.liquidationService.getFailSafeStatus(1);

// Get all health metrics
const allMetrics = await this.healthService.getAllHealthMetrics();
```

## Configuration Examples

### Conservative Configuration (Low Risk)
```json
{
  "coverageRatio": 50,
  "contributionRate": 0.002,
  "minimumBalance": 5000,
  "targetBalance": 25000,
  "autoRefillEnabled": true,
  "warningThreshold": 0.75
}
```

### Aggressive Configuration (High Coverage)
```json
{
  "coverageRatio": 90,
  "contributionRate": 0.0005,
  "minimumBalance": 1000,
  "targetBalance": 5000,
  "autoRefillEnabled": false,
  "warningThreshold": 0.5
}
```

### Balanced Configuration (Recommended)
```json
{
  "coverageRatio": 75,
  "contributionRate": 0.001,
  "minimumBalance": 2000,
  "targetBalance": 10000,
  "autoRefillEnabled": true,
  "warningThreshold": 0.6
}
```

## Maintenance Tasks

### Weekly
- Review claim statistics and patterns
- Check for anomalies in fund balance
- Verify contribution flow from trading

### Monthly
- Analyze liquidation patterns over month
- Audit claim approvals for consistency
- Review cascade events and improvements
- Update coverage ratio if needed

### Quarterly
- Full fund audit and reconciliation
- Stress test cascade scenarios with current data
- Review and adjust auto-refill thresholds
- Analyze user impact of coverage decisions

---

**Last Updated**: 2024
**Version**: 1.0.0
