import { createHmac } from 'crypto';

export type PrismaLike = {
  incident: {
    findUnique: (args: any) => Promise<any | null>;
    update: (args: any) => Promise<any>;
  };
};

function iso(d: any): string | null {
  if (d === null || d === undefined) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
}

function sortKey(v: any): string {
  // stable, null-safe, deterministic
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

/**
 * Deterministic JSON-like serialization:
 * - sorts object keys
 * - preserves array order
 * - handles Date/BigInt safely
 * - throws on cycles (so you never silently hash nonsense)
 */
export function stableStringify(value: any): string {
  return stableStringifyInternal(value, new WeakSet());
}

function stableStringifyInternal(value: any, seen: WeakSet<object>): string {
  if (value === null || value === undefined) return 'null';

  const t = typeof value;

  if (t === 'bigint') return JSON.stringify(value.toString());
  if (t !== 'object') return JSON.stringify(value);

  if (value instanceof Date) {
    // Use ISO to avoid locale differences
    return JSON.stringify(iso(value));
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringifyInternal(v, seen)).join(',')}]`;
  }

  // cycle detection
  if (seen.has(value)) {
    throw new Error('stableStringify: circular structure');
  }
  seen.add(value);

  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const out = `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringifyInternal(value[k], seen)}`)
    .join(',')}}`;

  seen.delete(value);
  return out;
}

export function computeHmacSha256Hex(secret: string, payload: string): string {
  if (!secret) throw new Error('computeHmacSha256Hex: secret is required');
  if (payload === null || payload === undefined)
    throw new Error('computeHmacSha256Hex: payload is required');

  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function buildIncidentAuditPayload(incident: any) {
  const categories = (incident.categories ?? [])
    .map((x: any) => ({
      categoryId: x.categoryId ?? x.category?.id ?? null,
      name: x.category?.name ?? null,
      assignedAt: iso(x.assignedAt),
    }))
    .sort((a: any, b: any) => sortKey(a.categoryId).localeCompare(sortKey(b.categoryId)));

  const tags = (incident.tags ?? [])
    .map((t: any) => ({ id: t.id ?? null, label: t.label ?? null }))
    .sort((a: any, b: any) => sortKey(a.label).localeCompare(sortKey(b.label)));

  const timeline = (incident.timeline ?? [])
    .map((e: any) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus ?? null,
      toStatus: e.toStatus ?? null,
      message: e.message ?? null,
      authorId: e.authorId ?? null,
      createdAt: iso(e.createdAt),
    }))
    .sort(
      (a: any, b: any) =>
        sortKey(a.createdAt).localeCompare(sortKey(b.createdAt)) ||
        sortKey(a.id).localeCompare(sortKey(b.id)),
    );

  const comments = (incident.comments ?? [])
    .map((c: any) => ({
      id: c.id,
      body: c.body,
      authorId: c.authorId,
      createdAt: iso(c.createdAt),
    }))
    .sort(
      (a: any, b: any) =>
        sortKey(a.createdAt).localeCompare(sortKey(b.createdAt)) ||
        sortKey(a.id).localeCompare(sortKey(b.id)),
    );

  const capas = (incident.capas ?? [])
    .map((c: any) => ({
      id: c.id,
      action: c.action,
      status: c.status,
      ownerId: c.ownerId ?? null,
      dueAt: iso(c.dueAt),
      createdAt: iso(c.createdAt),
      updatedAt: iso(c.updatedAt),
    }))
    .sort(
      (a: any, b: any) =>
        sortKey(a.createdAt).localeCompare(sortKey(b.createdAt)) ||
        sortKey(a.id).localeCompare(sortKey(b.id)),
    );

  const sources = (incident.sources ?? [])
    .map((s: any) => ({
      id: s.id,
      integrationId: s.integrationId,
      externalId: s.externalId,
      createdAt: iso(s.createdAt),
    }))
    .sort(
      (a: any, b: any) =>
        sortKey(a.integrationId).localeCompare(sortKey(b.integrationId)) ||
        sortKey(a.externalId).localeCompare(sortKey(b.externalId)),
    );

  return {
    incident: {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      severity: incident.severity,
      reporterId: incident.reporterId,
      assigneeId: incident.assigneeId ?? null,
      teamId: incident.teamId ?? null,
      primaryServiceId: incident.primaryServiceId ?? null,

      triagedAt: iso(incident.triagedAt),
      inProgressAt: iso(incident.inProgressAt),
      resolvedAt: iso(incident.resolvedAt),
      closedAt: iso(incident.closedAt),

      createdAt: iso(incident.createdAt),

      // ⚠️ DO NOT include updatedAt:
      // Prisma updates updatedAt when writing auditHash, which would cause immediate mismatches.
    },
    categories,
    tags,
    timeline,
    comments,
    capas,
    sources,
  };
}

export async function computeIncidentAuditHash(
  prisma: PrismaLike,
  incidentId: string,
  secret: string,
) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      categories: { include: { category: { select: { id: true, name: true } } } },
      tags: { select: { id: true, label: true } },
      timeline: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          fromStatus: true,
          toStatus: true,
          message: true,
          authorId: true,
          createdAt: true,
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, authorId: true, createdAt: true },
      },
      capas: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          action: true,
          status: true,
          ownerId: true,
          dueAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      sources: {
        select: { id: true, integrationId: true, externalId: true, createdAt: true },
      },
    },
  });

  if (!incident) {
    throw new Error('Incident not found for audit');
  }

  const payloadObj = buildIncidentAuditPayload(incident);
  const canonical = stableStringify(payloadObj);
  const hash = computeHmacSha256Hex(secret, canonical);

  return { hash, canonical, payloadObj };
}

export async function ensureIncidentAuditHash(
  prisma: PrismaLike,
  incidentId: string,
  secret?: string,
) {
  if (!secret) return null;

  const { hash } = await computeIncidentAuditHash(prisma, incidentId, secret);

  await prisma.incident.update({
    where: { id: incidentId },
    data: { auditHash: hash, auditHashUpdatedAt: new Date() },
  });

  return hash;
}
