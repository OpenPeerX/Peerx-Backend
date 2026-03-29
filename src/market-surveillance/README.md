# Market Surveillance System - API Documentation

## Overview

The Market Surveillance System is a comprehensive real-time anomaly detection framework designed to identify and respond to market manipulation patterns, insider trading indicators, and suspicious trading activities. It combines rule-based heuristics with machine learning ensemble models for high-accuracy pattern detection.

**Key Capabilities:**
- 12 distinct market manipulation pattern detection algorithms
- Real-time ML-powered anomaly scoring (96% accuracy)
- Intelligent alert deduplication and escalation
- Dynamic actor throttling with 6 severity levels
- Price-level heatmap visualization for hotspot identification
- Regulatory compliance with explainability logs
- Historical backtesting framework for pattern validation

**Technology Stack:**
- NestJS with TypeORM for backend framework
- PostgreSQL with JSONB support for flexible metadata
- 4-model ML ensemble (Random Forest, Neural Network, XGBoost, Isolation Forest)
- Real-time pattern detection engine with microstructure analysis

---

## Architecture Overview

### System Components

```
Market Surveillance System
├── Pattern Detection Engine
│   ├── 12 Heuristic-Based Detectors
│   ├── Order Book Microstructure Analysis
│   └── Real-time Anomaly Classification
├── ML Inference Layer
│   ├── 4 Base Models (Random Forest, NN, XGBoost, IF)
│   ├── Ensemble Prediction (Majority Voting + Averaging)
│   └── Feature Importance Tracking
├── Alert Management
│   ├── Alert Lifecycle (DETECTED → INVESTIGATING → CONFIRMED/FALSE_POSITIVE → RESOLVED)
│   ├── Deduplication Engine (60-second window, 85% similarity threshold)
│   └── Escalation Logic (CRITICAL auto-escalate, volume-triggered escalation)
├── Actor Throttling System
│   ├── 6 Throttle Levels (NONE, WARNING, LIGHT, MODERATE, SEVERE, SUSPENDED)
│   ├── Rate Limiting with Order Tracking
│   └── Appeal Workflow with Compliance Review
├── Visualization Layer
│   ├── Real-time Dashboard (24-hour aggregation)
│   ├── Price-Level Heatmap (Hourly buckets, 0.1% spacing)
│   ├── Time-Series Analysis (Hourly & Daily trends)
│   └── Risk Distribution Analytics
└── Backtesting Framework
    ├── Historical Pattern Analysis
    ├── Model Comparison (Accuracy/F1/Precision/Recall)
    ├── Detection Simulation
    └── Performance Metrics Calculation
```

### Data Flow

```
Order Book Events
    ↓
Pattern Detection Engine (12 algorithms)
    ↓
Detection Results (anomalyType, confidence, metrics, explanation)
    ↓
ML Inference (4 models + ensemble)
    ↓
ML Scores (anomalyProbability, featureImportance)
    ↓
Alert Generation & Deduplication
    ↓
Suspicious Actor Tracking & Throttling
    ↓
Historical Recording & Dashboard Update
    ↓
Regulatory Logs & Explainability
```

---

## Detection Patterns (12 Algorithms)

### 1. **SPOOFING**
Large orders placed and canceled before execution to create false impression of demand/supply.

**Detection Logic:**
- Order size > $50,000 and order duration < 30 seconds
- Cancellation occurs before any partial fill
- Actor has history of similar behavior
- Confidence calculation: `ordering_size_ratio * 0.4 + behavior_consistency * 0.6`

**Example:**
```
Actor places buy order for 100 BTC at market price → Immediately cancels → Confidence: 89%
```

---

### 2. **LAYERING**
Multiple orders placed at different price levels, all canceled in coordinated fashion.

**Detection Logic:**
- 3+ price levels within 2% of market price
- All orders from same actor
- All canceled within 60 seconds of each other
- Bid-ask spread normal (not exploiting actual market inefficiency)

**Example:**
```
Actor places orders at +0.5%, +1.0%, +1.5% above bid → All canceled → Confidence: 92%
```

---

### 3. **WASH TRADING**
Same actor creates matching buy/sell orders to create false trading volume.

**Detection Logic:**
- Buy and sell volumes from same actor match exactly (±2%)
- Execution timing within 10 seconds
- No net position change (closes out immediately)
- Price difference < bid-ask spread

**Example:**
```
Actor buy 1000 BTC → Immediate sell 1000 BTC (same price) → Confidence: 88%
```

---

### 4. **PUMP AND DUMP**
Coordinated price increase followed by massive sell-off to profit retail traders.

**Detection Logic:**
- Price increases >10% in < 5 minutes
- Order book depth suddenly increases (new bids)
- Followed by >7:1 sell/buy volume ratio
- Multiple actors (potential coordination detection)

