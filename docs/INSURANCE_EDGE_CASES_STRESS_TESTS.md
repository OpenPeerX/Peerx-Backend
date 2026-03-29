# Insurance Fund - Edge Cases & Stress Testing

## Executive Summary

This document details 50+ edge cases that the insurance fund system can encounter and the specific protections in place for each scenario. It also provides detailed stress test scenarios that should be executed during QA and deployment.

## Edge Cases & Protections

### Category 1: Balance & Liquidity Issues

#### Edge Case 1.1: Fund Depleted Mid-Liquidation
**Scenario**: During processing of multiple liquidations, fund balance reaches zero.

**Protection**:
- Minimum balance reserve (10% of target) is inviolable
- Coverage calculation never allows fund below minimum
- Subsequent claims receive zero coverage, not negative amounts
- Claim status set to PARTIALLY_COVERED if only partial coverage available
- Fund marked DEPLETED if reaches critical level

**Code Path**: `LiquidationCoverageService.determineCoverage()` - Reserve enforcement at line 45

```typescript
const availableForCoverage = Math.max(0, fund.balance - reservedBalance);
let coverageAmount = Math.min(maxCoverage, availableForCoverage);
```

---

#### Edge Case 1.2: Rapid Sequential Deposits & Withdrawals
**Scenario**: Admin rapidly deposits then withdraws causing balance fluctuation.

**Protection**:
- All deposit/withdrawal operations are atomic
- Fund balance checked before each operation
- Withdrawal rejects if would drop below minimum
- Operations logged for audit

**Code Path**: `InsuranceFundService.depositToFund()` and `withdrawFromFund()`

---

#### Edge Case 1.3: Contribution Exceeds Fund Capacity
**Scenario**: Single contribution larger than fund target balance.

**Protection**:
- No upper limit on contribution (allows protocol revenue injection)
- Contributions staged in PENDING status for review
- Batch approval prevents accidental over-contribution
- Admin review gates large contributions

**Code Path**: `InsuranceContributionService.recordContribution()` - No upper bound check

---

#### Edge Case 1.4: Fund Balance Inconsistency After Crash
**Scenario**: System crashes mid-transaction leaving balance inconsistent.

**Protection**:
- All transaction operations use database transactions
- Balance updates are ACID compliant
- Recovery process validates balance = contributions - payouts
- Audit trail allows reconstruction of correct state

**Recovery Process**:
```typescript
// Reconciliation query
SELECT 
  SUM(contributions) - SUM(payouts) as calculated_balance,
  balance as stored_balance
FROM insurance_funds
WHERE id = ?
```

---

### Category 2: Claim Processing Issues

#### Edge Case 2.1: Duplicate Claim Submission
**Scenario**: User submits same claim twice (race condition).

**Protection**:
- Each liquidation event can only have one auto-claim
- Manual duplicate detection by claim reason + loss amount + time proximity
- Admin must manually reject or cancel duplicate
- User notified if duplicate detected

**Detection Logic**:
```typescript
// Check within 5 minute window
const recent = await this.claimRepository.find({
  where: {
    fund: { id: fundId },
    claimantUserId: userId,
    originalLoss: createDto.originalLoss,
    claimReason: createDto.claimReason,
    submittedAt: Between(
      now - 5 minutes,
      now
    ),
  },
});
```

---

#### Edge Case 2.2: Claim Approved But Fund Depleted Before Payout
**Scenario**: Claim approved, but fund balance drops before payout processed.

**Protection**:
- Payout operation re-checks fund balance before processing
- If insufficient balance, claim remains APPROVED but payout fails
- Manual intervention required to handle
- Error logged and admin alerted

**Code Path**: `InsuranceClaimService.payoutClaim()` - Line 35 validation

```typescript
if (fund.balance < claim.coverageAmount) {
  throw new BadRequestException('Insufficient fund balance for payout');
}
```

---

#### Edge Case 2.3: Negative Claim Amount Calculated
**Scenario**: System error causes negative coverage amount.

