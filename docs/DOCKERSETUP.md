# Docker Setup (DEV + CI)

Este documento descreve como correr o **Incident Management System** via Docker em **desenvolvimento (DEV)** e como preparar um **stack mínimo de CI** para correr testes automatizados com uma base de dados isolada.

> Objetivo: garantir que qualquer pessoa da equipa consegue levantar DB/Redis/API com **um comando**, e que o CI usa um ambiente **reprodutível**.

---

## 1) Ficheiros de Docker recomendados

### DEV (local)
- `docker-compose.yml` — stack de desenvolvimento (Postgres + Redis + Backend opcional + Datadog opcional)

### CI (testes)
- `docker-compose.ci.yml` — stack para correr testes (Postgres/Redis + Backend em `NODE_ENV=test`)

> Nota: podes usar `docker compose -f docker-compose.yml -f docker-compose.ci.yml ...` para **sobrepor** variáveis e comportamentos quando necessário.

---

## 2) DEV Stack — o que cada serviço faz

### `postgres` (PostgreSQL 15)
**Responsabilidade**: persistência dos dados do sistema (incidentes, equipas, users, etc.).

**Pontos importantes**
- Porta: `5432` exposta para o host (DBeaver/pgAdmin/psql).
- Volume: `pgdata` para manter dados entre restarts.
- Healthcheck: garante readiness (`pg_isready`) antes de subir a API.

### `redis` (Redis 7)
**Responsabilidade**: cache / pubsub / filas / locks (mesmo que nem tudo seja usado já, fica pronto para evoluções).

**Pontos importantes**
- Porta: `6379` (útil em dev, opcional).
- Volume: `redis_data` para persistência leve (dev).
- Healthcheck: `redis-cli ping`.

### `backend` (NestJS API) — **opcional em DEV**
**Responsabilidade**: API NestJS disponível em `http://localhost:3000`.

**Porque é “opcional” em DEV**
- Em muitas equipas, corre-se o backend **fora** do Docker para hot-reload mais rápido.
- Mas manter o serviço permite “one-command dev” e demos com consistência.

**O que faz no arranque**
- `npm ci`
- `prisma migrate deploy`
- `prisma db seed`
- `npm run start:dev` (watch mode)

> Se queres controlar quando faz seed/migrations, altera o `command` (ver secção de boas práticas).

### `datadog` (Agent) — **opcional**
**Responsabilidade**: APM (tracing) + métricas + logs.

**Notas**
- Requer `DD_API_KEY` (env). Se não quiseres monitorização, podes remover este serviço.
- Expõe `8126` (APM) e `8125/udp` (DogStatsD).

---

## 3) Como correr em DEV

### 3.1 Subir stack (recomendado)
Na raiz do projeto:

```bash
docker compose up -d --build
```

Ver estado:
```bash
docker compose ps
```

Ver logs da API:
```bash
docker compose logs -f backend
```

### 3.2 Parar stack
```bash
docker compose down
```

### 3.3 Reset total (inclui volumes)
⚠️ Apaga dados locais do Postgres/Redis:

```bash
docker compose down -v
```

---

## 4) Variáveis de ambiente (DEV)

### Backend (dentro do compose)
- `DATABASE_URL` deve apontar para `postgres` (hostname interno do Docker):
  - `postgresql://postgres:postgres@postgres:5432/incidentsdb?schema=public`
- `REDIS_URL`: `redis://redis:6379`
- JWT:
  - `JWT_SECRET` (ou `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, dependendo do teu backend)

### Datadog
- `DD_API_KEY` (idealmente via `.env` na raiz do repo)
- `DD_SITE` (ex.: `datadoghq.eu`)

---

## 5) Boas práticas (DEV)

### 5.1 Controlar migrations/seed
O `command` atual aplica migrations e seed automaticamente. Em equipas grandes, pode ser preferível:
- migrations/seed só quando explicitamente pedido
- para evitar “surpresas” ao levantar stack

Exemplo (arranque só com API):
```yaml
command: sh -lc "npm ci && npm run start:dev"
```

E depois correr manualmente:
```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### 5.2 Correr backend fora do Docker (modo híbrido)
Se queres DB/Redis no Docker e backend local:
1) Sobe apenas infra:
```bash
docker compose up -d postgres redis
```
2) No backend local, usa `DATABASE_URL` com `localhost`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/incidentsdb?schema=public
REDIS_URL=redis://localhost:6379
```

---

## 6) CI Stack — objetivos e isolamento

Em CI queremos:
- DB dedicada a testes (`incidentsdb_test`)
- `NODE_ENV=test`
- Secrets de JWT previsíveis (para testes)
- (Opcional) `USE_COOKIE_REFRESH=false` para simplificar chamadas HTTP nos testes

O ficheiro `docker-compose.ci.yml` implementa exatamente isso e pode ser usado em pipelines (GitHub Actions / GitLab CI / Jenkins).

---

## 7) Como usar o stack CI localmente

Subir em modo “CI”:
```bash
docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --build
```

Correr testes dentro do container:
```bash
docker compose exec backend npm test
```

Desligar:
```bash
docker compose -f docker-compose.yml -f docker-compose.ci.yml down -v
```

---

## 8) Troubleshooting rápido

### Porta já em uso (5432 / 6379 / 3000)
- Fecha serviços locais (Postgres/Redis) **ou** muda o mapeamento de portas no compose.

### Prisma não conecta à DB
- Confirma `DATABASE_URL`:
  - **no Docker** usa `postgres` como hostname
  - **no host** usa `localhost`

### Seed/migrate a falhar
- Ver logs:
```bash
docker compose logs -f backend
```
- Entra no container:
```bash
docker compose exec backend sh
```

---

## 9) Checklist DEV (rápido)
- ✅ `docker compose up -d --build`
- ✅ `docker compose ps` mostra `healthy` em postgres/redis
- ✅ API responde em `http://localhost:3000/health` (se existir health endpoint)
