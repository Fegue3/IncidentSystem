# Integrações (Discord / PagerDuty)

Este documento descreve como configurar e usar as integrações do backend para **notificações** (Discord e PagerDuty),
incluindo variáveis de ambiente, flags e boas práticas de segurança.

## Segurança (importante)

- **Nunca** coloques webhooks/routing keys no repositório.
- Se um webhook foi exposto publicamente, considera-o **comprometido** e faz **rotate** imediatamente.

## Feature flags

- `NOTIFICATIONS_ENABLED=true|false` — master switch
- `DISCORD_NOTIFICATIONS_ENABLED=true|false`
- `PAGERDUTY_NOTIFICATIONS_ENABLED=true|false`

## Variáveis de ambiente

### Discord
- `DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/<id>/<token>"`

### PagerDuty
- `PAGERDUTY_ROUTING_KEY="<routing_key>"`

## Comportamento esperado

### Discord
- `POST` JSON `{ "content": "<mensagem>" }` para o webhook do canal

### PagerDuty
- `POST` para `https://events.pagerduty.com/v2/enqueue`
- payload com `routing_key`, `event_action`, `payload.summary/source/severity`
- incluir `custom_details.incidentId` quando existir

Mapeamento de severidade (compatível com os teus testes):
- `SEV1` → `critical`
- `SEV2` → `error`
- `SEV3` → `warning`
- outros → `info`

## Testes

Ver: `test/unit/notifications.service.spec.ts`.
