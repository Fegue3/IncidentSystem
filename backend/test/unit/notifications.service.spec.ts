// test/unit/notifications.service.spec.ts
/**
 * Unit tests: NotificationsService
 *
 * O que este ficheiro valida:
 * - sendDiscord(): valida env var DISCORD_WEBHOOK_URL e payload do fetch
 * - triggerPagerDuty(): valida env var PAGERDUTY_ROUTING_KEY, mapeamento de severidade,
 *   payload para endpoint PagerDuty, e handling de erros (res.ok=false / res.text throws)
 *
 * Nota:
 * - global.fetch é mockado por teste
 * - variáveis de ambiente são limpas em afterEach/afterAll para evitar "leaks" entre testes
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NotificationsService } from '../../src/notifications/notifications.service';

describe('NotificationsService (unit)', () => {
  let service: NotificationsService;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  beforeEach(() => {
    // flags para garantir que a feature está "ativa" durante os testes (se o service usar isto)
    process.env.NOTIFICATIONS_ENABLED = 'true';
    process.env.DISCORD_NOTIFICATIONS_ENABLED = 'true';
    process.env.PAGERDUTY_NOTIFICATIONS_ENABLED = 'true';

    service = new NotificationsService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // limpar env vars específicas
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.PAGERDUTY_ROUTING_KEY;

    // limpar flags
    delete process.env.NOTIFICATIONS_ENABLED;
    delete process.env.DISCORD_NOTIFICATIONS_ENABLED;
    delete process.env.PAGERDUTY_NOTIFICATIONS_ENABLED;

    // restaurar fetch original
    global.fetch = originalFetch;
  });

  afterAll(() => {
    // limpeza final (segurança extra)
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.PAGERDUTY_ROUTING_KEY;

    delete process.env.NOTIFICATIONS_ENABLED;
    delete process.env.DISCORD_NOTIFICATIONS_ENABLED;
    delete process.env.PAGERDUTY_NOTIFICATIONS_ENABLED;
  });

  describe('sendDiscord', () => {
    it('returns ok=false with error when DISCORD_WEBHOOK_URL is missing', async () => {
      delete process.env.DISCORD_WEBHOOK_URL;

      const res = await service.sendDiscord('test');
      expect(res).toEqual({ ok: false, error: 'DISCORD_WEBHOOK_URL not set' });
    });

    it('calls fetch with correct payload when webhook exists', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';

      global.fetch = jest.fn().mockResolvedValue({ ok: true } as any);

      const res = await service.sendDiscord('hello');

      // Se o teu service devolve {ok:true, status:<number>}, ajusta este expect.
      expect(res).toEqual({ ok: true, status: undefined });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://discord.test/webhook');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(init.body).toBe(JSON.stringify({ content: 'hello' }));
    });
  });

  describe('triggerPagerDuty', () => {
    it('returns ok=false with error when PAGERDUTY_ROUTING_KEY is missing', async () => {
      delete process.env.PAGERDUTY_ROUTING_KEY;

      const res = await service.triggerPagerDuty('summary', 'SEV1', 'inc1');
      expect(res).toEqual({ ok: false, error: 'PAGERDUTY_ROUTING_KEY not set' });
    });

    it('maps SEV1 to critical', async () => {
      process.env.PAGERDUTY_ROUTING_KEY = 'pd_key';
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as any);

      const res = await service.triggerPagerDuty('sum', 'SEV1', 'inc1');
      expect(res).toEqual({ ok: true });

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://events.pagerduty.com/v2/enqueue');

      const body = JSON.parse(init.body);
      expect(body.routing_key).toBe('pd_key');
      expect(body.event_action).toBe('trigger');
      expect(body.payload.summary).toBe('sum');
      expect(body.payload.source).toBe('IMS');
      expect(body.payload.severity).toBe('critical');
      expect(body.payload.custom_details).toEqual({ incidentId: 'inc1' });
    });

    it('maps SEV2 to error', async () => {
      process.env.PAGERDUTY_ROUTING_KEY = 'pd_key';
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as any);

      await service.triggerPagerDuty('sum', 'SEV2', 'inc2');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.payload.severity).toBe('error');
    });

    it('maps SEV3 to warning', async () => {
      process.env.PAGERDUTY_ROUTING_KEY = 'pd_key';
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as any);

      await service.triggerPagerDuty('sum', 'SEV3', 'inc3');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.payload.severity).toBe('warning');
    });

    it('maps unknown severity to info', async () => {
      process.env.PAGERDUTY_ROUTING_KEY = 'pd_key';
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as any);

      await service.triggerPagerDuty('sum', 'whatever', 'incX');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.payload.severity).toBe('info');
    });

    it('returns ok=false and includes status/text when PagerDuty responds not ok', async () => {
      process.env.PAGERDUTY_ROUTING_KEY = 'pd_key';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'bad request',
      } as any);

      const res = await service.triggerPagerDuty('sum', 'SEV1', 'inc1');

      expect(res.ok).toBe(false);
      expect(res).toEqual({ ok: false, error: 'PagerDuty 400: bad request' });
    });

    it('returns ok=false and still works if res.text() throws', async () => {
      process.env.PAGERDUTY_ROUTING_KEY = 'pd_key';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error('boom');
        },
      } as any);

      const res = await service.triggerPagerDuty('sum', 'SEV1', 'inc1');

      expect(res.ok).toBe(false);
      expect(res).toEqual({ ok: false, error: 'PagerDuty 500: ' });
    });
  });
});