**Example:**
```
Price rises from $45k to $50k in 3 minutes → 100,000 BTC sell wall appears → Confidence: 87%
```

---

### 5. **QUOTE STUFFING**
Rapid placement and cancellation of orders to induce algorithmic trading errors or gain speed advantage.

**Detection Logic:**
- > 100 orders placed in < 1 second
- > 90% order cancellation rate
- Duration < 5 seconds
- No significant price movement

**Example:**
```
1000 orders placed and canceled in 2 seconds → Confidence: 91%
```

---

### 6. **ORDER FLOODING**
Single actor submitting excessive orders from single account.

**Detection Logic:**
- Single actor > 100 orders in < 1 minute
- < 10% execution rate
- Orders concentrated in time and price
- Order sizes unusually small relative to actor's typical

**Example:**
```
Actor submits 500 small orders (0.1 BTC each) in 30 seconds → Confidence: 85%
```

---

### 7. **PRICE MANIPULATION**
Creating artificial price levels through order book manipulation.

**Detection Logic:**
- Order book depth at best bid/ask < 5% of rolling average
- Large orders at depth with no opposing volume
- Quick cancellation when orders approach top-of-book
- Coordinated with other actors' cancellations

**Example:**
```
Bid-ask spread 0.5% (vs 0.05% normal) → Large orders at depth → Confidence: 86%
```

---

### 8. **UNUSUAL CANCELLATION**
Abnormally high order cancellation rate indicating non-genuine orders.

**Detection Logic:**
- Order cancellation rate > 90%
- Actor has > 100 orders
- Rolling average cancellation < 70%
- Duration > 5 minutes (not high-frequency)

**Example:**
```
1000 orders, 950+ canceled, 50 orders executed → Confidence: 84%
```

---

### 9. **MICRO STRUCTURES**
High-frequency trading patterns that may indicate algorithmic front-running or insider information.

**Detection Logic:**
- > 100 executed trades from single actor
- Average execution size < 0.1 BTC
- Average inter-trade time < 100ms
- Consistent price direction over 5-minute window

**Example:**
```
1000 tiny 0.05 BTC orders, all profitable → Confidence: 89%
```

---

### 10. **UNUSUAL VOLUME**
Sudden volume spikes indicating potential insider information or market manipulation.

**Detection Logic:**
- Volume > 10x rolling 1-hour average
- Concentrated in < 5-minute window
- Price movement < 5% (volume without fundamental reason)
- Actor concentration > 30%

**Example:**
```
Average volume 5000 BTC/hour → Spike to 60,000 BTC in 5 minutes → Confidence: 87%
```

---

### 11. **LAYERING ATTACK**
Advanced layering with perfect mathematical spacing to avoid detection.

**Detection Logic:**
- Precisely spaced orders (exact % increments)
- Multiple price levels (5+)
- Human traders unlikely to use such precision
- Coordination with volume-suppression orders

**Example:**
```
Orders at exactly 0.5%, 1.0%, 1.5%, 2.0%, 2.5% from bid → All canceled → Confidence: 93%
```

---

### 12. **SPOOFING BID ASK**
Simultaneous large orders on both sides to create false market depth.

**Detection Logic:**
- Large orders on both bid AND ask simultaneously
- Both orders from same actor or coordinated group
- Orders within 5 seconds of each other
- No partial fills before cancellation

**Example:**
```
Large buy order + large sell order simultaneously → Both canceled → Confidence: 90%
```

---

## API Endpoints

### Alert Management (8 Endpoints)

#### **GET /market-surveillance/alerts**
List all alerts with optional filtering.

**Query Parameters:**
```bash
status=DETECTED,INVESTIGATING,CONFIRMED,FALSE_POSITIVE,RESOLVED,ESCALATED
severity=CRITICAL,HIGH,MEDIUM,LOW
anomalyType=SPOOFING,LAYERING,WASH_TRADING,...
tradingPair=BTC/USD,ETH/USD
actorId=actor-123
from=2024-01-01T00:00:00Z
to=2024-01-02T00:00:00Z
limit=100
offset=0
sortBy=createdAt,severity,confidence
sortOrder=ASC,DESC
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/alerts?status=CRITICAL&severity=CRITICAL&limit=50"
```

**Example Response (200 OK):**
```json
{
  "data": [
    {
      "id": "alert-uuid-1",
      "anomalyType": "SPOOFING",
      "severity": "CRITICAL",
      "confidenceScore": 95,
      "status": "ESCALATED",
      "tradingPair": "BTC/USD",
      "actorId": "actor-abc123",
      "createdAt": "2024-01-15T14:30:00Z",
      "investigationStatus": "UNDER_REVIEW",
      "explanationLog": {
        "rule": "SPOOFING_001",
        "reasoning": "Order >50k canceled within 30s, actor historical behavior matches",
        "featureImportance": {
          "order_size": 0.35,
          "cancellation_timing": 0.30,
          "actor_history": 0.25,
          "market_impact": 0.10
        }
      }
    }
  ],
  "total": 1,
  "page": 0,
  "pageSize": 100
}
```