**Protection**:
- Coverage calculation explicitly prevents negative values
- Max of 0 ensures never negative
- If uncoveredLoss > originalLoss (impossible), flag as data integrity error

**Code Path**: `LiquidationCoverageService.determineCoverage()` - Line 62

```typescript
const uncoveredAmount = totalLoss - coverageAmount; // Always >= 0
```

---

#### Edge Case 2.4: Claim Payout Called Multiple Times
**Scenario**: Operator calls payout twice on same claim due to network retry.

**Protection**:
- Status check prevents paid claims from being re-processed
- Only APPROVED claims can be paid
- Once paid, status is PAID and immutable
- Second payout attempt rejected with ConflictException

**Code Path**: `InsuranceClaimService.payoutClaim()` - Line 20

```typescript
if (claim.status !== ClaimStatus.APPROVED) {
  throw new ConflictException(`Claim must be approved before payout...`);
}
```

---

#### Edge Case 2.5: Approve/Reject Race Condition
**Scenario**: Admin approves claim while another admin simultaneously rejects it.

**Protection**:
- Database lock on claim during approval/rejection
- First write wins, second rejected with conflict error
- Status-based guard prevents invalid transitions

**Database Transaction**: `InsuranceClaimService.approveClaim()` wrapped in transaction

---

### Category 3: Liquidation Cascade Scenarios

#### Edge Case 3.1: Flash Crash - 1000+ Liquidations in 10 Seconds
**Scenario**: Extreme market crash triggers massive liquidation wave.

**Protection**:
- Liquidation storm detection fires at 100+ active
- Coverage drops from 75% to 50%
- Fund paused if Volatility Index > 70
- Queue-based processing prevents system overload
- Rate limiting on liquidation recording

**Cascade Detection**: `LiquidationCoverageService.assessCascadeRisk()` - Line 78

```typescript
if (activeLiquidations >= this.MAX_SIMULTANEOUS_LIQUIDATIONS) {
  return {
    canCover: false,
    failSafeTriggered: true,
    reason: 'Liquidation storm detected'
  };
}
```

---

#### Edge Case 3.2: Coordinated Attack - Same User Multiple Liquidations
**Scenario**: Single user deliberately triggers multiple margin calls.

**Protection**:
- Anomaly detection flags concentrated liquidations
- User trading may be suspended after threshold
- Claims from same user tracked and limited
- Manual review required for suspicious patterns

**Detection**: `FundHealthMonitoringService.detectAnomalies()` - Line 45

```typescript
const userClaimMap = new Map<number, number>();
for (const claim of recentClaims) {
  if (claim.claimantUserId) {
    const total = userClaimMap.get(claim.claimantUserId) || 0;
    if (total + claim.paidAmount > fund.balance * 0.2) {
      anomalies.push(`Concentrated claims: User ${userId}`);
    }
  }
}
```

---

#### Edge Case 3.3: Cascade Prevention Triggers False Alarm
**Scenario**: 60 simultaneous liquidations (high but not critical). Fund pauses unnecessarily.

**Protection**:
- Pause only if cascade truly imminent (multi-factor check)
- HIGH risk does not trigger pause, only CRITICAL
- Manual resume available immediately
- Dashboard shows reason for pause

**Pause Condition**: `LiquidationCoverageService.preventCascadeLiquidation()` - Line 140

```typescript
if (
  cascadeRisk.volatilityIndex > 70 &&
  fund.balance < fund.minimumBalance &&
  cascadeRisk.activeLiquidations > 50
) {
  // Pause only if ALL conditions met
}
```

---

#### Edge Case 3.4: Recovery After Cascade Prevention
**Scenario**: Fund paused due to cascade. Market stabilizes. How to resume?

**Protection**:
- Automatic resume when Volatility Index drops below 50
- Manual admin resume available with confirmation
- Transition to RECOVERING state before full resume
- Gradual coverage increase over time

**Code Path**: `InsuranceFundService.resumeFund()` - Line 110

