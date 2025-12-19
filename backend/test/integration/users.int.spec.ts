/**
 * @file users.int.spec.ts
 * @module test/integration/users
 *
 * @summary
 *  - Testes de integração do UsersService: create, unique email, changePassword.
 *
 * @description
 *  Valida com DB real:
 *  - create persiste user e guarda password com hash (não plaintext);
 *  - create rejeita email repetido (BadRequest);
 *  - changePassword altera password quando oldPass está correto;
 *  - changePassword falha quando oldPass está errado.
 *
 * @dependencies
 *  - AppModule + UsersService real.
 *  - PrismaService para asserts diretos.
 *  - resetDb para isolamento.
 */

import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UsersService } from '../../src/users/users.service';
import { resetDb } from './_helpers/prisma-reset';
import { BadRequestException } from '@nestjs/common';

describe('Users (integration)', () => {
  let prisma: PrismaService;
  let users: UsersService;
  let mod: any;

  beforeAll(async () => {
    jest.setTimeout(30000);

    process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@postgres:5432/incidentsdb_test?schema=public';

    mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = mod.get(PrismaService);
    users = mod.get(UsersService);

    await resetDb(prisma);
  }, 30000);

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await mod?.close?.();
  });

  it('create() -> cria user e guarda password com hash', async () => {
    const u = await users.create('u1@test.com', 'StrongPass1!', 'User 1');

    expect(u.id).toBeDefined();
    expect(u.email).toBe('u1@test.com');

    const db = await prisma.user.findUnique({ where: { id: u.id } });
    expect(db).toBeTruthy();
    expect(db!.password).not.toBe('StrongPass1!');
  });

  it('create() -> rejeita email repetido', async () => {
    await users.create('dup@test.com', 'StrongPass1!', 'A');

    await expect(users.create('dup@test.com', 'StrongPass1!', 'B')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('changePassword() -> altera password quando oldPass correto', async () => {
    const u = await users.create('cp@test.com', 'OldPass1!', 'CP');

    await users.changePassword(u.id, 'OldPass1!', 'NewPass1!');

    const db = await prisma.user.findUnique({ where: { id: u.id } });
    expect(db).toBeTruthy();
    expect(db!.password).not.toBe('OldPass1!');
  });

  it('changePassword() -> falha quando oldPass errado', async () => {
    const u = await users.create('cp2@test.com', 'OldPass1!', 'CP2');

    await expect(users.changePassword(u.id, 'WRONG', 'NewPass1!')).rejects.toBeTruthy();
  });
});