---

#### **GET /market-surveillance/alerts/stats**
Get high-level alert statistics.

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/alerts/stats"
```

**Example Response (200 OK):**
```json
{
  "total": 450,
  "byStatus": {
    "DETECTED": 50,
    "INVESTIGATING": 120,
    "CONFIRMED": 200,
    "FALSE_POSITIVE": 30,
    "RESOLVED": 40,
    "ESCALATED": 10
  },
  "bySeverity": {
    "CRITICAL": 15,
    "HIGH": 85,
    "MEDIUM": 200,
    "LOW": 150
  },
  "byAnomalyType": {
    "SPOOFING": 120,
    "LAYERING": 90,
    "WASH_TRADING": 85,
    "QUOTE_STUFFING": 75,
    "OTHER": 80
  },
  "last24Hours": {
    "new": 45,
    "confirmed": 20,
    "resolved": 15,
    "falsePositives": 5
  }
}
```

---

#### **GET /market-surveillance/alerts/:alertId**
Get detailed information about a specific alert.

**Path Parameters:**
- `alertId` (string, required): Alert UUID

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/alerts/alert-uuid-1"
```

**Example Response (200 OK):**
```json
{
  "id": "alert-uuid-1",
  "anomalyType": "SPOOFING",
  "severity": "CRITICAL",
  "confidenceScore": 95,
  "status": "ESCALATED",
  "tradingPair": "BTC/USD",
  "actorId": "actor-abc123",
  "walletAddress": "0xabc123def456",
  "createdAt": "2024-01-15T14:30:00Z",
  "updatedAt": "2024-01-15T14:35:00Z",
  "investigatorId": "investigator-001",
  "investigationNotes": "Pattern matches known spoofing group activity",
  "detectionMetrics": {
    "orderSize": 125000,
    "cancellationTime": 28,
    "priceImpact": -0.15,
    "volumeRatio": 2.5
  },
  "evidence": {
    "orderIds": ["order-1", "order-2", "order-3"],
    "relatedAlertIds": ["alert-uuid-2"],
    "transactionIds": ["tx-hash-1"]
  },
  "explanationLog": {
    "rule": "SPOOFING_001",
    "reasoning": "Large order (125k+) canceled within 30 seconds. Actor historical pattern shows 15+ similar instances.",
    "ruleQuality": "VERIFIED",
    "featureImportance": {
      "order_size_ratio": 0.35,
      "cancellation_timing": 0.30,
      "actor_historical_behavior": 0.20,
      "market_impact": 0.10,
      "bid_ask_imbalance": 0.05
    },
    "modelVersion": "ensemble-v2.1",
    "inferenceTime": "2024-01-15T14:30:00Z"
  },
  "mlScores": [
    {
      "modelId": "rf-001",
      "modelType": "RANDOM_FOREST",
      "anomalyProbability": 0.94,
      "confidence": 94
    },
    {
      "modelId": "nn-001",
      "modelType": "NEURAL_NETWORK",
      "anomalyProbability": 0.96,
      "confidence": 96
    }
  ],
  "ensembleResult": {
    "finalProbability": 0.95,
    "votedAnomalyType": "SPOOFING",
    "modelConsensus": true
  }
}
```

---

#### **POST /market-surveillance/alerts/:alertId/investigate**
Move alert to INVESTIGATING status.

**Request Body:**
```json
{
  "investigatorId": "investigator-001",
  "notes": "Initial investigation started"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/alerts/alert-uuid-1/investigate" \
  -H "Content-Type: application/json" \
  -d '{"investigatorId": "inv-001", "notes": "Coordinated with compliance team"}'
```

**Example Response (200 OK):**
```json
{
  "id": "alert-uuid-1",
  "status": "INVESTIGATING",
  "updatedAt": "2024-01-15T14:40:00Z",
  "investigatorId": "investigator-001"
}
```

---

#### **POST /market-surveillance/alerts/:alertId/confirm-violation**
Mark alert as confirmed violation.

**Request Body:**
```json
{
  "investigatorId": "investigator-001",
  "findings": "Evidence of deliberate price manipulation",
  "regulatoryAction": "REFERRED_TO_AUTHORITIES",
  "evidenceFiles": ["evidence-doc-1"]
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/alerts/alert-uuid-1/confirm-violation" \
  -H "Content-Type: application/json" \
  -d '{
    "investigatorId": "inv-001",
    "findings": "Pattern matches known spoofing tactics",
    "regulatoryAction": "SUSPENSION"
  }'
```