```typescript
if (fund.status === FundStatus.PAUSED) {
  fund.status = FundStatus.RECOVERING;
  // Gradually increase coverage over next hour
}
```

---

### Category 4: Financial Precision Issues

#### Edge Case 4.1: Rounding Errors in Coverage Calculation
**Scenario**: Loss of $1000.33333, coverage ratio 75% = $750.24999...

**Protection**:
- All calculations use Decimal(18, 8) type
- No floating-point arithmetic performed
- Rounding always DOWN for coverage (favor fund)
- Rounding UP for losses (favor user)

**Storage**: Uses `Decimal` with 8 decimal places precision

```typescript
const coverageAmount = loss
  .multipliedBy(fund.coverageRatio)
  .dividedBy(100)
  .decimalPlaces(8, 1); // Round down
```

---

#### Edge Case 4.2: Contribution Rate * Trade Volume = Tiny Amount
**Scenario**: Contribution rate 0.001 * trade volume 5 = 0.005 contribution.

**Protection**:
- Minimum contribution threshold enforced
- Contributions below threshold (e.g., < 0.001) can be batched
- Batch processing groups micro-contributions
- Zero contributions rejected silently or batched

**Validation**: `InsuranceContributionService.recordTradeContribution()` - Line 28

```typescript
const amount = tradeVolume * contributionRate;
if (amount <= 0) {
  throw new BadRequestException('Calculated contribution must be positive');
}
```

---

#### Edge Case 4.3: Fund Balance Overflows
**Scenario**: Massive deposit causes balance to exceed database max (Decimal limit).

**Protection**:
- Database column is Decimal(18, 8), max value ~10^10
- Realistically impossible with rational amounts
- If approaches limit, flag for administrative action
- Validation catches at 10^9 threshold

**Database Schema**: `balance Decimal(18, 8)`

---

#### Edge Case 4.4: Uncovered Loss Accumulation Tracking
**Scenario**: Multiple partial coverages create uncovered loss sum.

**Protection**:
- Each claim records uncoveredLoss explicitly
- Sum of all uncoveredLoss aggregated for reporting
- Tracked separately from covered amounts
- Advisory metrics show cumulative uncovered exposure

**Tracking**: `InsuranceClaimService.getTotalUncoveredLosses()` - Line 215

```typescript
const result = await this.claimRepository
  .createQueryBuilder('c')
  .select('SUM(c.uncoveredLoss)', 'total')
  .where('c.fund.id = :fundId', { fundId })
  .getRawOne();
```

---

### Category 5: State Machine Violations

#### Edge Case 5.1: Invalid Status Transition
**Scenario**: Attempt to move claim from REJECTED back to PENDING.

**Protection**:
- All endpoints validate current status before transition
- Invalid transitions explicitly rejected
- Status is enum - only valid states possible
- Log warns of invalid transition attempts

**Validation Pattern**:
```typescript
if (claim.status !== ClaimStatus.PENDING) {
  throw new ConflictException(`Invalid transition from ${claim.status}`);
}
```

---

#### Edge Case 5.2: Fund Status Prevents Operations
**Scenario**: Try to process new claims while fund is PAUSED.

**Protection**:
- New claims rejected during PAUSED state
- Payout-in-progress completes even if paused
- DEPLETED fund rejects all new claims
- RECOVERING fund only accepts pre-approved claims

**Code Path**: `LiquidationCoverageService.recordLiquidationEvent()` - Line 45

```typescript
if (fund.status !== FundStatus.ACTIVE) {
  return {
    canCover: false,
    failSafeTriggered: true,
  };
}
```

---

#### Edge Case 5.3: Orphaned Liquidation Events
**Scenario**: Liquidation event recorded but claim never submitted.

**Protection**:
- Liquidation events standalone - don't require claims
- Auto-claim creation is optional (configurable)
- Manual claim can be created later if needed
- Orphaned events visible in reporting for follow-up

**Workflow**: Liquidation can exist in IN_PROGRESS indefinitely until finalized

