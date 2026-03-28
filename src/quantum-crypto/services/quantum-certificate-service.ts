import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuantumCertificateEntity, CertificateType, CertificateStatus } from '../entities/quantum-certificate.entity';
import { QuantumKeyEntity, KeyType, KeyUsage } from '../entities/quantum-key.entity';
import { QuantumKeyService } from './quantum-key-service';
import * as crypto from 'crypto';

interface CertificateRequest {
  userId: string;
  certificateType: CertificateType;
  subjectDN: string;
  keyId: string;
  validityDays: number;
  subjectAlternativeNames?: string[];
  keyUsage?: string[];
  extendedKeyUsage?: string[];
}

interface CertificateData {
  certificate: string;
  certificateChain: string[];
  fingerprint: string;
  serialNumber: string;
}

@Injectable()
export class QuantumCertificateService {
  private readonly logger = new Logger(QuantumCertificateService.name);
  private readonly caCertificateDN = 'CN=SwapTrade Quantum CA,O=SwapTrade,C=US';
  private readonly defaultValidityDays = 365;

  constructor(
    @InjectRepository(QuantumCertificateEntity)
    private readonly certificateRepository: Repository<QuantumCertificateEntity>,
    @InjectRepository(QuantumKeyEntity)
    private readonly quantumKeyRepository: Repository<QuantumKeyEntity>,
    private readonly quantumKeyService: QuantumKeyService,
  ) {}

  async issueCertificate(request: CertificateRequest): Promise<QuantumCertificateEntity> {
    this.logger.log(`Issuing ${request.certificateType} certificate for user ${request.userId}`);

    try {
      // Validate the quantum key
      const quantumKey = await this.quantumKeyRepository.findOne({ 
        where: { keyId: request.keyId, userId: request.userId } 
      });
      
      if (!quantumKey) {
        throw new Error(`Quantum key ${request.keyId} not found for user ${request.userId}`);
      }

      if (!this.isKeySuitableForCertificate(quantumKey, request.certificateType)) {
        throw new Error(`Quantum key ${request.keyId} is not suitable for ${request.certificateType} certificate`);
      }

      // Generate certificate data
      const certificateData = await this.generateCertificate(request, quantumKey);

      // Calculate validity period
      const issuedAt = new Date();
      const validFrom = issuedAt;
      const validTo = new Date(issuedAt);
      validTo.setDate(validTo.getDate() + request.validityDays || this.defaultValidityDays);

      // Create certificate entity
      const certificate = this.certificateRepository.create({
        certificateId: this.generateCertificateId(),
        userId: request.userId,
        keyId: request.keyId,
        certificateType: request.certificateType,
        status: CertificateStatus.ACTIVE,
        subjectDN: request.subjectDN,
        issuerDN: this.caCertificateDN,
        certificateData: certificateData.certificate,
        certificateChain: certificateData.certificateChain,
        publicKeyFingerprint: certificateData.fingerprint,
        serialNumber: certificateData.serialNumber,
        signatureAlgorithm: `${quantumKey.keyType.toUpperCase()}_WITH_${this.getHashAlgorithm()}`,
        hashAlgorithm: this.getHashAlgorithm(),
        issuedAt,
        expiresAt: validTo,
        validFrom,
        validTo,
        keyUsage: request.keyUsage || this.getDefaultKeyUsage(request.certificateType),
        extendedKeyUsage: request.extendedKeyUsage || this.getDefaultExtendedKeyUsage(request.certificateType),
        subjectAlternativeNames: request.subjectAlternativeNames,
        securityLevel: quantumKey.securityLevel,
      });

      return this.certificateRepository.save(certificate);
    } catch (error) {
      this.logger.error('Certificate issuance failed:', error);
      throw error;
    }
  }

  private async generateCertificate(request: CertificateRequest, quantumKey: QuantumKeyEntity): Promise<CertificateData> {
    // Mock certificate generation - in production, this would use actual X.509 certificate generation
    const serialNumber = this.generateSerialNumber();
    const fingerprint = this.generateFingerprint(quantumKey.publicKey);
    
    // Generate mock certificate
    const certificate = this.generateMockCertificate(request, quantumKey, serialNumber);
    const certificateChain = [certificate]; // In production, include full chain

    return {
      certificate,
      certificateChain,
      fingerprint,
      serialNumber,
    };
  }

