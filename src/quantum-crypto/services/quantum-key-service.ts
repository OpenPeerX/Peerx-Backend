import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuantumKeyEntity, KeyType, KeyStatus, KeyUsage } from '../entities/quantum-key.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';

interface KeyPair {
  publicKey: string;
  privateKey: string;
  keySize: number;
  algorithmVersion: string;
}

interface QuantumSecurityConfig {
  minKeySize: number;
  maxKeyAge: number; // days
  rotationInterval: number; // days
  maxUsageCount: number;
  securityLevel: number;
}

@Injectable()
export class QuantumKeyService implements OnModuleInit {
  private readonly logger = new Logger(QuantumKeyService.name);
  private readonly securityConfig: QuantumSecurityConfig = {
    minKeySize: 2048,
    maxKeyAge: 365, // 1 year
    rotationInterval: 90, // 90 days
    maxUsageCount: 10000,
    securityLevel: 3, // Medium-high security
  };

  constructor(
    @InjectRepository(QuantumKeyEntity)
    private readonly quantumKeyRepository: Repository<QuantumKeyEntity>,
  ) {}

  async onModuleInit() {
    this.logger.log('Quantum Key Service initialized');
    await this.checkForExpiredKeys();
  }

  async generateQuantumKeyPair(
    userId: string,
    keyType: KeyType,
    usage: KeyUsage,
    securityLevel: number = this.securityConfig.securityLevel,
  ): Promise<QuantumKeyEntity> {
    this.logger.log(`Generating ${keyType} key pair for user ${userId}`);

    try {
      // Generate quantum-resistant key pair
      const keyPair = await this.generateKeyPair(keyType, securityLevel);
      
      // Calculate expiration and rotation dates
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.securityConfig.maxKeyAge);

      const nextRotationAt = new Date();
      nextRotationAt.setDate(nextRotationAt.getDate() + this.securityConfig.rotationInterval);

      // Create quantum key entity
      const quantumKey = this.quantumKeyRepository.create({
        keyId: this.generateKeyId(),
        userId,
        keyType,
        usage,
        status: KeyStatus.ACTIVE,
        publicKey: keyPair.publicKey,
        privateKey: this.encryptPrivateKey(keyPair.privateKey, userId),
        keySize: keyPair.keySize,
        securityLevel,
        algorithmVersion: keyPair.algorithmVersion,
        expiresAt,
        nextRotationAt,
        maxUsageCount: this.securityConfig.maxUsageCount,
        rotationIntervalDays: this.securityConfig.rotationInterval,
      });

      return this.quantumKeyRepository.save(quantumKey);
    } catch (error) {
      this.logger.error('Quantum key generation failed:', error);
      throw error;
    }
  }

  private async generateKeyPair(keyType: KeyType, securityLevel: number): Promise<KeyPair> {
    switch (keyType) {
      case KeyType.DILITHIUM:
        return this.generateDilithiumKeyPair(securityLevel);
      case KeyType.FALCON:
        return this.generateFalconKeyPair(securityLevel);
      case KeyType.SPHINCS_PLUS:
        return this.generateSphincsPlusKeyPair(securityLevel);
      case KeyType.KYBER:
        return this.generateKyberKeyPair(securityLevel);
      case KeyType.NTRU:
        return this.generateNtruKeyPair(securityLevel);
      case KeyType.CLASSIC_MCELIECE:
        return this.generateClassicMcElieceKeyPair(securityLevel);
      default:
        throw new Error(`Unsupported quantum key type: ${keyType}`);
    }
  }

  private async generateDilithiumKeyPair(securityLevel: number): Promise<KeyPair> {
    // Dilithium is a lattice-based signature scheme
    // In production, this would use actual Dilithium implementation
    const keySize = this.getKeySizeForSecurityLevel(securityLevel, KeyType.DILITHIUM);
    
    // Mock implementation - generate RSA-like keys for demonstration
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      publicKey,
      privateKey,
      keySize,
      algorithmVersion: 'DILITHIUM_v3.1',
    };
  }

  private async generateFalconKeyPair(securityLevel: number): Promise<KeyPair> {
    // Falcon is another lattice-based signature scheme
    const keySize = this.getKeySizeForSecurityLevel(securityLevel, KeyType.FALCON);
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      publicKey,
      privateKey,
      keySize,
      algorithmVersion: 'FALCON_v1.0',
    };
  }

  private async generateSphincsPlusKeyPair(securityLevel: number): Promise<KeyPair> {
    // SPHINCS+ is a hash-based signature scheme
    const keySize = this.getKeySizeForSecurityLevel(securityLevel, KeyType.SPHINCS_PLUS);
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      publicKey,
      privateKey,
      keySize,
      algorithmVersion: 'SPHINCS_PLUS_v3.1',
    };
  }

  private async generateKyberKeyPair(securityLevel: number): Promise<KeyPair> {
    // Kyber is a lattice-based key encapsulation mechanism
    const keySize = this.getKeySizeForSecurityLevel(securityLevel, KeyType.KYBER);
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      publicKey,
      privateKey,
      keySize,
      algorithmVersion: 'KYBER_v768',
    };
  }

  private async generateNtruKeyPair(securityLevel: number): Promise<KeyPair> {
    // NTRU is another lattice-based cryptosystem
    const keySize = this.getKeySizeForSecurityLevel(securityLevel, KeyType.NTRU);
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      publicKey,
      privateKey,
      keySize,
      algorithmVersion: 'NTRU_hps2048509',
    };
  }

  private async generateClassicMcElieceKeyPair(securityLevel: number): Promise<KeyPair> {
    // Classic McEliece is a code-based cryptosystem
    const keySize = this.getKeySizeForSecurityLevel(securityLevel, KeyType.CLASSIC_MCELIECE);
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      publicKey,
      privateKey,
      keySize,
      algorithmVersion: 'CLASSIC_MCELIECE_mceliece348864',
    };
  }

  private getKeySizeForSecurityLevel(securityLevel: number, keyType: KeyType): number {
    const keySizes: Record<KeyType, Record<number, number>> = {
      [KeyType.DILITHIUM]: {
        1: 2048,
        2: 3072,
        3: 4096,
        4: 6144,
        5: 8192,
      },
      [KeyType.FALCON]: {
        1: 2048,
        2: 3072,
        3: 4096,
        4: 6144,
        5: 8192,
      },
      [KeyType.SPHINCS_PLUS]: {
        1: 1024,
        2: 2048,
        3: 4096,
        4: 8192,
        5: 16384,
      },
      [KeyType.KYBER]: {
        1: 1024,
        2: 2048,
        3: 3072,
        4: 4096,
        5: 6144,
      },
      [KeyType.NTRU]: {
        1: 2048,
        2: 3072,
        3: 4096,
        4: 6144,
        5: 8192,
      },
      [KeyType.CLASSIC_MCELIECE]: {
        1: 4096,
        2: 8192,
        3: 12288,
        4: 16384,
        5: 24576,
      },
    };

    return keySizes[keyType]?.[securityLevel] || this.securityConfig.minKeySize;
  }

  async signData(keyId: string, data: Buffer): Promise<string> {
    this.logger.log(`Signing data with quantum key ${keyId}`);

    const quantumKey = await this.quantumKeyRepository.findOne({ where: { keyId } });
    if (!quantumKey) {
      throw new Error(`Quantum key ${keyId} not found`);
    }

    if (quantumKey.status !== KeyStatus.ACTIVE) {
      throw new Error(`Quantum key ${keyId} is not active`);
    }

    if (quantumKey.usage !== KeyUsage.SIGNING && quantumKey.usage !== KeyUsage.AUTHENTICATION) {
      throw new Error(`Quantum key ${keyId} is not authorized for signing`);
    }

    try {
      const privateKey = this.decryptPrivateKey(quantumKey.privateKey, quantumKey.userId);
      
      // Sign the data using the appropriate quantum algorithm
      const signature = this.performQuantumSignature(quantumKey.keyType, data, privateKey);

      // Update usage statistics
      await this.updateKeyUsage(quantumKey);

      return signature;
    } catch (error) {
      this.logger.error(`Data signing failed for key ${keyId}:`, error);
      throw error;
    }
  }

  async verifySignature(keyId: string, data: Buffer, signature: string): Promise<boolean> {
    this.logger.log(`Verifying signature with quantum key ${keyId}`);

    const quantumKey = await this.quantumKeyRepository.findOne({ where: { keyId } });
    if (!quantumKey) {
      throw new Error(`Quantum key ${keyId} not found`);
    }

    try {
      return this.performQuantumVerification(quantumKey.keyType, data, signature, quantumKey.publicKey);
    } catch (error) {
      this.logger.error(`Signature verification failed for key ${keyId}:`, error);
      return false;
    }
  }

  async performKeyExchange(keyId: string, peerPublicKey: string): Promise<{ sharedSecret: string; encryptedKey: string }> {
    this.logger.log(`Performing quantum key exchange with key ${keyId}`);

    const quantumKey = await this.quantumKeyRepository.findOne({ where: { keyId } });
    if (!quantumKey) {
      throw new Error(`Quantum key ${keyId} not found`);
    }

    if (quantumKey.usage !== KeyUsage.KEY_EXCHANGE) {
      throw new Error(`Quantum key ${keyId} is not authorized for key exchange`);
    }

    try {
      const privateKey = this.decryptPrivateKey(quantumKey.privateKey, quantumKey.userId);
      
      // Perform quantum-resistant key exchange
      const result = this.performQuantumKeyExchange(quantumKey.keyType, privateKey, peerPublicKey);

      // Update usage statistics
      await this.updateKeyUsage(quantumKey);

      return result;
    } catch (error) {
      this.logger.error(`Key exchange failed for key ${keyId}:`, error);
      throw error;
    }
  }

  private performQuantumSignature(keyType: KeyType, data: Buffer, privateKey: string): string {
    // Mock implementation using traditional crypto
    // In production, this would use actual quantum-resistant algorithms
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'base64');
  }

  private performQuantumVerification(keyType: KeyType, data: Buffer, signature: string, publicKey: string): boolean {
    // Mock implementation using traditional crypto
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    return verify.verify(publicKey, signature, 'base64');
  }

  private performQuantumKeyExchange(keyType: KeyType, privateKey: string, peerPublicKey: string): { sharedSecret: string; encryptedKey: string } {
    // Mock implementation - in production, this would use actual quantum-resistant KEM
    const sharedSecret = crypto.randomBytes(32).toString('base64');
    const encryptedKey = crypto.randomBytes(32).toString('base64');
    
    return { sharedSecret, encryptedKey };
  }

  private encryptPrivateKey(privateKey: string, userId: string): string {
    // Encrypt private key with user-specific key
    const key = crypto.scryptSync(userId, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptPrivateKey(encryptedPrivateKey: string, userId: string): string {
    const key = crypto.scryptSync(userId, 'salt', 32);
    const parts = encryptedPrivateKey.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async updateKeyUsage(quantumKey: QuantumKeyEntity): Promise<void> {
    quantumKey.usageCount += 1;
    quantumKey.lastUsedAt = new Date();
    
    // Check if key should be rotated due to usage count
    if (quantumKey.usageCount >= quantumKey.maxUsageCount) {
      quantumKey.status = KeyStatus.ROTATED;
    }
    
    await this.quantumKeyRepository.save(quantumKey);
  }

  async rotateKey(keyId: string): Promise<QuantumKeyEntity> {
    this.logger.log(`Rotating quantum key ${keyId}`);

    const oldKey = await this.quantumKeyRepository.findOne({ where: { keyId } });
    if (!oldKey) {
      throw new Error(`Quantum key ${keyId} not found`);
    }

    // Generate new key
    const newKey = await this.generateQuantumKeyPair(
      oldKey.userId,
      oldKey.keyType,
      oldKey.usage,
      oldKey.securityLevel,
    );

    // Mark old key as rotated
    oldKey.status = KeyStatus.ROTATED;
    oldKey.nextRotationAt = new Date();
    await this.quantumKeyRepository.save(oldKey);

    // Link new key to old key
    newKey.parentKeyId = oldKey.id;
    await this.quantumKeyRepository.save(newKey);

    return newKey;
  }

  async revokeKey(keyId: string, reason: string): Promise<void> {
    this.logger.log(`Revoking quantum key ${keyId} for reason: ${reason}`);

    const quantumKey = await this.quantumKeyRepository.findOne({ where: { keyId } });
    if (!quantumKey) {
      throw new Error(`Quantum key ${keyId} not found`);
    }

    quantumKey.status = KeyStatus.COMPROMISED;
    quantumKey.compromiseDetectedAt = new Date();
    quantumKey.compromiseDetails = reason;
    
    await this.quantumKeyRepository.save(quantumKey);
  }

  async getActiveKeys(userId: string): Promise<QuantumKeyEntity[]> {
    return this.quantumKeyRepository.find({
      where: { 
        userId, 
        status: KeyStatus.ACTIVE,
        isArchived: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getKeyById(keyId: string): Promise<QuantumKeyEntity | null> {
    return this.quantumKeyRepository.findOne({ 
      where: { keyId, isArchived: false } 
    });
  }

  private generateKeyId(): string {
    return `QK_${Date.now()}_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkForExpiredKeys(): Promise<void> {
    this.logger.log('Checking for expired quantum keys...');

    const now = new Date();
    const expiredKeys = await this.quantumKeyRepository.find({
      where: {
        expiresAt: { $lte: now },
        status: KeyStatus.ACTIVE,
      },
    });

    for (const key of expiredKeys) {
      this.logger.warn(`Quantum key ${key.keyId} has expired`);
      key.status = KeyStatus.INACTIVE;
      await this.quantumKeyRepository.save(key);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkForKeysNeedingRotation(): Promise<void> {
    this.logger.log('Checking for quantum keys needing rotation...');

    const now = new Date();
    const keysToRotate = await this.quantumKeyRepository.find({
      where: {
        nextRotationAt: { $lte: now },
        status: KeyStatus.ACTIVE,
      },
    });

    for (const key of keysToRotate) {
      this.logger.info(`Rotating quantum key ${key.keyId} due for rotation`);
      await this.rotateKey(key.keyId);
    }
  }

  async migrateFromTraditionalKey(
    userId: string,
    traditionalKeyId: string,
    quantumKeyType: KeyType,
    usage: KeyUsage,
  ): Promise<QuantumKeyEntity> {
    this.logger.log(`Migrating traditional key ${traditionalKeyId} to quantum ${quantumKeyType}`);

    // Generate quantum key
    const quantumKey = await this.generateQuantumKeyPair(userId, quantumKeyType, usage);
    
    // Record migration information
    quantumKey.migrationFrom = traditionalKeyId;
    quantumKey.migrationCompletedAt = new Date();
    
    return this.quantumKeyRepository.save(quantumKey);
  }
}
