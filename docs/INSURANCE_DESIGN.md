# Insurance Fund and Liquidation Safety - Design Guide

## Overview

The Insurance Fund system is a comprehensive financial safety mechanism designed to protect traders from catastrophic losses during extreme market conditions. It provides coverage for liquidation losses while implementing sophisticated fail-safe mechanisms to prevent cascade liquidation events that could destabilize the entire trading platform.

## Core Objectives

1. **Loss Coverage**: Cover trader losses during liquidation events up to a configurable percentage
2. **Cascade Prevention**: Detect and prevent liquidation cascades that could trigger systemic risk
3. **Fund Sustainability**: Maintain adequate fund balance through multi-source contribution mechanisms
4. **Proactive Monitoring**: Real-time health monitoring with early warning systems
5. **Transparent Reporting**: Complete visibility into fund status, claims, and risk metrics

## Fund Architecture

### Three Fund Types

1. **PRIMARY Fund**: Main insurance pool funded by protocol revenue and trader contributions
2. **EMERGENCY Fund**: Secondary reserve activated during crisis situations
3. **USER_CONTRIBUTED Fund**: Supplementary pool from voluntary trader contributions

### Financial Model

```
Fund Balance Growth = Contributions - Payouts + Interest
Contribution Sources = Trade Volume + Manual + Protocol Revenue + Interest + Penalties
```

#### Contribution Types
- **TRADE_VOLUME**: Automatic 0.1% of trade volume (configurable)
- **MANUAL**: User voluntary contributions  
- **PROTOCOL_REVENUE**: Protocol fee sharing (configurable percentage)
- **INTEREST**: Returns from lending/staking activities
- **PENALTY**: Penalties from liquidation violations redistributed to fund

## Liquidation Coverage Decision Engine

### Coverage Calculation

```
Max Coverage = Loss × Coverage Ratio ÷ 100
Allowed Coverage = min(Max Coverage, Available Balance - Reserve)
```

Default Parameters:
- Coverage Ratio: 75% (covers 3/4 of losses up to fund limit)
- Minimum Balance (Reserve): 10% of target balance
- Target Balance: Baseline fund size

### Fail-Safe Mechanisms

#### FAIL-SAFE 1: Fund Status Check
- Only ACTIVE funds can provide coverage
- PAUSED/DEPLETED funds reject all new coverage requests
- Status transitions prevent cascade during crises

#### FAIL-SAFE 2: Liquidation Storm Detection
- Threshold: 100+ simultaneous liquidations
- Action: Switch to reduced coverage mode (50% coverage ratio)
- Purpose: Preserve capital for extended crisis

#### FAIL-SAFE 3: Critical Cascade Threshold
- Triggers when: Volatility Index ≥ 70 AND Balance < Minimum
- Action: Pause fund, reject all coverage except emergency
- Protection: Prevents fund depletion during synchronized attacks

#### FAIL-SAFE 4: Minimum Balance Reserve
- Always reserves 10% of target balance
- Cannot be used for claims no matter how many liquidations
- Guarantee: Fund never goes below critical level

#### FAIL-SAFE 5: Graduated Coverage Under Stress

| Volatility Level | Coverage Ratio Applied | Condition |
|----------------|----------------------|-----------|
| LOW | 100% (normal 75%) | Index < 30 |
| MEDIUM | 100% (normal 75%) | Index 30-50 |
| HIGH | 75% of normal | Index 50-70 |
| CRITICAL | 50% of normal | Index > 70 |

## Health Monitoring System

### Health Status Levels

```
Funding Level (Balance / Target) → Health Status
≥ 75% → HEALTHY (green)
50-75% → WARNING (yellow)
25-50% → CRITICAL (orange)  
< 25% → EMERGENCY (red)
```

### Volatility Index Calculation (0-100)

**Funding Level Component** (0-40 points):
- < 10%: +40 pts
- 10-25%: +30 pts
- 25-50%: +20 pts
- 50-75%: +10 pts

**Active Threats Component** (0-40 points):
- Liquidations > 100: +40 pts
- Liquidations 50-100: +30 pts
- Liquidations 20-50: +20 pts
- Liquidations 5-20: +10 pts