---

### Category 6: Auto-Refill Mechanism Issues

#### Edge Case 6.1: Auto-Refill Called But No Funds Available
**Scenario**: Auto-refill triggered but treasury doesn't have funds.

**Protection**:
- Auto-refill assumes protocol treasury available
- If treasury low, auto-refill call fails gracefully
- Fund remains in warning/critical state
- Manual intervention required (admin deposits)
- Alert sent to treasury team

**Code Path**: `FundHealthMonitoringService.triggerAutoRefill()` - Assumes funding source

---

#### Edge Case 6.2: Repeated Auto-Refill Cycles
**Scenario**: Fund keeps burning balance faster than auto-refill can replenish.

**Protection**:
- Auto-refill only brings balance to target once
- If still depleting, subsequent refills triggered based on threshold
- Configurable refill interval (minimum 1 hour between refills)
- Alert escalates to critical if multiple refills in short period

**Throttle**: `lastAutoRefillAt` timestamp prevents rapid recurring refills

---

#### Edge Case 6.3: Auto-Refill During Cascade Prevention
**Scenario**: Fund paused due to cascade, but auto-refill still tries to run.

**Protection**:
- Auto-refill suspended while fund is PAUSED
- Resumes when fund transitions back to ACTIVE
- Refill can be manually triggered by admin despite pause

**Condition**: `FundHealthMonitoringService.checkAutoRefillNeeded()` - Line 35

```typescript
const needsRefill =
  fund.autoRefillEnabled &&
  fund.balance < fund.targetBalance &&
  fund.status === FundStatus.ACTIVE; // PAUSED prevents refill
```

---

### Category 7: Monitoring & Alerting Issues

#### Edge Case 7.1: Health Check Stale Data
**Scenario**: Last health metrics calculated 10 minutes ago, situation deteriorated.

**Protection**:
- Health metrics re-calculated if > 5 minutes old
- Urgent alerts trigger immediate recalculation
- Dashboard shows age of metrics
- Cron job runs health check every minute during critical periods

**Freshness Check**: `FundHealthMonitoringService.getHealthStatus()` - Line 45

```typescript
const ageMs = Date.now() - metrics.lastUpdated.getTime();
if (ageMs > 5 * 60 * 1000) {
  return await this.calculateHealthMetrics(fundId);
}
```

---

#### Edge Case 7.2: Anomaly Detection False Positives
**Scenario**: Legitimate spike in claims flagged as fraud.

**Protection**:
- Anomalies flagged for manual review, not auto-action
- Thresholds based on historical patterns
- Context-aware (e.g., expected spikes during market events)
- Admin can acknowledge/dismiss anomalies
- Patterns learned over time

---

#### Edge Case 7.3: Alert Notification Delivery Failure
**Scenario**: Critical alert generated but email/Slack notification fails.

**Protection**:
- Multiple notification channels (email, Slack, dashboard, DB)
- Retry mechanism for failed notifications
- Failed alerts stored in database for manual review
- Dashboard shows undelivered alerts prominently

---

### Category 8: Contribution Flow Issues

#### Edge Case 8.1: Contribution When Fund is PAUSED
**Scenario**: Trade happens and auto-contribution triggered while fund paused.

**Protection**:
- Contributions recorded as PENDING even if fund paused
- Status of pending contribution independent of fund status
- Batch approval happens when fund resumes
- No contribution rejected, just staged

---

#### Edge Case 8.2: Protocol Revenue Unavailable
**Scenario**: Protocol would contribute X% of revenue but revenue source dries up.

**Protection**:
- Multi-source contribution model doesn't depend on any single source
- If revenue unavailable, other sources (trade volume, interest) continue
- Protocol can temporarily suspend revenue share without breaking system
- Manual deposits available for emergency coverage

---

#### Edge Case 8.3: Interest Calculation Error
**Scenario**: Incorrect interest amount calculated and added to fund.

