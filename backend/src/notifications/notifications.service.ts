// src/notifications/notifications.service.ts

import { Injectable } from '@nestjs/common';

/**
 * Converte a severidade interna (ex.: "SEV1") para o formato esperado pelo PagerDuty.
 *
 * @param sev Severidade interna (ex.: "SEV1", "SEV2", "SEV3", "SEV4")
 * @returns severidade no formato PagerDuty ("critical" | "error" | "warning" | "info")
 */
function toPagerDutySeverity(sev: string) {
  const s = sev.toUpperCase().trim();
  if (s === 'SEV1') return 'critical';
  if (s === 'SEV2') return 'error';
  if (s === 'SEV3') return 'warning';
  return 'info';
}

/**
 * @file src/notifications/notifications.service.ts
 * @module Backend.Notifications.Service
 *
 * @summary
 * Serviço de integração com sistemas externos de notificação:
 * - Discord (webhook)
 * - PagerDuty (Events API v2)
 *
 * @description
 * Este serviço é intencionalmente simples:
 * - Falhas não lançam exceções por defeito; devolve `{ ok: false, error?: string }`
 * - A decisão de “o que notificar” pertence aos serviços de domínio (ex.: IncidentsService)
 *
 * Variáveis de ambiente:
 * - DISCORD_WEBHOOK_URL
 * - PAGERDUTY_ROUTING_KEY
 */
@Injectable()
export class NotificationsService {
  constructor() {}

  /**
   * Envia uma mensagem para um canal Discord usando um webhook.
   *
   * @param message Conteúdo a publicar no Discord (field `content`)
   * @returns `{ ok: boolean, error?: string }`
   *
   * @remarks
   * - Se `DISCORD_WEBHOOK_URL` não estiver definido, devolve ok=false.
   * - Não faz retry/backoff.
   */
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

  /**
   * Dispara um evento no PagerDuty (Events API v2) para criar/trigger um incident.
   *
   * @param summary Resumo/assunto do evento
   * @param severity Severidade interna (ex.: "SEV1", "SEV2", "SEV3", "SEV4")
   * @param incidentId Identificador interno do IMS (vai em `custom_details`)
   * @returns `{ ok: boolean, error?: string }`
   *
   * @remarks
   * - Se `PAGERDUTY_ROUTING_KEY` não estiver definido, devolve ok=false.
   * - Se a resposta HTTP for != 2xx, devolve ok=false e inclui um erro com status e body (se disponível).
   */
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
}
