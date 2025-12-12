import { UsersService } from '../../src/users/users.service';
import { UsersRepository } from '../../src/users/users.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async () => 'HASHED'),
  compare: jest.fn(async () => true),
}));

describe('UsersService (unit)', () => {
  let service: UsersService;

  const repoMock = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    setPassword: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(repoMock as unknown as UsersRepository);
  });

  it('create -> se email já existe => BadRequest', async () => {
    repoMock.findByEmail.mockResolvedValue({ id: 'u1' });

    await expect(service.create('a@a.com', 'pw')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create -> cria user com name default "" e password hash', async () => {
    repoMock.findByEmail.mockResolvedValue(null);
    repoMock.create.mockResolvedValue({ id: 'u1' });

    await service.create('a@a.com', 'pw');

    expect(repoMock.create).toHaveBeenCalledWith({
      email: 'a@a.com',
      password: 'HASHED',
      name: '',
      role: 'USER',
    });
  });

  it('changePassword -> user não existe => NotFound', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.changePassword('u1', 'old', 'new')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('changePassword -> old password inválida => BadRequest', async () => {
    const bcrypt = require('bcrypt');
    bcrypt.compare.mockResolvedValue(false);

    repoMock.findById.mockResolvedValue({ id: 'u1', password: 'HASH' });

    await expect(service.changePassword('u1', 'old', 'new')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('changePassword -> ok => setPassword com hash novo', async () => {
    repoMock.findById.mockResolvedValue({ id: 'u1', password: 'HASH' });

    await service.changePassword('u1', 'old', 'newStrongPass1!');

    expect(repoMock.setPassword).toHaveBeenCalledWith('u1', 'HASHED');
  });
});
