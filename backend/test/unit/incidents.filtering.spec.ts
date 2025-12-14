import { Test, TestingModule } from '@nestjs/testing';
import { IncidentStatus, Severity } from '@prisma/client';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { ListIncidentsDto } from '../../src/incidents/dto/list-incidents.dto';

describe('IncidentsService - Filtering & Search (NEW)', () => {
  let service: IncidentsService;
  let prisma: any;

  const mockIncidents = [
    {
      id: 'inc-1',
      title: 'Database connection timeout',
      description: 'DB not responding',
      status: IncidentStatus.NEW,
      severity: Severity.SEV1,
      teamId: 'team-1',
      assigneeId: 'user-1',
      primaryServiceId: 'svc-1',
      createdAt: new Date('2024-12-01'),
      reporter: { id: 'user-0', email: 'reporter@test.com' },
      assignee: { id: 'user-1', email: 'user1@test.com' },
      team: { id: 'team-1', name: 'SRE' },
      primaryService: { id: 'svc-1', key: 'postgres', name: 'PostgreSQL' },
    },
    {
      id: 'inc-2',
      title: 'API Gateway latency',
      description: 'High latency observed',
      status: IncidentStatus.IN_PROGRESS,
      severity: Severity.SEV2,
      teamId: 'team-2',
      assigneeId: 'user-2',
      primaryServiceId: 'svc-2',
      createdAt: new Date('2024-12-02'),
      reporter: { id: 'user-0', email: 'reporter@test.com' },
      assignee: { id: 'user-2', email: 'user2@test.com' },
      team: { id: 'team-2', name: 'NOC' },
      primaryService: { id: 'svc-2', key: 'api-gateway', name: 'API Gateway' },
    },
    {
      id: 'inc-3',
      title: 'Redis cache miss spike',
      description: 'Cache performance degradation',
      status: IncidentStatus.RESOLVED,
      severity: Severity.SEV3,
      teamId: 'team-1',
      assigneeId: null,
      primaryServiceId: 'svc-3',
      createdAt: new Date('2024-12-03'),
      reporter: { id: 'user-0', email: 'reporter@test.com' },
      assignee: null,
      team: { id: 'team-1', name: 'SRE' },
      primaryService: { id: 'svc-3', key: 'redis', name: 'Redis' },
    },
  ];

  beforeEach(async () => {
    const prismaMock: any = {
      incident: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      service: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') return arg({});
        return Promise.all(arg);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: NotificationsService,
          useValue: {
            sendDiscord: jest.fn().mockResolvedValue({ ok: true }),
            triggerPagerDuty: jest.fn().mockResolvedValue({ ok: true }),
          },
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll with filters', () => {
    it('deve filtrar por status', async () => {
      const query: ListIncidentsDto = { status: IncidentStatus.NEW };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: IncidentStatus.NEW }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve filtrar por severidade', async () => {
      const query: ListIncidentsDto = { severity: Severity.SEV1 };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ severity: Severity.SEV1 }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve filtrar por assigneeId', async () => {
      const query: ListIncidentsDto = { assigneeId: 'user-1' };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ assigneeId: 'user-1' }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve filtrar por teamId', async () => {
      const query: ListIncidentsDto = { teamId: 'team-1' };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0], mockIncidents[2]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ teamId: 'team-1' }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve filtrar por primaryServiceId', async () => {
      const query: ListIncidentsDto = { primaryServiceId: 'svc-1' };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ primaryServiceId: 'svc-1' }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve filtrar por primaryServiceKey e resolver para ID', async () => {
      const query: ListIncidentsDto = { primaryServiceKey: 'postgres' };
      prisma.service.findUnique.mockResolvedValue({ id: 'svc-1', key: 'postgres' });
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.service.findUnique).toHaveBeenCalledWith({
        where: { key: 'postgres' },
        select: { id: true },
      });

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ primaryServiceId: 'svc-1' }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve retornar vazio se primaryServiceKey não existir', async () => {
      const query: ListIncidentsDto = { primaryServiceKey: 'nonexistent' };
      prisma.service.findUnique.mockResolvedValue(null);

      const result = await service.findAll(query);

      expect(result).toEqual([]);
    });
  });

  describe('findAll with search', () => {
    it('deve pesquisar por title (case-insensitive)', async () => {
      const query: ListIncidentsDto = { search: 'database' };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'database', mode: 'insensitive' } },
            { description: { contains: 'database', mode: 'insensitive' } },
          ],
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve pesquisar por description (case-insensitive)', async () => {
      const query: ListIncidentsDto = { search: 'responding' };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'responding', mode: 'insensitive' } },
            { description: { contains: 'responding', mode: 'insensitive' } },
          ],
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('findAll with combined filters', () => {
    it('deve combinar status + severity + search', async () => {
      const query: ListIncidentsDto = {
        status: IncidentStatus.NEW,
        severity: Severity.SEV1,
        search: 'database',
      };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: IncidentStatus.NEW,
          severity: Severity.SEV1,
          OR: [
            { title: { contains: 'database', mode: 'insensitive' } },
            { description: { contains: 'database', mode: 'insensitive' } },
          ],
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve combinar teamId + status + primaryServiceKey', async () => {
      const query: ListIncidentsDto = {
        teamId: 'team-1',
        status: IncidentStatus.NEW,
        primaryServiceKey: 'postgres',
      };
      prisma.service.findUnique.mockResolvedValue({ id: 'svc-1' });
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          teamId: 'team-1',
          status: IncidentStatus.NEW,
          primaryServiceId: 'svc-1',
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('findAll with date range', () => {
    it('deve filtrar por createdFrom', async () => {
      const from = new Date('2024-12-02');
      const query: ListIncidentsDto = { createdFrom: from };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[1], mockIncidents[2]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: from }),
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve filtrar por createdTo', async () => {
      const to = new Date('2024-12-02');
      const query: ListIncidentsDto = { createdTo: to };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0], mockIncidents[1]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lte: to }),
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('deve filtrar por range (createdFrom and createdTo)', async () => {
      const from = new Date('2024-12-01');
      const to = new Date('2024-12-02');
      const query: ListIncidentsDto = { createdFrom: from, createdTo: to };
      prisma.incident.findMany.mockResolvedValue([mockIncidents[0], mockIncidents[1]]);

      await service.findAll(query);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: {
            gte: from,
            lte: to,
          },
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });
});
