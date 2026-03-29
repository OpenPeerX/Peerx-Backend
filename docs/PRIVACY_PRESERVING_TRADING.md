# Privacy-Preserving Trading Feature

## Overview
This document outlines the implementation of privacy-preserving trading features that enable users to maintain anonymity while maintaining compliance. The feature includes pseudonymous accounts, encrypted off-chain orders, zero-knowledge proofs for balance verification, and comprehensive compliance tracking.

## Privacy Model and Threat Profile

### Privacy Goals
1. **User Anonymity**: Users can trade without revealing their identity
2. **Order Confidentiality**: Order details are encrypted and not visible to the public order book
3. **Balance Privacy**: Balance verification without revealing the actual amount
4. **Activity Privacy**: Trading activity is not linked to personal identity

### Threat Model
- **External adversaries**: Cannot determine which user placed an order
- **Internal observers**: Cannot correlate orders to specific identities without special access
- **Order book operators**: Cannot see order details (encrypted off-chain storage)
- **Compliance auditors**: Can access encrypted data with proper authorization

### Trust Assumptions
- Users trust the ZKP library implementation
- Encryption is semantically secure (IND-CPA)
- Private keys are securely managed by users
- Audit system is tamper-resistant

## Architecture

### 1. Pseudonymous Account Mode

#### Privacy Profile Entity
- `pseudonymousId`: Unique anonymous identifier (UUID v4)
- `publicKey`: For encryption of incoming data
- `encryptedPrivateKeyBackup`: Encrypted backup of user's private key
- `isAnonymous`: Boolean flag to enable anonymous mode
- `anonymityLevel`: LOW, MEDIUM, HIGH
- `profileMetadata`: Encrypted JSON containing trading preferences
- `createdAt`, `updatedAt`: Timestamps

#### Pseudonymity Levels
- **LOW**: Name visible, trading patterns visible (minimal privacy)
- **MEDIUM**: Pseudonym used, basic order hiding, aggregate stats only
- **HIGH**: Full anonymity, all orders encrypted, no public profile

### 2. Encrypted Off-Chain Order Book

#### Off-Chain Order Entity
- `orderId`: UUID v4 unique identifier
- `pseudonymousId`: Reference to anonymous user
- `encryptedOrderDetails`: Encrypted order data using AES-256-GCM
- `orderHash`: HMAC of order details for integrity verification
- `timestamp`: When order was created
- `status`: PENDING, MATCHED, CANCELLED, EXECUTED
- `encryptionNonce`: Random nonce for encryption
- `orderMetadata`: Non-sensitive metadata (order type, symbol, etc.)

#### Encrypted Order DTO
```typescript
{
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: bigint;
  price: bigint;
  expiration: Date;
  slippage: number;
  conditions?: Object; // Complex trading conditions
}
```

### 3. Zero-Knowledge Proofs (ZKP)

#### ZKP-Based Balance Verification
Uses Zk-SNARK proofs to verify balance without revealing the amount.

#### Commitment Scheme
- Users commit to their balance using: `C = hash(balance || nonce)`
- To prove eligibility (balance >= min_amount), use ZKP without revealing exact balance

#### Proof Generation
- Input: Balance, proof secret, min_amount threshold
- Output: zk-proof that proves `balance >= min_amount` without revealing balance
- Verification: System verifies proof without learning the actual balance

### 4. Compliance and Audit Controls

#### Privacy Audit Log
- `auditId`: UUID v4
- `pseudonymousId`: Encrypted or Hashed reference
- `action`: Type of action (ORDER_PLACED, ORDER_MATCHED, etc.)
- `encryptedDetails`: Encrypted transaction details
- `complianceFlags`: Suspicious activity markers
- `timestamp`: When action occurred

#### Compliance Flags
- `SuspiciousVolume`: Unusual trading volume detected
- `PatternMatch`: Trading pattern matches known schemes
- `RapidOrders`: Multiple orders in short timeframe
- `SuspiciousTiming`: Orders placed at unusual times
- `GeographicAnomaly`: Location-based anomalies

#### Audit Trail Access Control
- Admin users can request decryption with logging
- Decryption requires multiple approvals
- All access attempts are logged

## Implementation Details

### Encryption Strategy
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with SHA-256 (100,000 iterations)
- **Nonce Generation**: Cryptographically secure random (96-bit for GCM)
- **Key Management**: Keys stored in encrypted vaults

### Security Practices
1. **No Plaintext Storage**: All sensitive data is encrypted before storage
2. **Separate Encryption Keys**: Different keys for different data types
3. **Integrity Checking**: HMAC verification for all encrypted data
4. **Key Rotation**: Regular rotation of encryption keys
5. **Access Logging**: All decryption access is logged

## Privacy-Preserving Workflows

