import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UsersService } from '../../src/users/users.service';
import { TeamsService } from '../../src/teams/teams.service';
import { resetDb } from './_helpers/prisma-reset';
import { NotFoundException } from '@nestjs/common';

describe('Teams (integration)', () => {
  let prisma: PrismaService;
  let users: UsersService;
  let teams: TeamsService;
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
    teams = mod.get(TeamsService);

    await resetDb(prisma);
  }, 30000);

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await mod?.close?.();
  });

  it('create() -> cria team com membros (connect)', async () => {
    const u1 = await users.create('t1@test.com', 'Pass1!', 'T1');
    const u2 = await users.create('t2@test.com', 'Pass1!', 'T2');

    const team = await teams.create({ name: 'NOC', memberIds: [u1.id, u2.id] } as any);

    const db = await prisma.team.findUnique({
      where: { id: team.id },
      include: { members: true },
    });

    expect(db).toBeTruthy();
    expect(db!.members.map((m) => m.id).sort()).toEqual([u1.id, u2.id].sort());
  });

  it('addMember() + removeMember() -> liga e desliga user', async () => {
    const u1 = await users.create('a1@test.com', 'Pass1!', 'A1');
    const u2 = await users.create('a2@test.com', 'Pass1!', 'A2');

    const team = await teams.create({ name: 'SRE', memberIds: [u1.id] } as any);

    const updated = await teams.addMember(team.id, u2.id);
    expect(updated.members.some((m) => m.id === u2.id)).toBe(true);

    const updated2 = await teams.removeMember(team.id, u2.id);
    expect(updated2.members.some((m) => m.id === u2.id)).toBe(false);
  });

  it('addMember() -> NotFound se team não existir', async () => {
    const u = await users.create('x@test.com', 'Pass1!', 'X');

    await expect(
      teams.addMember('team-does-not-exist', u.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update() com memberIds -> faz reset completo de membros', async () => {
    const u1 = await users.create('r1@test.com', 'Pass1!', 'R1');
    const u2 = await users.create('r2@test.com', 'Pass1!', 'R2');
    const u3 = await users.create('r3@test.com', 'Pass1!', 'R3');

    const team = await teams.create({ name: 'OPS', memberIds: [u1.id, u2.id] } as any);

    const updated = await teams.update(team.id, { memberIds: [u3.id] } as any);

    expect(updated.members.map((m) => m.id)).toEqual([u3.id]);
  });
});
