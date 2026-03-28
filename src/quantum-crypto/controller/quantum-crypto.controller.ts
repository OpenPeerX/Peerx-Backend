import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QuantumKeyService } from '../services/quantum-key-service';
import { QuantumCertificateService } from '../services/quantum-certificate-service';
import { QuantumKeyEntity, KeyType, KeyUsage } from '../entities/quantum-key.entity';
import { QuantumCertificateEntity, CertificateType } from '../entities/quantum-certificate.entity';

interface KeyGenerationRequest {
  keyType: KeyType;
  usage: KeyUsage;
  securityLevel?: number;
  createdFor?: string;
}

interface CertificateRequest {
  certificateType: CertificateType;
  subjectDN: string;
  keyId: string;
  validityDays?: number;
  subjectAlternativeNames?: string[];
  keyUsage?: string[];
  extendedKeyUsage?: string[];
}

interface SignDataRequest {
  keyId: string;
  data: string; // Base64 encoded data
}

interface VerifySignatureRequest {
  keyId: string;
  data: string; // Base64 encoded data
  signature: string;
}

interface KeyExchangeRequest {
  keyId: string;
  peerPublicKey: string;
}

interface CertificateRevocationRequest {
  reason: string;
}

interface KeyRevocationRequest {
  reason: string;
}

