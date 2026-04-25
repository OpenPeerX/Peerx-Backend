import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycRecord } from '../entities/kyc-records.entity';
import { KycStatus } from '../enum/kyc-status.enum';

export const SKIP_KYC_KEY = 'skipKyc';
export const SkipKyc = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@nestjs/common').SetMetadata(SKIP_KYC_KEY, true);

@Injectable()
export class KycGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(KycRecord)
    private readonly kycRepo: Repository<KycRecord>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_KYC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Unauthenticated request.');
    }

    const record = await this.kycRepo.findOne({
      where: { userId: user.id },
    });

    if (!record || record.status !== KycStatus.VERIFIED) {
      throw new ForbiddenException(
        'KYC verification required to access this resource.',
      );
    }

    return true;
  }
}
