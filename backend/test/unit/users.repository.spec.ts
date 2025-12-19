// test/unit/users.repository.spec.ts
/**
 * Unit tests: UsersRepository
 *
 * O que valida:
 * - findByEmail / findById: delega para prisma.user.findUnique
 * - create: inclui role apenas quando fornecida
 * - setRefreshToken / setPassword / setResetToken / clearResetToken: updates corretos
 * - delete: delega para prisma.user.delete
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { UsersRepository } from '../../src/users/users.repository';

describe('UsersRepository (unit)', () => {
  const prismaMock: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let repo: UsersRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new UsersRepository(prismaMock);
  });

  it('findByEmail -> prisma.user.findUnique', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    const res = await repo.findByEmail('a@a.com');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@a.com' } });
    expect(res).toEqual({ id: 'u1' });
  });

  it('findById -> prisma.user.findUnique', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    const res = await repo.findById('u1');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(res).toEqual({ id: 'u1' });
  });

  it('create -> envia role apenas se vier definido', async () => {
    await repo.create({ email: 'a@a.com', name: 'A', password: 'HASH' });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { email: 'a@a.com', name: 'A', password: 'HASH' },
    });

    await repo.create({ email: 'b@b.com', name: 'B', password: 'HASH', role: 'ADMIN' as any });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { email: 'b@b.com', name: 'B', password: 'HASH', role: 'ADMIN' },
    });
  });

  it('setRefreshToken -> update refreshTokenHash', async () => {
    await repo.setRefreshToken('u1', 'H');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { refreshTokenHash: 'H' },
    });
  });

  it('setPassword -> update password', async () => {
    await repo.setPassword('u1', 'P');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'P' },
    });
  });

  it('setResetToken / clearResetToken', async () => {
    const d = new Date();
    await repo.setResetToken('u1', 'T', d);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { resetTokenHash: 'T', resetTokenExpires: d },
    });

    await repo.clearResetToken('u1');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { resetTokenHash: null, resetTokenExpires: null },
    });
  });

  it('delete -> prisma.user.delete', async () => {
    await repo.delete('u1');

    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