  private generateMockCertificate(request: CertificateRequest, quantumKey: QuantumKeyEntity, serialNumber: string): string {
    // Mock X.509 certificate structure
    const certData = {
      version: 3,
      serialNumber,
      subject: request.subjectDN,
      issuer: this.caCertificateDN,
      validity: {
        notBefore: new Date().toISOString(),
        notAfter: new Date(Date.now() + (request.validityDays || this.defaultValidityDays) * 24 * 60 * 60 * 1000).toISOString(),
      },
      subjectPublicKeyInfo: {
        algorithm: quantumKey.keyType,
        publicKey: quantumKey.publicKey,
      },
      extensions: {
        keyUsage: request.keyUsage || this.getDefaultKeyUsage(request.certificateType),
        extendedKeyUsage: request.extendedKeyUsage || this.getDefaultExtendedKeyUsage(request.certificateType),
        subjectAlternativeNames: request.subjectAlternativeNames,
      },
      signatureAlgorithm: `${quantumKey.keyType.toUpperCase()}_WITH_${this.getHashAlgorithm()}`,
    };

    // Sign the certificate with the quantum key
    const signature = await this.quantumKeyService.signData(
      quantumKey.keyId,
      Buffer.from(JSON.stringify(certData))
    );

    return JSON.stringify({
      ...certData,
      signature,
      certificateData: Buffer.from(JSON.stringify(certData)).toString('base64'),
    });
  }

  private isKeySuitableForCertificate(key: QuantumKeyEntity, certType: CertificateType): boolean {
    switch (certType) {
      case CertificateType.IDENTITY:
      case CertificateType.AUTHENTICATION:
      case CertificateType.CODE_SIGNING:
      case CertificateType.DOCUMENT_SIGNING:
        return key.usage === KeyUsage.SIGNING || key.usage === KeyUsage.AUTHENTICATION;
      
      case CertificateType.SSL_TLS:
      case CertificateType.EMAIL:
      case CertificateType.API:
        return key.usage === KeyUsage.ENCRYPTION || key.usage === KeyUsage.KEY_EXCHANGE;
      
      default:
        return false;
    }
  }

  private getDefaultKeyUsage(certificateType: CertificateType): string[] {
    switch (certificateType) {
      case CertificateType.IDENTITY:
      case CertificateType.AUTHENTICATION:
        return ['digitalSignature', 'nonRepudiation'];
      
      case CertificateType.CODE_SIGNING:
        return ['digitalSignature', 'nonRepudiation', 'codeSigning'];
      
      case CertificateType.DOCUMENT_SIGNING:
        return ['digitalSignature', 'nonRepudiation'];
      
      case CertificateType.SSL_TLS:
        return ['keyEncipherment', 'dataEncipherment', 'digitalSignature'];
      
      case CertificateType.EMAIL:
        return ['digitalSignature', 'keyEncipherment', 'emailProtection'];
      
      case CertificateType.API:
        return ['digitalSignature', 'keyEncipherment'];
      
      default:
        return ['digitalSignature'];
    }
  }

  private getDefaultExtendedKeyUsage(certificateType: CertificateType): string[] {
    switch (certificateType) {
      case CertificateType.IDENTITY:
        return ['clientAuth'];
      
      case CertificateType.AUTHENTICATION:
        return ['clientAuth', 'serverAuth'];
      
      case CertificateType.CODE_SIGNING:
        return ['codeSigning'];
      
      case CertificateType.DOCUMENT_SIGNING:
        return ['documentSigning'];
      
      case CertificateType.SSL_TLS:
        return ['serverAuth', 'clientAuth'];
      
      case CertificateType.EMAIL:
        return ['emailProtection'];
      
      case CertificateType.API:
        return ['clientAuth'];
      
      default:
        return [];
    }
  }

  private getHashAlgorithm(): string {
    return 'SHA256';
  }

