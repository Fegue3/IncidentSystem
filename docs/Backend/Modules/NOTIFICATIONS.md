# Notifications Module — Discord + PagerDuty

Este documento descreve o módulo `notifications/` do backend IMS, responsável por encapsular integrações externas de alerta/notificação (Discord e PagerDuty) usadas por outros módulos (ex.: Incidents).

---

## 1) Estrutura do módulo

Localização: `backend/src/notifications/`

Ficheiros:
- `notifications.module.ts` — expõe o `NotificationsService` para outros módulos
- `notifications.service.ts` — cliente simples para Discord webhook e PagerDuty Events API

---

## 2) Objetivo

O módulo Notifications fornece uma camada única para:
- enviar mensagens para um canal Discord via Webhook
- disparar incidentes no PagerDuty via Events API (v2)

Isto mantém a lógica de integração fora dos serviços de domínio (ex.: `IncidentsService`), evitando duplicação e facilitando manutenção.

---

## 3) Wiring (NotificationsModule)

O módulo:
- regista `NotificationsService` em `providers`
- exporta `NotificationsService` em `exports`

Isto permite que qualquer módulo que importe `NotificationsModule` injete `NotificationsService`.

---

## 4) Variáveis de ambiente

O serviço depende de env vars:

### Discord
- `DISCORD_WEBHOOK_URL`
  - URL do webhook do Discord
  - Se não existir, `sendDiscord()` devolve `{ ok: false, error: 'DISCORD_WEBHOOK_URL not set' }`

### PagerDuty
- `PAGERDUTY_ROUTING_KEY`
  - Routing key de um Integration (Events API v2)
  - Se não existir, `triggerPagerDuty()` devolve `{ ok: false, error: 'PAGERDUTY_ROUTING_KEY not set' }`

---

## 5) API pública do NotificationsService

### 5.1 `sendDiscord(message: string)`

Envia `message` para o Discord webhook configurado.

**Inputs**
- `message: string` — conteúdo a publicar (enviado como `{ content: message }`)

**Comportamento**
- Se `DISCORD_WEBHOOK_URL` não estiver definido:
  - retorna `{ ok: false, error: 'DISCORD_WEBHOOK_URL not set' }`
- Caso contrário faz `fetch(url, POST, JSON)` e retorna:
  - `{ ok: res.ok }`

**Notas**
- O método não lança erro em falha HTTP; devolve o estado em `ok`.
- O payload usado é o formato típico de webhook do Discord (`content`).

---

### 5.2 `triggerPagerDuty(summary: string, severity: string, incidentId: string)`

Dispara um evento no PagerDuty usando Events API v2.

**Inputs**
- `summary: string` — resumo do incidente (vai para `payload.summary`)
- `severity: string` — severidade do IMS (ex.: `SEV1`, `SEV2`, `SEV3`, `SEV4`)
- `incidentId: string` — id interno do IMS (vai em `custom_details`)

**Mapeamento de severidade**
A função interna `toPagerDutySeverity(sev)` traduz:
- `SEV1` -> `critical`
- `SEV2` -> `error`
- `SEV3` -> `warning`
- outros -> `info`

**Comportamento**
- Se `PAGERDUTY_ROUTING_KEY` não estiver definido:
  - retorna `{ ok: false, error: 'PAGERDUTY_ROUTING_KEY not set' }`
- Caso contrário faz POST para `https://events.pagerduty.com/v2/enqueue` com:
```json
{
  "routing_key": "<key>",
  "event_action": "trigger",
  "payload": {
    "summary": "<summary>",
    "source": "IMS",
    "severity": "<critical|error|warning|info>",
    "custom_details": { "incidentId": "<id>" }
  }
}
```

**Erros**
- Se `res.ok` for `false`:
  - tenta ler `res.text()` e devolve
  - `{ ok: false, error: "PagerDuty <status>: <body>" }`
- Caso contrário:
  - `{ ok: true }`

---

## 6) Dependências e considerações técnicas

- Usa `fetch` (assume runtime Node com fetch disponível, ou polyfill).
- Não existe retry/backoff neste serviço (falhas são reportadas via `{ ok: false }`).
- O método do Discord retorna apenas `ok`, sem corpo de erro detalhado (por design atual).
- Import `IntegrationKind` existe no ficheiro fornecido mas não é usado (pode ser removido para limpeza).

---

## 7) Integração com outros módulos

Exemplo típico:
- `IncidentsService` chama `sendDiscord()` e `triggerPagerDuty()` para incidentes `SEV1/SEV2`
- o resultado é registado na timeline do incidente (ex.: `Discord=OK/FAIL`)

---

## 8) Tests associados (referência)

Ainda não foi fornecida a lista/nomes dos testes específicos deste módulo.
Quando tiveres os paths, sugere-se validar:
- comportamento quando env vars estão ausentes
- comportamento quando `fetch` retorna HTTP != 2xx
- mapeamento de severidade (`SEV1..SEV4`) para PagerDuty

---
