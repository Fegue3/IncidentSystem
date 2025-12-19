// test/unit/roles.guard.spec.ts
/**
 * Unit tests: RolesGuard
 *
 * O que valida:
 * - Se não existir metadata @Roles -> permite (true)
 * - Se existir @Roles e o user não tiver role -> nega (false)
 * - Se existir @Roles e role não corresponder -> nega (false)
 * - Se existir @Roles e role corresponder -> permite (true)
 *
 * Nota:
 * - O RolesGuard lê metadata via Reflector (handler + class)
 * - O "ctx" é mockado com getHandler/getClass/switchToHttp().getRequest().user.role
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import { RolesGuard } from '../../src/auth/roles.guard';
import { Roles } from '../../src/auth/roles.decorator';

describe('RolesGuard (unit)', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const makeCtx = (userRole?: Role, handler?: any, clazz?: any) =>
    ({
      getHandler: () => handler,
      getClass: () => clazz,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: userRole } }),
      }),
    } as any);

  it('se não houver @Roles -> true', () => {
    class C {
      handler() {}
    }
    const ctx = makeCtx(undefined, C.prototype.handler, C);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('se houver @Roles e user sem role -> false', () => {
    class C {
      @Roles(Role.ADMIN)
      handler() {}
    }
    const ctx = makeCtx(undefined, C.prototype.handler, C);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('se houver @Roles e role não bate -> false', () => {
    class C {
      @Roles(Role.ADMIN)
      handler() {}
    }
    const ctx = makeCtx(Role.USER, C.prototype.handler, C);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('se houver @Roles e role bate -> true', () => {
    class C {
      @Roles(Role.ADMIN)
      handler() {}
    }
    const ctx = makeCtx(Role.ADMIN, C.prototype.handler, C);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
