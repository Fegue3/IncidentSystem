/**
 * @file incidents.int.spec.ts
 * @module test/integration/incidents
 *
 * @summary
 *  - Testes de integração do IncidentsService (create, changeStatus, comments, delete).
 *
 * @description
 *  Exercita regras de domínio e persistência:
 *  - create aplica defaults (status NEW, severity SEV3) e cria timeline STATUS_CHANGE;
 *  - reporter é automaticamente subscrito (notificationSubscription);
 *  - changeStatus aplica validações de transição e cria timeline + timestamps (triagedAt);
 *  - addComment cria comment e timeline COMMENT;
 *  - delete é permitido apenas ao reporter (Forbidden caso contrário).
 *
 * @dependencies
 *  - AppModule: providers reais.
 *  - PrismaService: asserts diretos e leitura de timeline/subscriptions.
 *  - resetDb: isolamento determinístico.
 *
 * @security
 *  - Permissões de domínio (reporter-only) são verificadas ao nível de service.
 */

import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UsersService } from '../../src/users/users.service';
import { TeamsService } from '../../src/teams/teams.service';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { resetDb } from './_helpers/prisma-reset';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IncidentStatus, Severity, TimelineEventType } from '@prisma/client';

describe('Incidents (integration)', () => {
  let prisma: PrismaService;
  let users: UsersService;
  let teams: TeamsService;
  let incidents: IncidentsService;
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
    incidents = mod.get(IncidentsService);

    await resetDb(prisma);
  }, 30000);

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await mod?.close?.();
  });

  it('create() -> cria incidente + timeline STATUS_CHANGE + subscription do reporter', async () => {
    const reporter = await users.create('rep@test.com', 'Pass1!', 'Rep');
    const assignee = await users.create('asg@test.com', 'Pass1!', 'Asg');
    const team = await teams.create({ name: 'NOC' } as any);

    const created = await incidents.create(
      {
        title: 'DB down',
        description: 'Database unreachable',
        severity: undefined, // default esperado
        assigneeId: assignee.id,
        teamId: team.id,
        categoryIds: [],
        tagIds: [],
      } as any,
      reporter.id,
    );

    const dbIncident = await prisma.incident.findUnique({
      where: { id: created.id },
      include: { reporter: true, assignee: true, team: true },
    });

    expect(dbIncident).toBeTruthy();
    expect(dbIncident!.status).toBe(IncidentStatus.NEW);
    expect(dbIncident!.severity).toBe(Severity.SEV3);

    const events = await prisma.incidentTimelineEvent.findMany({
      where: { incidentId: created.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe(TimelineEventType.STATUS_CHANGE);
    expect(events[0].toStatus).toBe(IncidentStatus.NEW);

    const sub = await prisma.notificationSubscription.findFirst({
      where: { incidentId: created.id, userId: reporter.id },
    });
    expect(sub).toBeTruthy();
  });

  it('changeStatus() NEW -> TRIAGED -> seta triagedAt e cria timeline', async () => {
    const reporter = await users.create('rep2@test.com', 'Pass1!', 'Rep2');

    const inc = await incidents.create(
      {
        title: 'Latency',
        description: 'High latency',
        severity: Severity.SEV2,
        categoryIds: [],
        tagIds: [],
      } as any,
      reporter.id,
    );

    const updated = await incidents.changeStatus(
      inc.id,
      { newStatus: IncidentStatus.TRIAGED, message: 'triagem feita' } as any,
      reporter.id,
    );

    expect(updated.status).toBe(IncidentStatus.TRIAGED);

    const db = await prisma.incident.findUnique({ where: { id: inc.id } });
    expect(db!.triagedAt).toBeTruthy();

    const last = await prisma.incidentTimelineEvent.findFirst({
      where: { incidentId: inc.id, type: TimelineEventType.STATUS_CHANGE },
      orderBy: { createdAt: 'desc' },
    });

    expect(last).toBeTruthy();
    expect(last!.fromStatus).toBe(IncidentStatus.NEW);
    expect(last!.toStatus).toBe(IncidentStatus.TRIAGED);
  });

  it('changeStatus() NEW -> CLOSED -> recusa transição inválida', async () => {
    const reporter = await users.create('rep3@test.com', 'Pass1!', 'Rep3');

    const inc = await incidents.create(
      { title: 'X', description: 'Y', categoryIds: [], tagIds: [] } as any,
      reporter.id,
    );

    await expect(
      incidents.changeStatus(
        inc.id,
        { newStatus: IncidentStatus.CLOSED, message: 'fechar' } as any,
        reporter.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addComment() -> cria comment e timeline COMMENT', async () => {
    const reporter = await users.create('rep4@test.com', 'Pass1!', 'Rep4');

    const inc = await incidents.create(
      { title: 'API', description: 'API errors', categoryIds: [], tagIds: [] } as any,
      reporter.id,
    );

    const c = await incidents.addComment(
      inc.id,
      { body: 'isto está a arder' } as any,
      reporter.id,
    );
    expect(c.id).toBeDefined();

    const timeline = await prisma.incidentTimelineEvent.findFirst({
      where: { incidentId: inc.id, type: TimelineEventType.COMMENT },
      orderBy: { createdAt: 'desc' },
    });

    expect(timeline).toBeTruthy();
    expect(timeline!.message).toContain('isto está a arder');
  });

  it('delete() -> só o reporter pode apagar', async () => {
    const reporter = await users.create('rep5@test.com', 'Pass1!', 'Rep5');
    const other = await users.create('rep6@test.com', 'Pass1!', 'Rep6');

    const inc = await incidents.create(
      { title: 'Delete me', description: '...', categoryIds: [], tagIds: [] } as any,
      reporter.id,
    );

    await expect(incidents.delete(inc.id, other.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const ok = await incidents.delete(inc.id, reporter.id);
    expect(ok).toEqual({ deleted: true });

    const db = await prisma.incident.findUnique({ where: { id: inc.id } });
    expect(db).toBeNull();
  });
});
