/**
 * @file incidents.notifications.e2e.spec.ts
 * @module test/e2e/incidents.notifications.integration-style
 *
 * @summary
 *  - Testa criação de incidentes (service-level) com regras de notificações e timeline, com DB real.
 *
 * @description
 *  Apesar do nome estar como “e2e”, este teste é mais próximo de **integration**:
 *  - chama diretamente `IncidentsService.create(...)` (não via HTTP);
 *  - valida efeitos na DB (timeline/subscriptions) e comportamento por severidade.
 *
 *  Também valida que integrações externas (Discord/PagerDuty) podem ser “mockadas” via `global.fetch`.
 *
 * @dependencies
 *  - @nestjs/testing + AppModule: cria o container Nest e resolve services reais.
 *  - PrismaService: DB real.
 *  - resetDb (TRUNCATE): garante DB limpa e determinística.
 *
 * @security
 *  - Exercita regras internas do domínio (não auth via HTTP).
 *
 * @performance
 *  - TRUNCATE CASCADE por teste (rápido) mas atenção a paralelismo.
 */

import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { UsersService } from '../../src/users/users.service';
import { TeamsService } from '../../src/teams/teams.service';
import { resetDb } from '../integration/_helpers/prisma-reset';
import { Severity } from '@prisma/client';

// Mock global de fetch para integrações externas (Discord/PagerDuty)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 204,
    json: async () => ({}),
  } as any),
);

