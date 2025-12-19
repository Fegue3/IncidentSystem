/**
 * @file backend/src/auth/roles.guard.ts
 * @module Backend.Auth.RolesGuard
 *
 * @summary
 *  Guard de autorização (RBAC) baseado em roles definidos via decorator @Roles.
 *
 * @description
 *  - Lê metadata ROLES_KEY (roles requeridos) ao nível do handler e da classe.
 *  - Se não houver metadata, permite acesso (no-op).
 *  - Se houver, verifica se req.user.role existe e está incluído em requiredRoles.
 *
 * @integration
 *  Este guard é registado como APP_GUARD no AuthModule, tornando-o global.
 *  Mesmo sendo global, só bloqueia endpoints anotados com @Roles(...).
 *
 * @notes
 *  - Este guard assume que `req.user` é preenchido por uma strategy de autenticação
 *    (ex.: AccessJwtStrategy) e que contém `role`.
 *  - Se user.role faltar, devolve false (o Nest trata como Forbidden/Unauthorized consoante setup).
 */

import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";
import { Role } from "@prisma/client";

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
