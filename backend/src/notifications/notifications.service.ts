import { Injectable } from '@nestjs/common';
import { IntegrationKind } from '@prisma/client';
import { IntegrationsService } from '../integrations/integrations.service';

function toPagerDutySeverity(sev: string) {
  const s = sev.toUpperCase().trim();
  if (s === 'SEV1') return 'critical';
  if (s === 'SEV2') return 'error';
  if (s === 'SEV3') return 'warning';
  return 'info';
}

@Injectable()
export class NotificationsService {
  constructor(private readonly integrations: IntegrationsService) { }

  async sendDiscord(message: string) {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url) return { ok: false, error: 'DISCORD_WEBHOOK_URL not set' };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });

    return { ok: res.ok };
  }

  async triggerPagerDuty(summary: string, severity: string, incidentId: string) {
    const key = process.env.PAGERDUTY_ROUTING_KEY;
    if (!key) return { ok: false, error: 'PAGERDUTY_ROUTING_KEY not set' };

    const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: key,
        event_action: 'trigger',
        payload: {
          summary,
          source: 'IMS',
          severity: toPagerDutySeverity(severity),
          custom_details: { incidentId },
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `PagerDuty ${res.status}: ${txt}` };
    }

    return { ok: true };
  }

  async triggerPagerDutyForUser(
    userId: string,
    summary: string,
    severity: string,
    incidentId: string,
  ) {
    const enabled = await this.integrations.isEnabled(
      userId,
      IntegrationKind.PAGERDUTY,
    );

    if (!enabled) return { ok: false, error: 'PagerDuty disabled by user setting' };

    return this.triggerPagerDuty(summary, severity, incidentId);
  }
  async sendDiscordForUser(userId: string, message: string) {
    const enabled = await this.integrations.isEnabled(userId, IntegrationKind.DISCORD);
    if (!enabled) return { ok: false, error: 'Discord disabled by user setting' };
    return this.sendDiscord(message);
  }
}
