import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KycRole } from '../enum/kyc-role.enum';
import { ROLES_KEY } from '../roles.decorator';

@Injectable()
export class KycRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<KycRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles decorator — public route
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      throw new ForbiddenException('No authenticated user or missing roles.');
    }

    const hasRole = requiredRoles.some((role) =>
      (user.roles as KycRole[]).includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: [${requiredRoles.join(', ')}].`,
      );
    }

    return true;
  }
}
