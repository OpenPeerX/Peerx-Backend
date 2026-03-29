# Privacy-Preserving Trading Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing and using the privacy-preserving trading features.

## Project Structure

```
src/privacy/
├── entities/
│   ├── privacy-profile.entity.ts          # User privacy profiles
│   ├── encrypted-order.entity.ts          # Encrypted order storage
│   └── privacy-audit-log.entity.ts        # Compliance audit logs
├── services/
│   ├── privacy-encryption.service.ts      # AES-256-GCM encryption
│   ├── privacy-zkp.service.ts             # Zero-knowledge proofs
│   ├── privacy-profile.service.ts         # Profile management
│   ├── encrypted-order.service.ts         # Order management
│   └── privacy-compliance.service.ts      # Audit & compliance
├── dto/
│   ├── privacy-profile.dto.ts             # Profile DTOs
│   ├── encrypted-order.dto.ts             # Order DTOs
│   └── privacy-audit-log.dto.ts           # Audit DTOs
├── privacy.controller.ts                   # REST API endpoints
├── privacy.module.ts                       # NestJS module definition
├── privacy.integration.spec.ts             # Integration tests
└── privacy.performance.spec.ts             # Performance benchmarks
```

## Feature Implementation

### 1. Pseudonymous Account Mode

#### Create a Privacy Profile
```typescript
POST /api/v1/privacy/profiles
{
  "publicKey": "your-rsa-public-key...",
  "anonymityLevel": "HIGH",
  "isAnonymous": true,
  "privacySettings": {
    "hideOrderHistory": true,
    "hideBalance": true,
    "enableZKProofs": true,
    "autoDeleteOldOrders": true,
    "orderRetentionDays": 30
  }
}
```

#### Response
```json
{
  "id": "profile-uuid",
  "pseudonymousId": "unique-anonymous-id",
  "anonymityLevel": "HIGH",
  "isAnonymous": true,
  "anonymousOrderCount": 0,
  "anonymousTradeVolume": 0,
  "createdAt": "2024-03-29T10:00:00Z",
  "updatedAt": "2024-03-29T10:00:00Z"
}
```

#### Get Aggregated Stats
```
GET /api/v1/privacy/profiles/{pseudonymousId}/stats
```

### 2. Encrypted Off-Chain Orders

#### Place an Anonymous Order
```typescript
POST /api/v1/privacy/orders?pseudonymousId={pseudonymousId}
{
  "encryptedOrderDetails": "base64-encoded-encrypted-order-data",
  "orderHash": "hmac-hash-for-integrity",
  "encryptionNonce": "base64-encoded-nonce",
  "orderMetadata": {
    "symbol": "BTC/USD",
    "side": "BUY",
    "orderType": "LIMIT",
    "estimatedAmount": "50000"
  }
}
```

#### Order Response
```json
{
  "id": "order-uuid",
  "pseudonymousId": "anonymous-user-id",
  "orderHash": "hash-value",
  "orderMetadata": {
    "symbol": "BTC/USD",
    "side": "BUY"
  },
  "status": "PENDING",
  "createdAt": "2024-03-29T10:00:00Z",
  "updatedAt": "2024-03-29T10:00:00Z"
}
```

#### Order Encryption Workflow
1. User encrypts order details locally using AES-256-GCM
2. Generate HMAC for integrity verification
3. Send encrypted data to server
4. Server stores without decryption
5. Order visible only to user and compliance officers

### 3. ZKP-Based Balance Verification

#### Create Balance Commitment
```typescript
POST /api/v1/privacy/proofs/balance-commitment
{
  "balance": "1000000000000000000",  // 1 ETH in wei
  "nonce": "optional-randm-nonce"
}
```

#### Generate Balance Proof
```typescript
POST /api/v1/privacy/proofs/balance
{
  "balance": "1000000000000000000",
  "coefficient": "1",
  "minAmount": "500000000000000000",
  "challenge": "server-challenge-hash"
}
```

#### Verify Balance Proof
```typescript
POST /api/v1/privacy/proofs/balance/verify
{
  "commitment": "commitment-hash",
  "proof": "zkp-proof",
  "minAmount": "500000000000000000",
  "challenge": "challenge-hash",
  "coefficient": "1"
}

// Response
{
  "isValid": true
}
```

