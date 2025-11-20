import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // se não tiver @Roles, não faz filtro
    }

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as { role?: Role };

    if (!user?.role) return false;

    return requiredRoles.includes(user.role);
  }
}
