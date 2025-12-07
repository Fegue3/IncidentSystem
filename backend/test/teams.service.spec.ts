import { NotFoundException } from '@nestjs/common';
import { TeamsService } from '../src/teams/teams.service';
import { PrismaService } from '../src/prisma/prisma.service';

// mock simples do Prisma
const createMockPrisma = () => ({
  team: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
});

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TeamsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------- create ----------

  it('cria equipa só com name', async () => {
    const dto = { name: 'NOC 24/7' };
    const created = { id: 'team-1', name: 'NOC 24/7' };

    prisma.team.create.mockResolvedValue(created);

    const result = await service.create(dto as any);

    expect(prisma.team.create).toHaveBeenCalledWith({
      data: {
        name: 'NOC 24/7',
      },
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
    expect(result).toBe(created);
  });

  it('cria equipa com membros ligados', async () => {
    const dto = { name: 'SRE', memberIds: ['u1', 'u2'] };
    prisma.team.create.mockResolvedValue({ id: 'team-2', name: 'SRE' });

    await service.create(dto as any);

    expect(prisma.team.create).toHaveBeenCalledWith({
      data: {
        name: 'SRE',
        members: {
          connect: [{ id: 'u1' }, { id: 'u2' }],
        },
      },
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  });

  // ---------- findAll / findForUser ----------

  it('lista equipas sem filtro', async () => {
    prisma.team.findMany.mockResolvedValue([]);

    await service.findAll({} as any);

    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  });

  it('aplica filtro search por nome', async () => {
    prisma.team.findMany.mockResolvedValue([]);

    await service.findAll({ search: 'noc' } as any);

    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: {
        name: {
          contains: 'noc',
          mode: 'insensitive',
        },
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  });

  it('lista equipas em que o utilizador é membro', async () => {
    prisma.team.findMany.mockResolvedValue([]);

    await service.findForUser('user-1');

    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: {
        members: {
          some: { id: 'user-1' },
        },
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  });

  // ---------- findOne / listMembers ----------

  it('findOne devolve equipa quando existe', async () => {
    const team = { id: 'team-1', name: 'NOC' };
    prisma.team.findUnique.mockResolvedValue(team);

    const result = await service.findOne('team-1');

    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      include: {
        members: true,
        _count: {
          select: { incidents: true, members: true },
        },
      },
    });
    expect(result).toBe(team);
  });

  it('findOne lança NotFound se não existir', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(service.findOne('team-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('listMembers devolve membros da equipa', async () => {
    const members = [{ id: 'u1' }, { id: 'u2' }];
    prisma.team.findUnique.mockResolvedValue({
      id: 'team-1',
      name: 'NOC',
      members,
    });

    const result = await service.listMembers('team-1');

    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      include: { members: true },
    });
    expect(result).toBe(members);
  });

  it('listMembers lança NotFound se equipa não existir', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(service.listMembers('team-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ---------- addMember / removeMember ----------

  it('addMember liga user à equipa', async () => {
    prisma.team.findUnique
      .mockResolvedValueOnce({ id: 'team-1' }) // equipa existe
      .mockResolvedValueOnce({ id: 'team-1' }); // chamada interna não usada, mas ok
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.team.update.mockResolvedValue({
      id: 'team-1',
      members: [{ id: 'u1' }],
    });

    const result = await service.addMember('team-1', 'u1');

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: {
        members: {
          connect: { id: 'u1' },
        },
      },
      include: {
        members: true,
      },
    });
    expect(result).toEqual({ id: 'team-1', members: [{ id: 'u1' }] });
  });

  it('addMember falha se equipa não existir', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(service.addMember('team-x', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('addMember falha se user não existir', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1' });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.addMember('team-1', 'u-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removeMember desliga user da equipa', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1' });
    prisma.team.update.mockResolvedValue({
      id: 'team-1',
      members: [],
    });

    const result = await service.removeMember('team-1', 'u1');

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: {
        members: {
          disconnect: { id: 'u1' },
        },
      },
      include: {
        members: true,
      },
    });
    expect(result).toEqual({ id: 'team-1', members: [] });
  });

  it('removeMember falha se equipa não existir', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(service.removeMember('team-x', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ---------- update / remove ----------

  it('update renomeia equipa', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1', name: 'Old' });
    prisma.team.update.mockResolvedValue({
      id: 'team-1',
      name: 'New',
      members: [],
      _count: { members: 0, incidents: 0 },
    });

    const result = await service.update('team-1', { name: 'New' } as any);

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { name: 'New' },
      include: {
        members: true,
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
    expect(result.name).toBe('New');
  });

  it('update pode fazer reset de membros', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1', name: 'NOC' });

    await service.update('team-1', { memberIds: ['u1', 'u2'] } as any);

    expect(prisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          members: {
            set: [{ id: 'u1' }, { id: 'u2' }],
          },
        },
      }),
    );
  });

  it('update lança NotFound se equipa não existir', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(
      service.update('team-x', { name: 'New' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove apaga equipa existente', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1' });
    prisma.team.delete.mockResolvedValue({ id: 'team-1' });

    const result = await service.remove('team-1');

    expect(prisma.team.delete).toHaveBeenCalledWith({
      where: { id: 'team-1' },
    });
    expect(result).toEqual({ deleted: true });
  });

  it('remove lança NotFound se equipa não existir', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(service.remove('team-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