**Recent Payouts Component** (0-20 points):
- > 10% of target in last hour: +20 pts
- 5-10% of target in last hour: +15 pts
- Any amount in last hour: +10 pts

### Burn Rate & Days to Depletion

```
Burn Rate = Total Claims Paid in 24h ÷ 24 hours
Days to Depletion = Current Balance ÷ Burn Rate ÷ 24 hours
```

Early Warning Triggers:
- Days to Depletion < 7 days → Enable auto-refill
- Days to Depletion < 2 days → Critical alert, manual intervention
- Days to Depletion < 1 day → Emergency pause option

### Auto-Refill Mechanism

Triggered when:
1. Fund balance drops below target balance
2. Balance is below minimum balance
3. Auto-refill is enabled
4. Fund is in ACTIVE status

Action:
- Automatically refill to target balance
- Record timestamp and refill amount
- Log event for audit trail
- Alert admins of refill trigger

## Claim Processing Workflow

### Claim States

```
PENDING → APPROVED → PAID
    ↓         ↓
REJECTED CANCELLED
```

### Claim Submission
- User/operator submits claim with loss amount
- System calculates coverage based on fund state
- Claim stored in PENDING status
- Initial coverage calculation locked

### Claim Approval
- Admin approves with optional notes
- Fund balance verified sufficient
- Claim moves to APPROVED state
- Timestamp recorded

### Claim Payout
- Operator triggers payout
- Fund balance decreased by coverage amount
- Claim moved to PAID state
- Payout amount and timestamp recorded

### Claim Rejection
- Admin rejects with reason documented
- Claim moved to REJECTED state
- Rejection reason stored immutably
- Event logged for audit

## Liquidation Event Recording

### Event Capture
```typescript
{
  userId: number              // Affected trader
  totalLoss: number          // Full loss amount
  coverageAmount: number     // Fund coverage provided
  uncoveredAmount: number    // User's responsibility
  coveragePercentage: number // Actual coverage %
  volatilityIndex: number    // Market stress level at time
  cascadeRiskLevel: string   // LOW|MEDIUM|HIGH|CRITICAL
  isCovered: boolean         // Did fund provide any coverage
  failSafeTriggered: boolean // Was fail-safe mechanism engaged
}
```

### Status Transitions
```
INITIATED → IN_PROGRESS → [FULLY_COVERED | PARTIALLY_COVERED | FAILED]
                              ↓
                          COMPLETED
```

## Edge Cases & Protections

### Edge Case 1: Simultaneous Large Claims
**Scenario**: Multiple large claims submitted while balance limited

**Protection**:
- FIFO claim processing ensures fairness
- Partial coverage allowed (claim marked PARTIALLY_COVERED)
- Uncovered loss tracked separately
- Subsequent claims get nil coverage if balance exhausted

### Edge Case 2: Fund Depletion During Crisis
**Scenario**: Claims exceed fund balance during liquidation cascade

**Protection**:
- Minimum balance reserve is inviolable
- Coverage automatically reduces as reserve approached
- Fail-safe pauses fund before depletion
- Emergency fund can be activated

### Edge Case 3: Flash Crash - 1000+ Liquidations in Seconds
**Scenario**: Market flash crash triggers massive simultaneous liquidations

**Protection**:
- Liquidation storm detection triggers immediately
- Coverage ratio drops to 50%
- Fund paused if Volatility Index > 70
- Coordinated payouts queued fairly

### Edge Case 4: Repeated User Claims
**Scenario**: Single user submitting many claims to extract fund value

**Protection**:
- Anomaly detection flags concentrated claims
- Admin review required for >20% from single user
- Historical claim data tracked per user
- Pattern analysis for fraud detection

### Edge Case 5: Interest/Contribution Pool Dries Up
**Scenario**: Protocol revenue stops or lending pool becomes illiquid

