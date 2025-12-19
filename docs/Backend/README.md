# Backend — README

Este backend é uma API em **NestJS** com **Prisma** (ORM) e uma base de dados relacional (tipicamente Postgres). Inclui testes **unitários**, **integração** e **end‑to‑end (E2E)** com **Jest**, e documentação em `docs/Backend/**`.

> Este README serve como “mapa” do backend: estrutura, módulos, base de dados, testes e como executar localmente.

---

## Stack & conceitos

- **Framework:** NestJS (controllers, services, guards, modules, DI).
- **Base de dados:** Prisma (schema, migrations, seed).
- **Testes:** Jest (unit/integration/e2e), com mocks de Prisma quando apropriado.
- **Relatórios:** Export CSV/PDF (há mocks de `pdfkit` nos testes unitários para cobertura total).
- **Notificações:** Integrações externas (Discord/PagerDuty) controladas por env vars/feature flags.

---

## Estrutura de pastas (visão geral)

A organização relevante (simplificada) do backend:

```text
backend/
├─ src/
│  ├─ app/…
│  ├─ auth/…
│  ├─ audit/…
│  ├─ incidents/…
│  ├─ notifications/…
│  ├─ prisma/…
│  ├─ reports/…
│  ├─ services/…
│  ├─ teams/…
│  ├─ users/…
│  └─ main.ts
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/…
│  └─ seed*.ts
├─ test/
│  ├─ unit/…
│  ├─ integration/…
│  └─ e2e/…
├─ config/
│  ├─ jest.unit.config.ts
│  └─ jest.int.config.ts
└─ docs/
   └─ Backend/
      ├─ 00_BACKEND-OVERVIEW.md
      ├─ 01_SETUP_LOCAL_BACKEND.md
      ├─ 02_CONFIGURATION_BACKEND.md
      ├─ 03_SETUP_DOCKER_BACKEND.md
      ├─ Database/
      │  ├─ DATABASE-STRUCTURE.md
      │  ├─ MIGRATIONS.md
      │  ├─ SCHEMA.md
      │  └─ SEED-LOGIC.md
      ├─ Modules/
      │  ├─ APP.md
      │  ├─ AUDIT.md
      │  ├─ AUTH.md
      │  ├─ HEALTH.md
      │  ├─ INCIDENTS.md
      │  ├─ NOTIFICATIONS.md
      │  ├─ PRISMA.md
      │  ├─ REPORTS.md
      │  ├─ SERVICES.md
      │  ├─ TEAMS.md
      │  └─ USERS.md
      └─ Tests/
         ├─ JEST-CONFIGS.md
         ├─ unit/UNIT.md
         ├─ integration/INTEGRATION.md
         ├─ integration/PRISMA-RESET.md
         └─ e2e/E2E.md
```

> A pasta `docs/Backend` é a referência “oficial” de detalhes por módulo e por tipo de teste.

---

## Como o código está organizado (NestJS)

Em cada módulo do `src/` (ex.: `incidents/`, `reports/`, `teams/`), vais encontrar o padrão típico:

- **Controller**: define rotas HTTP e valida input (DTOs).
- **Service**: contém regras de negócio (chama Prisma, aplica validações, dispara notificações).
- **DTOs**: contratos de entrada/saída (class-validator/class-transformer).
- **Guards/Decorators** (Auth): controlo de permissões (ex.: `RolesGuard` + `@Roles()`).
- **PrismaService**: wrapper central do PrismaClient para DI no Nest.

---

## Módulos (o que faz cada um)

Resumo rápido (detalhe em `docs/Backend/Modules/*.md`):

- **APP**: wiring geral, health endpoints, bootstrap.
- **PRISMA**: acesso a dados, lifecycle, helpers de BD.
- **AUTH**: login/register, JWT (access/refresh), roles e guards.
- **USERS**: gestão de utilizadores (criação, password, tokens, etc.).
- **TEAMS**: equipas e membros (CRUD + membership).
- **SERVICES**: catálogo de serviços monitorizados (listagem e lookup por id/key).
- **INCIDENTS**: criação/edição de incidentes, timeline, comentários, filtros.
- **REPORTS**: KPIs, breakdowns, timeseries, export CSV/PDF (inclui verificação de audit hash).
- **NOTIFICATIONS**: integrações externas (Discord/PagerDuty) com feature flags.
- **AUDIT**: mecanismos de integridade/audit (hash HMAC e validações).
- **HEALTH**: endpoints de healthcheck (para Docker/K8s/uptime).

---

## Base de Dados (Prisma)

- **Schema:** `prisma/schema.prisma`
- **Migrations:** `prisma/migrations/*`
- **Seed:** scripts em `prisma/seed*.ts` (ver `docs/Backend/Database/SEED-LOGIC.md`)

Documentação recomendada:
- `docs/Backend/Database/SCHEMA.md`
- `docs/Backend/Database/MIGRATIONS.md`
- `docs/Backend/Database/DATABASE-STRUCTURE.md`

### Reset de BD para testes
Para testes de integração, existe tipicamente um helper `test/integration/_helpers/prisma-reset.ts` que:
- limpa o estado da BD
- volta a aplicar o schema/migrations
- prepara dados mínimos para os testes

Ver: `docs/Backend/Tests/integration/PRISMA-RESET.md`.

---

## Testes (unit / integration / e2e)

A pasta `test/` está separada por intenção:

### 1) Unit tests — `test/unit`
Objetivo: testar **classes isoladas** (services/guards/repositories/controllers) com **mocks** (ex.: Prisma mock).

