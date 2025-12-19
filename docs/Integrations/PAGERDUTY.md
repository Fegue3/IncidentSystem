# Integração PagerDuty (Events API v2)

Permite ao backend disparar eventos no PagerDuty via **Events API v2**.

## Configuração

No `.env`:
```bash
NOTIFICATIONS_ENABLED=true
PAGERDUTY_NOTIFICATIONS_ENABLED=true
PAGERDUTY_ROUTING_KEY="<routing_key>"
```

## Endpoint e payload

- Endpoint: `https://events.pagerduty.com/v2/enqueue`
- Payload típico:
```json
{
  "routing_key": "<routing_key>",
  "event_action": "trigger",
  "payload": {
    "summary": "Resumo do incidente",
    "source": "IMS",
    "severity": "critical",
    "custom_details": { "incidentId": "inc_123" }
  }
}
```

## Mapeamento de severidade

- `SEV1` → `critical`
- `SEV2` → `error`
- `SEV3` → `warning`
- outros → `info`