#### ZKP Workflow
1. User creates balance commitment: `C = hash(balance || nonce)`
2. To prove `balance >= min_amount`, user generates ZKP proof
3. Server generates random challenge
4. User computes proof without revealing balance
5. Server verifies proof using commitment and challenge

### 4. Compliance and Audit Controls

#### Log Compliance Events
```typescript
POST /api/v1/privacy/audit-logs
{
  "pseudonymousIdHash": "sha256-hash-of-id",
  "action": "ORDER_PLACED",
  "encryptedDetails": "encrypted-action-details",
  "complianceFlags": ["SUSPICIOUS_VOLUME"],
  "riskAssessment": {
    "riskScore": 45,
    "riskLevel": "MEDIUM",
    "assessment": "Unusual trading volume detected"
  }
}
```

#### Detect Compliance Issues
```typescript
// System automatically detects:
- SUSPICIOUS_VOLUME: 10x normal amount
- RAPID_ORDERS: Multiple orders in < 1 second
- PATTERN_MATCH: Known suspicious patterns
- HIGH_FREQUENCY: >100 orders in short period
- SANCTION_HIT: Blacklist match
```

#### Generate Compliance Report
```
GET /api/v1/privacy/compliance-report?startDate=2024-01-01&endDate=2024-03-29

{
  "totalAudits": 1250,
  "highRiskCount": 15,
  "criticalRiskCount": 2,
  "flagDistribution": {
    "SUSPICIOUS_VOLUME": 8,
    "RAPID_ORDERS": 5,
    ...
  },
  "topFlags": [
    {
      "flag": "SUSPICIOUS_VOLUME",
      "count": 8
    },
    ...
  ]
}
```

## API Endpoints Reference

### Profile Management
- `POST /api/v1/privacy/profiles` - Create profile
- `GET /api/v1/privacy/profiles/me` - Get current profile
- `GET /api/v1/privacy/profiles/:pseudonymousId` - Get profile by ID
- `PUT /api/v1/privacy/profiles/:pseudonymousId` - Update profile
- `POST /api/v1/privacy/profiles/:pseudonymousId/enable-anonymous` - Enable anonymity
- `POST /api/v1/privacy/profiles/:pseudonymousId/disable-anonymous` - Disable anonymity
- `DELETE /api/v1/privacy/profiles/:pseudonymousId` - Delete profile

### Order Management
- `POST /api/v1/privacy/orders` - Create encrypted order
- `GET /api/v1/privacy/orders/:orderId` - Get order
- `GET /api/v1/privacy/orders` - Get user's orders
- `PUT /api/v1/privacy/orders/:orderId` - Update order
- `POST /api/v1/privacy/orders/:orderId/cancel` - Cancel order
- `DELETE /api/v1/privacy/orders/:orderId` - Delete order
- `GET /api/v1/privacy/orders/stats/execution` - Get statistics

### Encryption
- `POST /api/v1/privacy/encrypt` - Encrypt data
- `POST /api/v1/privacy/decrypt` - Decrypt data (with auth)

### ZKP Proofs
- `POST /api/v1/privacy/proofs/balance-commitment` - Create commitment
- `POST /api/v1/privacy/proofs/balance` - Generate proof
- `POST /api/v1/privacy/proofs/balance/verify` - Verify proof
- `POST /api/v1/privacy/proofs/range` - Create range proof
- `GET /api/v1/privacy/proofs/challenge` - Get server challenge

### Compliance & Audit
- `POST /api/v1/privacy/audit-logs` - Create audit log
- `GET /api/v1/privacy/audit-logs/:auditId` - Get audit log
- `GET /api/v1/privacy/audit-logs` - Get user's audit logs
- `GET /api/v1/privacy/audit-logs/high-risk` - Get high-risk logs
- `POST /api/v1/privacy/audit-logs/:auditId/access` - Log access
- `GET /api/v1/privacy/compliance-report` - Generate report
- `POST /api/v1/privacy/compliance-report/export` - Export logs

