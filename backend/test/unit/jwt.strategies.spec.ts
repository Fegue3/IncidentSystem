import { UnauthorizedException } from '@nestjs/common';
import { AccessJwtStrategy } from '../../src/auth/strategies/access-jwt.strategy';
import { RefreshJwtStrategy } from '../../src/auth/strategies/refresh-jwt.strategy';

describe('JWT Strategies (unit)', () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh';
  });

  it('AccessJwtStrategy.validate devolve payload (sync)', () => {
    const s = new AccessJwtStrategy();
    const payload = { sub: 'u1', email: 'u@u.com', role: 'USER', teamId: null };

    const out = s.validate(payload as any);

    expect(out).toEqual(payload);
  });

  it('RefreshJwtStrategy.validate inclui refreshToken do body', () => {
    const s = new RefreshJwtStrategy();
    const payload = { sub: 'u1', email: 'u@u.com' };

    const out = s.validate(
      { body: { refreshToken: 'rt' }, headers: {} } as any,
      payload as any,
    );

    expect(out.sub).toBe('u1');
    expect(out.refreshToken).toBe('rt');
  });

  it('RefreshJwtStrategy.validate falha sem refresh token (sync throw)', () => {
    const s = new RefreshJwtStrategy();
    const payload = { sub: 'u1' };

    expect(() => s.validate({ body: {}, headers: {} } as any, payload as any)).toThrow(
      UnauthorizedException,
    );
  });
});
