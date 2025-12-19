# Health Module — Health Check (API + DB)

Este documento descreve o módulo `health/` do backend IMS, responsável por expor um endpoint de health-check para monitorização e probes (ex.: Docker/Kubernetes, uptime monitors).

---

## 1) Estrutura do módulo

Localização: `backend/src/health/`

Ficheiros:
- `health.controller.ts` — endpoint HTTP `/health`
- `health.module.ts` — wiring do módulo e import do PrismaModule

Dependências:
- `PrismaModule` / `PrismaService` para testar conectividade à base de dados.

---

## 2) Objetivo

O módulo Health fornece:
- um sinal rápido de que a API está operacional
- um check simples da base de dados (PostgreSQL) usando Prisma
- metadata útil para debugging/observabilidade:
  - `uptime` do processo
  - `timestamp` atual em ISO

---

## 3) Endpoint

Base route: `/health`

### `GET /health` (HTTP 200)
O endpoint tenta executar um ping à BD com:

- `SELECT 1` via `this.prisma.$queryRaw\`SELECT 1\``

Se o ping falhar, o endpoint **não lança erro** e devolve `status = "degraded"`.

#### Resposta (shape)
```json
{
  "status": "ok" | "degraded",
  "checks": { "db": true | false },
  "uptime": 123,
  "timestamp": "2025-12-17T19:01:02.123Z"
}
```

#### Semântica dos campos
- `status`
  - `"ok"`: DB respondeu ao ping
  - `"degraded"`: DB não respondeu (ou erro de query)
- `checks.db`
  - booleano que indica o resultado do ping
- `uptime`
  - `process.uptime()` arredondado (em segundos)
- `timestamp`
  - data/hora no momento da resposta (ISO)

---

## 4) Notas de design

- O HTTP status devolvido é sempre `200`.
  - Isto é intencional para distinguir “API respondeu” de “DB está ok” dentro do payload.
  - Se quiserem comportamento mais estrito para readiness/liveness (ex.: `503` quando `db=false`), é uma alteração simples no controller.

---

## 5) Tests associados (referência)

### E2E
- `backend/test/e2e/health.e2e.spec.ts`

---
