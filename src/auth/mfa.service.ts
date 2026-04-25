import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { Auth } from './entities/auth.entity';

@Injectable()
export class MFAService {
  constructor(
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
  ) {}

  async generateSecret(auth: Auth) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(auth.staffId, 'SwapTrade', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret,
      qrCodeDataUrl,
    };
  }

  async verifyAndEnable(authId: number, secret: string, token: string) {
    const isValid = authenticator.verify({ token, secret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    const recoveryCodes = Array.from({ length: 8 }).map(() =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );

    await this.authRepository.update(authId, {
      totpSecret: secret,
      is2FAEnabled: true,
    });

    return { recoveryCodes };
  }

  async verifyToken(authId: number, token: string): Promise<boolean> {
    const auth = await this.authRepository.findOne({
      where: { id: authId },
      select: ['id', 'totpSecret', 'is2FAEnabled'],
    });

    if (!auth || !auth.is2FAEnabled || !auth.totpSecret) {
      return true; // MFA not enabled
    }

    return authenticator.verify({ token, secret: auth.totpSecret });
  }

  async disable(authId: number, token: string) {
    const auth = await this.authRepository.findOne({
      where: { id: authId },
      select: ['id', 'totpSecret', 'is2FAEnabled'],
    });

    if (!auth || !auth.is2FAEnabled || !auth.totpSecret) {
      throw new BadRequestException('MFA not enabled');
    }

    const isValid = authenticator.verify({ token, secret: auth.totpSecret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    await this.authRepository.update(authId, {
      is2FAEnabled: false,
      totpSecret: '',
    });
  }
}