### Status
- `GET /api/v1/privacy/stats/overview` - System statistics
- `GET /api/v1/privacy/health` - Health check

## Database Migration

To add privacy tables to existing database:

```sql
-- Run TypeOrmrm migration
npm run migration:generate -- CreatePrivacyTables
npm run migration:run

-- Or manually create tables:

CREATE TABLE privacy_profile (
  id UUID PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  pseudonymous_id UUID NOT NULL UNIQUE,
  public_key VARCHAR(1024) NOT NULL,
  anonymity_level VARCHAR(20) DEFAULT 'MEDIUM',
  is_anonymous BOOLEAN DEFAULT false,
  anonymous_order_count INT DEFAULT 0,
  anonymous_trade_volume DECIMAL(18,8) DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE encrypted_order (
  id UUID PRIMARY KEY,
  pseudonymous_id UUID NOT NULL,
  encrypted_order_details TEXT NOT NULL,
  order_hash VARCHAR(64) NOT NULL,
  encryption_nonce VARCHAR(32) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE privacy_audit_log (
  id UUID PRIMARY KEY,
  pseudonymous_id_hash VARCHAR(64) NOT NULL,
  action VARCHAR(50) NOT NULL,
  encrypted_details TEXT NOT NULL,
  risk_score INT,
  access_count INT DEFAULT 0,
  created_at TIMESTAMP
);
```

## Running Tests

```bash
# Run all privacy tests
npm test -- privacy

# Run specific test file
npm test -- privacy-encryption.service.spec

# Run with coverage
npm test -- privacy --coverage

# Run performance benchmarks
npm test -- privacy.performance.spec

# Run integration tests
npm test -- privacy.integration.spec
```

## Performance Optimization Tips

1. **Connection Pooling**: Use database connection pooling for encrypted orders
2. **Caching**: Cache privacy profiles to reduce lookups
3. **Batch Operations**: Process multiple encryptions concurrently
4. **Key Rotation**: Implement periodic key rotation without decrypting all orders
5. **Index Strategy**: Add indexes on `pseudonymousId`, `status`, `createdAt`

Example indexes:
```sql
CREATE INDEX idx_privacy_profile_pseudonymous_id ON privacy_profile(pseudonymous_id);
CREATE INDEX idx_encrypted_order_pseudonymous_id ON encrypted_order(pseudonymous_id);
CREATE INDEX idx_encrypted_order_status ON encrypted_order(status);
CREATE INDEX idx_privacy_audit_log_created_at ON privacy_audit_log(created_at);
```

## Security Considerations

1. **Key Management**
   - Store encryption keys in secure vaults (AWS KMS, HashiCorp Vault)
   - Rotate keys regularly
   - Never log keys or sensitive data

2. **Access Control**
   - Require authentication for all privacy endpoints
   - Use role-based access for audit log decryption
   - Multi-signature approval for sensitive operations

3. **Data Protection**
   - Use HTTPS/TLS for all transmissions
   - Implement rate limiting on encryption endpoints
   - Monitor for unusual access patterns

4. **Audit Trail**
   - Log all decryption requests
   - Track who accessed what data and when
   - Maintain immutable audit logs

## Troubleshooting

### Encryption Errors
- Verify key is 32 bytes (256 bits)
- Check nonce is 12 bytes (96 bits)
- Ensure data is valid UTF-8

### ZKP Verification Failures
- Check challenge is correctly generated
- Verify coefficient parameter
- Ensure minimum amount is less than balance

### Compliance Flag Issues
- Review detection thresholds
- Check risk factor calculations
- Validate transaction patterns

## Future Enhancements

1. Multi-party Computation (MPC) for distributed key management
2. Trusted Execution Environment (TEE) integration
3. Advanced ZKP schemes (Bulletproofs, STARKs)
4. Privacy pools for better anonymity
5. Cross-chain privacy support
6. Advanced pattern detection with ML

## References

- [AES-GCM Specification](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [PBKDF2 RFC 2898](https://tools.ietf.org/html/rfc2898)
- [Zero-Knowledge Proof Concepts](https://zocrato.github.io/zero-knowledge-proof/)
- [Privacy in Blockchain](https://www.zcashcommunity.com/)
