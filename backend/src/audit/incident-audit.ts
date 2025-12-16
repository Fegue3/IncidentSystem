import crypto from 'crypto';

type PrismaLike = {
  incident: {
    findUnique: Function;
    update: Function;
  };
};

function iso(d: any): string | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
}

export function stableStringify(value: any): string {
  if (value === null || value === undefined) return 'null';

  if (typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

export function computeHmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function buildIncidentAuditPayload(incident: any) {
  const categories = (incident.categories ?? [])
    .map((x: any) => ({
      categoryId: x.categoryId ?? x.category?.id ?? null,
      name: x.category?.name ?? null,
      assignedAt: iso(x.assignedAt),
    }))
    .sort((a: any, b: any) => String(a.categoryId).localeCompare(String(b.categoryId)));

  const tags = (incident.tags ?? [])
    .map((t: any) => ({ id: t.id ?? null, label: t.label ?? null }))
    .sort((a: any, b: any) => String(a.label).localeCompare(String(b.label)));

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
        String(a.createdAt).localeCompare(String(b.createdAt)) ||
        String(a.id).localeCompare(String(b.id)),
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
        String(a.createdAt).localeCompare(String(b.createdAt)) ||
        String(a.id).localeCompare(String(b.id)),
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
        String(a.createdAt).localeCompare(String(b.createdAt)) ||
        String(a.id).localeCompare(String(b.id)),
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
        String(a.integrationId).localeCompare(String(b.integrationId)) ||
        String(a.externalId).localeCompare(String(b.externalId)),
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

      // ⚠️ NÃO incluir updatedAt aqui:
      // porque ao gravar auditHash, o Prisma atualiza updatedAt automaticamente
      // e isso causava mismatch imediato.
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
      sources: { select: { id: true, integrationId: true, externalId: true, createdAt: true } },
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