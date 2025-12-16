import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IncidentStatus,
  Prisma,
  Role,
  Severity,
  TimelineEventType,
} from '@prisma/client';
import PDFDocument = require('pdfkit');
import type PDFKit from 'pdfkit';

import { PrismaService } from '../prisma/prisma.service';
import { ReportsGroupBy } from './dto/reports-breakdown.dto';
import { ReportsInterval } from './dto/reports-timeseries.dto';
import {
  computeIncidentAuditHash,
  ensureIncidentAuditHash,
} from '../audit/incident-audit';

type JwtUserLike = {
  id?: string;
  sub?: string;
  userId?: string;
  email?: string;
  role?: Role | 'USER' | 'ADMIN' | undefined;
};

type PdfDoc = PDFKit.PDFDocument;

const MS_DAY = 24 * 60 * 60 * 1000;

const COLORS = {
  deepNavy: '#1B2A41',
  warmOrange: '#C45A2E',
  emeraldGreen: '#3C9D71',
  sapphireBlue: '#6E8FBD',
  dangerRed: '#D9534F',
  warningAmber: '#FFB347',
  offWhite: '#F4F2EF',
  charcoal: '#2E2E2E',
  white: '#FFFFFF',
} as const;

type ResolvedRange =
  | { mode: 'lifetime' }
  | { mode: 'range'; from: string; to: string };

type TimelineEvent = {
  createdAt: Date;
  type: string;
  message: string | null;
  author?: { name: string | null; email: string } | null;
};

type SimpleComment = {
  createdAt: Date;
  authorLabel: string;
  message: string;
};

type IncidentAuthor = { name: string | null; email: string } | null;

type IncidentTimelineRow = {
  createdAt: Date;
  type: string;
  message: string | null;
  author?: IncidentAuthor;
};

type IncidentCommentRow = {
  createdAt: Date;
  message?: string | null;
  content?: string | null;
  text?: string | null;
  body?: string | null;
  author?: IncidentAuthor;
};

type IncidentForPdf = {
  id: string;
  title: string | null;
  description: string | null;
  severity: Severity;
  status: IncidentStatus | string;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt?: Date | null;
  auditHash?: string | null;
  teamId?: string | null;

  team?: { name: string | null } | null;
  reporter?: IncidentAuthor & { id?: string };
  assignee?: IncidentAuthor & { id?: string };

  primaryService?: { id: string; name: string | null; key: string } | null;

  timeline?: IncidentTimelineRow[];
  comments?: IncidentCommentRow[];

  categories?: { category?: { id: string; name: string } | null }[];
  tags?: { label: string }[];
  _count?: { capas: number };
  capas?: unknown[];
};

