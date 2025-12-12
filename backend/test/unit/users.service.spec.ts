import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../src/users/users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService (unit)', () => {
  let service: UsersService;

  const repoMock: any = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    setPassword: jest.fn(),
  };

  const bcryptMock = bcrypt as unknown as {
    hash: jest.Mock;
    compare: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(repoMock);
  });

  it('create -> falha se email já existe', async () => {
    repoMock.findByEmail.mockResolvedValueOnce({ id: 'u1' });

    await expect(service.create('a@a.com', 'pass', 'Ana')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('create -> cria user com password hash', async () => {
    repoMock.findByEmail.mockResolvedValueOnce(null);
    repoMock.create.mockResolvedValueOnce({ id: 'u1', email: 'a@a.com' });

    bcryptMock.hash.mockResolvedValueOnce('HASH');

    const res = await service.create('a@a.com', 'pass', 'Ana');

    expect(repoMock.create).toHaveBeenCalled();
    expect(res.id).toBe('u1');
  });

  it('validatePassword -> false quando bcrypt.compare falha', async () => {
    bcryptMock.compare.mockResolvedValueOnce(false);

    const ok = await service.validatePassword('plain', 'HASH');

    expect(ok).toBe(false);
  });

  it('validatePassword -> true quando bcrypt.compare ok', async () => {
    bcryptMock.compare.mockResolvedValueOnce(true);

    await expect(service.validatePassword('plain', 'HASH')).resolves.toBe(true);
  });

  it('changePassword -> NotFound se user não existe', async () => {
    repoMock.findById.mockResolvedValueOnce(null);

    await expect(service.changePassword('u1', 'old', 'new')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('changePassword -> BadRequest se oldPassword inválida', async () => {
    repoMock.findById.mockResolvedValueOnce({ id: 'u1', password: 'HASH' });
    bcryptMock.compare.mockResolvedValueOnce(false);

    await expect(service.changePassword('u1', 'old', 'new')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('changePassword -> ok => setPassword com hash novo', async () => {
    repoMock.findById.mockResolvedValueOnce({ id: 'u1', password: 'HASH' });
    bcryptMock.compare.mockResolvedValueOnce(true);
    bcryptMock.hash.mockResolvedValueOnce('NEW_HASH');

    await service.changePassword('u1', 'old', 'newStrongPass1!');

    expect(repoMock.setPassword).toHaveBeenCalledWith('u1', 'NEW_HASH');
  });
});
