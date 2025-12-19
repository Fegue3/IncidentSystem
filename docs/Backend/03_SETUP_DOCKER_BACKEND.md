# Setup — Backend via Docker Compose (DEV)

Este guia explica como levantar **PostgreSQL + Redis + Backend NestJS** via `docker compose`, usando o `docker-compose.yml` da raiz do projeto.

> Objetivo: ter um ambiente “one‑command dev” (DB/Redis/API) com migrations + seed aplicados automaticamente.

---

## 1) Pré‑requisitos

- Docker Desktop (Windows/macOS) ou Docker Engine + Compose (Linux)
- Node.js **não é obrigatório** para correr o backend *dentro* do Docker, mas é útil para correr scripts localmente.
- Portas livres no host:
  - `5432` (Postgres)
  - `6379` (Redis)
  - `3000` (Backend)
  - `8126` (Datadog APM) *(opcional)*

---

## 2) Serviços levantados pelo compose

### `postgres` (PostgreSQL 15)
- DB: `incidentsdb`
- User/pass: `postgres/postgres`
- Volume persistente: `pgdata`

**Healthcheck**: `pg_isready -U postgres -d incidentsdb`

### `redis` (Redis 7 alpine)
- URL interna no compose: `redis://redis:6379`
- Volume persistente: `redis_data`

**Healthcheck**: `redis-cli ping`

### `backend` (NestJS)
- Build: `./backend/Dockerfile`
- Código montado como volume: `./backend:/app` (hot‑reload via `start:dev`)
- `node_modules` isolado num volume: `api_node_modules:/app/node_modules`

**Importante**: como o backend corre *dentro* do Docker, a DB é acedida pelo hostname do serviço `postgres`:
- `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/incidentsdb?schema=public`

### `datadog` (Agent) — opcional
- Só é útil se estiveres a usar Datadog APM/metrics em dev.
- Requer `DD_API_KEY` no `.env` da raiz (ou exportado no shell).

---

## 3) Variáveis de ambiente

O compose já injeta as variáveis essenciais no serviço `backend`:

- `DATABASE_URL` (aponta para `postgres` dentro da rede do compose)
- `REDIS_URL` (aponta para `redis` dentro da rede do compose)
- `JWT_SECRET`
- `PORT`
- (Opcional) `DD_*` (Datadog)

### `.env` na raiz (recomendado)
Cria um `.env` na raiz do repo para Datadog (opcional):

```env
DD_API_KEY=...
DD_SITE=datadoghq.eu
```

> Se não usares Datadog, podes deixar vazio — mas o container `datadog` pode continuar a subir “em branco” (sem enviar dados).

---

## 4) Subir tudo (DB + Redis + Backend + Datadog)

Na raiz do projeto:

```bash
docker compose up -d --build
```

Ver estado:

```bash
docker compose ps
```

Logs do backend:

```bash
docker compose logs -f backend
```

A API fica disponível em:
- `http://localhost:3000`
- Com prefixo global `/api` → `http://localhost:3000/api/...`

---

## 5) O que acontece ao arrancar o backend (command do compose)

O `backend` arranca com o comando:

```sh
npm ci && npx prisma migrate deploy && npx prisma db seed && npm run start:dev
```

Isto significa:
1. Instala dependências (reprodutível) com `npm ci`
2. Aplica migrations pendentes (`migrate deploy`)
3. Executa seed (`prisma db seed`)
4. Arranca o Nest em modo watch (`start:dev`)

### Nota: Seeds e dados persistentes
Como o Postgres usa volume (`pgdata`), os dados **persistem** entre restarts.

Se correres o compose várias vezes, a seed pode:
- criar duplicados (se não tiver guards), ou
- falhar por constraints únicas (ex.: `Team.name`, `Service.key`, etc.)

Se quiseres “DB limpa”, vê a secção **Reset**.

---

## 6) Modos úteis (infra vs stack completa)

### A) Só DB + Redis (backend a correr local)
Útil se queres hot‑reload “nativo” no teu host (sem Docker para Node).

```bash
docker compose up -d postgres redis
```

Depois, localmente no `backend/`:
- Ajusta `DATABASE_URL` para o host (atenção ao hostname):
  - `postgresql://postgres:postgres@localhost:5432/incidentsdb?schema=public`

E corre:
```bash
cd backend
npm ci
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

### B) Stack completa (tudo em Docker)
É o modo “one‑command”:
```bash
docker compose up -d --build
```

---

## 7) Reset completo (⚠️ apaga dados)

Remove containers + volumes:

```bash
docker compose down -v
```

Depois volta a subir:

```bash
docker compose up -d --build
```

---

## 8) Troubleshooting

### “Port already in use” (3000/5432/6379)
- Fecha processos locais nessas portas ou altera o mapping no `docker-compose.yml`.

### Prisma não conecta / `DATABASE_URL`
- Se o backend corre no Docker: host deve ser `postgres`
- Se o backend corre local: host deve ser `localhost`

### Seed falha por `Unique constraint failed`
- É normal quando os dados já existem no volume.
- Faz reset com `docker compose down -v` (apaga DB) ou ajusta a seed para ser idempotente.

### CORS no frontend
- O backend permite `origin: http://localhost:5173`.
- Se o teu frontend estiver em outra porta (ex.: 5174), ajusta `enableCors` no `main.ts`.

### Datadog agent
- Se não usares Datadog, podes:
  - remover o serviço `datadog` do compose, ou
  - deixar `DD_API_KEY` vazio (não envia dados).

---

## 9) Checklist rápido

- [ ] `docker compose up -d --build`
- [ ] `docker compose ps` (postgres/redis healthy)
- [ ] `docker compose logs -f backend` (sem erros de prisma/migrate/seed)
- [ ] API responde em `http://localhost:3000/api/health` (se o HealthModule estiver ativo)

---

## 10) Referências relacionadas na docs

- `docs/Backend/01_SETUP_LOCAL_BACKEND.md`
- `docs/Backend/02_CONFIGURATION_BACKEND.md`
- `docs/Backend/Database/README.md`
