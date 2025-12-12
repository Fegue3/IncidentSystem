import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import { UsersRepository } from '../../src/users/users.repository';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async () => 'HASHED'),
  compare: jest.fn(async () => true),
}));

jest.mock('crypto', () => ({
  randomBytes: () => ({ toString: () => 'RAW_RESET_TOKEN' }),
}));

describe('AuthService (unit)', () => {
  let service: AuthService;

  const usersMock = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    validatePassword: jest.fn(),
    changePassword: jest.fn(),
  };

  const repoMock: any = {
    prisma: { user: { findMany: jest.fn() } }, // usado em resetPassword()
    setRefreshToken: jest.fn(),
    delete: jest.fn(),
    setPassword: jest.fn(),
    setResetToken: jest.fn(),
    clearResetToken: jest.fn(),
  };

  const jwtMock = {
    sign: jest.fn(() => 'TOKEN'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'b';

    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: UsersRepository, useValue: repoMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = mod.get(AuthService);
  });

  it('register -> cria user, gera tokens, grava refresh hash', async () => {
    usersMock.create.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      name: 'A',
      role: 'USER',
    });

    const res = await service.register('a@a.com', 'StrongPass1!', 'A');

    expect(usersMock.create).toHaveBeenCalledWith('a@a.com', 'StrongPass1!', 'A');
    expect(repoMock.setRefreshToken).toHaveBeenCalledWith('u1', 'HASHED');
    expect(res.user.id).toBe('u1');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it('login -> email não existe => Unauthorized', async () => {
    usersMock.findByEmail.mockResolvedValue(null);

    await expect(service.login('x@x.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login -> password inválida => Unauthorized', async () => {
    usersMock.findByEmail.mockResolvedValue({ id: 'u1', password: 'HASH', role: 'USER' });
    usersMock.validatePassword.mockResolvedValue(false);

    await expect(service.login('a@a.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login -> ok => grava refresh hash e devolve tokens', async () => {
    usersMock.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      name: 'A',
      role: 'USER',
      password: 'HASH',
    });
    usersMock.validatePassword.mockResolvedValue(true);

    const res = await service.login('a@a.com', 'pw');

    expect(repoMock.setRefreshToken).toHaveBeenCalledWith('u1', 'HASHED');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it('logout -> limpa refresh hash', async () => {
    const res = await service.logout('u1');
    expect(repoMock.setRefreshToken).toHaveBeenCalledWith('u1', null);
    expect(res).toEqual({ success: true });
  });

  it('refresh -> se user não tem refreshTokenHash => Unauthorized', async () => {
    usersMock.findById.mockResolvedValue({ id: 'u1', refreshTokenHash: null });

    await expect(service.refresh('u1', 'incoming')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh -> ok => devolve novos tokens e atualiza refresh hash', async () => {
    usersMock.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      name: 'A',
      role: 'USER',
      refreshTokenHash: 'SAVED',
    });

    const res = await service.refresh('u1', 'incoming');

    expect(repoMock.setRefreshToken).toHaveBeenCalledWith('u1', 'HASHED');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it('changePassword -> delega no UsersService', async () => {
    usersMock.changePassword.mockResolvedValue(undefined);

    const res = await service.changePassword('u1', 'old', 'newStrongPass1!');

    expect(usersMock.changePassword).toHaveBeenCalledWith('u1', 'old', 'newStrongPass1!');
    expect(res).toEqual({ success: true });
  });

  it('deleteAccount -> delega no repo.delete', async () => {
    repoMock.delete.mockResolvedValue(undefined);

    const res = await service.deleteAccount('u1');

    expect(repoMock.delete).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ success: true });
  });

  it('requestPasswordReset -> se user não existe => success true (sem token)', async () => {
    usersMock.findByEmail.mockResolvedValue(null);

    const res = await service.requestPasswordReset('x@x.com');

    expect(res).toEqual({ success: true });
    expect(repoMock.setResetToken).not.toHaveBeenCalled();
  });

  it('requestPasswordReset -> se user existe => grava reset token hash + expiração e devolve testToken', async () => {
    usersMock.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@a.com' });

    const res = await service.requestPasswordReset('a@a.com');

    expect(repoMock.setResetToken).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.testToken).toBe('RAW_RESET_TOKEN');
  });

  it('resetPassword -> se nenhum token bater => BadRequestException', async () => {
    // compare() mocked to true por default -> forçamos false aqui
    const bcrypt = require('bcrypt');
    bcrypt.compare.mockResolvedValue(false);

    repoMock.prisma.user.findMany.mockResolvedValue([
      { id: 'u1', resetTokenHash: 'H1' },
    ]);

    await expect(service.resetPassword('incoming', 'StrongPass1!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resetPassword -> encontra match => setPassword + clearResetToken', async () => {
    const bcrypt = require('bcrypt');
    bcrypt.compare.mockResolvedValueOnce(true);

    repoMock.prisma.user.findMany.mockResolvedValue([
      { id: 'u1', resetTokenHash: 'H1' },
    ]);

    const res = await service.resetPassword('incoming', 'StrongPass1!');

    expect(repoMock.setPassword).toHaveBeenCalledWith('u1', 'HASHED');
    expect(repoMock.clearResetToken).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ success: true });
  });
});