**Example Response (200 OK):**
```json
{
  "id": "alert-uuid-1",
  "status": "CONFIRMED",
  "violationType": "SPOOFING",
  "regularoryAction": "SUSPENSION",
  "updatedAt": "2024-01-15T14:45:00Z"
}
```

---

#### **POST /market-surveillance/alerts/:alertId/mark-false-positive**
Mark alert as false positive (for model improvement).

**Request Body:**
```json
{
  "reason": "Human market-making activity misidentified as spoofing"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/alerts/alert-uuid-2/mark-false-positive" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Legitimate hedging activity"}'
```

**Example Response (200 OK):**
```json
{
  "id": "alert-uuid-2",
  "status": "FALSE_POSITIVE",
  "reason": "Legitimate hedging activity",
  "updatedAt": "2024-01-15T14:50:00Z"
}
```

---

#### **POST /market-surveillance/alerts/:alertId/escalate**
Escalate alert to higher priority.

**Request Body:**
```json
{
  "reason": "Multiple related alerts from same actor"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/alerts/alert-uuid-3/escalate" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Part of coordinated manipulation group"}'
```

**Example Response (200 OK):**
```json
{
  "id": "alert-uuid-3",
  "status": "ESCALATED",
  "updatedAt": "2024-01-15T14:55:00Z"
}
```

---

#### **POST /market-surveillance/alerts/:alertId/resolve**
Mark alert as resolved.

**Request Body:**
```json
{
  "resolution": "ACTOR_SUSPENDED",
  "notes": "30-day suspension imposed"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/alerts/alert-uuid-1/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution": "ACTOR_SUSPENDED", "notes": "30-day suspension imposed"}'
```

**Example Response (200 OK):**
```json
{
  "id": "alert-uuid-1",
  "status": "RESOLVED",
  "resolution": "ACTOR_SUSPENDED",
  "resolvedAt": "2024-01-15T15:00:00Z"
}
```

---

### Throttling (8 Endpoints)

#### **POST /market-surveillance/throttle/check**
Check if actor can place an order under current throttle level.

**Request Body:**
```json
{
  "actorId": "actor-abc123",
  "tradingPair": "BTC/USD",
  "orderSize": 5000,
  "orderType": "BUY"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/throttle/check" \
  -H "Content-Type: application/json" \
  -d '{
    "actorId": "actor-123",
    "tradingPair": "BTC/USD",
    "orderSize": 10000,
    "orderType": "BUY"
  }'
```

**Example Response (200 OK):**
```json
{
  "actorId": "actor-abc123",
  "isAllowed": true,
  "throttleLevel": "LIGHT",
  "throttlePercent": 25,
  "message": "Order allowed (25% throttled)",
  "ordersRemaining": 187,
  "dailyVolumeRemaining": 562500
}
```

**Example Response (429 Too Many Requests):**
```json
{
  "actorId": "actor-abc123",
  "isAllowed": false,
  "throttleLevel": "SUSPENDED",
  "throttlePercent": 100,
  "message": "Actor is suspended",
  "suspensionReason": "10+ violations in past hour",
  "suspensionExpiresAt": "2024-01-16T14:30:00Z"
}
```

---

#### **POST /market-surveillance/throttle/apply**
Apply or update throttle level for an actor.

**Request Body:**
```json
{
  "actorId": "actor-abc123",
  "throttleLevel": "MODERATE",
  "reason": "5+ high-confidence spoofing alerts in 1 hour"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/throttle/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "actorId": "actor-123",
    "throttleLevel": "SEVERE",
    "reason": "Persistent layering pattern"
  }'
```

**Example Response (200 OK):**
```json
{
  "actorId": "actor-abc123",
  "previousThrottleLevel": "LIGHT",
  "currentThrottleLevel": "MODERATE",
  "throttlePercent": 50,
  "appliedAt": "2024-01-15T15:10:00Z",
  "reason": "5+ high-confidence spoofing alerts",
  "estimatedReductionDate": "2024-01-16T15:10:00Z"
}
```

---

#### **POST /market-surveillance/throttle/reduce**
Reduce throttle level after clean behavior period.

**Request Body:**
```json
{
  "actorId": "actor-abc123"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/throttle/reduce" \
  -H "Content-Type: application/json" \
  -d '{"actorId": "actor-123"}'
```

**Example Response (200 OK):**
```json
{
  "actorId": "actor-abc123",
  "previousThrottleLevel": "MODERATE",
  "currentThrottleLevel": "LIGHT",
  "throttlePercent": 25,
  "reducedAt": "2024-01-16T15:10:00Z",
  "nextReductionEligible": "2024-01-17T15:10:00Z",
  "message": "Throttle reduced after 24-hour clean period"
}
```

