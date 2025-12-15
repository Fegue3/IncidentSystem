// ✅ mocka pdfkit mesmo que não exista instalado (virtual mock)
jest.mock(
  'pdfkit',
  () => {
    return function PDFDocumentMock(this: any) {
      const handlers: Record<string, Function> = {};

      this.on = (evt: string, cb: Function) => {
        handlers[evt] = cb;
        return this;
      };

      this.fontSize = () => this;
      this.fillColor = () => this;
      this.text = () => this;
      this.moveDown = () => this;

      this.end = () => {
        if (handlers.end) handlers.end();
      };

      return this;
    };
  },
  { virtual: true },
);

import { ReportsService } from '../../src/reports/reports.service';
import { ReportsGroupBy } from '../../src/reports/dto/reports-breakdown.dto';
import { ReportsInterval } from '../../src/reports/dto/reports-timeseries.dto';

describe('ReportsService', () => {
  function makePrismaMock() {
    return {
      incident: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      categoryOnIncident: {
        groupBy: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      service: {
        findMany: jest.fn(),
      },
      team: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      incidentTimelineEvent: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
    } as any;
  }

  it('getKpis: calcula open/resolved/closed + mttr + sla', async () => {
    const prisma = makePrismaMock();

    prisma.incident.count
      .mockResolvedValueOnce(5) // openCount
      .mockResolvedValueOnce(7) // resolvedCount
      .mockResolvedValueOnce(3); // closedCount

    prisma.$queryRaw
      .mockResolvedValueOnce([
        { avg_seconds: 1200, median_seconds: 900, p90_seconds: 3600 },
      ]) // mttr
      .mockResolvedValueOnce([{ compliance: 0.875 }]); // sla

    const svc = new ReportsService(prisma);

    const out = await svc.getKpis(
      {
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-12-31T00:00:00.000Z',
      },
      { id: 'user1', role: 'ADMIN' }, // ✅ mock auth
    );

    expect(out.openCount).toBe(5);
    expect(out.resolvedCount).toBe(7);
    expect(out.closedCount).toBe(3);
    expect(out.mttrSeconds.avg).toBe(1200);
    expect(out.mttrSeconds.median).toBe(900);
    expect(out.mttrSeconds.p90).toBe(3600);
    expect(out.slaCompliancePct).toBe(87.5);

    expect(prisma.incident.count).toHaveBeenCalledTimes(3);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('getBreakdown: severity', async () => {
    const prisma = makePrismaMock();

    prisma.incident.groupBy.mockResolvedValue([
      { severity: 'SEV2', _count: { _all: 2 } },
      { severity: 'SEV1', _count: { _all: 5 } },
    ]);

    const svc = new ReportsService(prisma);

    const out = await svc.getBreakdown(
      { groupBy: ReportsGroupBy.severity },
      { id: 'user1', role: 'ADMIN' },
    );

    expect(out[0]).toEqual({ key: 'SEV1', label: 'SEV1', count: 5 });
    expect(out[1]).toEqual({ key: 'SEV2', label: 'SEV2', count: 2 });
  });

  it('getBreakdown: category mapeia ids para nomes', async () => {
    const prisma = makePrismaMock();

    prisma.categoryOnIncident.groupBy.mockResolvedValue([
      { categoryId: 'cat1', _count: { _all: 3 } },
      { categoryId: 'cat2', _count: { _all: 1 } },
    ]);

    prisma.category.findMany.mockResolvedValue([
      { id: 'cat1', name: 'Network' },
      { id: 'cat2', name: 'Database' },
    ]);

    const svc = new ReportsService(prisma);

    const out = await svc.getBreakdown(
      { groupBy: ReportsGroupBy.category },
      { id: 'user1', role: 'ADMIN' },
    );

    expect(out[0]).toEqual({ key: 'cat1', label: 'Network', count: 3 });
    expect(out[1]).toEqual({ key: 'cat2', label: 'Database', count: 1 });
  });

  it('getTimeseries: devolve buckets ISO', async () => {
    const prisma = makePrismaMock();

    prisma.$queryRaw.mockResolvedValue([
      { bucket: new Date('2025-01-01T00:00:00.000Z'), count: 2 },
      { bucket: new Date('2025-01-02T00:00:00.000Z'), count: 5 },
    ]);

    const svc = new ReportsService(prisma);

    const out = await svc.getTimeseries(
      { interval: ReportsInterval.day },
      { id: 'user1', role: 'ADMIN' },
    );

    expect(out).toEqual([
      { date: '2025-01-01T00:00:00.000Z', count: 2 },
      { date: '2025-01-02T00:00:00.000Z', count: 5 },
    ]);
  });

  it('exportCsv: gera CSV com escaping correto', async () => {
    const prisma = makePrismaMock();

    prisma.incident.findMany.mockResolvedValue([
      {
        id: 'i1',
        title: 'Hello, "World"',
        status: 'RESOLVED',
        severity: 'SEV1',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        resolvedAt: null,
        closedAt: null,
        reporter: { id: 'u1', name: 'Rep', email: 'rep@x.com' },
        assignee: null,
        team: null,
        primaryService: { id: 's1', name: 'Public API', key: 'public-api' },
        categories: [{ category: { id: 'c1', name: 'Network' } }],
        tags: [{ label: 'urgent' }],
        _count: { capas: 0 },
      },
    ]);

    const svc = new ReportsService(prisma);

    const csv = await svc.exportCsv({}, { id: 'user1', role: 'ADMIN' });

    expect(csv.split('\n')[0]).toBe(
      'id,createdAt,title,severity,status,team,service,assignee,reporter,mttrSeconds,slaTargetSeconds,slaMet,capaCount,resolvedAt,closedAt,categories,tags',
    );

    // title tem vírgula e aspas -> deve vir quoted e com "" dentro
    expect(csv).toContain('"Hello, ""World"""');
    expect(csv).toContain('Network');
    expect(csv).toContain('urgent');
    expect(prisma.incident.findMany).toHaveBeenCalledTimes(1);
  });
});
