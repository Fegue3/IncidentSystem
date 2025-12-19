# Integração Discord (Webhooks)

Permite ao backend publicar notificações num canal Discord via **Incoming Webhook**.

## Configuração

No `.env`:
```bash
NOTIFICATIONS_ENABLED=true
DISCORD_NOTIFICATIONS_ENABLED=true
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/<id>/<token>"
```

## Payload

`POST` com JSON:
```json
{ "content": "mensagem" }
```

## Nota de segurança

Se o webhook foi partilhado (ex.: num chat, screenshot, repositório), faz **rotate** no Discord.
