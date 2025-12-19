/**
 * @file reports.int.spec.ts
 * @module test/integration/reports
 *
 * @summary
 *  - Testes de integração do ReportsService (KPIs, breakdown e timeseries).
 *
 * @description
 *  Usa PrismaClient real e DB real para validar:
 *  - KPIs: open/resolved/closed + MTTR (avg/median/p90) + SLA compliance;
 *  - breakdown por categoria (labels e contagens);
 *  - timeseries por dia (buckets e contagens).
 *
 * @dependencies
 *  - PrismaClient real.
 *  - resetDb (TRUNCATE).
 *  - ReportsService.
 *
 * @notes
 *  - Este ficheiro usa datas fixas em UTC para métricas determinísticas.
 */

import { PrismaClient, IncidentStatus, Severity } from '@prisma/client';
import { resetDb } from './_helpers/prisma-reset';
import { ReportsService } from '../../src/reports/reports.service';
import { ReportsGroupBy } from '../../src/reports/dto/reports-breakdown.dto';
import { ReportsInterval } from '../../src/reports/dto/reports-timeseries.dto';

describe('Reports (integration)', () => {
  let prisma: PrismaClient;
  let service: ReportsService;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/incidentsdb?schema=public';

    prisma = new PrismaClient();
    await prisma.$connect();
    service = new ReportsService(prisma as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(prisma as any);
  });

  it('kpis: open/resolved/closed + MTTR + SLA', async () => {
    const reporter = await prisma.user.create({
      data: { email: 'rep@x.com', name: 'Reporter', password: 'x' },
    });

    const assignee = await prisma.user.create({
      data: { email: 'ass@x.com', name: 'Assignee', password: 'x' },
    });

    const team = await prisma.team.create({ data: { name: 'Ops' } });

    const svc = await prisma.service.create({
      data: { key: 'public-api', name: 'Public API', ownerTeamId: team.id },
    });

    const catNet = await prisma.category.create({ data: { name: 'Network' } });
    const catDb = await prisma.category.create({ data: { name: 'Database' } });

    // Datas fixas (UTC) para métricas determinísticas
    const i1Created = new Date('2025-01-01T00:00:00.000Z');
    const i1Resolved = new Date('2025-01-01T00:30:00.000Z'); // 1800s

    const i2Created = new Date('2025-01-01T01:00:00.000Z');
    const i2Resolved = new Date('2025-01-01T03:00:00.000Z'); // 7200s

    const i3Created = new Date('2025-01-02T00:00:00.000Z'); // open

    const i4Created = new Date('2025-01-02T00:00:00.000Z');
    const i4Resolved = new Date('2025-01-02T04:00:00.000Z'); // 14400s

    const inc1 = await prisma.incident.create({
      data: {
        title: 'i1',
        description: 'd',
        status: IncidentStatus.RESOLVED,
        severity: Severity.SEV1,
        reporterId: reporter.id,
        assigneeId: assignee.id,
        teamId: team.id,
        primaryServiceId: svc.id,
        createdAt: i1Created,
        resolvedAt: i1Resolved,
      },
    });

    const inc2 = await prisma.incident.create({
      data: {
        title: 'i2',
        description: 'd',
        status: IncidentStatus.RESOLVED,
        severity: Severity.SEV1,
        reporterId: reporter.id,
        assigneeId: assignee.id,
        teamId: team.id,
        primaryServiceId: svc.id,
        createdAt: i2Created,
        resolvedAt: i2Resolved,
      },
    });

    const inc3 = await prisma.incident.create({
      data: {
        title: 'i3',
        description: 'd',
        status: IncidentStatus.IN_PROGRESS,
        severity: Severity.SEV2,
        reporterId: reporter.id,
        teamId: team.id,
        primaryServiceId: svc.id,
        createdAt: i3Created,
      },
    });

    const inc4 = await prisma.incident.create({
      data: {
        title: 'i4',
        description: 'd',
        status: IncidentStatus.CLOSED,
        severity: Severity.SEV3,
        reporterId: reporter.id,
        teamId: team.id,
        primaryServiceId: svc.id,
        createdAt: i4Created,
        resolvedAt: i4Resolved,
        closedAt: new Date('2025-01-02T05:00:00.000Z'),
      },
    });

    await prisma.categoryOnIncident.createMany({
      data: [
        { incidentId: inc1.id, categoryId: catNet.id },
        { incidentId: inc2.id, categoryId: catNet.id },
        { incidentId: inc3.id, categoryId: catDb.id },
        { incidentId: inc4.id, categoryId: catDb.id },
      ],
    });

    const out = await service.getKpis({}, { id: reporter.id, role: 'ADMIN' });

    expect(out.openCount).toBe(1);
    expect(out.resolvedCount).toBe(3);
    expect(out.closedCount).toBe(1);

    // MTTR: (1800 + 7200 + 14400) / 3 = 7800
    expect(out.mttrSeconds.avg).toBeCloseTo(7800, 5);
    expect(out.mttrSeconds.median).toBeCloseTo(7200, 5);
    // p90 em [1800,7200,14400] => 12960 (percentile_cont 0.9)
    expect(out.mttrSeconds.p90).toBeCloseTo(12960, 5);

    // SLA: 2/3 => 66.7%
    expect(out.slaCompliancePct).toBeCloseTo(66.7, 1);
  });

  it('breakdown: category devolve nomes e contagens', async () => {
    const reporter = await prisma.user.create({
      data: { email: 'rep2@x.com', name: 'Reporter2', password: 'x' },
    });

    const catA = await prisma.category.create({ data: { name: 'Network' } });
    const catB = await prisma.category.create({ data: { name: 'Database' } });

    const a = await prisma.incident.create({
      data: { title: 'a', description: 'd', reporterId: reporter.id, severity: Severity.SEV2 },
    });
    const b = await prisma.incident.create({
      data: { title: 'b', description: 'd', reporterId: reporter.id, severity: Severity.SEV2 },
    });

    await prisma.categoryOnIncident.createMany({
      data: [
        { incidentId: a.id, categoryId: catA.id },
        { incidentId: b.id, categoryId: catB.id },
      ],
    });

    const out = await service.getBreakdown(
      { groupBy: ReportsGroupBy.category },
      { id: reporter.id, role: 'ADMIN' },
    );

    expect(out.find((x) => x.label === 'Network')?.count).toBe(1);
    expect(out.find((x) => x.label === 'Database')?.count).toBe(1);
  });

  it('timeseries: buckets por dia', async () => {
    const reporter = await prisma.user.create({
      data: { email: 'rep3@x.com', name: 'Reporter3', password: 'x' },
    });

    await prisma.incident.create({
      data: {
        title: 'd1',
        description: 'd',
        reporterId: reporter.id,
        createdAt: new Date('2025-02-01T10:00:00.000Z'),
      },
    });

    await prisma.incident.create({
      data: {
        title: 'd2',
        description: 'd',
        reporterId: reporter.id,
        createdAt: new Date('2025-02-01T12:00:00.000Z'),
      },
    });

    await prisma.incident.create({
      data: {
        title: 'd3',
        description: 'd',
        reporterId: reporter.id,
        createdAt: new Date('2025-02-02T12:00:00.000Z'),
      },
    });

    const out = await service.getTimeseries(
      {
        interval: ReportsInterval.day,
        from: '2025-02-01T00:00:00.000Z',
        to: '2025-02-03T00:00:00.000Z',
      },
      { id: reporter.id, role: 'ADMIN' },
    );

    expect(out.some((x) => x.date.startsWith('2025-02-01') && x.count === 2)).toBe(true);
    expect(out.some((x) => x.date.startsWith('2025-02-02') && x.count === 1)).toBe(true);
  });
});