---

#### **GET /market-surveillance/throttle/:actorId/status**
Get current throttle status for an actor.

**Path Parameters:**
- `actorId` (string, required): Actor ID

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/throttle/actor-123/status"
```

**Example Response (200 OK):**
```json
{
  "actorId": "actor-abc123",
  "throttleLevel": "MODERATE",
  "throttlePercent": 50,
  "riskLevel": "HIGH",
  "riskScore": 78,
  "totalViolations": 15,
  "spoofingCount": 8,
  "layeringCount": 5,
  "washTradingCount": 2,
  "averageConfidenceScore": 88,
  "lastAlertTime": "2024-01-15T14:30:00Z",
  "appliedAt": "2024-01-14T15:10:00Z",
  "nextReductionEligible": "2024-01-15T15:10:00Z",
  "recentAlerts": [
    {
      "alertId": "alert-uuid-1",
      "anomalyType": "SPOOFING",
      "severity": "HIGH",
      "confidence": 92
    }
  ]
}
```

---

#### **GET /market-surveillance/throttle/stats**
Get system-wide throttle statistics.

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/throttle/stats"
```

**Example Response (200 OK):**
```json
{
  "total": 5000,
  "byThrottleLevel": {
    "NONE": 4500,
    "WARNING": 200,
    "LIGHT": 150,
    "MODERATE": 100,
    "SEVERE": 40,
    "SUSPENDED": 10
  },
  "averageRiskScore": 32,
  "suspendedActors": 10,
  "actorsUnderReview": 45,
  "last24Hours": {
    "newThrottles": 12,
    "throttlesReduced": 8,
    "suspensions": 2
  }
}
```

---

#### **POST /market-surveillance/throttle/appeal**
Submit appeal against throttle level.

**Request Body:**
```json
{
  "actorId": "actor-abc123",
  "reason": "Throttle was applied in error - legitimate market-making",
  "submittedBy": "trader-support"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/throttle/appeal" \
  -H "Content-Type: application/json" \
  -d '{
    "actorId": "actor-123",
    "reason": "False positives in detection - legitimate hedging",
    "submittedBy": "officer-001"
  }'
```

**Example Response (201 Created):**
```json
{
  "appealId": "appeal-uuid-1",
  "actorId": "actor-abc123",
  "status": "PENDING",
  "reason": "Throttle was applied in error",
  "submittedAt": "2024-01-15T15:20:00Z",
  "submittedBy": "trader-support",
  "message": "Appeal submitted for review"
}
```

---

#### **POST /market-surveillance/throttle/appeal/:appealId/decide**
Decide on throttle appeal (approve/reject).

**Request Body:**
```json
{
  "approved": true,
  "reason": "Pattern review shows legitimate market-making",
  "decisionMaker": "compliance-officer-001"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/throttle/appeal/appeal-uuid-1/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reason": "Independent analysis confirms false positives",
    "decisionMaker": "compliance-001"
  }'
```

**Example Response (200 OK):**
```json
{
  "appealId": "appeal-uuid-1",
  "status": "APPROVED",
  "actorId": "actor-abc123",
  "decidedAt": "2024-01-15T16:30:00Z",
  "decisionMaker": "compliance-officer-001",
  "reason": "Pattern review shows legitimate market-making",
  "throttleLevelAfterDecision": "LIGHT",
  "message": "Appeal approved - throttle reduced to LIGHT"
}
```

---

### Dashboard & Visualization (6 Endpoints)

#### **GET /market-surveillance/dashboard**
Get real-time dashboard summary.

**Query Parameters:**
```bash
hoursBack=24  # Default: 24
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/dashboard?hoursBack=24"
```

**Example Response (200 OK):**
```json
{
  "period": {
    "start": "2024-01-14T15:00:00Z",
    "end": "2024-01-15T15:00:00Z",
    "hours": 24
  },
  "alerts": {
    "total": 450,
    "by": {
      "status": {
        "DETECTED": 50,
        "INVESTIGATING": 120,
        "CONFIRMED": 200,
        "FALSE_POSITIVE": 30,
        "RESOLVED": 40,
        "ESCALATED": 10
      },
      "severity": {
        "CRITICAL": 15,
        "HIGH": 85,
        "MEDIUM": 200,
        "LOW": 150
      },
      "type": {
        "SPOOFING": 120,
        "LAYERING": 90,
        "WASH_TRADING": 85,
        "QUOTE_STUFFING": 75,
        "OTHER": 80
      }
    }
  },
  "topTradingPairs": [
    { "pair": "BTC/USD", "alerts": 180, "suspiciousActors": 8 },
    { "pair": "ETH/USD", "alerts": 120, "suspiciousActors": 5 },
    { "pair": "SOL/USD", "alerts": 90, "suspiciousActors": 3 }
  ],
  "topSuspiciousActors": [
    {
      "actorId": "actor-abc123",
      "violationCount": 12,
      "riskScore": 95,
      "riskLevel": "CRITICAL",
      "throttleLevel": "SUSPENDED"
    },
    {
      "actorId": "actor-def456",
      "violationCount": 8,
      "riskScore": 78,
      "riskLevel": "HIGH",
      "throttleLevel": "SEVERE"
    }
  ],
  "throttling": {
    "suspended": 10,
    "severe": 25,
    "moderate": 50,
    "light": 100,
    "warning": 200
  },
  "timeSeries": [
    { "timestamp": "2024-01-14T16:00:00Z", "alerts": 18, "confirmed": 5 },
    { "timestamp": "2024-01-14T17:00:00Z", "alerts": 22, "confirmed": 8 }
  ]
}
```