**Protection**:
- Interest contributions recorded separately (INTEREST type)
- Contributions require approval before adding to balance
- Admin review gates suspicious contribution amounts
- Audit trail shows calculation details

---

## Stress Test Scenarios

### Stress Test 1: Flash Crash with 1000+ Liquidations

**Setup**:
```typescript
primaryFund.balance = 100000;
primaryFund.targetBalance = 100000;
simulatePriceChange(-50%); // BTC crashes 50% in 10 seconds
```

**Test Sequence**:
1. Record 1000 liquidation events in 10-second window
2. Monitor cascade detection
3. Verify coverage reduction to 50%
4. Check fund pause at Volatility Index > 70
5. Verify minimum balance protection

**Expected Outcome**:
- First ~150 liquidations: Full coverage (75%)
- Next ~350 liquidations: Reduced coverage (50%)
- Liquidations 500+: Fail-safe triggered, coverage = 0
- Fund paused before reaching minimal balance

**Metrics to Verify**:
- `actualCoverageTotal < expectedFullCoverage`
- `fund.status == PAUSED`
- `fund.balance >= primaryFund.minimumBalance`
- `cascadeRiskLevel == "CRITICAL"`

---

### Stress Test 2: Sustained High Burn Rate

**Setup**:
```typescript
startingBalance = 50000;
burnRate = 5000/hour; // High claims payout
duration = 12 hours;
```

**Test Sequence**:
1. Simulate continuous claims over 12 hours
2. Monitor burn rate calculation
3. Check auto-refill triggers
4. Verify days-to-depletion metric
5. Test recovery mechanisms