### 1. Account Creation (Pseudonymous Mode)
```
1. User creates account with optional pseudonym
2. System generates pseudonymousId (UUID v4)
3. User generates key pair locally
4. Public key sent to server, private key stays local
5. System creates privacy profile with user's public key
6. User can now place anonymous orders
```

### 2. Placing an Anonymous Order
```
1. User creates order object
2. User encrypts order details with their private key (signing)
3. System encrypts order details using server's key (for storage)
4. Order stored as: {pseudonymousId, encryptedOrderDetails, orderHash}
5. Order returned to user as confirmation
6. Order NOT published to public order book
```

### 3. Balance Verification via ZKP
```
1. User wants to prove balance >= min_amount
2. User computes ZKP proof locally
3. Proof sent to server (no balance information revealed)
4. Server verifies proof using public commitment
5. If valid, order is accepted
6. Balance remains hidden from the system
```

### 4. Compliance Audit
```
1. Compliance officer requests audit of suspicious activity
2. System retrieves encrypted audit logs
3. Officer requests decryption with justification
4. Multiple approvals required
5. System decrypts and provides audit data
6. All access attempts logged and timestamped
```

## Privacy Considerations and Tradeoffs

### Advantages
- ✅ User anonymity while maintaining compliance
- ✅ Order confidentiality from public view
- ✅ Balance verification without exposure
- ✅ Audit trails for regulatory compliance
- ✅ Flexible anonymity levels
- ✅ Forward secrecy (old keys cannot decrypt new data)

### Limitations
- ❌ Performance overhead from encryption/ZKP
- ❌ Storage overhead for encrypted data
- ❌ Complexity in key management
- ❌ Cannot prevent all flow analysis attacks
- ❌ Metadata still visible (timestamps, order count)

### Regulatory Compliance
- Audit trails can be decrypted for regulatory requests
- Compliance flags help detect suspicious patterns
- System can support KYC/AML requirements with privacy
- Multi-signature approval for sensitive operations

## Database Schema

### Privacy Profile Table
```sql
CREATE TABLE privacy_profile (
  id UUID PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  pseudonymous_id UUID NOT NULL UNIQUE,
  public_key VARCHAR(1024) NOT NULL,
  encrypted_private_key_backup TEXT NOT NULL,
  anonymity_level VARCHAR(20),
  is_anonymous BOOLEAN DEFAULT false,
  profile_metadata TEXT, -- encrypted
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE encrypted_order (
  id UUID PRIMARY KEY,
  pseudonymous_id UUID NOT NULL,
  encrypted_order_details TEXT NOT NULL,
  order_hash VARCHAR(64) NOT NULL,
  encryption_nonce VARCHAR(24) NOT NULL,
  order_metadata JSON,
  status VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (pseudonymous_id) REFERENCES privacy_profile(pseudonymous_id)
);

CREATE TABLE privacy_audit_log (
  id UUID PRIMARY KEY,
  pseudonymous_id_hash VARCHAR(64) NOT NULL,
  action VARCHAR(50) NOT NULL,
  encrypted_details TEXT NOT NULL,
  compliance_flags JSON,
  access_log JSON, -- tracks who accessed this record
  created_at TIMESTAMP
);
```

## Testing Strategy

### Unit Tests
- Encryption/decryption round-trips
- ZKP proof generation and verification
- Privacy profile creation and management
- Compliance flag detection

### Integration Tests
- Complete order placement workflow
- Privacy profile linked to user
- Audit log creation and access
- Key rotation scenarios

### Privacy Tests
- Verify encrypted data cannot be reversed
- Verify pseudonymousId is unique per user
- Verify access logs correctly track audits
- Verify metadata is not sensitive

### Performance Tests
- Encryption throughput
- ZKP proof generation time
- Database query performance with encryption
- Memory usage under load

## Performance Benchmarks

Expected performance metrics:
- Order encryption: ~5-10ms per order
- ZKP proof generation: ~100-500ms per proof
- Proof verification: ~10-50ms per proof
- Encrypted order storage: ~2-3x normal storage
- Query performance: ~1.5x slower due to encryption

## Future Enhancements

1. **Multi-party Computation (MPC)**: Distribute private keys across multiple nodes
2. **Trusted Execution Environments (TEE)**: Run decryption in secure enclaves
3. **Semantic Security**: Implement additional semantic security measures
4. **Privacy Pools**: Group users for better anonymity
5. **Cross-chain Privacy**: Extend privacy across multiple chains
6. **Advanced ZKP**: Implement more complex privacy proofs (range proofs, etc.)

## References

- AES-GCM Specification: NIST SP 800-38D
- PBKDF2: RFC 2898
- HMAC: RFC 2104
- Zero-Knowledge Proofs: Ben-Sasson et al. (ZK-SNARK papers)
- Privacy in Blockchain: Monero, Zcash whitepapers