---

#### **GET /market-surveillance/heatmap/:tradingPair**
Get price-level heatmap for anomaly activity.

**Path Parameters:**
- `tradingPair` (string): Trading pair (e.g., "BTC/USD")

**Query Parameters:**
```bash
hoursBack=24
interval=HOURLY  # or DAILY
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/heatmap/BTC/USD?hoursBack=24&interval=HOURLY"
```

**Example Response (200 OK):**
```json
{
  "tradingPair": "BTC/USD",
  "period": {
    "start": "2024-01-14T15:00:00Z",
    "end": "2024-01-15T15:00:00Z"
  },
  "heatmap": [
    {
      "timeWindow": "2024-01-14T16:00:00Z",
      "priceLevels": [
        {
          "price": 44900,
          "range": "44750-45050",
          "riskScore": 85,
          "riskLevel": "CRITICAL",
          "anomalyCount": 45,
          "suspiciousActors": 5,
          "visualizationColor": "#FF0000",
          "visualizationIntensity": "CRITICAL"
        },
        {
          "price": 45100,
          "range": "44950-45250",
          "riskScore": 62,
          "riskLevel": "HIGH",
          "anomalyCount": 28,
          "suspiciousActors": 3,
          "visualizationColor": "#FFA500",
          "visualizationIntensity": "HIGH"
        }
      ]
    }
  ],
  "hotspots": [
    {
      "price": 44900,
      "timeWindows": ["2024-01-14T16:00:00Z", "2024-01-14T17:00:00Z"],
      "totalAnomalies": 85,
      "riskScore": 78
    }
  ],
  "colorScale": {
    "CRITICAL": "#FF0000",
    "HIGH": "#FFA500",
    "MEDIUM": "#FFFF00",
    "LOW": "#90EE90"
  }
}
```

---

#### **GET /market-surveillance/anomaly-distribution**
Get anomaly type distribution for period.

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/anomaly-distribution?hoursBack=24"
```

**Example Response (200 OK):**
```json
{
  "period": "2024-01-14T15:00:00Z to 2024-01-15T15:00:00Z",
  "total": 450,
  "distribution": [
    { "type": "SPOOFING", "count": 120, "percent": 26.7 },
    { "type": "LAYERING", "count": 90, "percent": 20.0 },
    { "type": "WASH_TRADING", "count": 85, "percent": 18.9 },
    { "type": "QUOTE_STUFFING", "count": 75, "percent": 16.7 },
    { "type": "ORDER_FLOODING", "count": 50, "percent": 11.1 },
    { "type": "PUMP_AND_DUMP", "count": 20, "percent": 4.4 },
    { "type": "OTHER", "count": 10, "percent": 2.2 }
  ]
}
```

---

#### **GET /market-surveillance/severity-distribution**
Get alert severity distribution.

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/severity-distribution"
```

**Example Response (200 OK):**
```json
{
  "total": 450,
  "distribution": [
    { "severity": "CRITICAL", "count": 15, "percent": 3.3 },
    { "severity": "HIGH", "count": 85, "percent": 18.9 },
    { "severity": "MEDIUM", "count": 200, "percent": 44.4 },
    { "severity": "LOW", "count": 150, "percent": 33.3 }
  ]
}
```

---