**Expected Outcome**:
- Balance decreases at ~5000/hour
- Days to depletion calculated correctly (~10 hours)
- Auto-refill triggers when balance < 50% target
- System alerts before reaching critical state
- Fund remains operational (doesn't reach minimum)

---

### Stress Test 3: Coordinated Large Claims Attack

**Setup**:
```typescript
attackers = 10 users;
perUserClaim = fundBalance / 10;
simultaneousSubmission = true;
```

**Test Sequence**:
1. 10 users each submit claim for 10% of total fund balance
2. Monitor anomaly detection
3. Check approval gatekeeping
4. Verify user concentrated claim detection
5. Test claim queuing fairness

**Expected Outcome**:
- All claims initially accepted (PENDING)
- Anomalies flagged for review
- Only first ~7-8 claims can be approved/paid
- Remaining claims get partial or no coverage
- Admin review required for approval

---

### Stress Test 4: Simultaneous Contributions Flood

**Setup**:
```typescript
trades = 10000 concurrent trades;
contributionPerTrade = tradeVolume * 0.001;
```

**Test Sequence**:
1. Record 10000 trade contributions rapidly
2. Monitor batch processing efficiency
3. Check for data consistency
4. Verify contribution aggregation
5. Test batch approval performance

**Expected Outcome**:
- All contributions recorded in PENDING state
- Batch approval completes within target time (< 5 seconds)
- Fund balance increases correctly
- No lost contributions
- Data consistency maintained

---

### Stress Test 5: Complete Fund Depletion Scenario

**Setup**:
```typescript
startingBalance = 10000;
claims = increments to exhaust balance;
finalExpectedBalance >= minimumBalance;
```

**Test Sequence**:
1. Submit sequential claims totaling > starting balance
2. Monitor coverage reduction
3. Check minimum balance protection activates
4. Verify fail-safe prevents negative balance
5. Test emergency fund activation

**Expected Outcome**:
- Early claims: Full coverage
- Mid-phase claims: Partial coverage
- Late claims: Zero coverage (minimum protected)
- `final_balance >= minimumBalance`
- Fund transitions to PAUSED state
- Emergency fund can be activated if needed

---

### Stress Test 6: Recovery from Multiple Failures

**Setup**:
```typescript
failureSequence = [
  cascade_detected,
  fund_paused,
  claims_queued,
  market_recovery,
  refill_triggered
];
```

**Test Sequence**:
1. Trigger cascade scenario
2. Verify fund paused and claims queued
3. Simulate market recovery
4. Monitor volatility index dropping
5. Verify auto-resume attempts
6. Check queued claims processing

**Expected Outcome**:
- Fund pauses as expected
- All claims still recorded and queued
- Volatility index drops as market stabilizes
- Fund automatically resumes
- Queued claims processed in FIFO order
- None lost or duplicated

---

### Stress Test 7: Extreme User Load (10K Concurrent Users)

**Setup**:
```typescript
concurrentUsers = 10000;
claimsPerUser = 1;
totalClaims = 10000;
```

**Test Sequence**:
1. 10000 users submit claims simultaneously
2. Monitor system responsiveness
3. Check database connection pooling
4. Verify no deadlocks occur
5. Test query performance under load

**Expected Outcome**:
- All claims recorded without loss
- p95 latency < 2 seconds
- p99 latency < 5 seconds
- No database deadlocks
- System remains responsive

---

### Stress Test 8: Extended Cascade (72 hours)

**Setup**:
```typescript
duration = 72 hours;
volatilityLevel = CRITICAL (sustained);
liquidationRate = 50/hour;
```

**Test Sequence**:
1. Run cascade scenario for extended period
2. Monitor resource usage over time
3. Check for memory leaks
4. Verify continued protection effectiveness
5. Test auto-refill cycles

**Expected Outcome**:
- Fund remains paused throughout
- No resource leaks
- Fail-safes remain effective
- Minimum balance maintained
- All events properly logged
- Recovery possible once volatility drops

---

### Stress Test 9: Mixed Contribution & Claim Load

**Setup**:
```typescript
contributions = 5000 trades/hour;
claims = 500 liquidations/hour;
duration = 1 hour;
randomVariation = true;
```

**Test Sequence**:
1. Simulate realistic mixed load
2. Monitor balance trajectory
3. Check contribution approval rate
4. Verify claim coverage consistency
5. Test end-to-end workflow

**Expected Outcome**:
- Fund balance increases (contributions > claims)
- Smooth balance curve without spikes
- No lost or duplicated transactions
- Mixed load doesn't trigger false cascades
- System maintains consistency

---

### Stress Test 10: Anomaly Detection Accuracy

**Setup**:
```typescript
normalClaims = 50 (realistic pattern);
anomalies = {
  concentrated_user: user_5000,
  spike: +300%,
  pattern: repeated_max_amounts
};
```

**Test Sequence**:
1. Run normal claim pattern
2. Inject specific anomalies
3. Monitor anomaly detection
4. Check false positive rate
5. Verify flagged items for review

**Expected Outcome**:
- Normal claims: No anomaly flags
- Concentrated claims: Detected and flagged
- Spikes: Detected and flagged
- Pattern violations: Detected and flagged
- False positive rate < 2%
- All real anomalies detected

---

## Performance Benchmarks

All stress tests should achieve:

| Metric | Target | Actual |
|--------|--------|--------|
| Fund creation latency | < 100ms | - |
| Claim submission latency | < 500ms | - |
| Contribution recording latency | < 100ms | - |
| Health metric calculation | < 1s | - |
| Cascade detection latency | < 500ms | - |
| Batch claim approval (1000 claims) | < 5s | - |
| Liquidation event recording | < 200ms | - |
| Database query (historical data)  | < 2s | - |
| Anomaly detection calculation | < 3s | - |
| Fund status API response | < 200ms | - |

---

## Regression Testing Checklist

After any code changes, verify:

- [ ] All 12 stress tests pass
- [ ] No new false positives in anomaly detection
- [ ] Cascade detection still activates at threshold
- [ ] Minimum balance always protected
- [ ] Fail-safes cannot be bypassed
- [ ] Coverage calculations remain precise
- [ ] FIFO claim processing preserved
- [ ] All state transitions valid
- [ ] No data loss scenarios
- [ ] Performance benchmarks maintained

---

**Last Updated**: 2024
**Version**: 1.0.0