Exemplos (pelos specs existentes no teu projeto):
- `incidents.service.spec.ts`: cria/edita incidentes, comentários, timeline, subscribe/unsubscribe.
- `notifications.service.spec.ts`: valida feature flags/env vars e chamadas a `fetch`.
- `reports.service.full.spec.ts`: cobertura extensa de branches (inclui mock virtual de `pdfkit`).
- `roles.guard.spec.ts`: validação de roles via `Reflector` e `@Roles()`.
- `teams.controller.spec.ts`: controller delega para o service.
- `teams.service.spec.ts`: CRUD + membership com `$transaction` mockado.
- `services.service.spec.ts`, `users.repository.spec.ts`, `users.service.spec.ts`, etc.

Boas práticas aplicadas:
- `beforeEach` com mocks fresh
- `jest.clearAllMocks()` / `jest.resetAllMocks()`
- mocks de `$transaction` para simular transações Prisma
- mocks “virtual” para libs opcionais (ex.: `pdfkit`) para não depender de instalação no ambiente de testes

### 2) Integration tests — `test/integration`
Objetivo: testar **módulos a falar com BD real** (Prisma + queries reais), mas ainda em modo “interno” (sem HTTP full stack).

- Normalmente corre com DB dedicada de testes.
- Usa `prisma-reset.ts` antes de suites/casos.

Ver: `docs/Backend/Tests/integration/INTEGRATION.md`.

### 3) E2E tests — `test/e2e`
Objetivo: testar o fluxo **via HTTP** (Nest app + pipes/guards + Prisma + DB), simulando o comportamento real da API.

- Inclui helpers em `test/e2e/_helpers` (ex.: `e2e-utils.ts`).
- Cobre endpoints como auth, health, incidents, reports, etc.

Ver: `docs/Backend/Tests/e2e/E2E.md` e `docs/Backend/Tests/e2e/E2E-UTILS.md`.

---

## Configuração do Jest

Configs no projeto:
- `config/jest.unit.config.ts`
- `config/jest.int.config.ts`

Documentação: `docs/Backend/Tests/JEST-CONFIGS.md`.

### Comandos (sugestão)
Os scripts exatos dependem do `package.json`, mas tipicamente tens algo semelhante a:

```bash
# Unit
npm run test:unit
# ou: npx jest --config config/jest.unit.config.ts

# Integration
npm run test:integration
# ou: npx jest --config config/jest.int.config.ts

# E2E (se existir config própria)
npm run test:e2e
```

Para testes que dependem de BD: recomendado `--runInBand` (evita concorrência de suites a mexer na mesma BD):

```bash
npx jest --runInBand --config config/jest.int.config.ts
```

---

## Variáveis de Ambiente (env)

Os nomes exatos podem variar, mas do que já aparece no teu código/testes:

### Notificações
- `NOTIFICATIONS_ENABLED=true|false`
- `DISCORD_NOTIFICATIONS_ENABLED=true|false`
- `PAGERDUTY_NOTIFICATIONS_ENABLED=true|false`
- `DISCORD_WEBHOOK_URL=...`
- `PAGERDUTY_ROUTING_KEY=...`

### Auditoria / Integridade
- `AUDIT_HMAC_SECRET=...` (usado para hash/validação de incidentes nos reports)

### Base de dados
- `DATABASE_URL=...` (Prisma)

Ver: `docs/Backend/02_CONFIGURATION_BACKEND.md`.

---

## Como correr localmente (resumo)

Segue os guias completos:
- `docs/Backend/01_SETUP_LOCAL_BACKEND.md`
- `docs/Backend/03_SETUP_DOCKER_BACKEND.md`

Checklist típico:
1. definir `DATABASE_URL` (e restantes secrets)
2. aplicar migrations: `npx prisma migrate dev` (ou equivalente do projeto)
3. arrancar o backend: `npm run start:dev` (Nest)
4. (opcional) seed: `npx prisma db seed` / script de seed do projeto

---

## Navegação rápida da documentação

- Overview: `docs/Backend/00_BACKEND-OVERVIEW.md`
- Configuração: `docs/Backend/02_CONFIGURATION_BACKEND.md`
- Docker: `docs/Backend/03_SETUP_DOCKER_BACKEND.md`
- DB: `docs/Backend/Database/*`
- Módulos: `docs/Backend/Modules/*`
- Testes: `docs/Backend/Tests/*`

---

## Convenções & notas práticas

- **Imports relativos** nos testes usam `../../src/...` a partir de `test/unit|integration|e2e`.
- **Prisma mocks**: em unit tests, o padrão é mockar `prisma.<model>.<op>` e, quando necessário, mockar `$transaction` para devolver um `tx` (como já fazes).
- **PDF nos testes**: usa-se um mock “virtual” de `pdfkit` para cobertura sem depender da lib instalada e para simular paginação (alteração de `doc.y`).
- **Feature flags**: quando um teste falha por “não fez fetch”, confirma que o env está ligado (`*_ENABLED=true`) e que as URLs/keys existem no env.

---

## Contribuir / manter

- Ao criares um novo módulo, cria:
  - `src/<module>/...`
  - documentação em `docs/Backend/Modules/<MODULE>.md`
  - testes unitários em `test/unit/<module>.*.spec.ts`
  - (se aplicável) testes integration/e2e
- Mantém o README e `docs/Backend/README.md` alinhados com mudanças de estrutura.

---

**Ficheiros chave (leitura recomendada):**
- `docs/Backend/README.md` (entrada da documentação do backend)
- `docs/Backend/Tests/unit/UNIT.md` (estrutura e regras de unit tests)
- `docs/Backend/Tests/JEST-CONFIGS.md` (configs e como correr cada suite)