**Protection**:
- Multi-source contribution model (doesn't rely on any single source)
- Manual deposit option always available
- Coverage ratio auto-adjusts if burn rate unsustainable
- Proactive monitoring alerts admins

## Risk Metrics & Reporting

### Dashboard Metrics

1. **Funding Level**: Current balance as % of target
2. **Burn Rate**: Average claims per hour
3. **Days to Depletion**: Projected depletion time
4. **Active Threats**: Liquidations in progress + pending claims
5. **Volatility Index**: Current market stress (0-100)
6. **Coverage Capacity**: Current ability to cover new losses

### Anomaly Detection

System flags:
- Spike in claims (>50 in 24 hours)
- Rapid depletion (>50% balance in 24 hours)
- Concentrated claims (>20% from single user)
- Repeated large claims from same user
- Unusual loss patterns (e.g., repeated 100% losses)

### Audit Trail
- All transactions immutably recorded
- Timestamps on every state change
- User/operator IDs on approvals and payouts
- Rejection reasons documented
- Fund balance snapshots for reconciliation

## Integration Points

### Trading Module Integration
- Auto-record contributions when trades executed
- Trigger liquidation event when position liquidated
- Pass volatility data to health monitoring

### Balance Module Integration
- Update user balance when claim paid out
- Verify user balance for contribution amount
- Reconcile claims against user account

### Portfolio Module Integration
- Link claims to portfolio liquidations
- Provide coverage data to portfolio health calculation
- Correlate liquidations with portfolio changes

### Notification Module Integration
- Alert users when claims processed
- Notify admins on cascade detection
- Health alerts for fund operators

## Access Control

### Admin Endpoints
- Create/update fund configuration
- Approve/reject claims
- Process payouts
- Pause/resume fund
- Trigger manual refill
- View all audit logs

### Operator Endpoints
- Record liquidation events
- Query claim status
- View fund health
- Process claim payouts (if approved)

### User Endpoints
- Submit claims
- View own claims
- View fund stats
- Make voluntary contributions
- View coverage parameters

## Configuration Parameters

All configurable via admin endpoints:

```typescript
{
  // Coverage & Sustainability
  coverageRatio: 75,           // % of loss to cover
  contributionRate: 0.001,     // % of trade volume
  protocolRevenueShare: 0.05,  // % of protocol fees
  
  // Thresholds & Limits
  minimumBalance: 1000,        // Absolute minimum
  targetBalance: 10000,        // Refill target
  maxSimultaneousLiquidations: 100,  // Cascade limit
  
  // Monitoring
  autoRefillEnabled: true,
  autoRefillThreshold: 0.75,   // Trigger at 75% of target
  
  // Graduated coverage under stress
  warningThreshold: 0.5,       // 50% funded = warning
  criticalThreshold: 0.25,     // 25% funded = critical
  emergencyThreshold: 0.1,     // 10% funded = emergency
}
```

## Recovery Strategies

### From WARNING State
1. Increase contribution rate temporarily
2. Reduce coverage ratio to 50%
3. Activate emergency fund
4. Manual protocol capital injection

### From CRITICAL State
1. Pause non-essential features
2. Reduce coverage to 25%
3. Emergency fund deployed
4. Full protocol capital mobilized

### From EMERGENCY State
1. Fund paused completely
2. Manual-intervention-only mode
3. Full platform review
4. Recovery plan execution

## Performance Considerations

- All calculations use Decimal(18,8) for precision
- Indexes on fundId, userId, status for fast queries
- Claim payouts processed FIFO for fairness
- No blocking operations in liquidation path
- Async anomaly detection runs periodically

## Testing Requirements

### Unit Tests: 50+ covering
- Contribution calculations
- Coverage decisions
- Claim workflows
- Status transitions
- Edge case calculations

### Integration Tests: 15+ covering
- Multi-fund operations
- Cross-module integrations
- Contribution flow through trading
- Liquidation event recording

### Stress Tests: 12+ scenarios
- Flash crashes (1000+ liquidations)
- Fund depletion under load
- Cascade protection effectiveness
- Coordinated attack resistance
- Recovery mechanisms

### End-to-End Tests
- Complete claim lifecycle
- Multi-claim concurrent processing
- Fund recovery after crisis
- Anomaly detection accuracy

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainers**: Platform Team
