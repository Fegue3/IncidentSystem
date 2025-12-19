/**
 * @file test/unit/auth.controller.spec.ts
 * @module tests/unit/auth-controller
 *
 * @summary
 *  - Testes unitários do AuthController (camada HTTP/controller).
 *
 * @description
 *  - Garante que o controller delega corretamente no AuthService.
 *  - Testa a leitura de dados a partir de:
 *    - body DTOs (register/login/change/reset),
 *    - req.user (logout/me/refresh via guard).
 *
 * @dependencies
 *  - @nestjs/testing: instância isolada do controller.
 *  - AuthService: mockado para validar delegação e argumentos.
 *
 * @security
 *  - Os guards não são executados aqui; simulamos req.user como payload autenticado.
 *
 * @testability
 *  - Testes focados em: "inputs do controller -> chamada service -> output do controller".
 */
import { Test } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthController (unit)', () => {
  let controller: AuthController;

  /**
   * Password “dummy” apenas para testes.
   * Não é segredo (não usar em produção).
   */
  const TEST_PASS = 'TEST_PASSWORD__NOT_A_SECRET';

  const authMock = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    changePassword: jest.fn(),
    deleteAccount: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authMock }],
    }).compile();

    controller = mod.get(AuthController);
  });

  it('register delega para auth.register', async () => {
    authMock.register.mockResolvedValue({ ok: true });

    const res = await controller.register({
      email: 'a@a.com',
      password: TEST_PASS,
      name: 'Ana',
    } as any);

    expect(authMock.register).toHaveBeenCalledWith('a@a.com', TEST_PASS, 'Ana');
    expect(res).toEqual({ ok: true });
  });

  it('login delega para auth.login', async () => {
    authMock.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });

    const res = await controller.login({ email: 'a@a.com', password: TEST_PASS } as any);

    expect(authMock.login).toHaveBeenCalledWith('a@a.com', TEST_PASS);
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it('logout usa req.user.sub', async () => {
    authMock.logout.mockResolvedValue({ ok: true });

    const res = await controller.logout({ user: { sub: 'u1' } } as any);

    expect(authMock.logout).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ ok: true });
  });

  it('refresh usa refreshToken do body quando existe', async () => {
    authMock.refresh.mockResolvedValue({ accessToken: 'new' });

    const res = await controller.refresh(
      { user: { sub: 'u1', refreshToken: 'fromGuard' } } as any,
      { refreshToken: 'fromBody' },
    );

    expect(authMock.refresh).toHaveBeenCalledWith('u1', 'fromBody');
    expect(res).toEqual({ accessToken: 'new' });
  });

  it('refresh fallback para req.user.refreshToken (guard)', async () => {
    authMock.refresh.mockResolvedValue({ accessToken: 'new' });

    const res = await controller.refresh(
      { user: { sub: 'u1', refreshToken: 'fromGuard' } } as any,
      {},
    );

    expect(authMock.refresh).toHaveBeenCalledWith('u1', 'fromGuard');
    expect(res).toEqual({ accessToken: 'new' });
  });

  it('me devolve user + teamId null se não existir', () => {
    const res = controller.me({ user: { sub: 'u1', email: 'u@u.com', role: 'USER' } } as any);
    expect(res).toEqual({ userId: 'u1', email: 'u@u.com', role: 'USER', teamId: null });
  });

  it('changePassword delega', async () => {
    authMock.changePassword.mockResolvedValue({ ok: true });

    const res = await controller.changePassword(
      { user: { sub: 'u1' } } as any,
      { oldPassword: TEST_PASS, newPassword: 'NEW_TEST_PASSWORD__NOT_A_SECRET' } as any,
    );

    expect(authMock.changePassword).toHaveBeenCalledWith(
      'u1',
      TEST_PASS,
      'NEW_TEST_PASSWORD__NOT_A_SECRET',
    );
    expect(res).toEqual({ ok: true });
  });

  it('deleteAccount delega', async () => {
    authMock.deleteAccount.mockResolvedValue({ deleted: true });

    const res = await controller.deleteAccount({ user: { sub: 'u1' } } as any);

    expect(authMock.deleteAccount).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ deleted: true });
  });

  it('requestReset delega', async () => {
    authMock.requestPasswordReset.mockResolvedValue({ ok: true });

    const res = await controller.requestReset({ email: 'u@u.com' });

    expect(authMock.requestPasswordReset).toHaveBeenCalledWith('u@u.com');
    expect(res).toEqual({ ok: true });
  });

  it('resetPassword delega', async () => {
    authMock.resetPassword.mockResolvedValue({ ok: true });

    const res = await controller.resetPassword({
      token: 't',
      newPassword: 'RESET_TEST_PASSWORD__NOT_A_SECRET',
    } as any);

    expect(authMock.resetPassword).toHaveBeenCalledWith('t', 'RESET_TEST_PASSWORD__NOT_A_SECRET');
    expect(res).toEqual({ ok: true });
  });
});
