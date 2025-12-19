# BACKEND-OVERVIEW — IMS Backend (NestJS + Prisma)

Este documento é a **visão geral “final”** do backend do IMS (Incident Management System): arquitetura, módulos, regras de segurança (RBAC + scoping), convenções e um **sumário de endpoints** (com o que já está confirmado pelo código que enviaste).

---

## 0) TL;DR

- Backend em **NestJS**, persistência via **Prisma + PostgreSQL**.
- API exposta com prefixo global **`/api`** (`main.ts`).
- **Auth** por JWT (AccessJwtGuard) e **RBAC** `ADMIN` vs `USER`.
- Módulos principais: **Auth, Users, Teams, Services, Incidents, Reports, Notifications, Prisma, Audit, Health**.
- Exportações: **Reports** gera **CSV** e **PDF** (PDFKit), com verificação de integridade (audit hash) quando configurada.

---

## 1) Stack e responsabilidades

### Stack
- **Runtime:** Node.js
- **Framework:** NestJS (Modules, Controllers, Services, Guards)
- **DB/ORM:** PostgreSQL via **Prisma Client**
- **PDF:** `pdfkit` (no módulo de Reports)
- **Tracing/Observability:** `dd-trace` inicializado no `main.ts`
- **Validação:** `class-validator` + `ValidationPipe({ whitelist: true })` global

### Objetivo do backend
- Expor uma API HTTP para:
  - autenticação e sessão
  - gestão de incidentes
  - gestão de equipas e membros
  - catálogo de serviços
  - relatórios/exports (JSON/CSV/PDF)
- Implementar regras de segurança:
  - **RBAC** (Role-based access): `ADMIN` vs `USER`
  - **Scoping por equipa** quando aplicável (ex.: reports/export)
- Garantir consistência para dashboards, exportações e testes.

---

## 2) Bootstrap e comportamento global (main.ts)

### Prefixo global
- Todos os controllers são servidos com prefixo **`/api`**
  - Ex.: `@Controller('services')` → **`/api/services`**

### CORS
- Configurado para permitir o frontend local:
  - `origin: 'http://localhost:5173'`
  - inclui `OPTIONS` para preflight
  - `credentials: true` (preparado para cookies, se necessário)

### Validação
- `ValidationPipe({ whitelist: true })`
  - Campos extra enviados pelo cliente são removidos (não passam para o DTO).

### Tracing (Datadog)
- `dd-trace` é inicializado **antes** de o Nest carregar módulos.
- Variáveis relevantes:
  - `DD_TRACE_SAMPLE_RATE` (default 1)
  - `DD_SERVICE`, `DD_ENV`/`NODE_ENV`, `DD_VERSION`

---

## 3) Mapa de módulos (arquitetura)

Pasta base: `backend/src/`

### Infra / Core
- `app/`  
  - **AppController/AppService**: endpoint simples (Hello World) para sanity-check.
- `prisma/`  
  - `PrismaModule` (global) + `PrismaService` (liga/desliga DB).
- `health/`  
  - health checks (endpoint típico `GET /api/health` — confirmar path exato no controller).
- `audit/`  
  - helpers de integridade (ex.: `ensureIncidentAuditHash`, `computeIncidentAuditHash`).

### Domínio
- `auth/`
  - registo/login/refresh/logout + guards/strategies JWT + roles.
- `users/`
  - `UsersService` + `UsersRepository` (sem controller neste snapshot).
- `teams/`
  - CRUD de equipas + gestão de membros (com regra “um user só pode estar em 1 equipa”).
- `services/`
  - catálogo/listagens e lookup por `id`/`key`.
- `incidents/`
  - CRUD, estados, timeline/comments, ligações a service, integrações (a documentar pelo código do módulo).
- `reports/`
  - KPIs, breakdown, timeseries, export CSV e PDF (PDFKit) com scoping e integridade.

### Integrações
- `notifications/`
  - envio para Discord e trigger no PagerDuty (serviço interno; sem controller no snapshot).

---

## 4) Segurança, autorização e scoping

### 4.1 Autenticação
- Requests protegidos usam **JWT access token** (via guard).
- Tipicamente existe também **refresh token** para renovar sessão (depende do módulo Auth).

### 4.2 RBAC (ADMIN vs USER)
- O backend diferencia permissões por role.
- Em Reports, por exemplo:
  - `ADMIN`: pode usar `teamId` arbitrário (ou não definir).
  - `USER`: fica limitado ao **teamId** onde é membro.

### 4.3 Scoping por equipa (exemplo concreto: Reports)
- Para `USER`, o service:
  - resolve a equipa do utilizador
  - bloqueia acesso a outras equipas (`ForbiddenException`)
- Para export de incidente individual:
  - valida que o incidente pertence ao scope do utilizador (`assertIncidentExportAllowed`)

### 4.4 Erros padrão (Nest)
- **400**: validação DTO / request inválida (`BadRequestException`)
- **401**: token inválido/ausente (guards JWT)
- **403**: sem permissão / scope inválido (`ForbiddenException`)
- **404**: recurso não encontrado (`NotFoundException`)
- **409**: conflitos de integridade (ex.: audit hash mismatch no PDF export, ou constraints)

---

## 5) Base de dados e seeds (visão funcional)