@ApiTags('Quantum-Resistant Cryptography')
@Controller('quantum-crypto')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuantumCryptoController {
  private readonly logger = new Logger(QuantumCryptoController.name);

  constructor(
    private readonly quantumKeyService: QuantumKeyService,
    private readonly quantumCertificateService: QuantumCertificateService,
  ) {}

  @Post('keys/generate')
  @ApiOperation({ summary: 'Generate quantum-resistant key pair' })
  @ApiResponse({ status: 201, description: 'Quantum key pair generated', type: QuantumKeyEntity })
  @ApiResponse({ status: 400, description: 'Invalid key parameters' })
  async generateKey(
    @Body() keyRequest: KeyGenerationRequest,
    @Request() req: any,
  ): Promise<QuantumKeyEntity> {
    try {
      const userId = req.user.id;
      return await this.quantumKeyService.generateQuantumKeyPair(
        userId,
        keyRequest.keyType,
        keyRequest.usage,
        keyRequest.securityLevel,
      );
    } catch (error) {
      this.logger.error('Quantum key generation failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('keys')
  @ApiOperation({ summary: 'Get user quantum keys' })
  @ApiResponse({ status: 200, description: 'Quantum keys retrieved', type: [QuantumKeyEntity] })
  async getUserKeys(@Request() req: any): Promise<QuantumKeyEntity[]> {
    try {
      const userId = req.user.id;
      return await this.quantumKeyService.getActiveKeys(userId);
    } catch (error) {
      this.logger.error('Failed to get user keys:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('keys/:keyId')
  @ApiOperation({ summary: 'Get specific quantum key' })
  @ApiResponse({ status: 200, description: 'Quantum key retrieved', type: QuantumKeyEntity })
  @ApiResponse({ status: 404, description: 'Key not found' })
  async getKey(@Param('keyId') keyId: string): Promise<QuantumKeyEntity> {
    try {
      const key = await this.quantumKeyService.getKeyById(keyId);
      if (!key) {
        throw new BadRequestException('Key not found');
      }
      return key;
    } catch (error) {
      this.logger.error(`Failed to get key ${keyId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('keys/:keyId/rotate')
  @ApiOperation({ summary: 'Rotate quantum key' })
  @ApiResponse({ status: 200, description: 'Key rotated successfully', type: QuantumKeyEntity })
  @ApiResponse({ status: 404, description: 'Key not found' })
  async rotateKey(@Param('keyId') keyId: string): Promise<QuantumKeyEntity> {
    try {
      return await this.quantumKeyService.rotateKey(keyId);
    } catch (error) {
      this.logger.error(`Key rotation failed for ${keyId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Put('keys/:keyId/revoke')
  @ApiOperation({ summary: 'Revoke quantum key' })
  @ApiResponse({ status: 200, description: 'Key revoked successfully' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  async revokeKey(
    @Param('keyId') keyId: string,
    @Body() revocationRequest: KeyRevocationRequest,
  ): Promise<{ message: string }> {
    try {
      await this.quantumKeyService.revokeKey(keyId, revocationRequest.reason);
      return { message: 'Key revoked successfully' };
    } catch (error) {
      this.logger.error(`Key revocation failed for ${keyId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('sign')
  @ApiOperation({ summary: 'Sign data with quantum key' })
  @ApiResponse({ status: 200, description: 'Data signed successfully' })
  @ApiResponse({ status: 400, description: 'Signing failed' })
  async signData(@Body() signRequest: SignDataRequest): Promise<{ signature: string }> {
    try {
      const data = Buffer.from(signRequest.data, 'base64');
      const signature = await this.quantumKeyService.signData(signRequest.keyId, data);
      return { signature };
    } catch (error) {
      this.logger.error('Data signing failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify signature with quantum key' })
  @ApiResponse({ status: 200, description: 'Signature verified' })
  @ApiResponse({ status: 400, description: 'Verification failed' })
  async verifySignature(@Body() verifyRequest: VerifySignatureRequest): Promise<{ isValid: boolean }> {
    try {
      const data = Buffer.from(verifyRequest.data, 'base64');
      const isValid = await this.quantumKeyService.verifySignature(
        verifyRequest.keyId,
        data,
        verifyRequest.signature,
      );
      return { isValid };
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('key-exchange')
  @ApiOperation({ summary: 'Perform quantum-resistant key exchange' })
  @ApiResponse({ status: 200, description: 'Key exchange completed' })
  @ApiResponse({ status: 400, description: 'Key exchange failed' })
  async performKeyExchange(@Body() exchangeRequest: KeyExchangeRequest): Promise<{
    sharedSecret: string;
    encryptedKey: string;
  }> {
    try {
      return await this.quantumKeyService.performKeyExchange(
        exchangeRequest.keyId,
        exchangeRequest.peerPublicKey,
      );
    } catch (error) {
      this.logger.error('Key exchange failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('certificates/issue')
  @ApiOperation({ summary: 'Issue quantum-resistant certificate' })
  @ApiResponse({ status: 201, description: 'Certificate issued', type: QuantumCertificateEntity })
  @ApiResponse({ status: 400, description: 'Certificate issuance failed' })
  async issueCertificate(
    @Body() certRequest: CertificateRequest,
    @Request() req: any,
  ): Promise<QuantumCertificateEntity> {
    try {
      const userId = req.user.id;
      const request = {
        ...certRequest,
        userId,
      };
      return await this.quantumCertificateService.issueCertificate(request);
    } catch (error) {
      this.logger.error('Certificate issuance failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('certificates')
  @ApiOperation({ summary: 'Get user quantum certificates' })
  @ApiResponse({ status: 200, description: 'Certificates retrieved', type: [QuantumCertificateEntity] })
  async getUserCertificates(@Request() req: any): Promise<QuantumCertificateEntity[]> {
    try {
      const userId = req.user.id;
      return await this.quantumCertificateService.getCertificatesByUser(userId);
    } catch (error) {
      this.logger.error('Failed to get user certificates:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('certificates/active')
  @ApiOperation({ summary: 'Get active quantum certificates' })
  @ApiResponse({ status: 200, description: 'Active certificates retrieved', type: [QuantumCertificateEntity] })
  async getActiveCertificates(@Request() req: any): Promise<QuantumCertificateEntity[]> {
    try {
      const userId = req.user.id;
      return await this.quantumCertificateService.getActiveCertificates(userId);
    } catch (error) {
      this.logger.error('Failed to get active certificates:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('certificates/:certificateId')
  @ApiOperation({ summary: 'Get specific quantum certificate' })
  @ApiResponse({ status: 200, description: 'Certificate retrieved', type: QuantumCertificateEntity })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async getCertificate(@Param('certificateId') certificateId: string): Promise<QuantumCertificateEntity> {
    try {
      const certificate = await this.quantumCertificateService.getCertificateById(certificateId);
      if (!certificate) {
        throw new BadRequestException('Certificate not found');
      }
      return certificate;
    } catch (error) {
      this.logger.error(`Failed to get certificate ${certificateId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('certificates/:certificateId/verify')
  @ApiOperation({ summary: 'Verify quantum certificate' })
  @ApiResponse({ status: 200, description: 'Certificate verification completed' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async verifyCertificate(@Param('certificateId') certificateId: string): Promise<{
    isValid: boolean;
    status: string;
    reason?: string;
  }> {
    try {
      return await this.quantumCertificateService.verifyCertificate(certificateId);
    } catch (error) {
      this.logger.error(`Certificate verification failed for ${certificateId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('certificates/:certificateId/revoke')
  @ApiOperation({ summary: 'Revoke quantum certificate' })
  @ApiResponse({ status: 200, description: 'Certificate revoked successfully' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async revokeCertificate(
    @Param('certificateId') certificateId: string,
    @Body() revocationRequest: CertificateRevocationRequest,
  ): Promise<{ message: string }> {
    try {
      await this.quantumCertificateService.revokeCertificate(certificateId, revocationRequest.reason);
      return { message: 'Certificate revoked successfully' };
    } catch (error) {
      this.logger.error(`Certificate revocation failed for ${certificateId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('certificates/:certificateId/renew')
  @ApiOperation({ summary: 'Renew quantum certificate' })
  @ApiResponse({ status: 200, description: 'Certificate renewed', type: QuantumCertificateEntity })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async renewCertificate(
    @Param('certificateId') certificateId: string,
    @Body() renewalRequest: { validityDays: number },
  ): Promise<QuantumCertificateEntity> {
    try {
      return await this.quantumCertificateService.renewCertificate(
        certificateId,
        renewalRequest.validityDays,
      );
    } catch (error) {
      this.logger.error(`Certificate renewal failed for ${certificateId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('certificates/expiring')
  @ApiOperation({ summary: 'Get expiring certificates' })
  @ApiResponse({ status: 200, description: 'Expiring certificates retrieved' })
  async getExpiringCertificates(@Request() req: any): Promise<QuantumCertificateEntity[]> {
    try {
      const userId = req.user.id;
      const allExpiring = await this.quantumCertificateService.checkExpiringCertificates();
      return allExpiring.filter(cert => cert.userId === userId);
    } catch (error) {
      this.logger.error('Failed to get expiring certificates:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('crl')
  @ApiOperation({ summary: 'Get Certificate Revocation List (CRL)' })
  @ApiResponse({ status: 200, description: 'CRL retrieved' })
  async getCRL(): Promise<{ crl: string }> {
    try {
      const crl = await this.quantumCertificateService.generateCRL();
      return { crl };
    } catch (error) {
      this.logger.error('CRL generation failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('migrate/key')
  @ApiOperation({ summary: 'Migrate from traditional key to quantum key' })
  @ApiResponse({ status: 201, description: 'Key migration completed', type: QuantumKeyEntity })
  async migrateKey(
    @Body() migrationRequest: {
      traditionalKeyId: string;
      quantumKeyType: KeyType;
      usage: KeyUsage;
    },
    @Request() req: any,
  ): Promise<QuantumKeyEntity> {
    try {
      const userId = req.user.id;
      return await this.quantumKeyService.migrateFromTraditionalKey(
        userId,
        migrationRequest.traditionalKeyId,
        migrationRequest.quantumKeyType,
        migrationRequest.usage,
      );
    } catch (error) {
      this.logger.error('Key migration failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('migrate/certificate')
  @ApiOperation({ summary: 'Migrate from traditional certificate to quantum certificate' })
  @ApiResponse({ status: 201, description: 'Certificate migration completed', type: QuantumCertificateEntity })
  async migrateCertificate(
    @Body() migrationRequest: {
      traditionalCertificateId: string;
      quantumKeyId: string;
      certificateType: CertificateType;
      subjectDN: string;
    },
    @Request() req: any,
  ): Promise<QuantumCertificateEntity> {
    try {
      const userId = req.user.id;
      return await this.quantumCertificateService.migrateFromTraditionalCertificate(
        userId,
        migrationRequest.traditionalCertificateId,
        migrationRequest.quantumKeyId,
        migrationRequest.certificateType,
        migrationRequest.subjectDN,
      );
    } catch (error) {
      this.logger.error('Certificate migration failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get quantum cryptography dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved' })
  async getQuantumSummary(@Request() req: any): Promise<{
    totalKeys: number;
    activeKeys: number;
    totalCertificates: number;
    activeCertificates: number;
    expiringSoon: number;
    quantumMigrationProgress: number;
  }> {
    try {
      const userId = req.user.id;
      const activeKeys = await this.quantumKeyService.getActiveKeys(userId);
      const activeCertificates = await this.quantumCertificateService.getActiveCertificates(userId);
      const allCertificates = await this.quantumCertificateService.getCertificatesByUser(userId);
      const expiringSoon = await this.quantumCertificateService.checkExpiringCertificates();

      return {
        totalKeys: activeKeys.length,
        activeKeys: activeKeys.length,
        totalCertificates: allCertificates.length,
        activeCertificates: activeCertificates.length,
        expiringSoon: expiringSoon.filter(cert => cert.userId === userId).length,
        quantumMigrationProgress: this.calculateMigrationProgress(activeKeys, allCertificates),
      };
    } catch (error) {
      this.logger.error('Failed to get quantum summary:', error);
      throw new BadRequestException(error.message);
    }
  }

  private calculateMigrationProgress(keys: QuantumKeyEntity[], certificates: QuantumCertificateEntity[]): number {
    // Simple calculation - in production, this would be more sophisticated
    const migratedKeys = keys.filter(key => key.migrationFrom).length;
    const migratedCerts = certificates.filter(cert => cert.migrationFromTraditional).length;
    const totalItems = keys.length + certificates.length;
    
    if (totalItems === 0) return 0;
    
    return Math.round(((migratedKeys + migratedCerts) / totalItems) * 100);
  }
}