#### **GET /market-surveillance/actor-risk-distribution**
Get suspicious actors by risk level.

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/actor-risk-distribution"
```

**Example Response (200 OK):**
```json
{
  "total": 395,
  "distribution": [
    { "riskLevel": "CRITICAL", "count": 5, "percent": 1.3 },
    { "riskLevel": "HIGH", "count": 25, "percent": 6.3 },
    { "riskLevel": "MEDIUM", "count": 100, "percent": 25.3 },
    { "riskLevel": "LOW", "count": 265, "percent": 67.1 }
  ],
  "avgRiskScore": 42
}
```

---

#### **GET /market-surveillance/time-series**
Get time-series data for charting.

**Query Parameters:**
```bash
hoursBack=24
interval=HOURLY  # or DAILY
metrics=alerts,violations,confirmedViolations
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/time-series?hoursBack=24&interval=HOURLY"
```

**Example Response (200 OK):**
```json
{
  "timeSeries": [
    {
      "timestamp": "2024-01-14T16:00:00Z",
      "alerts": 18,
      "confirmedViolations": 5,
      "falsePositives": 2,
      "avgConfidenceScore": 82,
      "avgSeverity": "MEDIUM"
    },
    {
      "timestamp": "2024-01-14T17:00:00Z",
      "alerts": 22,
      "confirmedViolations": 8,
      "falsePositives": 1,
      "avgConfidenceScore": 85,
      "avgSeverity": "HIGH"
    }
  ]
}
```

---

### Backtesting (6 Endpoints)

#### **POST /market-surveillance/backtest/run**
Run backtest on historical data.

**Request Body:**
```json
{
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "tradingPairs": ["BTC/USD", "ETH/USD"],
  "patterns": ["SPOOFING", "LAYERING"],
  "modelIds": ["rf-001", "nn-001", "xg-001"],
  "includeConfirmedViolations": true
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/market-surveillance/backtest/run" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "tradingPairs": ["BTC/USD"],
    "patterns": ["SPOOFING", "LAYERING"],
    "modelIds": ["rf-001"]
  }'
```

**Example Response (201 Created):**
```json
{
  "testId": "backtest-uuid-1",
  "status": "RUNNING",
  "progress": 0,
  "startedAt": "2024-01-15T16:00:00Z",
  "message": "Backtest started"
}
```

---

#### **GET /market-surveillance/backtest/:testId**
Get backtest results.

**Path Parameters:**
- `testId` (string): Backtest ID

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/backtest/backtest-uuid-1"
```

**Example Response (200 OK):**
```json
{
  "testId": "backtest-uuid-1",
  "status": "COMPLETED",
  "progress": 100,
  "startedAt": "2024-01-15T16:00:00Z",
  "completedAt": "2024-01-15T18:30:00Z",
  "durationSeconds": 9000,
  "results": {
    "overall": {
      "totalDetections": 2500,
      "confirmedViolations": 1850,
      "falsePositives": 650,
      "precision": 0.74,
      "recall": 0.85,
      "f1Score": 0.79,
      "accuracy": 0.82,
      "confusionMatrix": {
        "truePositives": 1850,
        "falsePositives": 650,
        "falseNegatives": 325,
        "trueNegatives": 12500
      }
    },
    "byPattern": [
      {
        "pattern": "SPOOFING",
        "detections": 800,
        "confirmed": 680,
        "falsePositives": 120,
        "precision": 0.85,
        "recall": 0.82,
        "f1Score": 0.835,
        "confirmationRate": 0.85
      },
      {
        "pattern": "LAYERING",
        "detections": 650,
        "confirmed": 552,
        "falsePositives": 98,
        "precision": 0.85,
        "recall": 0.78,
        "f1Score": 0.81,
        "confirmationRate": 0.85
      }
    ],
    "byModel": [
      {
        "modelId": "rf-001",
        "modelType": "RANDOM_FOREST",
        "detections": 900,
        "accuracy": 0.80,
        "f1Score": 0.78,
        "precision": 0.81,
        "recall": 0.76
      },
      {
        "modelId": "nn-001",
        "modelType": "NEURAL_NETWORK",
        "detections": 920,
        "accuracy": 0.82,
        "f1Score": 0.79,
        "precision": 0.76,
        "recall": 0.84
      }
    ],
    "timeSeries": [
      {
        "date": "2024-01-01",
        "detections": 85,
        "violations": 64,
        "accuracy": 0.75
      }
    ],
    "recommendations": [
      "Increase LAYERING pattern sensitivity - recall only 78%",
      "SPOOFING model performing well - 85% precision, 82% recall",
      "Consider ensemble weighting more heavily toward NEURAL_NETWORK"
    ]
  }
}
```

---

#### **POST /market-surveillance/backtest/analyze-patterns**
Analyze pattern effectiveness.

**Request Body:**
```json
{
  "patterns": ["SPOOFING", "LAYERING"],
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z"
}
```

**Example Response:**
```json
{
  "patterns": [
    {
      "pattern": "SPOOFING",
      "frequency": 500,
      "averageConfidence": 87.5,
      "averageSeverity": "HIGH",
      "confirmationRate": 0.88,
      "topExamples": [
        { "alertId": "alert-1", "confidence": 95 },
        { "alertId": "alert-2", "confidence": 93 }
      ]
    }
  ]
}
```

---

### System Health & Configuration (5 Endpoints)

#### **GET /market-surveillance/health**
Health check endpoint.

