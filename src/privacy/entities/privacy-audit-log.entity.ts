import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ComplianceFlag {
  SUSPICIOUS_VOLUME = 'SUSPICIOUS_VOLUME',
  PATTERN_MATCH = 'PATTERN_MATCH',
  RAPID_ORDERS = 'RAPID_ORDERS',
  SUSPICIOUS_TIMING = 'SUSPICIOUS_TIMING',
  GEOGRAPHIC_ANOMALY = 'GEOGRAPHIC_ANOMALY',
  HIGH_FREQUENCY = 'HIGH_FREQUENCY',
  STRUCTURING = 'STRUCTURING',
  SANCTION_HIT = 'SANCTION_HIT',
}

export enum AuditAction {
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_MATCHED = 'ORDER_MATCHED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  BALANCE_VERIFIED = 'BALANCE_VERIFIED',
  PROFILE_CREATED = 'PROFILE_CREATED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  KEY_ROTATED = 'KEY_ROTATED',
  AUDIT_ACCESSED = 'AUDIT_ACCESSED',
}

@Entity('privacy_audit_log')
@Index(['pseudonymousIdHash'])
@Index(['action'])
@Index(['createdAt'])
export class PrivacyAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 64,
    comment: 'SHA-256 hash of pseudonymousId (for searchability)',
  })
  pseudonymousIdHash: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  action: AuditAction;

  @Column({
    type: 'text',
    comment: 'Encrypted action details',
  })
  encryptedDetails: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Detected compliance issues',
  })
  complianceFlags?: ComplianceFlag[];

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Risk score and assessment',
  })
  riskAssessment?: {
    riskScore: number; // 0-100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assessment: string;
  };

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Audit access log (who accessed this record)',
  })
  accessLog?: Array<{
    accessedBy: string;
    accessedAt: Date;
    reason: string;
    approved: boolean;
    approvedBy?: string;
  }>;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Decryption key identifier (for audit)',
  })
  decryptionKeyId?: string;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of times this record was accessed',
  })
  accessCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
