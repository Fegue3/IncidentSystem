/**
 * test/unit/reports.service.full.spec.ts
 *
 * Goal: hit (practically) every branch/line in ReportsService WITHOUT editing the service.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ✅ mock pdfkit mesmo que não exista instalado (virtual mock)
jest.mock(
  'pdfkit',
  () => {
    type HandlerMap = Record<string, Function[]>;

    class PDFDocumentMock {
      private handlers: HandlerMap = {};
      private pages: any[] = [];
      private pageIndex = 0;

      public y = 0;

      constructor(_opts?: any) {
        this.pages = [this.makePage()];
        this.pageIndex = 0;
        this.y = this.page.margins.top;
      }

      // ---------- events ----------
      on(evt: string, cb: Function) {
        if (!this.handlers[evt]) this.handlers[evt] = [];
        this.handlers[evt].push(cb);
        return this;
      }

      private emit(evt: string, ...args: any[]) {
        for (const cb of this.handlers[evt] ?? []) cb(...args);
      }

      end() {
        // Emit some bytes so Buffer.concat(chunks) isn't empty
        this.emit('data', Buffer.from('%PDF-mock%'));
        this.emit('end');
        return this;
      }

      // ---------- pages ----------
      private makePage() {
        return {
          width: 595.28, // A4 approx in points
          height: 841.89,
          margins: { top: 60, bottom: 40, left: 48, right: 48 },
        };
      }

      get page() {
        return this.pages[this.pageIndex];
      }

      bufferedPageRange() {
        return { start: 0, count: this.pages.length };
      }

      switchToPage(i: number) {
        this.pageIndex = Math.max(0, Math.min(i, this.pages.length - 1));
        return this;
      }

      addPage() {
        this.pages.push(this.makePage());
        this.pageIndex = this.pages.length - 1;
        this.y = this.page.margins.top;
        return this;
      }

      // ---------- drawing / text API stubs ----------
      save() {
        return this;
      }
      restore() {
        return this;
      }

      rect(_x: number, _y: number, _w: number, _h: number) {
        return this;
      }
      roundedRect(_x: number, _y: number, _w: number, _h: number, _r: number) {
        return this;
      }
      fill(_c?: any) {
        return this;
      }
      stroke() {
        return this;
      }
      strokeColor(_c: any) {
        return this;
      }
      lineWidth(_w: number) {
        return this;
      }
      moveTo(_x: number, _y: number) {
        return this;
      }
      lineTo(_x: number, _y: number) {
        return this;
      }
      closePath() {
        return this;
      }
      fillOpacity(_v: number) {
        return this;
      }

      circle(_x: number, _y: number, _r: number) {
        return this;
      }

      font(_name: string) {
        return this;
      }
      fontSize(_n: number) {
        return this;
      }
      fillColor(_c: any) {
        return this;
      }

      text(_t: string, _x?: any, _y?: any, _opts?: any) {
        // mimic doc.text affecting y a bit (helps paging loops progress)
        const t = String(_t ?? '');
        const lines = Math.max(1, Math.ceil(t.length / 60));
        this.y += lines * 12;
        return this;
      }

      moveDown(n = 1) {
        this.y += 12 * n;
        return this;
      }

      // Rough text metrics (enough for paging logic)
      widthOfString(t: string) {
        const s = String(t ?? '');
        return Math.min(520, s.length * 5.2);
      }

      heightOfString(t: string, opts?: any) {
        const s = String(t ?? '');
        const width = Number(opts?.width ?? 400);
        const charsPerLine = Math.max(10, Math.floor(width / 5.2));
        const lines = Math.max(1, Math.ceil(s.length / charsPerLine));
        return lines * 12;
      }
    }

    return PDFDocumentMock;
  },
  { virtual: true },
);

// ✅ mock audit helpers used by ReportsService
jest.mock('../../src/audit/incident-audit', () => ({
  ensureIncidentAuditHash: jest.fn(async () => undefined),
  computeIncidentAuditHash: jest.fn(async () => ({ hash: 'HASH_OK' })),
}));

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  IncidentStatus,
  Role,
  Severity,
  TimelineEventType,
  Prisma,
} from '@prisma/client';

import { ReportsService } from '../../src/reports/reports.service';
import { ReportsGroupBy } from '../../src/reports/dto/reports-breakdown.dto';
import { ReportsInterval } from '../../src/reports/dto/reports-timeseries.dto';

import {
  ensureIncidentAuditHash,
  computeIncidentAuditHash,
} from '../../src/audit/incident-audit';

function makePrismaMock() {
  return {
    incident: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
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

function makeIncident(overrides: Partial<any> = {}) {
  const base = {
    id: overrides.id ?? 'inc_1',
    title: overrides.title ?? 'Incident title',
    description:
      overrides.description ??
      'A long description '.repeat(80) + 'END', // force paging paths
    severity: overrides.severity ?? Severity.SEV2,
    status: overrides.status ?? IncidentStatus.IN_PROGRESS,
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    resolvedAt: overrides.resolvedAt ?? new Date('2025-01-01T01:00:00.000Z'),
    closedAt: overrides.closedAt ?? null,
    auditHash: overrides.auditHash ?? 'HASH_OK',
    teamId: overrides.teamId ?? 'team_1',

    team: overrides.team ?? { name: 'Team A' },
    reporter:
      overrides.reporter ?? ({ id: 'u_rep', name: 'Rep', email: 'rep@x.com' } as any),
    assignee:
      overrides.assignee ?? ({ id: 'u_ass', name: 'Ass', email: 'ass@x.com' } as any),

    primaryService:
      overrides.primaryService ??
      ({ id: 'svc_1', name: 'API', key: 'api' } as any),

    timeline:
      overrides.timeline ??
      ([
        {
          createdAt: new Date('2025-01-01T00:10:00.000Z'),
          type: TimelineEventType.STATUS_CHANGE,
          message: 'Estado: NEW -> IN_PROGRESS',
          author: { name: 'Marta', email: 'm@x.com' },
        },
        {
          createdAt: new Date('2025-01-01T00:20:00.000Z'),
          type: TimelineEventType.FIELD_UPDATE,
          message: 'Serviço definido: API',
          author: { name: null, email: 'system@x.com' },
        },
        {
          createdAt: new Date('2025-01-01T00:30:00.000Z'),
          type: TimelineEventType.COMMENT,
          message: 'comment from timeline',
          author: { name: 'Ana', email: 'ana@x.com' },
        },
      ] as any),

    comments:
      overrides.comments ??
      ([
        {
          createdAt: new Date('2025-01-01T00:31:00.000Z'),
          message: 'table comment',
          author: { name: 'Ana', email: 'ana@x.com' },
        },
        {
          createdAt: new Date('2025-01-01T00:31:00.000Z'),
          message: 'table comment', // dup to hit dedup
          author: { name: 'Ana', email: 'ana@x.com' },
        },
        {
          createdAt: new Date('2025-01-01T00:35:00.000Z'),
          content: 'comment via content field',
          author: { name: '', email: 'someone@x.com' },
        },
      ] as any),

    categories:
      overrides.categories ??
      ([
        { category: { id: 'cat1', name: 'Network' } },
        { category: { id: 'cat2', name: 'Database' } },
      ] as any),

    tags: overrides.tags ?? ([{ label: 'urgent' }, { label: 'prod' }] as any),
    _count: overrides._count ?? ({ capas: 2 } as any),
    capas: overrides.capas ?? ([] as any),
  };

  return { ...base, ...overrides };
}

describe('ReportsService (full coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUDIT_HMAC_SECRET = 'secret';
  });

  afterEach(() => {
    delete process.env.AUDIT_HMAC_SECRET;
  });

  it('covers auth helpers + scoping (admin/user) + forbidden paths', async () => {
    const prisma = makePrismaMock();
    const svc = new ReportsService(prisma);

    // getAuthUserId throws
    expect(() => (svc as any).getAuthUserId(null)).toThrow(ForbiddenException);

    // getAuthRole: only enum Role.ADMIN passes; string 'ADMIN' becomes USER
    expect((svc as any).getAuthRole({ role: 'ADMIN' as any })).toBe(Role.USER);
    expect((svc as any).getAuthRole({ role: Role.ADMIN as any })).toBe(Role.ADMIN);

    // resolveTeamScope: admin returns requested
    await expect(
      (svc as any).resolveTeamScope({ id: 'u1', role: Role.ADMIN }, 't_req'),
    ).resolves.toBe('t_req');

    // user with no team
    prisma.team.findFirst.mockResolvedValueOnce(null);
    await expect(
      (svc as any).resolveTeamScope({ id: 'u1', role: Role.USER }, undefined),
    ).rejects.toThrow(ForbiddenException);

    // user mismatch team
    prisma.team.findFirst.mockResolvedValueOnce({ id: 't_mine' });
    await expect(
      (svc as any).resolveTeamScope({ id: 'u1', role: Role.USER }, 't_other'),
    ).rejects.toThrow(ForbiddenException);

    // user ok -> returns myTeamId
    prisma.team.findFirst.mockResolvedValueOnce({ id: 't_mine' });
    await expect(
      (svc as any).resolveTeamScope({ id: 'u1', role: Role.USER }, 't_mine'),
    ).resolves.toBe('t_mine');

    // assertIncidentExportAllowed
    expect(() =>
      (svc as any).assertIncidentExportAllowed(Role.USER, 't_mine', 't_other'),
    ).toThrow(ForbiddenException);

    // ADMIN passes
    expect(() =>
      (svc as any).assertIncidentExportAllowed(Role.ADMIN, undefined, 'anything'),
    ).not.toThrow();
  });

  it('covers range helpers + formatting utils + series/ticks helpers', () => {
    const prisma = makePrismaMock();
    const svc = new ReportsService(prisma);

    // clampRangeToMaxDays
    const clamped = (svc as any).clampRangeToMaxDays(
      { from: '2020-01-01T00:00:00.000Z', to: '2020-03-15T00:00:00.000Z' },
      30,
    );
    expect(new Date(clamped.to).getTime() - new Date(clamped.from).getTime()).toBeLessThanOrEqual(
      30 * 24 * 60 * 60 * 1000,
    );

    // start/end of day UTC
    expect((svc as any).startOfDayUTC('2025-01-02T12:34:56.000Z').toISOString()).toContain(
      'T00:00:00.000Z',
    );
    expect((svc as any).endOfDayUTC('2025-01-02T12:34:56.000Z').toISOString()).toContain(
      'T23:59:59.999Z',
    );

    // lastNDaysRange
    const r30 = (svc as any).lastNDaysRange('2025-02-01T10:00:00.000Z', 30);
    expect(r30.from.slice(0, 10)).toBe('2025-01-03');
    expect(r30.to.slice(0, 10)).toBe('2025-02-01');

    // resolveRange lifetime / range
    expect((svc as any).resolveRange({})).toEqual({ mode: 'lifetime' });
    const rr = (svc as any).resolveRange({ from: '2025-01-01', to: '2025-01-02' });
    expect(rr.mode).toBe('range');

    // buildIncidentWhere variations
    expect(
      (svc as any).buildIncidentWhere({
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-01-02T00:00:00.000Z',
        teamId: 't1',
        serviceId: 's1',
        severity: Severity.SEV1,
      }),
    ).toMatchObject({
      severity: Severity.SEV1,
      teamId: 't1',
      primaryServiceId: 's1',
      createdAt: expect.any(Object),
    });

    // slaTargetSeconds branches
    expect((svc as any).slaTargetSeconds(Severity.SEV1)).toBe(45 * 60);
    expect((svc as any).slaTargetSeconds(Severity.SEV2)).toBe(2 * 60 * 60);
    expect((svc as any).slaTargetSeconds(Severity.SEV3)).toBe(8 * 60 * 60);
    expect((svc as any).slaTargetSeconds(Severity.SEV4)).toBe(24 * 60 * 60);

    // toNum / fmtDateTime / fmtShortDate
    expect((svc as any).toNum('x')).toBeNull();
    expect((svc as any).toNum(123)).toBe(123);
    expect((svc as any).fmtDateTime(null)).toBe('—');
    expect((svc as any).fmtDateTime('not-a-date')).toBe('—');
    expect((svc as any).fmtDateTime('2025-01-01T00:00:00.000Z')).toContain('2025-01-01');
    expect((svc as any).fmtShortDate('not-a-date')).toBe('—');
    expect((svc as any).fmtShortDate('2025-01-01T00:00:00.000Z')).toBe('2025-01-01');

    // humanSeconds / humanHoursFromSeconds branches
    expect((svc as any).humanSeconds(null)).toBe('—');
    expect((svc as any).humanSeconds(30)).toContain('s');
    expect((svc as any).humanSeconds(120)).toContain('min');
    expect((svc as any).humanSeconds(7200)).toContain('h');
    expect((svc as any).humanHoursFromSeconds(3600)).toBe('1.0 h');

    // fillDailySeries (missing days -> 0)
    const filled = (svc as any).fillDailySeries(
      { from: '2025-01-01T00:00:00.000Z', to: '2025-01-03T23:59:59.999Z' },
      [{ date: '2025-01-02T12:00:00.000Z', count: 5 }],
    );
    expect(filled).toHaveLength(3);
    expect(filled.map((x: any) => x.count)).toEqual([0, 5, 0]);

    // ticks helpers
    expect((svc as any).niceTickStep(3)).toBe(1);
    const tSmall = (svc as any).buildYTicks(4);
    expect(tSmall).toEqual([0, 1, 2, 3, 4]);
    const tBig = (svc as any).buildYTicks(99);
    expect(tBig[0]).toBe(0);
    expect(tBig[tBig.length - 1]).toBeGreaterThanOrEqual(99);
  });

  it('covers timeline/comment styling helpers + text paging helpers', () => {
    const prisma = makePrismaMock();
    const svc = new ReportsService(prisma);

    // Minimal doc instance (from our pdfkit mock)
    const PDFDocument: any = require('pdfkit');
    const doc = new PDFDocument();

    // timelineKind branches
    expect((svc as any).timelineKind('status_change')).toBe('STATUS');
    expect((svc as any).timelineKind('service_update')).toBe('SERVICE');
    expect((svc as any).timelineKind('field_update')).toBe('FIELDS');
    expect((svc as any).timelineKind('assignee_update')).toBe('ASSIGNEE');
    expect((svc as any).timelineKind('comment')).toBe('COMMENT');
    expect((svc as any).timelineKind('')).toBe('EVENT');

    // timelineDotColor branches
    expect((svc as any).timelineDotColor('service_update', 'x')).toBeDefined();
    expect((svc as any).timelineDotColor('field_update', 'Serviço definido: API')).toBeDefined();
    expect((svc as any).timelineDotColor('field_update', 'Notificação Discord enviada')).toBeDefined();
    expect((svc as any).timelineDotColor('status_change', 'IN_PROGRESS')).toBeDefined();
    expect((svc as any).timelineDotColor('status_change', 'RESOLVED')).toBeDefined();
    expect((svc as any).timelineDotColor('status_change', 'TRIAGED')).toBeDefined();
    expect((svc as any).timelineDotColor('status_change', 'REOPENED')).toBeDefined();
    expect((svc as any).timelineDotColor('assignee_update', 'x')).toBeDefined();
    expect((svc as any).timelineDotColor('comment', 'x')).toBeDefined();
    expect((svc as any).timelineDotColor('whatever', 'x')).toBeDefined();

    // statusChipStyle branches
    expect((svc as any).statusChipStyle('RESOLVED')).toMatchObject({ fg: expect.any(String) });
    expect((svc as any).statusChipStyle('IN_PROGRESS')).toMatchObject({ fg: expect.any(String) });
    expect((svc as any).statusChipStyle('TRIAGED')).toMatchObject({ fg: expect.any(String) });
    expect((svc as any).statusChipStyle('NEW')).toMatchObject({ fg: expect.any(String) });
    expect((svc as any).statusChipStyle('REOPENED')).toMatchObject({ fg: expect.any(String) });
    expect((svc as any).statusChipStyle('CLOSED')).toMatchObject({ fg: expect.any(String) });

    // drawChip
    const chip = (svc as any).drawChip(doc, 10, 10, 'IN_PROGRESS', (svc as any).statusChipStyle('IN_PROGRESS'));
    expect(chip.w).toBeGreaterThan(10);

    // takeFittingChunk / writeTextPaged / writeTextFittingOnce
    const long = 'word '.repeat(500);
    const chunked = (svc as any).takeFittingChunk(doc, long, 120, 60, {});
    expect(chunked.chunk.length).toBeGreaterThan(0);
    expect(chunked.rest.length).toBeGreaterThan(0);

    // empty text fallback
    (svc as any).writeTextPaged(doc, '', 48, 400, {});
    const once = (svc as any).writeTextFittingOnce(doc, long, 48, 200, 36, {});
    expect(typeof once.rest).toBe('string');
  });

  it('getKpis: calcula open/resolved/closed + mttr + sla', async () => {
    const prisma = makePrismaMock();

    prisma.team.findFirst.mockResolvedValue({ id: 't1' });

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
      { id: 'user1', role: Role.ADMIN },
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

  it('getBreakdown: severity/status/assignee/team/service/category', async () => {
    const prisma = makePrismaMock();
    prisma.team.findFirst.mockResolvedValue({ id: 't1' });

    const svc = new ReportsService(prisma);

    prisma.incident.groupBy.mockResolvedValueOnce([
      { severity: 'SEV2', _count: { _all: 2 } },
      { severity: 'SEV1', _count: { _all: 5 } },
    ]);
    await expect(
      svc.getBreakdown({ groupBy: ReportsGroupBy.severity }, { id: 'u', role: Role.ADMIN }),
    ).resolves.toEqual([
      { key: 'SEV1', label: 'SEV1', count: 5 },
      { key: 'SEV2', label: 'SEV2', count: 2 },
    ]);

    prisma.incident.groupBy.mockResolvedValueOnce([
      { status: 'RESOLVED', _count: { _all: 2 } },
      { status: 'NEW', _count: { _all: 9 } },
    ]);
    await expect(
      svc.getBreakdown({ groupBy: ReportsGroupBy.status }, { id: 'u', role: Role.ADMIN }),
    ).resolves.toEqual([
      { key: 'NEW', label: 'NEW', count: 9 },
      { key: 'RESOLVED', label: 'RESOLVED', count: 2 },
    ]);

    prisma.incident.groupBy.mockResolvedValueOnce([
      { assigneeId: 'a1', _count: { _all: 3 } },
      { assigneeId: null, _count: { _all: 1 } },
    ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'a1', name: 'Assignee', email: 'a@x.com' },
    ]);
    await expect(
      svc.getBreakdown({ groupBy: ReportsGroupBy.assignee }, { id: 'u', role: Role.ADMIN }),
    ).resolves.toEqual([
      { key: 'a1', label: 'Assignee', count: 3 },
      { key: 'none', label: 'Sem responsável', count: 1 },
    ]);

    prisma.incident.groupBy.mockResolvedValueOnce([
      { teamId: 't1', _count: { _all: 2 } },
      { teamId: null, _count: { _all: 1 } },
    ]);
    prisma.team.findMany.mockResolvedValueOnce([{ id: 't1', name: 'Team A' }]);
    await expect(
      svc.getBreakdown({ groupBy: ReportsGroupBy.team }, { id: 'u', role: Role.ADMIN }),
    ).resolves.toEqual([
      { key: 't1', label: 'Team A', count: 2 },
      { key: 'none', label: 'Sem equipa', count: 1 },
    ]);

    prisma.incident.groupBy.mockResolvedValueOnce([
      { primaryServiceId: 's1', _count: { _all: 4 } },
      { primaryServiceId: null, _count: { _all: 1 } },
    ]);
    prisma.service.findMany.mockResolvedValueOnce([{ id: 's1', name: 'Public API', key: 'public-api' }]);
    await expect(
      svc.getBreakdown({ groupBy: ReportsGroupBy.service }, { id: 'u', role: Role.ADMIN }),
    ).resolves.toEqual([
      { key: 's1', label: 'Public API', count: 4 },
      { key: 'none', label: 'Sem serviço', count: 1 },
    ]);

    prisma.categoryOnIncident.groupBy.mockResolvedValueOnce([
      { categoryId: 'cat1', _count: { _all: 3 } },
      { categoryId: 'cat2', _count: { _all: 1 } },
    ]);
    prisma.category.findMany.mockResolvedValueOnce([
      { id: 'cat1', name: 'Network' },
      { id: 'cat2', name: 'Database' },
    ]);
    await expect(
      svc.getBreakdown({ groupBy: ReportsGroupBy.category }, { id: 'u', role: Role.ADMIN }),
    ).resolves.toEqual([
      { key: 'cat1', label: 'Network', count: 3 },
      { key: 'cat2', label: 'Database', count: 1 },
    ]);
  });

  it('getTimeseries: day + week', async () => {
    const prisma = makePrismaMock();
    prisma.team.findFirst.mockResolvedValue({ id: 't1' });

    prisma.$queryRaw.mockResolvedValueOnce([
      { bucket: new Date('2025-01-01T00:00:00.000Z'), count: 2 },
      { bucket: new Date('2025-01-02T00:00:00.000Z'), count: 5 },
    ]);

    const svc = new ReportsService(prisma);

    const outDay = await svc.getTimeseries(
      { interval: ReportsInterval.day },
      { id: 'u', role: Role.ADMIN },
    );

    expect(outDay).toEqual([
      { date: '2025-01-01T00:00:00.000Z', count: 2 },
      { date: '2025-01-02T00:00:00.000Z', count: 5 },
    ]);

    prisma.$queryRaw.mockResolvedValueOnce([
      { bucket: new Date('2025-01-06T00:00:00.000Z'), count: 10 },
    ]);

    const outWeek = await svc.getTimeseries(
      { interval: ReportsInterval.week },
      { id: 'u', role: Role.ADMIN },
    );

    expect(outWeek).toEqual([{ date: '2025-01-06T00:00:00.000Z', count: 10 }]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('exportCsv: escaping + mttr/sla + limit clamp', async () => {
    const prisma = makePrismaMock();
    prisma.team.findFirst.mockResolvedValue({ id: 't1' });

    prisma.incident.findMany.mockResolvedValue([
      {
        id: 'i1',
        title: 'Hello, "World"',
        status: 'RESOLVED',
        severity: 'SEV1',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        resolvedAt: new Date('2025-01-01T00:10:00.000Z'),
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

    const csv = await svc.exportCsv({ limit: 999999 }, { id: 'u', role: Role.ADMIN });

    expect(csv.split('\n')[0]).toBe(
      'id,createdAt,title,severity,status,team,service,assignee,reporter,mttrSeconds,slaTargetSeconds,slaMet,capaCount,resolvedAt,closedAt,categories,tags',
    );

    // title tem vírgula e aspas -> deve vir quoted e com "" dentro
    expect(csv).toContain('"Hello, ""World"""');
    expect(csv).toContain('Network');
    expect(csv).toContain('urgent');
    expect(prisma.incident.findMany).toHaveBeenCalledTimes(1);
  });

  it('verifyIncidentAuditOrThrow: missing hash ensures hash; mismatch blocks; match ok', async () => {
    const prisma = makePrismaMock();
    const svc = new ReportsService(prisma);

    // missing currentAuditHash -> ensureIncidentAuditHash called
    await (svc as any).verifyIncidentAuditOrThrow('inc1', null, 'secret');
    expect(ensureIncidentAuditHash).toHaveBeenCalled();

    // mismatch -> creates timeline event + throws ConflictException
    (computeIncidentAuditHash as any).mockResolvedValueOnce({ hash: 'DIFFERENT' });
    await expect(
      (svc as any).verifyIncidentAuditOrThrow('inc2', 'HASH_OK', 'secret'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.incidentTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId: 'inc2',
        type: TimelineEventType.FIELD_UPDATE,
      }),
    });

    // match -> no throw
    (computeIncidentAuditHash as any).mockResolvedValueOnce({ hash: 'HASH_OK' });
    await expect(
      (svc as any).verifyIncidentAuditOrThrow('inc3', 'HASH_OK', 'secret'),
    ).resolves.toBeUndefined();
  });

  it('resolveReportRangeAndLabels: range + lifetime with data + lifetime without data', async () => {
    const prisma = makePrismaMock();
    const svc = new ReportsService(prisma);

    // range
    const a = await (svc as any).resolveReportRangeAndLabels(
      { from: '2025-01-01T00:00:00.000Z', to: '2025-01-05T00:00:00.000Z' },
      't1',
    );
    expect(a.resolved.mode).toBe('range');
    expect(a.rangeLabelCard).toContain('2025-01-01');

    // lifetime with data
    prisma.incident.aggregate.mockResolvedValueOnce({
      _min: { createdAt: new Date('2025-01-01T00:00:00.000Z') },
      _max: { createdAt: new Date('2025-02-01T00:00:00.000Z') },
    });
    const b = await (svc as any).resolveReportRangeAndLabels({}, 't1');
    expect(b.resolved.mode).toBe('lifetime');
    expect(b.headerPeriodLine).toContain('lifetime');

    // lifetime without data -> fallback last 30 days
    prisma.incident.aggregate.mockResolvedValueOnce({
      _min: { createdAt: null },
      _max: { createdAt: null },
    });
    const c = await (svc as any).resolveReportRangeAndLabels({}, 't1');
    expect(c.resolved.mode).toBe('lifetime');
    expect(c.chartRange.from).toBeDefined();
    expect(c.chartRange.to).toBeDefined();
  });

  it('exportPdf (single incident): not found + forbidden + success + audit mismatch blocked', async () => {
    const prisma = makePrismaMock();
    const svc = new ReportsService(prisma);

    prisma.team.findFirst.mockResolvedValue({ id: 'team_user' });

    // not found
    prisma.incident.findUnique.mockResolvedValueOnce(null);
    await expect(
      svc.exportPdf({ incidentId: 'missing' }, { id: 'u', role: Role.ADMIN }),
    ).rejects.toThrow(NotFoundException);

    // forbidden (USER trying to export other team)
    prisma.incident.findUnique.mockResolvedValueOnce(makeIncident({ teamId: 'team_other' }));
    await expect(
      svc.exportPdf({ incidentId: 'inc_1' }, { id: 'u', role: Role.USER }),
    ).rejects.toThrow(ForbiddenException);

    // audit mismatch blocks
    prisma.incident.findUnique.mockResolvedValueOnce(makeIncident({ teamId: 'team_user', auditHash: 'HASH_OK' }));
    (computeIncidentAuditHash as any).mockResolvedValueOnce({ hash: 'NOPE' });
    await expect(
      svc.exportPdf({ incidentId: 'inc_2' }, { id: 'u', role: Role.USER }),
    ).rejects.toThrow(ConflictException);

    // success
    prisma.incident.findUnique.mockResolvedValueOnce(makeIncident({ teamId: 'team_user', auditHash: 'HASH_OK' }));
    (computeIncidentAuditHash as any).mockResolvedValueOnce({ hash: 'HASH_OK' });
    const buf = await svc.exportPdf({ incidentId: 'inc_ok' }, { id: 'u', role: Role.USER });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('exportPdf (report): generates PDF with lifetime + chart + per-incident pages (covers loops)', async () => {
    const prisma = makePrismaMock();
    prisma.team.findFirst.mockResolvedValue({ id: 't1' });

    // report incident list: return 200 to hit "(cap 200)" branch
    const incidents = Array.from({ length: 200 }, (_, i) =>
      makeIncident({
        id: `inc_${i}`,
        // vary some statuses to touch chip color paths in timeline renderer
        status:
          i % 5 === 0
            ? IncidentStatus.NEW
            : i % 5 === 1
              ? IncidentStatus.TRIAGED
              : i % 5 === 2
                ? IncidentStatus.IN_PROGRESS
                : i % 5 === 3
                  ? IncidentStatus.RESOLVED
                  : IncidentStatus.REOPENED,
        severity:
          i % 4 === 0
            ? Severity.SEV1
            : i % 4 === 1
              ? Severity.SEV2
              : i % 4 === 2
                ? Severity.SEV3
                : Severity.SEV4,
        resolvedAt: i % 3 === 0 ? null : new Date('2025-01-01T01:00:00.000Z'),
        // include some empty comments cases
        comments: i % 7 === 0 ? [] : undefined,
      }),
    );

    prisma.incident.findMany.mockResolvedValueOnce(incidents);

    // getKpis internals
    prisma.incident.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5);

    prisma.$queryRaw
      .mockResolvedValueOnce([{ avg_seconds: 100, median_seconds: 80, p90_seconds: 200 }])
      .mockResolvedValueOnce([{ compliance: 0.5 }])
      // getTimeseries used by report chart
      .mockResolvedValueOnce([
        { bucket: new Date('2025-01-01T00:00:00.000Z'), count: 1 },
        { bucket: new Date('2025-01-02T00:00:00.000Z'), count: 3 },
      ]);

    // lifetime min/max for chartRange
    prisma.incident.aggregate.mockResolvedValueOnce({
      _min: { createdAt: new Date('2025-01-01T00:00:00.000Z') },
      _max: { createdAt: new Date('2025-01-02T00:00:00.000Z') },
    });

    const svc = new ReportsService(prisma);

    const buf = await svc.exportPdf({}, { id: 'admin', role: Role.ADMIN });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);

    expect(prisma.incident.findMany).toHaveBeenCalledTimes(1);
  });

  it('directly covers remaining private render blocks (headers/metric cards/quick stats boxes)', () => {
    const prisma = makePrismaMock();
    const svc = new ReportsService(prisma);

    const PDFDocument: any = require('pdfkit');
    const doc = new PDFDocument();

    // drawHeader / page helpers / layout helpers
    (svc as any).drawHeader(doc);
    expect((svc as any).pageBottom(doc)).toBeGreaterThan(0);
    (svc as any).ensureSpace(doc, 1);
    (svc as any).newPage(doc);
    const layout = (svc as any).getTwoColumnLayout(doc);
    expect(layout.leftW + layout.rightW + layout.gap).toBeGreaterThan(0);

    // section titles and headers
    (svc as any).sectionTitle(doc, 'Title');
    const yAfter = (svc as any).drawSectionHeaderAt(doc, 'Hdr', 48, 200, doc.y);
    expect(yAfter).toBeGreaterThan(0);
    (svc as any).twoColumnHeaders(doc, 'L', 'R', layout.leftX, layout.leftW, layout.rightX, layout.rightW);

    // metricCards
    (svc as any).metricCards(doc, [
      { label: 'A', value: '1' },
      { label: 'B', value: '2', accent: '#123' },
      { label: 'C', value: '3' },
    ]);

    // trend chart + SLA targets + quick stats box
    (svc as any).drawTrendChart(doc, 'Trend', [
      { date: '2025-01-01T00:00:00.000Z', count: 1 },
      { date: '2025-01-02T00:00:00.000Z', count: 5 },
      { date: '2025-01-03T00:00:00.000Z', count: 2 },
    ]);
    (svc as any).drawSlaTargetsBox(doc);

    const stats = (svc as any).quickStats([
      { date: '2025-01-01T00:00:00.000Z', count: 1 },
      { date: '2025-01-02T00:00:00.000Z', count: 9 },
    ]);
    expect(stats.peak).toBe(9);
    (svc as any).drawQuickStatsBox(doc, stats, 'Lifetime');

    // comments plain: empty + filled
    (svc as any).drawCommentsPlainPaged(doc, {
      x: 48,
      y: doc.y,
      w: 220,
      h: 120,
      comments: [],
      startIndex: 0,
    });

    (svc as any).drawCommentsPlainPaged(doc, {
      x: 48,
      y: doc.y,
      w: 220,
      h: 120,
      comments: [
        { createdAt: new Date(), authorLabel: 'A', message: 'm1' },
        { createdAt: new Date(), authorLabel: 'B', message: 'm2' },
      ],
      startIndex: 0,
    });

    // timeline paged: small area to force stop
    (svc as any).drawTimelinePaged(doc, {
      x: 48,
      y: doc.y,
      w: 220,
      h: 40,
      events: [
        { createdAt: new Date(), type: 'STATUS_CHANGE', message: 'Estado: NEW -> IN_PROGRESS', author: { name: 'X', email: 'x@x.com' } },
        { createdAt: new Date(), type: 'FIELD_UPDATE', message: 'Notificação email enviada', author: null },
      ],
      startIndex: 0,
    });

    // buildEventsAndMergedComments / normalizeCommentText / pickAuthorLabel
    const inc = makeIncident();
    const merged = (svc as any).buildEventsAndMergedComments(inc);
    expect(merged.events.length).toBeGreaterThan(0);
    expect(merged.mergedComments.length).toBeGreaterThan(0);

    expect((svc as any).normalizeCommentText({ createdAt: new Date(), body: null })).toBe('—');
    expect((svc as any).pickAuthorLabel(null)).toBe('—');
    expect((svc as any).pickAuthorLabel({ name: 'N', email: 'e@x.com' })).toBe('N');
    expect((svc as any).pickAuthorLabel({ name: '', email: 'e@x.com' })).toBe('e@x.com');

    // dedupComments
    const d = (svc as any).dedupComments([
      { createdAt: new Date('2025-01-01T00:00:00Z'), authorLabel: 'A', message: 'x' },
      { createdAt: new Date('2025-01-01T00:00:00Z'), authorLabel: 'A', message: 'x' },
    ]);
    expect(d).toHaveLength(1);
  });
});