  private generateSerialNumber(): string {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  private generateFingerprint(publicKey: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(publicKey);
    return hash.digest('hex').toUpperCase();
  }

  private generateCertificateId(): string {
    return `QCERT_${Date.now()}_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }

  async revokeCertificate(certificateId: string, reason: string): Promise<void> {
    this.logger.log(`Revoking certificate ${certificateId} for reason: ${reason}`);

    const certificate = await this.certificateRepository.findOne({ 
      where: { certificateId } 
    });
    
    if (!certificate) {
      throw new Error(`Certificate ${certificateId} not found`);
    }

    certificate.status = CertificateStatus.REVOKED;
    certificate.revokedAt = new Date();
    certificate.revocationReason = reason;
    
    await this.certificateRepository.save(certificate);
  }

  async verifyCertificate(certificateId: string): Promise<{
    isValid: boolean;
    status: CertificateStatus;
    reason?: string;
  }> {
    const certificate = await this.certificateRepository.findOne({ 
      where: { certificateId } 
    });
    
    if (!certificate) {
      return { isValid: false, status: CertificateStatus.INACTIVE, reason: 'Certificate not found' };
    }

    // Check if certificate is expired
    if (new Date() > certificate.validTo) {
      return { isValid: false, status: CertificateStatus.EXPIRED, reason: 'Certificate has expired' };
    }

    // Check if certificate is revoked
    if (certificate.status === CertificateStatus.REVOKED) {
      return { isValid: false, status: CertificateStatus.REVOKED, reason: certificate.revocationReason };
    }

    // Check if certificate is active
    if (certificate.status !== CertificateStatus.ACTIVE) {
      return { isValid: false, status: certificate.status, reason: 'Certificate is not active' };
    }

    // Verify certificate signature (mock implementation)
    const signatureValid = await this.verifyCertificateSignature(certificate);
    if (!signatureValid) {
      return { isValid: false, status: CertificateStatus.INACTIVE, reason: 'Invalid certificate signature' };
    }

    return { isValid: true, status: certificate.status };
  }

  private async verifyCertificateSignature(certificate: QuantumCertificateEntity): Promise<boolean> {
    try {
      // Mock signature verification - in production, this would verify the actual certificate signature
      const quantumKey = await this.quantumKeyRepository.findOne({ 
        where: { keyId: certificate.keyId } 
      });
      
      if (!quantumKey) {
        return false;
      }

      // For demonstration, always return true
      // In production, this would verify the certificate signature using the quantum key
      return true;
    } catch (error) {
      this.logger.error('Certificate signature verification failed:', error);
      return false;
    }
  }

  async getCertificatesByUser(userId: string): Promise<QuantumCertificateEntity[]> {
    return this.certificateRepository.find({
      where: { userId, isArchived: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveCertificates(userId: string): Promise<QuantumCertificateEntity[]> {
    return this.certificateRepository.find({
      where: { 
        userId, 
        status: CertificateStatus.ACTIVE,
        isArchived: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getCertificateById(certificateId: string): Promise<QuantumCertificateEntity | null> {
    return this.certificateRepository.findOne({ 
      where: { certificateId, isArchived: false } 
    });
  }

  async renewCertificate(certificateId: string, validityDays: number): Promise<QuantumCertificateEntity> {
    this.logger.log(`Renewing certificate ${certificateId}`);

    const oldCertificate = await this.certificateRepository.findOne({ 
      where: { certificateId } 
    });
    
    if (!oldCertificate) {
      throw new Error(`Certificate ${certificateId} not found`);
    }

    // Create renewal request
    const renewalRequest: CertificateRequest = {
      userId: oldCertificate.userId,
      certificateType: oldCertificate.certificateType,
      subjectDN: oldCertificate.subjectDN,
      keyId: oldCertificate.keyId,
      validityDays,
      subjectAlternativeNames: oldCertificate.subjectAlternativeNames,
      keyUsage: oldCertificate.keyUsage,
      extendedKeyUsage: oldCertificate.extendedKeyUsage,
    };

    // Issue new certificate
    const newCertificate = await this.issueCertificate(renewalRequest);

    // Mark old certificate as inactive
    oldCertificate.status = CertificateStatus.INACTIVE;
    await this.certificateRepository.save(oldCertificate);

    return newCertificate;
  }

  async migrateFromTraditionalCertificate(
    userId: string,
    traditionalCertificateId: string,
    quantumKeyId: string,
    certificateType: CertificateType,
    subjectDN: string,
  ): Promise<QuantumCertificateEntity> {
    this.logger.log(`Migrating traditional certificate ${traditionalCertificateId} to quantum certificate`);

    const request: CertificateRequest = {
      userId,
      certificateType,
      subjectDN,
      keyId: quantumKeyId,
      validityDays: this.defaultValidityDays,
    };

    const quantumCertificate = await this.issueCertificate(request);
    
    // Record migration information
    quantumCertificate.migrationFromTraditional = traditionalCertificateId;
    quantumCertificate.migrationCompletedAt = new Date();
    
    return this.certificateRepository.save(quantumCertificate);
  }

  async checkExpiringCertificates(): Promise<QuantumCertificateEntity[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return this.certificateRepository.find({
      where: {
        status: CertificateStatus.ACTIVE,
        expiresAt: { $lte: thirtyDaysFromNow },
        isArchived: false,
      },
    });
  }

  async generateCRL(): Promise<string> {
    this.logger.log('Generating Certificate Revocation List (CRL)');

    const revokedCertificates = await this.certificateRepository.find({
      where: {
        status: CertificateStatus.REVOKED,
        isArchived: false,
      },
    });

    // Mock CRL generation - in production, this would generate proper CRL format
    const crlData = {
      version: 2,
      issuer: this.caCertificateDN,
      thisUpdate: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
      revokedCertificates: revokedCertificates.map(cert => ({
        serialNumber: cert.serialNumber,
        revocationDate: cert.revokedAt?.toISOString(),
        reason: cert.revocationReason,
      })),
    };

    return JSON.stringify(crlData);
  }
}
