import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuantumKeyEntity } from './entities/quantum-key.entity';
import { QuantumCertificateEntity } from './entities/quantum-certificate.entity';
import { QuantumCryptoController } from './controller/quantum-crypto.controller';
import { QuantumKeyService } from './services/quantum-key-service';
import { QuantumCertificateService } from './services/quantum-certificate.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuantumKeyEntity,
      QuantumCertificateEntity,
    ]),
  ],
  controllers: [QuantumCryptoController],
  providers: [
    QuantumKeyService,
    QuantumCertificateService,
  ],
  exports: [
    QuantumKeyService,
    QuantumCertificateService,
  ],
})
export class QuantumCryptoModule {}
