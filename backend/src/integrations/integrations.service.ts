import { Injectable } from '@nestjs/common';
import { IntegrationKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultsForUser(userId: string) {
    await this.prisma.integrationSetting.createMany({
      data: [
        { userId, kind: IntegrationKind.DATADOG, notificationsEnabled: true, lastSavedAt: null },
        { userId, kind: IntegrationKind.PAGERDUTY, notificationsEnabled: true, lastSavedAt: null },
        { userId, kind: IntegrationKind.DISCORD, notificationsEnabled: true, lastSavedAt: null }, // ✅ NEW
      ],
      skipDuplicates: true,
    });
  }

  async getForUser(userId: string) {
    await this.ensureDefaultsForUser(userId);

    const rows = await this.prisma.integrationSetting.findMany({
      where: { userId },
      select: { kind: true, notificationsEnabled: true, lastSavedAt: true },
    });

    const map = new Map(rows.map((r) => [r.kind, r]));

    const dd = map.get(IntegrationKind.DATADOG);
    const pd = map.get(IntegrationKind.PAGERDUTY);
    const dc = map.get(IntegrationKind.DISCORD);

    return {
      datadog: {
        id: 'datadog',
        name: 'Datadog',
        description: 'Métricas, logs e APM em cloud.',
        docsUrl: 'https://docs.datadoghq.com/',
        notificationsEnabled: dd?.notificationsEnabled ?? true,
        lastSavedAt: dd?.lastSavedAt ? dd.lastSavedAt.toISOString() : null,
      },
      pagerduty: {
        id: 'pagerduty',
        name: 'PagerDuty',
        description: 'Notificações on-call via eventos v2.',
        docsUrl: 'https://support.pagerduty.com/',
        notificationsEnabled: pd?.notificationsEnabled ?? true,
        lastSavedAt: pd?.lastSavedAt ? pd.lastSavedAt.toISOString() : null,
      },
      discord: {
        id: 'discord',
        name: 'Discord',
        description: 'Notificações via webhook (canal).',
        docsUrl: 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks',
        notificationsEnabled: dc?.notificationsEnabled ?? true,
        lastSavedAt: dc?.lastSavedAt ? dc.lastSavedAt.toISOString() : null,
      },
    };
  }

  async setEnabledForUser(userId: string, kind: IntegrationKind, enabled: boolean) {
    await this.prisma.integrationSetting.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, notificationsEnabled: enabled, lastSavedAt: new Date() },
      update: { notificationsEnabled: enabled, lastSavedAt: new Date() },
    });

    return this.getForUser(userId);
  }

  async isEnabled(userId: string, kind: IntegrationKind) {
    const row = await this.prisma.integrationSetting.findUnique({
      where: { userId_kind: { userId, kind } },
      select: { notificationsEnabled: true },
    });
    return row?.notificationsEnabled ?? true;
  }
}
