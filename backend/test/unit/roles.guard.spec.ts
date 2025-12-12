import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/auth/roles.guard';
import { Roles } from '../../src/auth/roles.decorator';
import { Role } from '@prisma/client';

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
