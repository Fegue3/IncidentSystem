import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus, Prisma, Severity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsGroupBy } from './dto/reports-breakdown.dto';
import { ReportsInterval } from './dto/reports-timeseries.dto';
import PDFDocument from 'pdfkit';
import { computeIncidentAuditHash, ensureIncidentAuditHash } from '../audit/incident-audit';

type BreakdownItem = { key: string; label: string; count: number };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildIncidentWhere(input: {
    from?: string;
    to?: string;
    teamId?: string;
    serviceId?: string;
    severity?: Severity;
  }): Prisma.IncidentWhereInput {
    const where: Prisma.IncidentWhereInput = {};

    if (input.severity) where.severity = input.severity;
    if (input.teamId) where.teamId = input.teamId;
    if (input.serviceId) where.primaryServiceId = input.serviceId;

    if (input.from || input.to) {
      where.createdAt = {};
      if (input.from) where.createdAt.gte = new Date(input.from);
      if (input.to) where.createdAt.lte = new Date(input.to);
    }

    return where;
  }

  private slaTargetSeconds(sev: Severity): number {
    switch (sev) {
      case Severity.SEV1:
        return 45 * 60;
      case Severity.SEV2:
        return 2 * 60 * 60;
      case Severity.SEV3:
        return 8 * 60 * 60;
      case Severity.SEV4:
      default:
        return 24 * 60 * 60;
    }
  }

  private toNum(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = Number(v as any);
    return Number.isFinite(n) ? n : null;
  }

  private csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const raw =
      value instanceof Date
        ? value.toISOString()
        : typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value);

    if (/[",\r\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }

  private async pdfToBuffer(build: (doc: any) => void): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    build(doc);
    doc.end();

    return done;
  }

  async getKpis(input: {
    from?: string;
    to?: string;
    teamId?: string;
    serviceId?: string;
    severity?: Severity;
  }) {
    const baseWhere = this.buildIncidentWhere(input);

    const openStatuses: IncidentStatus[] = [
      IncidentStatus.NEW,
      IncidentStatus.TRIAGED,
      IncidentStatus.IN_PROGRESS,
      IncidentStatus.ON_HOLD,
      IncidentStatus.REOPENED,
    ];

    const [openCount, resolvedCount, closedCount] = await Promise.all([
      this.prisma.incident.count({
        where: { ...baseWhere, status: { in: openStatuses } },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, resolvedAt: { not: null } },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, status: IncidentStatus.CLOSED },
      }),
    ]);

    const mttrRows = await this.prisma.$queryRaw<
      { avg_seconds: any; median_seconds: any; p90_seconds: any }[]
    >(Prisma.sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS avg_seconds,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS median_seconds,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS p90_seconds
      FROM "Incident"
      WHERE "resolvedAt" IS NOT NULL
        ${baseWhere.severity ? Prisma.sql`AND "severity" = ${baseWhere.severity}` : Prisma.empty}
        ${baseWhere.teamId ? Prisma.sql`AND "teamId" = ${baseWhere.teamId}` : Prisma.empty}
        ${baseWhere.primaryServiceId ? Prisma.sql`AND "primaryServiceId" = ${baseWhere.primaryServiceId}` : Prisma.empty}
        ${
          baseWhere.createdAt && (baseWhere.createdAt as any).gte
            ? Prisma.sql`AND "createdAt" >= ${(baseWhere.createdAt as any).gte}`
            : Prisma.empty
        }
        ${
          baseWhere.createdAt && (baseWhere.createdAt as any).lte
            ? Prisma.sql`AND "createdAt" <= ${(baseWhere.createdAt as any).lte}`
            : Prisma.empty
        }
    `);

    const mttr = mttrRows?.[0] ?? {
      avg_seconds: null,
      median_seconds: null,
      p90_seconds: null,
    };

    const slaRows = await this.prisma.$queryRaw<{ compliance: any }[]>(
      Prisma.sql`
      SELECT
        AVG(
          CASE
            WHEN EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) <=
              CASE "severity"
                WHEN 'SEV1' THEN ${this.slaTargetSeconds(Severity.SEV1)}
                WHEN 'SEV2' THEN ${this.slaTargetSeconds(Severity.SEV2)}
                WHEN 'SEV3' THEN ${this.slaTargetSeconds(Severity.SEV3)}
                ELSE ${this.slaTargetSeconds(Severity.SEV4)}
              END
            THEN 1 ELSE 0
          END
        ) AS compliance
      FROM "Incident"
      WHERE "resolvedAt" IS NOT NULL
        ${baseWhere.severity ? Prisma.sql`AND "severity" = ${baseWhere.severity}` : Prisma.empty}
        ${baseWhere.teamId ? Prisma.sql`AND "teamId" = ${baseWhere.teamId}` : Prisma.empty}
        ${baseWhere.primaryServiceId ? Prisma.sql`AND "primaryServiceId" = ${baseWhere.primaryServiceId}` : Prisma.empty}
        ${
          baseWhere.createdAt && (baseWhere.createdAt as any).gte
            ? Prisma.sql`AND "createdAt" >= ${(baseWhere.createdAt as any).gte}`
            : Prisma.empty
        }
        ${
          baseWhere.createdAt && (baseWhere.createdAt as any).lte
            ? Prisma.sql`AND "createdAt" <= ${(baseWhere.createdAt as any).lte}`
            : Prisma.empty
        }
    `,
    );

    const slaCompliance = slaRows?.[0]?.compliance ?? null;

    return {
      openCount,
      resolvedCount,
      closedCount,
      mttrSeconds: {
        avg: this.toNum(mttr.avg_seconds),
        median: this.toNum(mttr.median_seconds),
        p90: this.toNum(mttr.p90_seconds),
      },
      slaCompliancePct:
        slaCompliance === null ? null : Math.round(this.toNum(slaCompliance)! * 1000) / 10,
    };
  }

  async getBreakdown(input: {
    groupBy: ReportsGroupBy;
    from?: string;
    to?: string;
    teamId?: string;
    serviceId?: string;
    severity?: Severity;
  }): Promise<BreakdownItem[]> {
    const where = this.buildIncidentWhere(input);

    if (input.groupBy === ReportsGroupBy.severity) {
      const rows = await this.prisma.incident.groupBy({
        by: ['severity'],
        where,
        _count: { _all: true },
      });

      return rows
        .map((r) => ({ key: r.severity, label: r.severity, count: r._count._all }))
        .sort((a, b) => b.count - a.count);
    }

    if (input.groupBy === ReportsGroupBy.assignee) {
      const rows = await this.prisma.incident.groupBy({
        by: ['assigneeId'],
        where,
        _count: { _all: true },
      });

      const ids = rows.map((r) => r.assigneeId).filter(Boolean) as string[];
      const users = ids.length
        ? await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, email: true },
          })
        : [];

      const map = new Map(users.map((u) => [u.id, u.name?.trim() ? u.name : u.email]));

      return rows
        .map((r) => ({
          key: r.assigneeId ?? 'unassigned',
          label: r.assigneeId ? map.get(r.assigneeId) ?? r.assigneeId : 'Sem responsável',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count);
    }

    if (input.groupBy === ReportsGroupBy.service) {
      const rows = await this.prisma.incident.groupBy({
        by: ['primaryServiceId'],
        where,
        _count: { _all: true },
      });

      const ids = rows.map((r) => r.primaryServiceId).filter(Boolean) as string[];
      const services = ids.length
        ? await this.prisma.service.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, key: true },
          })
        : [];

      const map = new Map(services.map((s) => [s.id, s.name ?? s.key]));

      return rows
        .map((r) => ({
          key: r.primaryServiceId ?? 'none',
          label: r.primaryServiceId ? map.get(r.primaryServiceId) ?? r.primaryServiceId : 'Sem serviço',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count);
    }

    if (input.groupBy === ReportsGroupBy.team) {
      const rows = await this.prisma.incident.groupBy({
        by: ['teamId'],
        where,
        _count: { _all: true },
      });

      const ids = rows.map((r) => r.teamId).filter(Boolean) as string[];
      const teams = ids.length
        ? await this.prisma.team.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : [];

      const map = new Map(teams.map((t) => [t.id, t.name]));

      return rows
        .map((r) => ({
          key: r.teamId ?? 'none',
          label: r.teamId ? map.get(r.teamId) ?? r.teamId : 'Sem equipa',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count);
    }

    const rows = await this.prisma.categoryOnIncident.groupBy({
      by: ['categoryId'],
      where: { incident: where },
      _count: { _all: true },
    });

    const ids = rows.map((r) => r.categoryId);
    const categories = ids.length
      ? await this.prisma.category.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];

    const map = new Map(categories.map((c) => [c.id, c.name]));

    return rows
      .map((r) => ({
        key: r.categoryId,
        label: map.get(r.categoryId) ?? r.categoryId,
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getTimeseries(input: { from?: string; to?: string; interval: ReportsInterval }) {
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;

    const bucket = input.interval === ReportsInterval.week ? 'week' : 'day';

    const rows = await this.prisma.$queryRaw<{ bucket: Date; count: number }[]>(
      Prisma.sql`
      SELECT date_trunc(${bucket}, "createdAt") AS bucket, COUNT(*)::int AS count
      FROM "Incident"
      WHERE 1=1
        ${from ? Prisma.sql`AND "createdAt" >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND "createdAt" <= ${to}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    );

    return rows.map((r) => ({ date: r.bucket.toISOString(), count: r.count }));
  }

  async exportCsv(input: {
    from?: string;
    to?: string;
    teamId?: string;
    serviceId?: string;
    severity?: Severity;
    limit?: number | string;
  }): Promise<string> {
    const where = this.buildIncidentWhere(input);

    const rawLimit = input.limit === undefined ? undefined : Number(input.limit);
    const take =
      Number.isFinite(rawLimit) && rawLimit && rawLimit > 0
        ? Math.min(rawLimit, 10000)
        : 5000;

    const incidents = await this.prisma.incident.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
        primaryService: { select: { id: true, name: true, key: true } },
        categories: { include: { category: { select: { id: true, name: true } } } },
        tags: { select: { label: true } },
      },
    });

    const headers = [
      'id',
      'title',
      'status',
      'severity',
      'team',
      'service',
      'assignee',
      'reporter',
      'createdAt',
      'resolvedAt',
      'closedAt',
      'categories',
      'tags',
    ];

    const lines: string[] = [];
    lines.push(headers.join(','));

    for (const inc of incidents as any[]) {
      const categories = (inc.categories ?? [])
        .map((x: any) => x.category?.name)
        .filter(Boolean)
        .join(';');
      const tags = (inc.tags ?? []).map((t: any) => t.label).filter(Boolean).join(';');

      const assigneeLabel = inc.assignee
        ? inc.assignee.name?.trim()
          ? inc.assignee.name
          : inc.assignee.email
        : '';
      const reporterLabel = inc.reporter
        ? inc.reporter.name?.trim()
          ? inc.reporter.name
          : inc.reporter.email
        : '';
      const teamLabel = inc.team?.name ?? '';
      const serviceLabel = inc.primaryService?.name ?? inc.primaryService?.key ?? '';

      const row = [
        this.csvCell(inc.id),
        this.csvCell(inc.title),
        this.csvCell(inc.status),
        this.csvCell(inc.severity),
        this.csvCell(teamLabel),
        this.csvCell(serviceLabel),
        this.csvCell(assigneeLabel),
        this.csvCell(reporterLabel),
        this.csvCell(inc.createdAt),
        this.csvCell(inc.resolvedAt),
        this.csvCell(inc.closedAt),
        this.csvCell(categories),
        this.csvCell(tags),
      ];

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  async exportPdf(input: {
    from?: string;
    to?: string;
    teamId?: string;
    serviceId?: string;
    severity?: Severity;
    incidentId?: string;
  }): Promise<Buffer> {
    const secret = process.env.AUDIT_HMAC_SECRET;

    // 1) PDF “auditável” de um incidente
    if (input.incidentId) {
      const incident = await this.prisma.incident.findUnique({
        where: { id: input.incidentId },
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          primaryService: { select: { id: true, name: true, key: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
          tags: { select: { id: true, label: true } },
          timeline: { orderBy: { createdAt: 'asc' }, include: { author: true } },
          comments: { orderBy: { createdAt: 'asc' }, include: { author: true } },
          capas: { orderBy: { createdAt: 'asc' }, include: { owner: true } },
          sources: { include: { integration: true } },
        },
      });

      if (!incident) throw new NotFoundException('Incident not found');

      // se não houver hash ainda e houver secret -> calcula e guarda
      if (!incident.auditHash && secret) {
        await ensureIncidentAuditHash(this.prisma as any, incident.id, secret);
        const refreshed = await this.prisma.incident.findUnique({ where: { id: incident.id } });
        (incident as any).auditHash = refreshed?.auditHash ?? null;
        (incident as any).auditHashUpdatedAt = refreshed?.auditHashUpdatedAt ?? null;
      }

      // se houver secret + hash -> validar integridade
      if (secret && incident.auditHash) {
        const { hash: computed } = await computeIncidentAuditHash(this.prisma as any, incident.id, secret);
        if (computed !== incident.auditHash) {
          throw new ConflictException(
            'Integrity check failed (audit hash mismatch). PDF export blocked.',
          );
        }
      }

      return this.pdfToBuffer((doc) => {
        doc.fontSize(18).text('Incident Audit Report', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('gray').text(`Generated at: ${new Date().toISOString()}`);
        doc.fillColor('black').moveDown();

        doc.fontSize(14).text(`${incident.title}`);
        doc.fontSize(10).text(`ID: ${incident.id}`);
        doc.text(`Status: ${incident.status}   Severity: ${incident.severity}`);
        doc.text(`Service: ${incident.primaryService?.name ?? incident.primaryService?.key ?? '—'}`);
        doc.text(`Team: ${incident.team?.name ?? '—'}`);
        doc.text(
          `Assignee: ${
            incident.assignee
              ? incident.assignee.name?.trim()
                ? incident.assignee.name
                : incident.assignee.email
              : '—'
          }`,
        );
        doc.text(
          `Reporter: ${
            incident.reporter
              ? incident.reporter.name?.trim()
                ? incident.reporter.name
                : incident.reporter.email
              : '—'
          }`,
        );
        doc.text(`Created: ${incident.createdAt.toISOString()}`);
        if (incident.resolvedAt) doc.text(`Resolved: ${incident.resolvedAt.toISOString()}`);
        if (incident.closedAt) doc.text(`Closed: ${incident.closedAt.toISOString()}`);

        doc.moveDown();
        doc.fontSize(12).text('Description');
        doc.fontSize(10).text(incident.description ?? '—');
        doc.moveDown();

        const cats = (incident.categories ?? [])
          .map((x: any) => x.category?.name)
          .filter(Boolean)
          .join(', ');
        const tags = (incident.tags ?? []).map((t: any) => t.label).filter(Boolean).join(', ');

        doc.fontSize(10).text(`Categories: ${cats || '—'}`);
        doc.fontSize(10).text(`Tags: ${tags || '—'}`);
        doc.moveDown();

        doc.fontSize(12).text('CAPAs');
        if (!incident.capas?.length) {
          doc.fontSize(10).text('—');
        } else {
          doc.fontSize(10);
          for (const c of incident.capas as any[]) {
            doc.text(
              `• [${c.status}] ${c.action} ${
                c.dueAt ? `(due ${new Date(c.dueAt).toISOString()})` : ''
              }`,
            );
          }
        }
        doc.moveDown();

        doc.fontSize(12).text('Timeline');
        doc.fontSize(10);
        for (const e of incident.timeline as any[]) {
          const author =
            e.author?.name?.trim()
              ? e.author.name
              : e.author?.email ?? (e.authorId ?? 'system');

          const line =
            `${new Date(e.createdAt).toISOString()} | ${e.type}` +
            (e.fromStatus || e.toStatus ? ` | ${e.fromStatus ?? '—'} -> ${e.toStatus ?? '—'}` : '') +
            ` | by ${author}` +
            (e.message ? ` | ${String(e.message).slice(0, 160)}` : '');

          doc.text(line);
        }

        doc.moveDown();
        doc.fontSize(12).text('Comments');
        if (!incident.comments?.length) {
          doc.fontSize(10).text('—');
        } else {
          doc.fontSize(10);
          for (const c of incident.comments as any[]) {
            const author =
              c.author?.name?.trim()
                ? c.author.name
                : c.author?.email ?? c.authorId;
            doc.text(`${new Date(c.createdAt).toISOString()} | ${author}: ${c.body}`);
          }
        }

        doc.moveDown();
        doc.fontSize(12).text('Integrity');
        doc.fontSize(10).text(
          secret
            ? `Audit hash: ${incident.auditHash ?? '—'} (updated: ${incident.auditHashUpdatedAt ? new Date(incident.auditHashUpdatedAt).toISOString() : '—'})`
            : 'AUDIT_HMAC_SECRET not configured (integrity verification disabled).',
        );
      });
    }

    // 2) PDF “de relatório” (lista + KPIs)
    const where = this.buildIncidentWhere(input);

    const [kpis, incidents] = await Promise.all([
      this.getKpis(input),
      this.prisma.incident.findMany({
        where,
        take: 200,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
          createdAt: true,
          resolvedAt: true,
          team: { select: { name: true } },
          primaryService: { select: { name: true, key: true } },
        },
      }),
    ]);

    return this.pdfToBuffer((doc) => {
      doc.fontSize(18).text('Incident Reports', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('gray').text(`Generated at: ${new Date().toISOString()}`);
      doc.fillColor('black').moveDown();

      doc.fontSize(12).text('KPIs');
      doc.fontSize(10).text(`Open: ${kpis.openCount}   Resolved: ${kpis.resolvedCount}   Closed: ${kpis.closedCount}`);
      doc.text(
        `MTTR (s): avg=${kpis.mttrSeconds.avg ?? '—'} median=${kpis.mttrSeconds.median ?? '—'} p90=${kpis.mttrSeconds.p90 ?? '—'}`,
      );
      doc.text(`SLA Compliance: ${kpis.slaCompliancePct ?? '—'}%`);
      doc.moveDown();

      doc.fontSize(12).text('Latest incidents (max 200)');
      doc.moveDown(0.25);

      doc.fontSize(9);
      for (const inc of incidents as any[]) {
        const svc = inc.primaryService?.name ?? inc.primaryService?.key ?? '—';
        const team = inc.team?.name ?? '—';
        doc.text(
          `${inc.createdAt.toISOString()} | ${inc.severity} | ${inc.status} | ${team} | ${svc} | ${inc.title} (${inc.id.slice(0, 8)})`,
        );
      }

      doc.moveDown();
      doc.fontSize(10).fillColor('gray').text(
        secret
          ? 'Integrity verification applies to incident-specific PDF exports (export.pdf?incidentId=...).'
          : 'AUDIT_HMAC_SECRET not configured (integrity verification disabled).',
      );
      doc.fillColor('black');
    });
  }
}