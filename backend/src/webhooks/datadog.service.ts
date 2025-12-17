import { Injectable, Logger } from '@nestjs/common';
import { IncidentStatus, Prisma, Provider, Severity, TimelineEventType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DatadogService {
  private readonly logger = new Logger(DatadogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingestAlert(payload: any) {
    const title = String(payload?.title ?? 'Datadog alert');
    const text = String(payload?.text ?? payload?.message ?? '');
    const tags = this.normalizeTags(payload?.tags);

    const externalId = String(
      payload?.alert_id ?? payload?.event_id ?? payload?.id ?? '',
    ).trim();

    const serviceKey = tags['service'] ?? null;
    const severity = this.normalizeSeverity(tags['severity'], title);

    await this.prisma.$transaction(async (tx) => {
      const integrationId = await this.ensureDatadogIntegration(tx);

      if (externalId) {
        const existingSource = await tx.incidentSource.findUnique({
          where: {
            integrationId_externalId: { integrationId, externalId },
          },
          include: { incident: true },
        });

        if (existingSource) {
          await tx.incidentTimelineEvent.create({
            data: {
              incidentId: existingSource.incidentId,
              type: TimelineEventType.COMMENT,
              message: `[Datadog] alert update: ${title}`,
              authorId: null,
            },
          });
          return;
        }
      }

      const reporterId = await this.resolveReporterId(tx);

      const primaryServiceId = serviceKey
        ? await this.tryResolveServiceId(tx, serviceKey)
        : undefined;

      const incident = await tx.incident.create({
        data: {
          title,
          description: text,
          severity,
          status: IncidentStatus.NEW,
          reporter: { connect: { id: reporterId } },
          primaryService: primaryServiceId
            ? { connect: { id: primaryServiceId } }
            : undefined,
        },
      });

      if (externalId) {
        await tx.incidentSource.create({
          data: {
            incidentId: incident.id,
            integrationId,
            externalId,
            payload,
          },
        });
      }

      await tx.incidentTimelineEvent.create({
        data: {
          incidentId: incident.id,
          type: TimelineEventType.COMMENT,
          message: `[Datadog] alert received: ${title}`,
          authorId: null,
        },
      });
    });
  }

  private normalizeTags(raw: any): Record<string, string> {
    if (Array.isArray(raw)) {
      return raw.reduce((acc: Record<string, string>, curr) => {
        const [k, ...rest] = String(curr).split(':');
        if (k && rest.length) acc[k.trim().toLowerCase()] = rest.join(':').trim();
        return acc;
      }, {});
    }

    const str = String(raw ?? '');
    if (!str) return {};

    return str
      .split(/[, ]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .reduce((acc: Record<string, string>, part) => {
        const [k, ...rest] = part.split(':');
        if (k && rest.length) acc[k.trim().toLowerCase()] = rest.join(':').trim();
        return acc;
      }, {});
  }

  private normalizeSeverity(tagValue?: string, title?: string): Severity {
    const fromTag = String(tagValue ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    if (fromTag === 'SEV1') return Severity.SEV1;
    if (fromTag === 'SEV2') return Severity.SEV2;
    if (fromTag === 'SEV3') return Severity.SEV3;
    if (fromTag === 'SEV4') return Severity.SEV4;

    if (title?.toUpperCase().includes('SEV1')) return Severity.SEV1;
    if (title?.toUpperCase().includes('SEV2')) return Severity.SEV2;

    return Severity.SEV3;
  }

  private async ensureDatadogIntegration(tx: Prisma.TransactionClient) {
    const existing = await tx.integrationSource.findFirst({
      where: { provider: Provider.DATADOG },
      select: { id: true },
    });

    if (existing) return existing.id;

    const created = await tx.integrationSource.create({
      data: {
        provider: Provider.DATADOG,
        name: 'Datadog',
        baseUrl: process.env.DD_SITE ? `https://${process.env.DD_SITE}` : undefined,
      },
      select: { id: true },
    });

    return created.id;
  }

  private async resolveReporterId(tx: Prisma.TransactionClient): Promise<string> {
    if (process.env.DD_WEBHOOK_REPORTER_ID) {
      const exists = await tx.user.findUnique({
        where: { id: process.env.DD_WEBHOOK_REPORTER_ID },
        select: { id: true },
      });
      if (exists) return exists.id;
      this.logger.warn('DD_WEBHOOK_REPORTER_ID not found, falling back to admin/user');
    }

    const admin = await tx.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admin) return admin.id;

    const anyUser = await tx.user.findFirst({ select: { id: true } });
    if (anyUser) return anyUser.id;

    const created = await tx.user.create({
      data: {
        email: 'datadog-bot@local',
        name: 'Datadog Bot',
        password: randomBytes(16).toString('hex'),
        role: 'ADMIN',
      },
      select: { id: true },
    });

    return created.id;
  }

  private async tryResolveServiceId(tx: Prisma.TransactionClient, serviceKey: string) {
    const svc = await tx.service.findUnique({ where: { key: serviceKey }, select: { id: true } });
    return svc?.id;
  }
}
