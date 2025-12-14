import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { CreateIncidentDto } from '../../src/incidents/dto/create-incident.dto';
import { Severity, IncidentStatus } from '@prisma/client';

describe('NotificationsService Integration - Incident Creation (NEW)', () => {
  let service: IncidentsService;
  let notificationsService: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    const tx: any = {
      incident: { create: jest.fn() },
      incidentTimelineEvent: { create: jest.fn(), createMany: jest.fn() },
      notificationSubscription: { create: jest.fn() },
      categoryOnIncident: { deleteMany: jest.fn() },
      service: { findUnique: jest.fn() },
    };

    const prismaMock: any = {
      incident: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
      service: { findUnique: jest.fn() },
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') return arg(tx);
        return Promise.all(arg);
      }),
      __tx: tx,
    };

    const notificationsMock = {
      sendDiscord: jest.fn().mockResolvedValue({ ok: true }),
      triggerPagerDuty: jest.fn().mockResolvedValue({ ok: true }),
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
          useValue: notificationsMock,
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Incident creation with SEV1/SEV2 triggers notifications', () => {
    it('deve enviar Discord quando severidade é SEV1', async () => {
      const dto: CreateIncidentDto = {
        title: 'Critical Database Failure',
        description: 'Production DB is down',
        severity: Severity.SEV1,
        teamId: 'team-1',
        assigneeId: 'user-1',
      };

      const createdIncident = {
        id: 'inc-1',
        title: dto.title,
        description: dto.description,
        status: IncidentStatus.NEW,
        severity: dto.severity,
        reporterId: 'user-1',
        primaryServiceId: 'svc-1',
        teamId: 'team-1',
        assigneeId: 'user-1',
        primaryService: { name: 'PostgreSQL', ownerTeam: null },
        team: { name: 'SRE' },
        assignee: { name: 'User One', email: 'user1@test.com' },
        reporter: { name: 'Reporter', email: 'rep@test.com' },
      };

      prisma.__tx.incident.create.mockResolvedValue(createdIncident);
      prisma.__tx.incidentTimelineEvent.create.mockResolvedValue({});
      prisma.__tx.incidentTimelineEvent.createMany.mockResolvedValue({ count: 1 });
      prisma.__tx.notificationSubscription.create.mockResolvedValue({});

      process.env.FRONTEND_BASE_URL = 'http://localhost:5173';

      await service.create(dto, 'user-1');

      expect(notificationsService.sendDiscord).toHaveBeenCalledWith(
        expect.stringContaining('🚨 **SEV1**')
      );
      expect(notificationsService.triggerPagerDuty).toHaveBeenCalledWith(
        'Critical Database Failure',
        Severity.SEV1,
        'inc-1'
      );
    });

    it('deve enviar Discord quando severidade é SEV2', async () => {
      const dto: CreateIncidentDto = {
        title: 'High Latency on API Gateway',
        description: 'API response time is very slow',
        severity: Severity.SEV2,
        teamId: 'team-2',
      };

      const createdIncident = {
        id: 'inc-2',
        title: dto.title,
        description: dto.description,
        status: IncidentStatus.NEW,
        severity: dto.severity,
        reporterId: 'user-2',
        primaryServiceId: 'svc-2',
        teamId: 'team-2',
        assigneeId: null,
        primaryService: { name: 'API Gateway', ownerTeam: null },
        team: { name: 'NOC' },
        assignee: null,
        reporter: { name: 'Reporter', email: 'rep@test.com' },
      };

      prisma.__tx.incident.create.mockResolvedValue(createdIncident);
      prisma.__tx.incidentTimelineEvent.create.mockResolvedValue({});
      prisma.__tx.incidentTimelineEvent.createMany.mockResolvedValue({ count: 1 });
      prisma.__tx.notificationSubscription.create.mockResolvedValue({});

      process.env.FRONTEND_BASE_URL = 'http://localhost:5173';

      await service.create(dto, 'user-2');

      expect(notificationsService.sendDiscord).toHaveBeenCalledWith(
        expect.stringContaining('🚨 **SEV2**')
      );
      expect(notificationsService.triggerPagerDuty).toHaveBeenCalledWith(
        'High Latency on API Gateway',
        Severity.SEV2,
        'inc-2'
      );
    });

    it('NÃO deve enviar notificações quando severidade é SEV3', async () => {
      const dto: CreateIncidentDto = {
        title: 'Low Priority Issue',
        description: 'Minor performance issue',
        severity: Severity.SEV3,
        teamId: 'team-1',
      };

      const createdIncident = {
        id: 'inc-3',
        ...dto,
        status: IncidentStatus.NEW,
        reporterId: 'user-1',
        primaryServiceId: null,
        teamId: 'team-1',
        assigneeId: null,
        primaryService: null,
        team: { name: 'SRE' },
        assignee: null,
        reporter: { name: 'Reporter', email: 'rep@test.com' },
      };

      prisma.__tx.incident.create.mockResolvedValue(createdIncident);
      prisma.__tx.incidentTimelineEvent.create.mockResolvedValue({});
      prisma.__tx.notificationSubscription.create.mockResolvedValue({});

      await service.create(dto, 'user-1');

      // SEV3 não dispara notificações
      expect(notificationsService.sendDiscord).not.toHaveBeenCalled();
      expect(notificationsService.triggerPagerDuty).not.toHaveBeenCalled();
    });

    it('NÃO deve enviar notificações quando severidade é SEV4', async () => {
      const dto: CreateIncidentDto = {
        title: 'Very Low Priority',
        description: 'Minimal issue',
        severity: Severity.SEV4,
      };

      const createdIncident = {
        id: 'inc-4',
        ...dto,
        status: IncidentStatus.NEW,
        reporterId: 'user-1',
        primaryServiceId: null,
        assigneeId: null,
        teamId: null,
        primaryService: null,
        team: null,
        assignee: null,
        reporter: { name: 'Reporter', email: 'rep@test.com' },
      };

      prisma.__tx.incident.create.mockResolvedValue(createdIncident);
      prisma.__tx.incidentTimelineEvent.create.mockResolvedValue({});
      prisma.__tx.notificationSubscription.create.mockResolvedValue({});

      await service.create(dto, 'user-1');

      // SEV4 não dispara notificações
      expect(notificationsService.sendDiscord).not.toHaveBeenCalled();
      expect(notificationsService.triggerPagerDuty).not.toHaveBeenCalled();
    });

    it('deve incluir FRONTEND_BASE_URL na mensagem Discord', async () => {
      const dto: CreateIncidentDto = {
        title: 'Critical Issue',
        description: 'Something is down',
        severity: Severity.SEV1,
        teamId: 'team-1',
      };

      const createdIncident = {
        id: 'inc-5',
        ...dto,
        status: IncidentStatus.NEW,
        reporterId: 'user-1',
        primaryServiceId: null,
        assigneeId: null,
        teamId: 'team-1',
        primaryService: null,
        team: { name: 'SRE' },
        assignee: null,
        reporter: { name: 'Reporter', email: 'rep@test.com' },
      };

      prisma.__tx.incident.create.mockResolvedValue(createdIncident);
      prisma.__tx.incidentTimelineEvent.create.mockResolvedValue({});
      prisma.__tx.incidentTimelineEvent.createMany.mockResolvedValue({ count: 1 });
      prisma.__tx.notificationSubscription.create.mockResolvedValue({});

      process.env.FRONTEND_BASE_URL = 'http://localhost:5173';

      await service.create(dto, 'user-1');

      expect(notificationsService.sendDiscord).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:5173/incidents/inc-5')
      );
    });
  });

  afterEach(() => {
    delete process.env.FRONTEND_BASE_URL;
    jest.clearAllMocks();
  });
});