const OPEN_STATUSES: IncidentStatus[] = [
  IncidentStatus.NEW,
  IncidentStatus.TRIAGED,
  IncidentStatus.IN_PROGRESS,
  IncidentStatus.ON_HOLD,
  IncidentStatus.REOPENED,
];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) { }

  // -------------------------
  // Auth / Scoping helpers
  // -------------------------

  private getAuthUserId(u: JwtUserLike | undefined | null): string {
    const id = u?.id ?? u?.sub ?? u?.userId;
    if (!id) throw new ForbiddenException('Missing auth user id');
    return id;
  }

  private getAuthRole(u: JwtUserLike | undefined | null): Role {
    const r = u?.role;
    return r === Role.ADMIN ? Role.ADMIN : Role.USER;
  }

  private async getUserSingleTeamId(userId: string): Promise<string | null> {
    const team = await this.prisma.team.findFirst({
      where: { members: { some: { id: userId } } },
      select: { id: true },
    });
    return team?.id ?? null;
  }

  private async resolveTeamScope(
    auth?: JwtUserLike | null,
    requestedTeamId?: string,
  ): Promise<string | undefined> {
    if (!auth) return requestedTeamId;

    const userId = this.getAuthUserId(auth);
    const role = this.getAuthRole(auth);

    if (role === Role.ADMIN) return requestedTeamId;

    const myTeamId = await this.getUserSingleTeamId(userId);
    if (!myTeamId) throw new ForbiddenException('User has no team assigned');

    if (requestedTeamId && requestedTeamId !== myTeamId) {
      throw new ForbiddenException('You can only access reports for your team');
    }

    return myTeamId;
  }

  private assertIncidentExportAllowed(
    role: Role,
    scopedTeamId: string | undefined,
    incidentTeamId: string | null | undefined,
  ) {
    if (role === Role.ADMIN) return;
    if (!scopedTeamId || incidentTeamId !== scopedTeamId) {
      throw new ForbiddenException(
        'You can only export incidents from your team',
      );
    }
  }

  // -------------------------
  // Range helpers
  // -------------------------

  private clampRangeToMaxDays(
    input: { from?: string; to?: string },
    maxDays: number,
  ): { from: string; to: string } {
    const to = input.to ? new Date(input.to) : new Date();
    let from = input.from
      ? new Date(input.from)
      : new Date(to.getTime() - maxDays * MS_DAY);

    const maxMs = maxDays * MS_DAY;
    if (to.getTime() - from.getTime() > maxMs) {
      from = new Date(to.getTime() - maxMs);
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }

  private startOfDayUTC(iso: string): Date {
    const d = new Date(iso);
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
    );
  }

  private endOfDayUTC(iso: string): Date {
    const d = new Date(iso);
    return new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }

  private lastNDaysRange(
    toIso?: string,
    days = 30,
  ): { from: string; to: string } {
    const to = toIso ? new Date(toIso) : new Date();
    const toStart = new Date(
      Date.UTC(
        to.getUTCFullYear(),
        to.getUTCMonth(),
        to.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const fromStart = new Date(toStart.getTime() - (days - 1) * MS_DAY);
    const toEnd = new Date(toStart.getTime() + MS_DAY - 1);
    return { from: fromStart.toISOString(), to: toEnd.toISOString() };
  }

  // resolve range (lifetime quando não há from/to)
  private resolveRange(input: { from?: string; to?: string }): ResolvedRange {
    const hasFrom = !!(input.from && String(input.from).trim());
    const hasTo = !!(input.to && String(input.to).trim());
    if (!hasFrom && !hasTo) return { mode: 'lifetime' };

    const from = hasFrom ? new Date(input.from as string) : new Date(0);
    const to = hasTo ? new Date(input.to as string) : new Date();

    return { mode: 'range', from: from.toISOString(), to: to.toISOString() };
  }

  // -------------------------
  // Filters / formatting
  // -------------------------

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
      if (input.from) (where.createdAt as any).gte = new Date(input.from);
      if (input.to) (where.createdAt as any).lte = new Date(input.to);
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
      default:
        return 24 * 60 * 60;
    }
  }

  private toNum(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = Number(v as any);
    return Number.isFinite(n) ? n : null;
  }

  private fmtDateTime(d: Date | string | null | undefined): string {
    if (!d) return '—';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  }

  private fmtShortDate(iso: string | Date): string {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  }

  private humanSeconds(s: number | null): string {
    if (s == null) return '—';
    if (s < 60) return `${Math.round(s)}s`;
    const m = s / 60;
    if (m < 60) return `${Math.round(m)} min`;
    const h = m / 60;
    return `${h.toFixed(1)} h`;
  }

  private humanHoursFromSeconds(sec: number): string {
    const h = sec / 3600;
    return `${h.toFixed(1)} h`;
  }

  // -------------------------
  // PDF core helpers
  // -------------------------

  private async pdfToBuffer(build: (doc: PdfDoc) => void): Promise<Buffer> {
    const doc = new (PDFDocument as any)({
      size: 'A4',
      bufferPages: true,
      margins: { top: 60, bottom: 40, left: 48, right: 48 },
    }) as PdfDoc;

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    build(doc);

    // Header em todas as páginas
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      this.drawHeader(doc);
    }

    doc.end();
    return done;
  }

  private drawHeader(doc: PdfDoc) {
    const w = doc.page.width;
    const h = 22;

    doc.save();
    doc.rect(0, 0, w, h).fill(COLORS.deepNavy);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(11);
    doc.text('INCIDENT MANAGER', 0, 6, { align: 'center' });

    doc.strokeColor('rgba(255,255,255,0.14)')
      .lineWidth(1)
      .moveTo(0, h)
      .lineTo(w, h)
      .stroke();

    doc.restore();
  }

  private pageBottom(doc: PdfDoc) {
    return doc.page.height - doc.page.margins.bottom;
  }

  private newPage(doc: PdfDoc) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }

  private ensureSpace(doc: PdfDoc, needed: number) {
    if (doc.y + needed <= this.pageBottom(doc)) return;
    this.newPage(doc);
  }

  private getTwoColumnLayout(doc: PdfDoc) {
    const pageW =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const gap = 18;
    const rightW = Math.round(pageW * 0.38);
    const leftW = pageW - rightW - gap;

    const leftX = doc.page.margins.left;
    const rightX = leftX + leftW + gap;

    return { pageW, gap, leftX, leftW, rightX, rightW };
  }

  // -------------------------
  // Sections / cards
  // -------------------------

  private sectionTitle(
    doc: PdfDoc,
    title: string,
    width?: number,
    x?: number,
  ) {
    const ix = x ?? doc.page.margins.left;
    const iw =
      width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;

    this.ensureSpace(doc, 28);

    doc.save();
    doc.fillColor(COLORS.charcoal).font('Helvetica-Bold').fontSize(12);
    doc.text(title, ix, doc.y, { width: iw });
    doc.y += 6;
    doc.strokeColor('rgba(27,42,65,0.12)')
      .lineWidth(1)
      .moveTo(ix, doc.y)
      .lineTo(ix + iw, doc.y)
      .stroke();
    doc.y += 10;
    doc.restore();
  }

  // header fixo (não mexe no layout global de forma imprevisível)
  private drawSectionHeaderAt(
    doc: PdfDoc,
    title: string,
    x: number,
    w: number,
    y: number,
  ): number {
    doc.save();
    doc.fillColor(COLORS.charcoal).font('Helvetica-Bold').fontSize(12);
    doc.text(title, x, y, { width: w });

    const titleH = doc.heightOfString(title, { width: w });
    const lineY = y + titleH + 4;

    doc.strokeColor('rgba(27,42,65,0.12)')
      .lineWidth(1)
      .moveTo(x, lineY)
      .lineTo(x + w, lineY)
      .stroke();

    doc.restore();
    return lineY + 10; // content starts here
  }

  // headers alinhados (Timeline à esquerda, Comentários à direita)
  private twoColumnHeaders(
    doc: PdfDoc,
    leftTitle: string,
    rightTitle: string,
    leftX: number,
    leftW: number,
    rightX: number,
    rightW: number,
  ) {
    this.ensureSpace(doc, 28);

    const y = doc.y;
    const yLeft = this.drawSectionHeaderAt(doc, leftTitle, leftX, leftW, y);
    const yRight = this.drawSectionHeaderAt(doc, rightTitle, rightX, rightW, y);

    doc.y = Math.max(yLeft, yRight);
  }

  // barras de cor menores e dentro do card
  private metricCards(
    doc: PdfDoc,
    cards: { label: string; value: string; accent?: string }[],
  ) {
    const x0 = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const gap = 10;
    const cardW = (w - gap * (cards.length - 1)) / cards.length;
    const cardH = 56;

    this.ensureSpace(doc, cardH + 8);

    const y = doc.y;

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const x = x0 + i * (cardW + gap);

      doc.save();
      doc.roundedRect(x, y, cardW, cardH, 12).fill(COLORS.white);

      const accent = c.accent ?? COLORS.deepNavy;
      doc.rect(x, y, 7, cardH).fill(accent);

      doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
      doc.text(c.label, x + 14, y + 10, { width: cardW - 24 });

      doc.fillColor(COLORS.deepNavy).font('Helvetica-Bold').fontSize(18);
      doc.text(c.value, x + 14, y + 28, { width: cardW - 24 });

      doc.restore();
    }

    doc.y = y + cardH + 10;
  }

  // -------------------------
  // Text paging (no truncation)
  // -------------------------

  private takeFittingChunk(
    doc: PdfDoc,
    text: string,
    width: number,
    maxHeight: number,
    opts?: any,
  ): { chunk: string; rest: string } {
    const raw = String(text ?? '').replaceAll('\r\n', '\n');
    if (!raw.trim()) return { chunk: '—', rest: '' };

    if (doc.heightOfString(raw, { width, ...(opts ?? {}) }) <= maxHeight) {
      return { chunk: raw, rest: '' };
    }

    const words = raw.split(/\s+/);
    let lo = 1;
    let hi = words.length;
    let best = 1;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const cand = words.slice(0, mid).join(' ');
      const h = doc.heightOfString(cand, { width, ...(opts ?? {}) });
      if (h <= maxHeight) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const chunk = words.slice(0, best).join(' ').trim();
    const rest = words.slice(best).join(' ').trim();
    return { chunk: chunk || words[0], rest };
  }

  private writeTextPaged(
    doc: PdfDoc,
    text: string,
    x: number,
    width: number,
    opts?: any,
  ) {
    let remaining = String(text ?? '');
    if (!remaining.trim()) {
      doc.text('—', x, doc.y, { width, ...(opts ?? {}) });
      return;
    }

    while (remaining.trim().length > 0) {
      const maxH = this.pageBottom(doc) - doc.y;
      if (maxH < 24) {
        this.newPage(doc);
        continue;
      }

      const { chunk, rest } = this.takeFittingChunk(
        doc,
        remaining,
        width,
        maxH,
        opts,
      );
      doc.text(chunk, x, doc.y, { width, ...(opts ?? {}) });
      remaining = rest;

      if (remaining.trim().length > 0) {
        this.newPage(doc);
      }
    }
  }

  private writeTextFittingOnce(
    doc: PdfDoc,
    text: string,
    x: number,
    width: number,
    maxHeight: number,
    opts?: any,
  ): { rest: string } {
    const { chunk, rest } = this.takeFittingChunk(
      doc,
      text,
      width,
      maxHeight,
      opts,
    );
    doc.text(chunk, x, doc.y, { width, ...(opts ?? {}) });
    return { rest };
  }

  // -------------------------
  // Trend series fill
  // -------------------------

  private fillDailySeries(
    range: { from: string; to: string },
    raw: { date: string; count: number }[],
  ) {
    const fromD = this.startOfDayUTC(range.from);
    const toD = this.startOfDayUTC(range.to);

    const map = new Map<string, number>();
    for (const r of raw) {
      const k = this.startOfDayUTC(r.date).toISOString();
      map.set(k, r.count);
    }

    const out: { date: string; count: number }[] = [];
    for (let t = fromD.getTime(); t <= toD.getTime(); t += MS_DAY) {
      const k = new Date(t).toISOString();
      out.push({ date: k, count: map.get(k) ?? 0 });
    }
    return out;
  }

  // -------------------------
  // Trend chart (axes INSIDE box)
  // -------------------------

  private niceTickStep(max: number): number {
    if (max <= 4) return 1;
    const rough = Math.ceil(max / 4);
    return Math.max(1, rough);
  }

  private buildYTicks(max: number): number[] {
    const m = Math.max(1, Math.floor(max));
    if (m <= 12) return Array.from({ length: m + 1 }, (_, i) => i);

    const step = this.niceTickStep(m);
    const ticks: number[] = [];
    for (let t = 0; t <= m; t += step) ticks.push(t);

    if (ticks[ticks.length - 1] < m) {
      ticks.push(ticks[ticks.length - 1] + step);
    }

    return ticks;
  }

  private drawTrendChart(
    doc: PdfDoc,
    title: string,
    series: { date: string; count: number }[],
  ) {
    this.sectionTitle(doc, title);

    const x = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const h = 150;

    this.ensureSpace(doc, h + 16);

    const y = doc.y;

    doc.save();
    doc.roundedRect(x, y, w, h, 14).fill(COLORS.offWhite);

    const padTop = 14;
    const padRight = 14;
    const padBottom = 22;
    const padLeft = 44;

    const ix = x + padLeft;
    const iy = y + padTop;
    const iw = w - padLeft - padRight;
    const ih = h - padTop - padBottom;

    const max = Math.max(1, ...series.map((s) => s.count));
    const n = Math.max(1, series.length);

    const ticks = this.buildYTicks(max);
    const chartMax = ticks[ticks.length - 1];

    const pts = series.map((s, idx) => {
      const px = ix + (n === 1 ? iw / 2 : (idx / (n - 1)) * iw);
      const py = iy + ih - (s.count / chartMax) * ih;
      return { x: px, y: py, v: s.count };
    });

    doc.strokeColor('rgba(27,42,65,0.18)').lineWidth(1);
    doc.moveTo(ix, iy).lineTo(ix, iy + ih).stroke();
    doc.moveTo(ix, iy + ih).lineTo(ix + iw, iy + ih).stroke();

    doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);

    for (const tv of ticks) {
      const ty = iy + ih - (tv / chartMax) * ih;

      doc.strokeColor('rgba(27,42,65,0.10)').lineWidth(1);
      doc.moveTo(ix, ty).lineTo(ix + iw, ty).stroke();

      doc.text(String(tv), x + 8, ty - 4, {
        width: padLeft - 12,
        align: 'left',
      });
    }

    doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
    doc.text('Nº incidentes', x + 8, y + 6, { width: w - 16, align: 'left' });

    doc.save();
    doc.fillColor(COLORS.deepNavy);
    doc.fillOpacity(0.12);
    doc.moveTo(pts[0].x, iy + ih);
    for (const p of pts) doc.lineTo(p.x, p.y);
    doc.lineTo(pts[pts.length - 1].x, iy + ih);
    doc.closePath().fill();
    doc.restore();

    doc.strokeColor(COLORS.deepNavy).lineWidth(2);
    doc.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) doc.lineTo(p.x, p.y);
    doc.stroke();

    doc.fillColor(COLORS.deepNavy);
    for (const p of pts) doc.circle(p.x, p.y, 3.2).fill();

    const start = series[0]?.date ? this.fmtShortDate(series[0].date) : '—';
    const end = series[series.length - 1]?.date
      ? this.fmtShortDate(series[series.length - 1].date)
      : '—';

    const labelY = iy + ih + 4;
    doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
    doc.text(start, ix, labelY, { width: iw / 2, align: 'left' });
    doc.text(end, ix + iw / 2, labelY, { width: iw / 2, align: 'right' });

    doc.restore();

    doc.y = y + h + 8;
  }

  // -------------------------
  // Timeline styling
  // -------------------------

  private timelineKind(type: string): string {
    const t = (type ?? '').toUpperCase();
    if (t.includes('STATUS')) return 'STATUS';
    if (t.includes('SERVICE')) return 'SERVICE';
    if (t.includes('FIELD')) return 'FIELDS';
    if (t.includes('ASSIGN')) return 'ASSIGNEE';
    if (t.includes('COMMENT')) return 'COMMENT';
    return t || 'EVENT';
  }

  private timelineDotColor(type: string, message?: string | null): string {
    const kind = this.timelineKind(type);
    const msg = (message ?? '').toUpperCase();

    const looksLikeService =
      msg.includes('SERVIÇO DEFINIDO') ||
      msg.includes('SERVICO DEFINIDO') ||
      msg.includes('SERVICE SET') ||
      msg.includes('SERVICE:') ||
      msg.includes('SERVIÇO:') ||
      msg.includes('SERVICO:');

    const looksLikeNotification =
      msg.includes('NOTIFICA') ||
      msg.includes('DISCORD') ||
      msg.includes('PAGERDUTY') ||
      msg.includes('SLACK') ||
      msg.includes('EMAIL');

    if (kind === 'SERVICE') return COLORS.sapphireBlue;
    if (kind === 'FIELDS' && (looksLikeService || looksLikeNotification))
      return COLORS.sapphireBlue;

    if (kind === 'STATUS') {
      if (msg.includes('IN_PROGRESS')) return COLORS.warningAmber;
      if (msg.includes('RESOLVED') || msg.includes('CLOSED'))
        return COLORS.emeraldGreen;
      if (msg.includes('TRIAGED') || msg.includes('NEW'))
        return COLORS.warmOrange;
      return COLORS.dangerRed;
    }

    if (kind === 'FIELDS') return COLORS.emeraldGreen;
    if (kind === 'ASSIGNEE') return COLORS.warmOrange;
    if (kind === 'COMMENT') return 'rgba(27,42,65,0.45)';
    return COLORS.deepNavy;
  }

  private statusChipStyle(status: string) {
    const s = (status ?? '').toUpperCase();
    if (s === 'RESOLVED') return { bg: '#DBF0E5', fg: COLORS.emeraldGreen };
    if (s === 'IN_PROGRESS') return { bg: '#FFF3D6', fg: COLORS.warningAmber };
    if (s === 'TRIAGED' || s === 'NEW')
      return { bg: '#F3DECE', fg: COLORS.warmOrange };
    if (s === 'REOPENED') return { bg: '#F1C9C9', fg: COLORS.dangerRed };
    return { bg: '#E0E4EA', fg: COLORS.deepNavy };
  }

  private drawChip(
    doc: PdfDoc,
    x: number,
    y: number,
    text: string,
    style: { bg: string; fg: string },
  ) {
    doc.save();
    doc.font('Helvetica-Bold').fontSize(9);
    const padX = 8;
    const w = doc.widthOfString(text) + padX * 2;
    const h = 16;

    doc.roundedRect(x, y, w, h, 8).fill(style.bg);
    doc.fillColor(style.fg).text(text, x + padX, y + 3, {
      width: w - padX * 2,
    });
    doc.restore();

    return { w, h };
  }

  private drawTimelinePaged(
    doc: PdfDoc,
    input: {
      x: number;
      y: number;
      w: number;
      h: number;
      events: TimelineEvent[];
      startIndex: number;
    },
  ): { endIndex: number; usedHeight: number } {
    const { x, y, w, h, events, startIndex } = input;

    let i = startIndex;
    let cy = y;

    const xLine = x + 12;
    const xText = x + 34;
    const maxY = y + h;

    doc.save();

    while (i < events.length) {
      const ev = events[i];
      const kind = this.timelineKind(ev.type);
      const dot = this.timelineDotColor(ev.type, ev.message);

      const who = ev.author?.name?.trim()
        ? ev.author.name
        : ev.author?.email ?? 'system';

      doc.font('Helvetica').fontSize(9);
      const meta = `${this.fmtDateTime(ev.createdAt)} • ${who} • ${kind}`;
      const metaH = doc.heightOfString(meta, { width: w - (xText - x) });

      doc.font('Helvetica-Bold').fontSize(11);
      const msg = (ev.message ?? '—').trim();
      const msgH = doc.heightOfString(msg, { width: w - (xText - x) });

      let chipsH = 0;
      const m = msg.match(/Estado:\s*([A-Z_]+)\s*(?:->|→)\s*([A-Z_]+)/i);
      if (m) chipsH = 20;

      const blockH = metaH + msgH + chipsH + 16;
      if (cy + blockH > maxY) break;

      doc.strokeColor('rgba(27,42,65,0.16)').lineWidth(1);
      doc.moveTo(xLine, cy).lineTo(xLine, cy + blockH).stroke();

      const dotY = cy + blockH / 2;
      doc.fillColor(dot);
      doc.circle(xLine, dotY, 6).fill();

      doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
      doc.text(meta, xText, cy + 4, { width: w - (xText - x) });

      doc.fillColor(COLORS.deepNavy).font('Helvetica-Bold').fontSize(11);
      doc.text(msg, xText, cy + 4 + metaH + 3, { width: w - (xText - x) });

      if (m) {
        const a = m[1];
        const b = m[2];
        let cx = xText;
        const chipY = cy + 4 + metaH + 3 + msgH + 6;

        doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
        doc.text('Estado:', cx, chipY + 2, { width: 44 });
        cx += 44;

        const ca = this.drawChip(doc, cx, chipY, a, this.statusChipStyle(a));
        cx += ca.w + 8;

        doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica-Bold').fontSize(10);
        doc.text('→', cx, chipY + 1, { width: 12, align: 'center' });
        cx += 14;

        this.drawChip(doc, cx, chipY, b, this.statusChipStyle(b));
      }

      cy += blockH;
      i++;
    }

    doc.restore();
    return { endIndex: i, usedHeight: cy - y };
  }

  // -------------------------
  // Comments (NORMAL list)
  // -------------------------

  private normalizeCommentText(c: IncidentCommentRow): string {
    const raw = String(c?.message ?? c?.content ?? c?.text ?? c?.body ?? '');
    return raw.trim() ? raw : '—';
  }

  private pickAuthorLabel(u: IncidentAuthor): string {
    if (!u) return '—';
    const name = String((u as any)?.name ?? '').trim();
    const email = String((u as any)?.email ?? '').trim();
    return name || email || '—';
  }

  private dedupComments(comments: SimpleComment[]) {
    const seen = new Set<string>();
    const out: SimpleComment[] = [];
    for (const c of comments) {
      const key =
        `${new Date(c.createdAt).toISOString()}|${c.authorLabel}|${String(
          c.message ?? '',
        )}`.slice(0, 600);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }

  private drawCommentsPlainPaged(
    doc: PdfDoc,
    input: {
      x: number;
      y: number;
      w: number;
      h: number;
      comments: SimpleComment[];
      startIndex: number;
    },
  ): { endIndex: number; usedHeight: number } {
    const { x, y, w, h, comments, startIndex } = input;

    let cy = y;
    const maxY = y + h;
    let i = startIndex;

    doc.save();

    if (i >= comments.length) {
      doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(10);
      doc.text('Ainda não existem comentários.', x, cy, { width: w });
      cy += 18;
      doc.restore();
      return { endIndex: i, usedHeight: cy - y };
    }

    while (i < comments.length) {
      const c = comments[i];

      doc.font('Helvetica').fontSize(9);
      const meta = `${this.fmtDateTime(c.createdAt)} • ${c.authorLabel}`;
      const metaH = doc.heightOfString(meta, { width: w });

      doc.font('Helvetica').fontSize(11);
      const msg = (c.message ?? '—').trim();
      const msgH = doc.heightOfString(msg, { width: w });

      const blockH = metaH + msgH + 14;
      if (cy + blockH > maxY) break;

      doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
      doc.text(meta, x, cy, { width: w });

      doc.fillColor(COLORS.deepNavy).font('Helvetica').fontSize(11);
      doc.text(msg, x, cy + metaH + 3, { width: w });

      doc.strokeColor('rgba(27,42,65,0.10)').lineWidth(1);
      doc.moveTo(x, cy + blockH - 6).lineTo(x + w, cy + blockH - 6).stroke();

      cy += blockH;
      i++;
    }

    const remaining = comments.length - i;
    if (remaining > 0 && cy + 10 < maxY) {
      doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
      doc.text(`… +${remaining} comentário(s)`, x, maxY - 12, {
        width: w,
        align: 'right',
      });
    }

    doc.restore();
    return { endIndex: i, usedHeight: cy - y };
  }

  // -------------------------
  // KPIs
  // -------------------------

  async getKpis(
    input: {
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
    },
    auth?: JwtUserLike,
  ) {
    const scopedTeamId = await this.resolveTeamScope(auth, input.teamId);
    const baseWhere = this.buildIncidentWhere({ ...input, teamId: scopedTeamId });

    const [openCount, resolvedCount, closedCount] = await Promise.all([
      this.prisma.incident.count({
        where: { ...baseWhere, status: { in: OPEN_STATUSES } },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, resolvedAt: { not: null } },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, status: IncidentStatus.CLOSED },
      }),
    ]);

    const mttrRows = await this.prisma.$queryRaw<
      { avg_seconds: unknown; median_seconds: unknown; p90_seconds: unknown }[]
    >(Prisma.sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS avg_seconds,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS median_seconds,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS p90_seconds
      FROM "Incident"
      WHERE "resolvedAt" IS NOT NULL
        ${baseWhere.severity ? Prisma.sql`AND "severity" = ${baseWhere.severity}::"Severity"` : Prisma.empty}
        ${baseWhere.teamId ? Prisma.sql`AND "teamId" = ${baseWhere.teamId}` : Prisma.empty}
        ${baseWhere.primaryServiceId ? Prisma.sql`AND "primaryServiceId" = ${baseWhere.primaryServiceId}` : Prisma.empty}
        ${baseWhere.createdAt && (baseWhere.createdAt as any).gte
        ? Prisma.sql`AND "createdAt" >= ${(baseWhere.createdAt as any).gte}`
        : Prisma.empty
      }
        ${baseWhere.createdAt && (baseWhere.createdAt as any).lte
        ? Prisma.sql`AND "createdAt" <= ${(baseWhere.createdAt as any).lte}`
        : Prisma.empty
      }
    `);

    const mttr = mttrRows?.[0] ?? {
      avg_seconds: null,
      median_seconds: null,
      p90_seconds: null,
    };

    const slaRows = await this.prisma.$queryRaw<{ compliance: unknown }[]>(
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
        ${baseWhere.severity ? Prisma.sql`AND "severity" = ${baseWhere.severity}::"Severity"` : Prisma.empty}
        ${baseWhere.teamId ? Prisma.sql`AND "teamId" = ${baseWhere.teamId}` : Prisma.empty}
        ${baseWhere.primaryServiceId ? Prisma.sql`AND "primaryServiceId" = ${baseWhere.primaryServiceId}` : Prisma.empty}
        ${baseWhere.createdAt && (baseWhere.createdAt as any).gte
          ? Prisma.sql`AND "createdAt" >= ${(baseWhere.createdAt as any).gte}`
          : Prisma.empty
        }
        ${baseWhere.createdAt && (baseWhere.createdAt as any).lte
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
        slaCompliance === null
          ? null
          : Math.round(this.toNum(slaCompliance)! * 1000) / 10,
    };
  }

  // -------------------------
  // Breakdown (UI only)
  // -------------------------

  async getBreakdown(
    input: {
      groupBy: ReportsGroupBy;
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
    },
    auth?: JwtUserLike,
  ) {
    const scopedTeamId = await this.resolveTeamScope(auth, input.teamId);
    const where = this.buildIncidentWhere({ ...input, teamId: scopedTeamId });

    if (input.groupBy === ReportsGroupBy.severity) {
      const rows = await this.prisma.incident.groupBy({
        by: ['severity'],
        where,
        _count: { _all: true },
      });
      return rows
        .map((r) => ({
          key: r.severity,
          label: r.severity,
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count);
    }

    if (input.groupBy === ReportsGroupBy.status) {
      const rows = await this.prisma.incident.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      });
      return rows
        .map((r) => ({
          key: r.status,
          label: r.status,
          count: r._count._all,
        }))
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

      const map = new Map(
        users.map((u) => [u.id, u.name?.trim() ? u.name : u.email]),
      );

      return rows
        .map((r) => ({
          key: r.assigneeId ?? 'none',
          label: r.assigneeId
            ? map.get(r.assigneeId) ?? r.assigneeId
            : 'Sem responsável',
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

    if (input.groupBy === ReportsGroupBy.service) {
      const rows = await this.prisma.incident.groupBy({
        by: ['primaryServiceId'],
        where,
        _count: { _all: true },
      });

      const ids = rows
        .map((r) => r.primaryServiceId)
        .filter(Boolean) as string[];
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
          label: r.primaryServiceId
            ? map.get(r.primaryServiceId) ?? r.primaryServiceId
            : 'Sem serviço',
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

  // -------------------------
  // Timeseries
  // -------------------------

  async getTimeseries(
    input: {
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
      interval: ReportsInterval;
    },
    auth?: JwtUserLike,
  ) {
    const scopedTeamId = await this.resolveTeamScope(auth, input.teamId);
    const where = this.buildIncidentWhere({ ...input, teamId: scopedTeamId });

    const bucket = input.interval === ReportsInterval.week ? 'week' : 'day';

    const rows = await this.prisma.$queryRaw<{ bucket: Date; count: number }[]>(
      Prisma.sql`
      SELECT date_trunc(${bucket}, "createdAt") AS bucket, COUNT(*)::int AS count
      FROM "Incident"
      WHERE 1=1
        ${where.severity ? Prisma.sql`AND "severity" = ${where.severity}::"Severity"` : Prisma.empty}
        ${where.teamId ? Prisma.sql`AND "teamId" = ${where.teamId}` : Prisma.empty}
        ${where.primaryServiceId ? Prisma.sql`AND "primaryServiceId" = ${where.primaryServiceId}` : Prisma.empty}
        ${where.createdAt && (where.createdAt as any).gte
          ? Prisma.sql`AND "createdAt" >= ${(where.createdAt as any).gte}`
          : Prisma.empty
        }
        ${where.createdAt && (where.createdAt as any).lte
          ? Prisma.sql`AND "createdAt" <= ${(where.createdAt as any).lte}`
          : Prisma.empty
        }
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    );

    return rows.map((r) => ({ date: r.bucket.toISOString(), count: r.count }));
  }

  // -------------------------
  // CSV export
  // -------------------------

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

    if (/[",\r\n]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
    return raw;
  }

  private userLabel(
    u: { name?: string | null; email?: string | null } | null | undefined,
  ): string {
    const name = u?.name?.trim();
    if (name) return name;
    return u?.email?.trim() || '';
  }

  private computeMttrSeconds(
    createdAt: Date,
    resolvedAt: Date | null | undefined,
  ): number | null {
    if (!resolvedAt) return null;
    return Math.max(
      0,
      Math.floor((resolvedAt.getTime() - createdAt.getTime()) / 1000),
    );
  }

  private computeSlaMet(
    mttrSeconds: number | null,
    slaTarget: number,
  ): boolean | null {
    if (mttrSeconds === null) return null;
    return mttrSeconds <= slaTarget;
  }

  async exportCsv(
    input: {
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
      limit?: number;
    },
    auth?: JwtUserLike,
  ) {
    // sem clamp; se não vier range => lifetime (sem createdAt filter)
    const scopedTeamId = await this.resolveTeamScope(auth, input.teamId);
    const where = this.buildIncidentWhere({ ...input, teamId: scopedTeamId });

    const take = input.limit ? Math.min(input.limit, 10000) : 5000;

    const incidents = await this.prisma.incident.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
        primaryService: { select: { id: true, name: true, key: true } },
        categories: {
          include: { category: { select: { id: true, name: true } } },
        },
        tags: { select: { label: true } },
        _count: { select: { capas: true } },
      },
    });

    const headers = [
      'id',
      'createdAt',
      'title',
      'severity',
      'status',
      'team',
      'service',
      'assignee',
      'reporter',
      'mttrSeconds',
      'slaTargetSeconds',
      'slaMet',
      'capaCount',
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

      const tags = (inc.tags ?? [])
        .map((t: any) => t.label)
        .filter(Boolean)
        .join(';');

      const assigneeLabel = this.userLabel(inc.assignee);
      const reporterLabel = this.userLabel(inc.reporter);

      const teamLabel = inc.team?.name ?? '';
      const serviceLabel = inc.primaryService?.name ?? inc.primaryService?.key ?? '';

      const mttrSeconds = this.computeMttrSeconds(inc.createdAt, inc.resolvedAt);

      const slaTarget = this.slaTargetSeconds(inc.severity);
      const slaMet = this.computeSlaMet(mttrSeconds, slaTarget);

      lines.push(
        [
          this.csvCell(inc.id),
          this.csvCell(inc.createdAt),
          this.csvCell(inc.title),
          this.csvCell(inc.severity),
          this.csvCell(inc.status),
          this.csvCell(teamLabel),
          this.csvCell(serviceLabel),
          this.csvCell(assigneeLabel),
          this.csvCell(reporterLabel),
          this.csvCell(mttrSeconds),
          this.csvCell(slaTarget),
          this.csvCell(slaMet),
          this.csvCell(inc._count?.capas ?? 0),
          this.csvCell(inc.resolvedAt),
          this.csvCell(inc.closedAt),
          this.csvCell(categories),
          this.csvCell(tags),
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  // -------------------------
  // Extra blocks for report 1st page
  // -------------------------

  private drawSlaTargetsBox(doc: PdfDoc) {
    this.sectionTitle(doc, 'SLA Targets por severidade');

    const x = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const h = 74;

    this.ensureSpace(doc, h + 8);
    const y = doc.y;

    doc.save();
    doc.roundedRect(x, y, w, h, 14).fill(COLORS.offWhite);

    const rows = [
      {
        sev: 'SEV1',
        t: this.humanSeconds(this.slaTargetSeconds(Severity.SEV1)),
        color: COLORS.dangerRed,
      },
      {
        sev: 'SEV2',
        t: this.humanSeconds(this.slaTargetSeconds(Severity.SEV2)),
        color: COLORS.warmOrange,
      },
      {
        sev: 'SEV3',
        t: this.humanSeconds(this.slaTargetSeconds(Severity.SEV3)),
        color: COLORS.sapphireBlue,
      },
      {
        sev: 'SEV4',
        t: this.humanSeconds(this.slaTargetSeconds(Severity.SEV4)),
        color: 'rgba(27,42,65,0.55)',
      },
    ];

    const colGap = 12;
    const colW = (w - colGap * 3) / 4;

    for (let i = 0; i < rows.length; i++) {
      const cx = x + i * (colW + colGap);

      doc.rect(cx + 10, y + 14, 6, 46).fill(rows[i].color);

      doc.fillColor(COLORS.deepNavy).font('Helvetica-Bold').fontSize(12);
      doc.text(rows[i].sev, cx + 22, y + 14, { width: colW - 24 });

      doc.fillColor('rgba(27,42,65,0.70)').font('Helvetica').fontSize(10);
      doc.text('Target', cx + 22, y + 32, { width: colW - 24 });

      doc.fillColor(COLORS.deepNavy).font('Helvetica-Bold').fontSize(12);
      doc.text(rows[i].t, cx + 22, y + 48, { width: colW - 24 });
    }

    doc.restore();
    doc.y = y + h + 10;
  }

  private quickStats(daily: { date: string; count: number }[]) {
    let total = 0;
    let peak = 0;
    let peakDate = daily[0]?.date ?? null;
    for (const d of daily) {
      total += d.count;
      if (d.count >= peak) {
        peak = d.count;
        peakDate = d.date;
      }
    }
    const avg = total / Math.max(1, daily.length);
    return { total, avg, peak, peakDate };
  }

  private drawQuickStatsBox(
    doc: PdfDoc,
    stats: { total: number; avg: number; peak: number; peakDate: string | null },
    rangeLabel: string,
  ) {
    this.sectionTitle(doc, 'Resumo rápido');

    const x = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const h = 58;

    this.ensureSpace(doc, h + 8);
    const y = doc.y;

    doc.save();
    doc.roundedRect(x, y, w, h, 14).fill(COLORS.offWhite);

    doc.fillColor(COLORS.deepNavy).font('Helvetica-Bold').fontSize(11);
    doc.text(`Total (${rangeLabel}): ${stats.total}`, x + 14, y + 14, {
      width: w - 28,
    });

    doc.fillColor('rgba(27,42,65,0.70)').font('Helvetica').fontSize(10);
    doc.text(
      `Média/dia: ${stats.avg.toFixed(2)}   •   Pico: ${stats.peak} (${stats.peakDate ? this.fmtShortDate(stats.peakDate) : '—'
      })`,
      x + 14,
      y + 34,
      { width: w - 28 },
    );

    doc.restore();
    doc.y = y + h + 10;
  }

  // -------------------------
  // Incident rendering helpers
  // -------------------------

  private buildEventsAndMergedComments(inc: IncidentForPdf): {
    events: TimelineEvent[];
    mergedComments: SimpleComment[];
  } {
    const events: TimelineEvent[] =
      (inc.timeline ?? []).map((e) => ({
        createdAt: e.createdAt,
        type: e.type,
        message: e.message,
        author: e.author
          ? { name: (e.author as any).name, email: (e.author as any).email }
          : null,
      })) ?? [];

    const timelineComments: SimpleComment[] =
      (inc.timeline ?? [])
        .filter((e) => this.timelineKind(e.type) === 'COMMENT')
        .map((e) => ({
          createdAt: e.createdAt,
          authorLabel: this.pickAuthorLabel(e.author ?? null),
          message: String(e.message ?? '—'),
        })) ?? [];

    const tableComments: SimpleComment[] =
      (inc.comments ?? []).map((c) => ({
        createdAt: c.createdAt,
        authorLabel: this.pickAuthorLabel(c.author ?? null),
        message: this.normalizeCommentText(c),
      })) ?? [];

    const mergedComments = this.dedupComments(
      [...tableComments, ...timelineComments].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    );

    return { events, mergedComments };
  }

  private renderIncidentTitleAndKpis(doc: PdfDoc, inc: IncidentForPdf) {
    doc.font('Helvetica');

    doc.fillColor(COLORS.deepNavy).font('Helvetica-Bold').fontSize(18);
    doc.text(inc.title ?? '—', doc.page.margins.left, doc.y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });

    doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(10);
    doc.text(`ID: ${inc.id}`);
    doc.moveDown(0.4);

    const mttrSeconds = this.computeMttrSeconds(
      new Date(inc.createdAt),
      inc.resolvedAt ? new Date(inc.resolvedAt) : null,
    );

    const slaTarget = this.slaTargetSeconds(inc.severity);
    const slaMet = this.computeSlaMet(mttrSeconds, slaTarget);

    this.metricCards(doc, [
      {
        label: 'Severity',
        value: String(inc.severity),
        accent: COLORS.warmOrange,
      },
      {
        label: 'Status',
        value: String(inc.status),
        accent: COLORS.sapphireBlue,
      },
      {
        label: 'SLA',
        value: slaMet == null ? '—' : slaMet ? 'OK' : 'FAIL',
        accent: slaMet ? COLORS.emeraldGreen : COLORS.dangerRed,
      },
    ]);

    return { mttrSeconds, slaTarget, slaMet };
  }

  private renderDetailsAndDescriptionTwoColumns(
    doc: PdfDoc,
    inc: IncidentForPdf,
    mttrSeconds: number | null,
    slaTarget: number,
  ) {
    const { pageW, leftX, leftW, rightX, rightW } = this.getTwoColumnLayout(doc);

    const y0 = doc.y;

    // Detalhes (esquerda)
    doc.y = y0;
    this.sectionTitle(doc, 'Detalhes', leftW, leftX);

    const team = inc.team?.name ?? '—';
    const owner = inc.assignee ? this.pickAuthorLabel(inc.assignee as any) : '—';
    const reporter = inc.reporter ? this.pickAuthorLabel(inc.reporter as any) : '—';

    doc.fillColor(COLORS.deepNavy).font('Helvetica').fontSize(10);
    doc.text(`Equipa: ${team}`, leftX, doc.y, { width: leftW });
    doc.text(`Responsável: ${owner}`, leftX, doc.y, { width: leftW });
    doc.text(`Reporter: ${reporter}`, leftX, doc.y, { width: leftW });
    doc.text(`Criado: ${this.fmtDateTime(inc.createdAt)}`, leftX, doc.y, {
      width: leftW,
    });
    doc.text(`Resolvido: ${this.fmtDateTime(inc.resolvedAt)}`, leftX, doc.y, {
      width: leftW,
    });
    doc.text(
      `MTTR: ${this.humanSeconds(mttrSeconds)}   |   SLA Target: ${this.humanHoursFromSeconds(
        slaTarget,
      )}`,
      leftX,
      doc.y,
      { width: leftW },
    );
    const yLeftEnd = doc.y;

    // Descrição (direita)
    doc.y = y0;
    this.sectionTitle(doc, 'Descrição', rightW, rightX);
    doc.fillColor(COLORS.deepNavy).font('Helvetica').fontSize(10);

    const descStartY = doc.y;
    const maxDescH = this.pageBottom(doc) - descStartY - 10;

    const { rest: remainingDesc } = this.writeTextFittingOnce(
      doc,
      inc.description ?? '—',
      rightX,
      rightW,
      Math.max(40, maxDescH),
      { width: rightW },
    );
    const yRightEnd = doc.y;

    doc.y = Math.max(yLeftEnd, yRightEnd) + 8;

    // Se a descrição não coube, continua em full width
    if (remainingDesc && remainingDesc.trim().length > 0) {
      this.sectionTitle(doc, 'Descrição', pageW, leftX);
      doc.fillColor(COLORS.deepNavy).font('Helvetica').fontSize(10);
      this.writeTextPaged(doc, remainingDesc, leftX, pageW, { width: pageW });
    }

    return { leftX, leftW, rightX, rightW };
  }

  private renderTimelineAndCommentsTwoColumns(
    doc: PdfDoc,
    layout: { leftX: number; leftW: number; rightX: number; rightW: number },
    events: TimelineEvent[],
    mergedComments: SimpleComment[],
  ) {
    const { leftX, leftW, rightX, rightW } = layout;

    let evIndex = 0;
    let cIndex = 0;

    this.twoColumnHeaders(
      doc,
      'Timeline',
      'Comentários',
      leftX,
      leftW,
      rightX,
      rightW,
    );

    while (evIndex < events.length || cIndex < mergedComments.length) {
      const topY = doc.y;
      const availableH = this.pageBottom(doc) - topY;

      if (availableH < 140) {
        this.newPage(doc);
        this.twoColumnHeaders(
          doc,
          'Timeline',
          'Comentários',
          leftX,
          leftW,
          rightX,
          rightW,
        );
        continue;
      }

      const tl = this.drawTimelinePaged(doc, {
        x: leftX,
        y: topY,
        w: leftW,
        h: availableH,
        events,
        startIndex: evIndex,
      });

      const commentsH = Math.min(availableH, Math.max(180, tl.usedHeight || 180));
      const cm = this.drawCommentsPlainPaged(doc, {
        x: rightX,
        y: topY,
        w: rightW,
        h: commentsH,
        comments: mergedComments,
        startIndex: cIndex,
      });

      const progressed = tl.endIndex > evIndex || cm.endIndex > cIndex;
      evIndex = tl.endIndex;
      cIndex = cm.endIndex;

      const used = Math.max(tl.usedHeight, commentsH);
      doc.y = topY + used;

      if (evIndex < events.length || cIndex < mergedComments.length) {
        // fallback anti-loop-infinito se nada progride
        if (!progressed && cIndex < mergedComments.length) cIndex++;
        this.newPage(doc);
        this.twoColumnHeaders(
          doc,
          'Timeline',
          'Comentários',
          leftX,
          leftW,
          rightX,
          rightW,
        );
      }
    }
  }

  private async verifyIncidentAuditOrThrow(
    incidentId: string,
    currentAuditHash: string | null | undefined,
    secret: string,
  ) {
    if (!currentAuditHash) {
      await ensureIncidentAuditHash(this.prisma as any, incidentId, secret);
      // não recarrego o incidente para manter igual ao teu fluxo (sem efeitos colaterais de include)
      return;
    }

    const { hash: computed } = await computeIncidentAuditHash(
      this.prisma as any,
      incidentId,
      secret,
    );

    if (computed !== currentAuditHash) {
      await this.prisma.incidentTimelineEvent.create({
        data: {
          incidentId,
          type: TimelineEventType.FIELD_UPDATE,
          message:
            'ALERT: Integrity check failed (audit hash mismatch) during PDF export attempt.',
          authorId: null,
        },
      });
      throw new ConflictException(
        'Integrity check failed. PDF export blocked.',
      );
    }
  }

  // -------------------------
  // Report range helpers
  // -------------------------

  private async resolveReportRangeAndLabels(
    input: {
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
    },
    scopedTeamId: string | undefined,
  ): Promise<{
    resolved: ResolvedRange;
    effectiveInput: any;
    chartRange: { from: string; to: string };
    rangeLabelCard: string;
    headerPeriodLine: string;
  }> {
    const resolved = this.resolveRange(input);

    const effectiveInput =
      resolved.mode === 'range'
        ? { ...input, teamId: scopedTeamId, from: resolved.from, to: resolved.to }
        : { ...input, teamId: scopedTeamId };

    // se for lifetime, o chart precisa de um range real (min/max) para preencher dias.
    let chartRange: { from: string; to: string };
    let rangeLabelCard = 'Lifetime';
    let headerPeriodLine = 'Período: Lifetime';

    if (resolved.mode === 'range') {
      chartRange = { from: resolved.from, to: resolved.to };
      rangeLabelCard = `${this.fmtShortDate(resolved.from)} → ${this.fmtShortDate(
        resolved.to,
      )}`;
      headerPeriodLine = `Período: ${this.fmtDateTime(
        resolved.from,
      )}  |  ${this.fmtDateTime(resolved.to)}`;
      return {
        resolved,
        effectiveInput,
        chartRange,
        rangeLabelCard,
        headerPeriodLine,
      };
    }

    const whereNoDates = this.buildIncidentWhere({
      teamId: scopedTeamId,
      serviceId: input.serviceId,
      severity: input.severity,
    });

    const agg = await this.prisma.incident.aggregate({
      where: whereNoDates,
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    const min = agg._min?.createdAt ?? null;
    const max = agg._max?.createdAt ?? null;

    if (min && max) {
      chartRange = {
        from: this.startOfDayUTC(min.toISOString()).toISOString(),
        to: this.endOfDayUTC(max.toISOString()).toISOString(),
      };
      headerPeriodLine = `Período (lifetime): ${this.fmtDateTime(
        min,
      )}  |  ${this.fmtDateTime(max)}`;
      rangeLabelCard = 'Lifetime';
    } else {
      // sem dados => fallback visual
      const fallback = this.lastNDaysRange(undefined, 30);
      chartRange = fallback;
      headerPeriodLine = 'Período: Lifetime';
      rangeLabelCard = 'Lifetime';
    }

    return { resolved, effectiveInput, chartRange, rangeLabelCard, headerPeriodLine };
  }

  // -------------------------
  // PDF export (refactor: baixa complexidade aqui)
  // -------------------------

  async exportPdf(
    input: {
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
      incidentId?: string;
    },
    auth?: JwtUserLike,
  ): Promise<Buffer> {
    const secret = process.env.AUDIT_HMAC_SECRET;
    const role = auth ? this.getAuthRole(auth) : Role.ADMIN;

    if (input.incidentId) {
      return this.exportSingleIncidentPdf(input, auth, role, secret);
    }

    return this.exportReportPdf(input, auth, role, secret);
  }

  // -------------------------
  // PDF: single incident
  // -------------------------

  private async exportSingleIncidentPdf(
    input: {
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
      incidentId?: string;
    },
    auth: JwtUserLike | undefined,
    role: Role,
    secret: string | undefined,
  ): Promise<Buffer> {
    const scopedTeamId = await this.resolveTeamScope(auth, input.teamId);

    const incident = (await this.prisma.incident.findUnique({
      where: { id: input.incidentId as string },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
        primaryService: { select: { id: true, name: true, key: true } },
        timeline: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true, email: true } } },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true, email: true } } },
        },
        capas: { take: 1 },
      },
    })) as unknown as IncidentForPdf | null;

    if (!incident) throw new NotFoundException('Incident not found');

    this.assertIncidentExportAllowed(role, scopedTeamId, incident.teamId);

    if (secret) {
      await this.verifyIncidentAuditOrThrow(
        incident.id,
        incident.auditHash,
        secret,
      );
    }

    const { events, mergedComments } = this.buildEventsAndMergedComments(incident);

    return this.pdfToBuffer((doc) => {
      const { mttrSeconds, slaTarget } = this.renderIncidentTitleAndKpis(
        doc,
        incident,
      );
      const layout = this.renderDetailsAndDescriptionTwoColumns(
        doc,
        incident,
        mttrSeconds,
        slaTarget,
      );

      this.renderTimelineAndCommentsTwoColumns(
        doc,
        layout,
        events,
        mergedComments,
      );

      if (secret && incident.auditHash) {
        this.sectionTitle(doc, 'Audit', layout.leftW, layout.leftX);
        doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(9);
        doc.text(`Audit hash: ${incident.auditHash}`, layout.leftX, doc.y, {
          width: layout.leftW,
        });
      }
    });
  }

  // -------------------------
  // PDF: report
  // -------------------------

  private async exportReportPdf(
    input: {
      from?: string;
      to?: string;
      teamId?: string;
      serviceId?: string;
      severity?: Severity;
      incidentId?: string;
    },
    auth: JwtUserLike | undefined,
    _role: Role,
    _secret: string | undefined,
  ): Promise<Buffer> {
    const scopedTeamId = await this.resolveTeamScope(auth, input.teamId);

    const { effectiveInput, chartRange, rangeLabelCard, headerPeriodLine } =
      await this.resolveReportRangeAndLabels(input, scopedTeamId);

    const where = this.buildIncidentWhere(effectiveInput);

    const incidents = (await this.prisma.incident.findMany({
      where,
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { name: true, email: true } },
        assignee: { select: { name: true, email: true } },
        team: { select: { name: true } },
        timeline: {
          orderBy: { createdAt: 'asc' },
          take: 80,
          include: { author: { select: { name: true, email: true } } },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 50,
          include: { author: { select: { name: true, email: true } } },
        },
      },
    })) as unknown as IncidentForPdf[];

    const kpis = await this.getKpis(effectiveInput, auth);

    const rawSeries = await this.getTimeseries(
      {
        ...effectiveInput,
        from: chartRange.from,
        to: chartRange.to,
        interval: ReportsInterval.day,
      },
      auth,
    );

    const daily = this.fillDailySeries(chartRange, rawSeries);
    const stats = this.quickStats(daily);

    return this.pdfToBuffer((doc) => {
      // Capa / resumo
      doc.fillColor(COLORS.deepNavy).font('Helvetica-Bold').fontSize(18);
      doc.text('Relatório de Incidentes');
      doc.moveDown(0.2);

      doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(10);
      doc.text(headerPeriodLine);
      doc.text(
        `Incidentes incluídos: ${incidents.length}${incidents.length >= 200 ? ' (cap 200)' : ''
        }`,
      );
      doc.moveDown(0.4);

      this.metricCards(doc, [
        { label: 'Abertos', value: String(kpis.openCount), accent: COLORS.warmOrange },
        {
          label: 'Resolvidos',
          value: String(kpis.resolvedCount),
          accent: COLORS.emeraldGreen,
        },
        { label: 'Fechados', value: String(kpis.closedCount), accent: COLORS.deepNavy },
      ]);

      this.metricCards(doc, [
        {
          label: 'MTTR avg',
          value: this.humanSeconds(kpis.mttrSeconds?.avg),
          accent: COLORS.deepNavy,
        },
        {
          label: 'MTTR median',
          value: this.humanSeconds(kpis.mttrSeconds?.median),
          accent: COLORS.deepNavy,
        },
        {
          label: 'MTTR p90',
          value: this.humanSeconds(kpis.mttrSeconds?.p90),
          accent: COLORS.deepNavy,
        },
      ]);

      this.metricCards(doc, [
        {
          label: 'SLA Compliance',
          value: kpis.slaCompliancePct == null ? '—' : `${kpis.slaCompliancePct}%`,
          accent: COLORS.emeraldGreen,
        },
        { label: 'Range', value: rangeLabelCard, accent: COLORS.warmOrange },
        { label: 'Export', value: 'PDF', accent: COLORS.sapphireBlue },
      ]);

      this.drawTrendChart(doc, 'Tendência (incidentes por dia)', daily);

      this.sectionTitle(doc, 'Definições');
      doc.fillColor('rgba(27,42,65,0.65)').font('Helvetica').fontSize(10);
      doc.text(
        'MTTR = Mean Time To Resolution (tempo até resolução). avg = média, median = mediana, p90 = percentil 90. ' +
        'SLA Compliance = percentagem de incidentes resolvidos dentro do tempo alvo definido por severidade.',
      );

      this.drawSlaTargetsBox(doc);
      this.drawQuickStatsBox(doc, stats, rangeLabelCard);

      // Páginas por incidente (render comum)
      for (const inc of incidents as any[]) {
        doc.addPage();
        doc.y = doc.page.margins.top;

        const { mttrSeconds, slaTarget } = this.renderIncidentTitleAndKpis(doc, inc);
        const layout = this.renderDetailsAndDescriptionTwoColumns(
          doc,
          inc,
          mttrSeconds,
          slaTarget,
        );

        const { events, mergedComments } = this.buildEventsAndMergedComments(inc);
        this.renderTimelineAndCommentsTwoColumns(doc, layout, events, mergedComments);
      }
    });
  }
}