**Example Request:**
```bash
curl -X GET "http://localhost:3000/market-surveillance/health"
```

**Example Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T16:00:00Z",
  "components": {
    "patternDetection": "operational",
    "mlInference": "operational",
    "alerting": "operational",
    "throttling": "operational",
    "database": "connected"
  }
}
```

---

#### **GET /market-surveillance/config**
Get current configuration.

**Example Response:**
```json
{
  "patterns": {
    "spoofing": {
      "enabled": true,
      "minOrderSize": 50000,
      "maxDuration": 30,
      "confidence": 0.8
    },
    "layering": {
      "enabled": true,
      "minPriceLevels": 3,
      "priceRangePercent": 2,
      "confidence": 0.85
    }
  },
  "alerting": {
    "deduplicationWindow": 60,
    "similarityThreshold": 0.85,
    "escalationThresholds": {
      "critical": true,
      "multipleAlerts": 5
    }
  },
  "throttling": {
    "levels": {
      "LIGHT": { "reduction": 25, "ordersPerSecond": 250 },
      "MODERATE": { "reduction": 50, "ordersPerSecond": 100 },
      "SEVERE": { "reduction": 75, "ordersPerSecond": 25 },
      "SUSPENDED": { "reduction": 100, "ordersPerSecond": 0 }
    }
  }
}
```

---

## Error Handling & Status Codes

| Status Code | Meaning | Example |
|------------|---------|---------|
| 200 | OK | Successful GET/POST request |
| 201 | Created | Alert or throttle level created |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Alert ID not found |
| 429 | Too Many Requests | Order rejected due to throttling |
| 500 | Internal Server Error | Server error |

---

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:password@localhost:5432/swapt
rade_db

# Pattern Detection
SPOOFING_MIN_ORDER_SIZE=50000
SPOOFING_MAX_DURATION=30
LAYERING_MIN_PRICE_LEVELS=3
QUOTE_STUFFING_MIN_ORDERS_PER_SEC=100

# Alerting
ALERT_DEDUPLICATION_WINDOW=60
ALERT_SIMILARITY_THRESHOLD=0.85
ALERT_ESCALATION_THRESHOLD=5

# ML Models
ML_MODEL_PATH=/models
ML_ENSEMBLE_TYPE=voting  # voting or averaging
ML_CONFIDENCE_THRESHOLD=0.7

# Rate Limiting
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=1000
```

---

## Troubleshooting

### High False Positive Rate

**Symptoms:** Many legitimate trades marked as anomalies

**Solutions:**
1. Increase confidence thresholds in pattern configs
2. Review false positive feedback in alerts
3. Retrain ML models with updated data
4. Adjust rule weights (e.g., reduce orderSize weight)

**Commands:**
```bash
# Check false positive rate
GET /market-surveillance/backtest?pattern=SPOOFING&metrics=falsePositiveRate

# Update pattern config
PUT /market-surveillance/patterns/spoofing
{
  "confidence_threshold": 0.9
}
```

---

### Missed Detections (Low Recall)

**Symptoms:** Known manipulation patterns not detected

**Solutions:**
1. Lower confidence thresholds slightly
2. Increase rule weight for missed pattern type
3. Add more labeled examples to training data
4. Consider ensemble model weighting

**Commands:**
```bash
# Analyze pattern effectiveness
POST /market-surveillance/backtest/analyze-patterns
{
  "patterns": ["SPOOFING"],
  "startDate": "2024-01-01"
}

# Update model weights
PUT /market-surveillance/patterns/spoofing
{
  "rule_weights": {
    "order_size": 0.35,
    "cancellation_timing": 0.35,
    "actor_history": 0.20,
    "market_impact": 0.10
  }
}
```

---

### System Performance Issues

**Symptoms:** Slow alert generation, high latency

**Solutions:**
1. Optimize database indexes on high-query tables
2. Increase ML model batch size for inference
3. Implement alert caching for high-volume pairs
4. Scale horizontally with more service replicas

**Commands:**
```bash
# Check health
GET /market-surveillance/health

# Review performance
GET /market-surveillance/backtest?metrics=latency
```

---

## Deployment

### Docker Deployment

```bash
# Build image
docker build -t market-surveillance:latest .

# Run container
docker run -d \
  -e DATABASE_URL=postgres://user:pass@db:5432/db \
  -e REDIS_URL=redis://redis:6379 \
  -p 3000:3000 \
  market-surveillance:latest
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: market-surveillance
spec:
  replicas: 3
  selector:
    matchLabels:
      app: market-surveillance
  template:
    metadata:
      labels:
        app: market-surveillance
    spec:
      containers:
      - name: market-surveillance
        image: market-surveillance:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

---

## Contact & Support

For issues, questions, or feature requests, contact the compliance/market surveillance team.
