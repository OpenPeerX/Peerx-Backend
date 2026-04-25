import { SetMetadata } from '@nestjs/common';
import { KycRole } from './enum/kyc-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: KycRole[]) => SetMetadata(ROLES_KEY, roles);