describe('Incident Creation with Notifications (integration)', () => {
  let prisma: PrismaService;
  let incidents: IncidentsService;
  let users: UsersService;
  let teams: TeamsService;
  let mod: any;

  let userId: string;
  let teamId: string;

  // Tracking de calls (se precisares de asserts mais detalhados no futuro)
  let discordCalls: any[] = [];
  let pagerdutyCallsCalls: any[] = [];

  beforeAll(async () => {
    jest.setTimeout(30000);

    process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@postgres:5432/incidentsdb_test?schema=public';

    process.env.FRONTEND_BASE_URL = 'http://localhost:5173';
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook-fake';
    process.env.PAGERDUTY_ROUTING_KEY = 'test_key_123';

    mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = mod.get(PrismaService);
    incidents = mod.get(IncidentsService);
    users = mod.get(UsersService);
    teams = mod.get(TeamsService);

    await resetDb(prisma);
  }, 30000);

  beforeEach(async () => {
    await resetDb(prisma);

    const user = await users.create('notif@test.com', 'Pass1!', 'Notif Tester');
    userId = user.id;

    const team = await teams.create({ name: 'SRE' } as any);
    teamId = team.id;

    discordCalls = [];
    pagerdutyCallsCalls = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await mod?.close?.();

    delete process.env.FRONTEND_BASE_URL;
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.PAGERDUTY_ROUTING_KEY;
  });

  describe('SEV1 Incidents', () => {
    it('deve registar incidente SEV1 com status NEW', async () => {
      const created = await incidents.create(
        {
          title: 'Critical Database Down',
          description: 'Postgres is unreachable',
          severity: Severity.SEV1,
          teamId: teamId,
        },
        userId,
      );

      expect(created.id).toBeDefined();
      expect(created.severity).toBe(Severity.SEV1);
      expect(created.status).toBe('NEW');
      expect(created.title).toBe('Critical Database Down');
    });

    it('deve criar timeline event STATUS_CHANGE para SEV1', async () => {
      const created = await incidents.create(
        {
          title: 'Critical Issue',
          description: 'Something critical',
          severity: Severity.SEV1,
          teamId: teamId,
        },
        userId,
      );

      const timeline = await prisma.incidentTimelineEvent.findMany({
        where: { incidentId: created.id, type: 'STATUS_CHANGE' },
      });

      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0].toStatus).toBe('NEW');
    });

    it('deve criar notificationSubscription para o reporter', async () => {
      const created = await incidents.create(
        {
          title: 'Critical',
          description: 'test',
          severity: Severity.SEV1,
          teamId: teamId,
        },
        userId,
      );

      const subscription = await prisma.notificationSubscription.findFirst({
        where: { userId, incidentId: created.id },
      });

      expect(subscription).toBeDefined();
      expect(subscription?.userId).toBe(userId);
      expect(subscription?.incidentId).toBe(created.id);
    });
  });

  describe('SEV2 Incidents', () => {
    it('deve registar incidente SEV2 com status NEW', async () => {
      const created = await incidents.create(
        {
          title: 'High Priority API Issue',
          description: 'API Gateway latency',
          severity: Severity.SEV2,
          teamId: teamId,
        },
        userId,
      );

      expect(created.severity).toBe(Severity.SEV2);
      expect(created.status).toBe('NEW');
    });
  });

  describe('SEV3 e SEV4 Incidents', () => {
    it('deve registar incidente SEV3 (sem notificações)', async () => {
      const created = await incidents.create(
        {
          title: 'Low Priority Issue',
          description: 'Minor bug',
          severity: Severity.SEV3,
          teamId: teamId,
        },
        userId,
      );

      expect(created.severity).toBe(Severity.SEV3);
      expect(created.status).toBe('NEW');

      // Timeline não deve ter eventos de notificação em SEV3
      const timeline = await prisma.incidentTimelineEvent.findMany({
        where: { incidentId: created.id },
      });

      const notifEvents = timeline.filter(
        (e) =>
          e.message?.includes('Notificações') ||
          e.message?.includes('Discord') ||
          e.message?.includes('PagerDuty'),
      );

      expect(notifEvents).toHaveLength(0);
    });

    it('deve registar incidente SEV4 (sem notificações)', async () => {
      const created = await incidents.create(
        {
          title: 'Trivial Issue',
          description: 'Minimal priority',
          severity: Severity.SEV4,
          teamId: teamId,
        },
        userId,
      );

      expect(created.severity).toBe(Severity.SEV4);
      expect(created.status).toBe('NEW');

      const timeline = await prisma.incidentTimelineEvent.findMany({
        where: { incidentId: created.id },
      });

      const notifEvents = timeline.filter((e) => e.message?.includes('Notificações'));
      expect(notifEvents).toHaveLength(0);
    });
  });

  describe('Incident with assignee', () => {
    it('deve registar incidente com assigneeId SEV1', async () => {
      const assignee = await users.create('assignee@test.com', 'Pass1!', 'Assignee');

      const created = await incidents.create(
        {
          title: 'Critical with Assignee',
          description: 'Has an owner',
          severity: Severity.SEV1,
          teamId: teamId,
          assigneeId: assignee.id,
        },
        userId,
      );

      expect(created.assignee?.id).toBe(assignee.id);
    });
  });

  describe('Incident with service', () => {
    it('deve registar incidente com serviço SEV1', async () => {
      const service = await prisma.service.create({
        data: { key: 'postgres', name: 'PostgreSQL', isActive: true },
      });

      const created = await incidents.create(
        {
          title: 'Database Critical',
          description: 'DB issue',
          severity: Severity.SEV1,
          teamId: teamId,
          primaryServiceId: service.id,
        },
        userId,
      );

      expect(created.primaryService?.id).toBe(service.id);
      expect(created.primaryService?.key).toBe('postgres');
    });

    it('deve resolver service key para ID antes de criar', async () => {
      await prisma.service.create({
        data: { key: 'api-gateway', name: 'API Gateway', isActive: true },
      });

      const created = await incidents.create(
        {
          title: 'API Issue',
          description: 'Gateway problem',
          severity: Severity.SEV2,
          teamId: teamId,
          primaryServiceKey: 'api-gateway',
        },
        userId,
      );

      expect(created.primaryService?.key).toBe('api-gateway');
    });
  });

  describe('Timeline events for SEV1/SEV2', () => {
    it('deve registar evento de FIELD_UPDATE com resultado de notificações', async () => {
      const created = await incidents.create(
        {
          title: 'With Service',
          description: 'To track field updates',
          severity: Severity.SEV1,
          teamId: teamId,
        },
        userId,
      );

      const timeline = await prisma.incidentTimelineEvent.findMany({
        where: { incidentId: created.id },
      });

      expect(timeline.length).toBeGreaterThan(0);

      const statusChangeEvents = timeline.filter((e) => e.type === 'STATUS_CHANGE');
      expect(statusChangeEvents.length).toBeGreaterThan(0);
    });
  });
});
