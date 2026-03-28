import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum KeyType {
  DILITHIUM = 'dilithium',           // Digital signatures
  FALCON = 'falcon',                 // Digital signatures
  SPHINCS_PLUS = 'sphincs_plus',     // Hash-based signatures
  KYBER = 'kyber',                   // Key exchange
  NTRU = 'ntru',                     // Key exchange
  CLASSIC_MCELIECE = 'classic_mceliece', // Key exchange
}

export enum KeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPROMISED = 'compromised',
  DEPRECATED = 'deprecated',
  ROTATED = 'rotated',
}

export enum KeyUsage {
  SIGNING = 'signing',
  ENCRYPTION = 'encryption',
  KEY_EXCHANGE = 'key_exchange',
  AUTHENTICATION = 'authentication',
}

@Entity('quantum_keys')
export class QuantumKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'key_id' })
  @Column({ unique: true })
  keyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: KeyType,
  })
  keyType: KeyType;

  @Column({
    type: 'enum',
    enum: KeyStatus,
    default: KeyStatus.ACTIVE,
  })
  status: KeyStatus;

  @Column({
    type: 'enum',
    enum: KeyUsage,
  })
  usage: KeyUsage;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ name: 'private_key', type: 'text' })
  privateKey: string;

  @Column({ name: 'key_size' })
  keySize: number;

  @Column({ name: 'security_level' })
  securityLevel: number; // 1-5, where 5 is highest

  @Column({ name: 'algorithm_version' })
  algorithmVersion: string;

  @Column({ name: 'created_for', nullable: true })
  createdFor: string; // Purpose/context

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'max_usage_count', nullable: true })
  maxUsageCount: number;

  @Column({ name: 'is_backup', default: false })
  isBackup: boolean;

  @Column({ name: 'backup_key_id', nullable: true })
  backupKeyId: string;

  @Column({ name: 'parent_key_id', nullable: true })
  parentKeyId: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'rotation_interval_days', nullable: true })
  rotationIntervalDays: number;

  @Column({ name: 'next_rotation_at', nullable: true })
  nextRotationAt: Date;

  @Column({ name: 'compromise_detected_at', nullable: true })
  compromiseDetectedAt: Date;

  @Column({ name: 'compromise_details', type: 'text', nullable: true })
  compromiseDetails: string;

  @Column({ name: 'migration_from', nullable: true })
  migrationFrom: string; // Traditional algorithm being migrated from

  @Column({ name: 'migration_completed_at', nullable: true })
  migrationCompletedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'archived_at', nullable: true })
  archivedAt: Date;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;
}
