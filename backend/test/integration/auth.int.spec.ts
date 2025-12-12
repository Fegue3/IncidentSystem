import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthService } from '../../src/auth/auth.service';
import { resetDb } from './_helpers/prisma-reset';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('Auth (integration)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  let mod: any;

  beforeAll(async () => {
    jest.setTimeout(30000);

    process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@postgres:5432/incidentsdb_test?schema=public';

    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'super_access_secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'super_refresh_secret';

    mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = mod.get(PrismaService);
    auth = mod.get(AuthService);

    await resetDb(prisma);
  }, 30000);

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await mod?.close?.();
  });

  it('register() -> cria user e guarda refreshTokenHash', async () => {
    const res = await auth.register('auth1@test.com', 'StrongPass1!', 'Auth1');

    expect(res.user.id).toBeDefined();
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();

    const db = await prisma.user.findUnique({ where: { id: res.user.id } });
    expect(db).toBeTruthy();
    expect(db!.refreshTokenHash).toBeTruthy();
  });

  it('login() -> falha se credenciais inválidas', async () => {
    await expect(auth.login('nope@test.com', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login() -> devolve tokens e atualiza refreshTokenHash', async () => {
    const reg = await auth.register('auth2@test.com', 'StrongPass1!', 'Auth2');

    const login = await auth.login('auth2@test.com', 'StrongPass1!');
    expect(login.accessToken).toBeDefined();
    expect(login.refreshToken).toBeDefined();

    const after = await prisma.user.findUnique({ where: { id: reg.user.id } });
    expect(after!.refreshTokenHash).toBeTruthy();
  });

  it('refresh() -> troca tokens se refresh válido', async () => {
    const reg = await auth.register('auth3@test.com', 'StrongPass1!', 'Auth3');

    const tokens = await auth.refresh(reg.user.id, reg.refreshToken);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });

  it('refresh() -> falha se refresh inválido', async () => {
    const reg = await auth.register('auth4@test.com', 'StrongPass1!', 'Auth4');

    await expect(auth.refresh(reg.user.id, 'INVALID')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout() -> limpa refreshTokenHash', async () => {
    const reg = await auth.register('auth5@test.com', 'StrongPass1!', 'Auth5');

    await auth.logout(reg.user.id);

    const db = await prisma.user.findUnique({ where: { id: reg.user.id } });
    expect(db!.refreshTokenHash).toBeNull();
  });

  it('requestPasswordReset() + resetPassword() -> altera password', async () => {
    await auth.register('auth6@test.com', 'StrongPass1!', 'Auth6');

    const reset = await auth.requestPasswordReset('auth6@test.com');
    expect(reset.success).toBe(true);
    expect(reset.testToken).toBeDefined();

    const token = reset.testToken!;

    const ok = await auth.resetPassword(token, 'NewPass1!');
    expect(ok).toEqual({ success: true });

    await expect(auth.resetPassword(token, 'X')).rejects.toBeInstanceOf(BadRequestException);

    await expect(auth.login('auth6@test.com', 'StrongPass1!')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const login2 = await auth.login('auth6@test.com', 'NewPass1!');
    expect(login2.accessToken).toBeDefined();
  });
});