### Entidades nucleares (alto nível)
- `User`, `Team`, `Service`
- `Incident`
  - `status`, `severity`
  - `reporter`, `assignee`
  - `timeline events`, `comments`
  - `categories`, `tags`
  - CAPAs e contagens
  - timestamps para métricas (`createdAt`, `resolvedAt`, `closedAt`)
  - `auditHash` (quando integridade está ativa)

### Seeds (prisma/)
- `seed.ts`: base (equipas, users, services, categories)
- `seed.incidents.ts`: dataset realista (incidents + timeline/comments/tags/…)
- `seed.runner.ts`: ordem de execução

> Nota: para detalhes (constrangimentos, índices, relações), ver `DATABASE-STRUCTURE.md` e `SEED-LOGIC.md`.

---

## 6) Endpoints — sumário (confirmados vs a confirmar)

> Convenção: todos os paths abaixo já incluem o prefixo global **`/api`**.

### 6.1 App
✅ **Confirmado**
- `GET /api` → `"Hello World!"`

### 6.2 Services
✅ **Confirmado**
- `GET /api/services?isActive=true|false&q=auth`
  - filtros: `isActive` (string boolean), `q` (contains em `name`/`key`)
- `GET /api/services/id/:id`
- `GET /api/services/key/:key`

### 6.3 Teams (protegido por JWT)
✅ **Confirmado** (usa `AccessJwtGuard`)
- `POST /api/teams`
- `GET /api/teams?search=...`
- `GET /api/teams/me` (equipas onde o user autenticado é membro)
- `GET /api/teams/:id`
- `PATCH /api/teams/:id`
- `DELETE /api/teams/:id`
- `GET /api/teams/:id/members`
- `POST /api/teams/:id/members` (body: `{ userId }`)
- `DELETE /api/teams/:id/members/:userId`

### 6.4 Reports (protegido por JWT)
✅ **Confirmado** (usa `AccessJwtGuard`)
- `GET /api/reports/kpis`
- `GET /api/reports/breakdown`
- `GET /api/reports/timeseries`
- `GET /api/reports/export.csv` (download)
- `GET /api/reports/export.pdf` (download)

Notas relevantes:
- CSV: `Content-Type: text/csv; charset=utf-8`
- PDF: `Content-Type: application/pdf`
- Scoping por equipa aplicado no service
- Integridade (audit hash) pode bloquear export de PDF em caso de mismatch (409)

### 6.5 Users
⚠️ **Parcial**
- Existe `UsersService` + `UsersRepository`, mas **não há UsersController** no snapshot.
- Operações disponíveis internamente:
  - criar user (com bcrypt)
  - lookup por email/id
  - change password

### 6.6 Notifications
⚠️ **Serviço interno**
- Sem controller no snapshot.
- Funções:
  - `sendDiscord(message)`
  - `triggerPagerDuty(summary, severity, incidentId)`
- Requer env vars:
  - `DISCORD_WEBHOOK_URL`
  - `PAGERDUTY_ROUTING_KEY`

### 6.7 Auth / Incidents / Health
⚠️ **A confirmar pelo código do módulo**
- Existem módulos e referências, mas paths finais e regras completas devem ser validados nos controllers.
- Assim que os controllers finais estiverem fechados, este overview passa a listar:
  - paths exatos
  - DTOs e exemplos
  - permissões por endpoint

---

## 7) Convenções de implementação (padrões do projeto)

### Controllers
- Responsáveis por:
  - routing
  - validação via DTOs
  - delegar regra de negócio para services
- Downloads (CSV/PDF) usam `@Res()` para headers e body.

### Services
- Encapsulam:
  - regras de negócio
  - queries Prisma
  - scoping/autorizações específicas do domínio (quando não é apenas guard)

### Prisma
- `PrismaService` liga no `onModuleInit()` e fecha no `onModuleDestroy()`
- `PrismaModule` é `@Global()` (pode ser injetado sem reimport em todos os módulos).

---

## 8) Variáveis de ambiente relevantes

### Runtime / Server
- `PORT` (default 3000)

### Tracing
- `DD_TRACE_SAMPLE_RATE`
- `DD_SERVICE`
- `DD_ENV` / `NODE_ENV`
- `DD_VERSION`

### Notifications
- `DISCORD_WEBHOOK_URL`
- `PAGERDUTY_ROUTING_KEY`

### Audit / Integridade
- `AUDIT_HMAC_SECRET` (ativa verificação/garantia de audit hash em exports)

---

## 9) Documentos “de referência” (estrutura de docs)

Recomendação de docs (um por módulo + base):
- `BACKEND-OVERVIEW.md` (este ficheiro)
- `AUTH.md`
- `USERS.md`
- `TEAMS.md`
- `SERVICES.md`
- `INCIDENTS.md`
- `REPORTS.md`
- `NOTIFICATIONS.md`
- `PRISMA.md`
- `DATABASE-STRUCTURE.md`
- `SEED-LOGIC.md`

Cada doc de módulo deve conter:
- Responsabilidade
- Endpoints e DTOs
- Regras de auth/scoping
- Erros e edge cases
- Notas de performance (queries, limites, caps)
- Exemplos (curl / payloads)
- Testabilidade (o que os unit/e2e garantem)

---
