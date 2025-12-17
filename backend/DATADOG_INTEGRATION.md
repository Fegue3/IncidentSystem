# 📊 Integração Datadog

Este documento descreve a integração com **Datadog** para ingestão de alertas no sistema de gestão de incidentes.

---

## 📋 Visão Geral

A integração permite que alertas do Datadog sejam automaticamente convertidos em **incidentes** no sistema, com:

- ✅ **Deduplicação automática**: Evita incidentes duplicados para o mesmo alerta.
- ✅ **Extração de metadados**: Severity, serviço e tags são extraídos do payload.
- ✅ **Timeline auditada**: Cada alerta cria um evento na timeline.
- ✅ **Fallback de reporter**: Se nenhum reporter estiver configurado, usa admin/bot.
- ✅ **Integração rastreada**: Dados do alerta guardados em `IncidentSource`.

---

## 🔧 Configuração

### 1. Variáveis de Ambiente (`backend/.env`)

```env
# Datadog Tracing
DD_API_KEY=your-datadog-api-key
DD_SITE=datadoghq.com
DD_ENV=development
DD_SERVICE=es-backend
DD_VERSION=0.0.1
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_TRACE_SAMPLE_RATE=1
DD_LOGS_INJECTION=true
DD_RUNTIME_METRICS_ENABLED=true
DD_TRACE_STARTUP_LOGS=true

# Webhook
DD_WEBHOOK_TOKEN=change-me-to-a-secure-token
DD_WEBHOOK_REPORTER_ID=    # (Opcional) ID do usuário que cria incidentes via webhook
```

### 2. Instalar Dependências

```bash
cd backend
npm install
```

### 3. Subir o Backend

```bash
npm run start:dev
```

O endpoint estará acessível em:
```
POST http://localhost:3000/api/webhooks/datadog
```

---

## 📨 Enviar Alertas do Datadog

### Endpoint

```
POST http://localhost:3000/api/webhooks/datadog
```

### Headers

Se `DD_WEBHOOK_TOKEN` estiver definido:

```
x-ims-token: your-token-value
```

ou

```
x-dd-token: your-token-value
```

### Payload

#### Exemplo 1: Alerta de Severity Crítica

```json
{
  "alert_id": "dd-alert-12345",
  "title": "SEV1 - Database Connection Pool Exhausted",
  "text": "The database connection pool has reached maximum capacity. Active connections: 100/100.",
  "tags": "service:auth,severity:sev1,environment:production",
  "event_id": "datadog-event-abc123"
}
```

#### Exemplo 2: Alerta com Tags Array

```json
{
  "id": "datadog-event-xyz789",
  "title": "SEV2 - API Response Time High",
  "message": "P95 latency exceeded 5s threshold for 10 minutes.",
  "tags": [
    "service:api-gateway",
    "severity:sev2",
    "region:us-east-1"
  ]
}
```

#### Campos Suportados

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `alert_id` / `event_id` / `id` | string | Sim* | ID único do alerta (usado para deduplicação) |
| `title` | string | Sim | Título do incidente |
| `text` / `message` | string | Não | Descrição detalhada |
| `tags` | string \| array | Não | Tags no formato `key:value` (separadas por vírgula ou espaço) |

*Se não for fornecido, o alerta será criado mas não será deduplicado em futuras atualizações.

---

## 🏷️ Tags Especiais

### Service

Define o serviço afetado. Deve corresponder a uma chave existente em `services`:

```
tags: "service:auth,..."
```

Se o serviço não existir, o incidente será criado **sem serviço associado**.

### Severity

Mapeia para os níveis de severidade do sistema:

| Tag Value | Mapeado para |
|-----------|-------------|
| `severity:sev1` | `SEV1` |
| `severity:sev2` | `SEV2` |
| `severity:sev3` | `SEV3` |
| `severity:sev4` | `SEV4` |

Se não encontrado em tags, verifica-se o título (ex: `"SEV1 - ..."` → `SEV1`).

**Default**: `SEV3`

---

## 🔄 Fluxo de Ingestão

```
1. Webhook recebe payload Datadog
   ↓
2. Validação de token (se configurado)
   ↓
3. Extração de título, texto, tags, ID
   ↓
4. Normalização de severity e service
   ↓
5. Transação Prisma:
   a) Verifica se `IncidentSource` com mesmo externalId já existe
   b) Se SIM → Adiciona timeline comment (alerta atualizado)
   c) Se NÃO → Cria novo Incident + IncidentSource + timeline event
   ↓
6. Resposta HTTP 200 (mesmo que não crie incident)
```

---

## 📊 Estrutura de Dados

### Incident (Criado)

```typescript
{
  id: "cuid-xxx",
  title: "SEV1 - Database Connection Pool Exhausted",
  description: "The database connection pool has reached maximum capacity...",
  severity: "SEV1",
  status: "NEW",
  reporterId: "datadog-bot-id",
  primaryServiceId: "service-auth-id" || null,
  createdAt: "2025-12-17T02:30:00Z",
  ...
}
```

