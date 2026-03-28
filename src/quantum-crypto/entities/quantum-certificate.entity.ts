import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { QuantumKeyEntity, KeyType } from './quantum-key.entity';

export enum CertificateType {
  IDENTITY = 'identity',
  AUTHENTICATION = 'authentication',
  CODE_SIGNING = 'code_signing',
  DOCUMENT_SIGNING = 'document_signing',
  SSL_TLS = 'ssl_tls',
  EMAIL = 'email',
  API = 'api',
}

export enum CertificateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

@Entity('quantum_certificates')
export class QuantumCertificateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'certificate_id' })
  @Column({ unique: true })
  certificateId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'key_id' })
  keyId: string;

  @ManyToOne(() => QuantumKeyEntity)
  @JoinColumn({ name: 'key_id' })
  quantumKey: QuantumKeyEntity;

  @Column({
    type: 'enum',
    enum: CertificateType,
  })
  certificateType: CertificateType;

  @Column({
    type: 'enum',
    enum: CertificateStatus,
    default: CertificateStatus.ACTIVE,
  })
  status: CertificateStatus;

  @Column({ name: 'subject_dn', type: 'text' })
  subjectDN: string; // Distinguished Name

  @Column({ name: 'issuer_dn', type: 'text' })
  issuerDN: string;

  @Column({ name: 'serial_number' })
  serialNumber: string;

  @Column({ name: 'certificate_data', type: 'text' })
  certificateData: string; // PEM/DER encoded certificate

  @Column({ name: 'certificate_chain', type: 'json', nullable: true })
  certificateChain: string[];

  @Column({ name: 'public_key_fingerprint' })
  publicKeyFingerprint: string;

  @Column({ name: 'signature_algorithm' })
  signatureAlgorithm: string;

  @Column({ name: 'hash_algorithm' })
  hashAlgorithm: string;

  @Column({ name: 'issued_at' })
  issuedAt: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'valid_from' })
  validFrom: Date;

  @Column({ name: 'valid_to' })
  validTo: Date;

  @Column({ name: 'key_usage', type: 'json' })
  keyUsage: string[]; // Digital signature, key encipherment, etc.

  @Column({ name: 'extended_key_usage', type: 'json', nullable: true })
  extendedKeyUsage: string[]; // Server auth, client auth, etc.

  @Column({ name: 'subject_alternative_names', type: 'json', nullable: true })
  subjectAlternativeNames: string[];

  @Column({ name: 'crl_distribution_points', type: 'json', nullable: true })
  crlDistributionPoints: string[];

  @Column({ name: 'authority_info_access', type: 'json', nullable: true })
  authorityInfoAccess: Record<string, string>;

  @Column({ name: 'certificate_policies', type: 'json', nullable: true })
  certificatePolicies: string[];

  @Column({ name: 'revocation_reason', nullable: true })
  revocationReason: string;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt: Date;

  @Column({ name: 'revoked_by', nullable: true })
  revokedBy: string;

  @Column({ name: 'is_ca_certificate', default: false })
  isCACertificate: boolean;

  @Column({ name: 'max_path_length', nullable: true })
  maxPathLength: number;

  @Column({ name: 'ocsp_url', nullable: true })
  ocspUrl: string;

  @Column({ name: 'ocsp_response', type: 'text', nullable: true })
  ocspResponse: string;

  @Column({ name: 'last_ocsp_check', nullable: true })
  lastOcspCheck: Date;

  @Column({ name: 'certificate_transparency', type: 'json', nullable: true })
  certificateTransparency: {
    scts?: string[];
    precert?: boolean;
  };

  @Column({ name: 'compliance_standards', type: 'json', nullable: true })
  complianceStandards: string[]; // FIPS, Common Criteria, etc.

  @Column({ name: 'security_level' })
  securityLevel: number; // 1-5, where 5 is highest

  @Column({ name: 'migration_from_traditional', nullable: true })
  migrationFromTraditional: string; // Traditional cert being migrated from

  @Column({ name: 'migration_completed_at', nullable: true })
  migrationCompletedAt: Date;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'archived_at', nullable: true })
  archivedAt: Date;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;
}