### IncidentSource (Rastreamento)

```typescript
{
  id: "cuid-yyy",
  incidentId: "cuid-xxx",
  integrationId: "datadog-integration-id",
  externalId: "dd-alert-12345",
  payload: { ...original Datadog payload... },
  createdAt: "2025-12-17T02:30:00Z"
}
```

### IncidentTimelineEvent (Auditoria)

```typescript
{
  id: "cuid-zzz",
  incidentId: "cuid-xxx",
  type: "COMMENT",
  message: "[Datadog] alert received: SEV1 - Database Connection Pool Exhausted",
  authorId: null,
  createdAt: "2025-12-17T02:30:00Z"
}
```

---

## 🧪 Testar o Webhook

### 1. Com cURL (Windows PowerShell)

```powershell
$body = @{
    alert_id = "test-alert-001"
    title = "SEV1 - Test Alert"
    text = "This is a test alert from Datadog"
    tags = "service:auth,severity:sev1"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-ims-token" = "change-me-to-a-secure-token"
}

Invoke-WebRequest -Uri "http://localhost:3000/api/webhooks/datadog" `
  -Method POST `
  -Headers $headers `
  -Body $body
```

### 2. Com Insomnia / Postman

1. **URL**: `http://localhost:3000/api/webhooks/datadog`
2. **Method**: `POST`
3. **Headers**:
   ```
   Content-Type: application/json
   x-ims-token: change-me-to-a-secure-token
   ```
4. **Body** (JSON):
   ```json
   {
     "alert_id": "test-alert-001",
     "title": "SEV1 - Test Alert",
     "text": "This is a test alert from Datadog",
     "tags": "service:auth,severity:sev1"
   }
   ```

### 3. Verificar no Database

```bash
cd backend
npx prisma studio

# Ir a: Incident → listar últimos criados
# Ir a: IncidentSource → verificar externalId = "test-alert-001"
```

---

## 🔐 Segurança

### Token de Webhook

O token é **obrigatório** se `DD_WEBHOOK_TOKEN` estiver definido. Recomenda-se:

1. **Gerar um token seguro**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Configurar em `.env`**:
   ```env
   DD_WEBHOOK_TOKEN=abcd1234567890...
   ```

3. **Configurar no Datadog**:
   - Webhook → Custom Headers:
     ```
     x-ims-token: abcd1234567890...
     ```

### Validação de Payload

- Campos `null` ou `undefined` são convertidos a strings vazias/defaults.
- Não há validação de schema strict (aceita qualquer JSON).
- **Recomendação**: Implementar validação com `class-validator` se necessário.

---

## 📈 Tracing com Datadog

O backend está configurado para enviar traces ao Datadog:

```typescript
// em src/main.ts
tracer.init({
  service: process.env.DD_SERVICE || 'es-backend',
  env: process.env.DD_ENV || process.env.NODE_ENV,
  version: process.env.DD_VERSION,
  logInjection: true,
  runtimeMetrics: true,
  sampleRate: process.env.DD_TRACE_SAMPLE_RATE,
});
```

**Logs serão enviados ao Datadog** se o agente estiver ativo:

```bash
docker run -d --name dd-agent \
  -e DD_API_KEY=your-api-key \
  -e DD_SITE=datadoghq.com \
  -p 8126:8126/udp \
  gcr.io/datadog-image/agent:latest
```

---

## 🚨 Troubleshooting

### Erro: "Can't reach Datadog agent"

Se vires `Could not store tracer configuration for service discovery`, é apenas um aviso. O tracing funciona mesmo sem agente local.

### Webhook retorna 401 "Invalid webhook token"

- ✅ Verifica se `DD_WEBHOOK_TOKEN` está definido em `.env`
- ✅ Verifica se o header `x-ims-token` (ou `x-dd-token`) corresponde
- ✅ Sem `DD_WEBHOOK_TOKEN` definido, o token é ignorado

### Incidente não é criado

- ✅ Verifica se o database está ativo (`docker compose ps`)
- ✅ Verifica os logs: `docker compose logs backend`
- ✅ Se houver erro em `resolveReporterId`, pode criar "Datadog Bot" automaticamente

### Deduplicação não funciona

- ✅ Verifica se `alert_id` / `event_id` / `id` está presente no payload
- ✅ Se vazio/null, cada webhook cria um novo incident

---

## 📚 Referências

- [Datadog Webhooks](https://docs.datadoghq.com/integrations/webhooks/)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [dd-trace Documentation](https://datadoghq.dev/dd-trace-js/)

---

## ✅ Checklist de Setup

- [ ] `npm install` (backend)
- [ ] Variáveis de ambiente preenchidas (`DD_API_KEY`, `DD_WEBHOOK_TOKEN`)
- [ ] `docker compose up -d` (postgres + redis)
- [ ] `npm run start:dev` (backend)
- [ ] Testar webhook com cURL/Postman
- [ ] Verificar incidentes criados em `prisma studio`
- [ ] Configurar webhook no Datadog com URL e token

---

**Pronto para integração!** 🚀
