# Unit Tests (UNIT.md)

Este documento descreve **a estrutura, convenções e padrões** dos testes do backend (NestJS + Prisma) e, em especial, do **conjunto de unit tests** em `backend/test/unit`.

> **Objetivo dos unit tests:** validar comportamento de *controllers/services/guards/helpers* isoladamente, com dependências mockadas (ex.: `PrismaService`, `fetch`, `pdfkit`).

---

## Estrutura de pastas

```
backend/
  test/
    unit/                     # ✅ Unit tests (isolados, com mocks)
      app.controller.spec.ts
      auth.controller.spec.ts
      auth.dto.spec.ts
      auth.service.spec.ts
      incident-audit.spec.ts
      incidents.controller.spec.ts
      incidents.filtering.spec.ts
      incidents.service.service-link.spec.ts
      incidents.service.spec.ts
      jwt.strategies.spec.ts
      main.spec.ts
      notifications.service.spec.ts
      reports.service.spec.ts
      roles.guard.spec.ts
      services.service.spec.ts
      teams.controller.spec.ts
      teams.service.spec.ts
      users.repository.spec.ts
      users.service.spec.ts

    integration/              # 🔶 Integration tests (DB real / Prisma real, mas sem HTTP full e2e)
      _helpers/
        prisma-reset.ts
      auth.int.spec.ts
      incidents.filtering.int.spec.ts
      incidents.int.spec.ts
      incidents.service-link.int.spec.ts
      notifications.int.spec.ts
      reports.export.int.spec.ts
      reports.int.spec.ts
      services.int.spec.ts
      teams.int.spec.ts
      users.int.spec.ts

  config/
    jest.unit.config.ts       # ✅ config Jest para unit tests
    jest.int.config.ts        # 🔶 config Jest para integration tests

  e2e/                        # 🔷 E2E tests (HTTP real contra app a correr em modo de teste)
    _helpers/
      e2e-utils.ts
    auth.e2e.spec.ts
    health.e2e.spec.ts
    incidents.e2e.spec.ts
    incidents.notifications.e2e.spec.ts
    incidents.service-link.e2e.spec.ts
    reports.e2e.spec.ts
    services.e2e.spec.ts
    teams.e2e.spec.ts
```

---

## Como executar

### Unit tests (recomendado no dia-a-dia)

Usa o config dedicado (para evitar apanhar integration/e2e por engano):

```bash
# opção 1 (direto com jest)
npx jest -c backend/config/jest.unit.config.ts

# opção 2 (modo watch)
npx jest -c backend/config/jest.unit.config.ts --watch
```

> Se tiveres scripts no `package.json`, normalmente será algo do género:
> `npm run test:unit` (ajusta ao teu projeto).

### Integration tests

```bash
npx jest -c backend/config/jest.int.config.ts
```

> Tipicamente dependem de base de dados e podem usar helpers como `prisma-reset.ts` para limpar estado.

### E2E tests

```bash
# depende da forma como o projeto levanta o app para e2e
# (muitas vezes: `npx jest -c test/jest-e2e.json` ou semelhante)
npx jest backend/e2e --runInBand
```

---

## Filosofia e convenções

### 1) O que é “unit” neste projeto?
- **Services**: lógica de negócio com Prisma mockado (sem DB real).
- **Controllers**: validação de parâmetros + delegação para services (service mockado).
- **Guards/Strategies**: regras de autorização/autenticação isoladas.
- **Helpers**: funções puras (ou quase) testadas com inputs controlados.

### 2) Naming
- Ficheiros terminam em `*.spec.ts`.
- Estrutura `describe('X', () => { ... })` com testes em PT/EN (o importante é consistência).

### 3) Mocks
- **Prisma**: quase sempre via objetos com `jest.fn()` por modelo (`prisma.incident.findMany = jest.fn()`).
- **Transactions**: padrão comum é simular `$transaction(cb)` e passar um “tx client” (`__tx`) para as operações dentro da transação.
- **I/O externo**:
  - `global.fetch` mockado para Discord/PagerDuty.
  - `pdfkit` mockado via `jest.mock('pdfkit', ..., { virtual: true })` para garantir que o CI não precisa da lib instalada.

---

## Inventário dos unit tests (o que cada ficheiro cobre)

### Controllers
- **`app.controller.spec.ts`**
  - Smoke tests / endpoints base do app (ex.: `GET /` ou health básico, dependendo do teu controller).

- **`auth.controller.spec.ts`**
  - Rotas de autenticação (ex.: register/login/refresh), validações e delegação correta para `AuthService`.

- **`incidents.controller.spec.ts`**
  - Rotas de incidentes (create/list/detail/update/status/comments/subscribe) e delegação para `IncidentsService`.

- **`teams.controller.spec.ts`**
  - Rotas de equipas (CRUD + members) e delegação para `TeamsService`.

### Services
- **`auth.service.spec.ts`**
  - Lógica de autenticação (hash/compare/refresh tokens/roles), com dependências mockadas.

- **`incidents.service.spec.ts`**
  - Lógica central de Incidents:
    - `create` com defaults (ex.: `SEV3` + `NEW`) e efeitos laterais (timeline + subscription).
    - `findAll` com filtros (status/severity/assignee/team/search/datas).
    - `findOne` com `NotFoundException` quando não existe.
    - `update` com `FIELD_UPDATE` e `ASSIGNMENT` via `createMany`.
    - `changeStatus` com transições válidas e inválidas (`BadRequestException`).
    - `addComment`, `listComments`, `listTimeline`, `subscribe`, `unsubscribe`.

- **`incidents.service.service-link.spec.ts`**
  - Cenários específicos de ligação de incidentes a serviços (service-link), regras e efeitos em timeline.

- **`notifications.service.spec.ts`**
  - Integrações externas (Discord e PagerDuty) com `global.fetch` mockado:
    - Falha quando env vars não existem (`DISCORD_WEBHOOK_URL`, `PAGERDUTY_ROUTING_KEY`).
    - Payload correto (Discord) e mapping de severidade (PagerDuty).
    - Tratamento de respostas `ok=false` e de erros em `res.text()`.

- **`reports.service.spec.ts`** (full coverage / branch coverage)
  - Teste intensivo do `ReportsService`:
    - helpers de auth/scope (admin vs user + forbidden paths)
    - helpers de ranges e formatação (UTC day boundaries, clamp de range, etc.)
    - helpers de séries/ticks (fill series, nice ticks)
    - export CSV (escaping, mttr/sla, clamp de limit)
    - export PDF (mock pdfkit, paging, layout, timeline/comments, auditoria)
    - auditoria do hash (mismatch => `ConflictException` + timeline event)

- **`services.service.spec.ts`**
  - Listagem por filtros (`isActive`, pesquisa por `q`) e lookups por `id`/`key`.

- **`teams.service.spec.ts`**
  - CRUD de equipas e gestão de membros:
    - criação com `memberIds`
    - filtros de search
    - `findForUser`
    - `addMember` com remoção de outras equipas (dependendo da regra do teu domínio)
    - `removeMember`, `update` (inclui reset de members), `remove` com NotFound

- **`users.service.spec.ts`**
  - Lógica de users:
    - `create` rejeita email duplicado
    - hash de password com `bcrypt.hash` mockado
    - `validatePassword` com `bcrypt.compare`
    - `changePassword` com validações e atualização

### DTOs / Validation
- **`auth.dto.spec.ts`**
  - Testes de validação dos DTOs de auth (class-validator), campos obrigatórios/formatos.

### Guards / Strategies
- **`roles.guard.spec.ts`**
  - Guard baseado no decorator `@Roles(...)` + `Reflector`:
    - sem roles => permite
    - user sem role => bloqueia
    - role diferente => bloqueia
    - role igual => permite

- **`jwt.strategies.spec.ts`**
  - Estratégias JWT (access/refresh) e validação do payload, extração de user, etc. (depende do teu código).

### Bootstrap / Main
- **`main.spec.ts`**
  - Verifica side-effects do bootstrap (pipes globais, CORS, listen port, etc.) com mocks do NestFactory/app.

### Audit / Helpers
- **`incident-audit.spec.ts`**
  - Funções de auditoria (hash/hmac) e comportamento quando faltam segredos/env (ex.: `AUDIT_HMAC_SECRET`).

- **`users.repository.spec.ts`**
  - Wrapper do Prisma `user` model (find/create/update/delete) e regras de mapeamento (ex.: só inclui `role` se vier definido).

---

## Padrões de implementação que o teu projeto já usa (e vale manter)

### Prisma `$transaction` com `__tx`
Para simular transações sem DB real, existe um padrão forte:

- `prisma.$transaction(cb)` executa `cb(tx)`
- o `tx` contém os mesmos models (`incident`, `incidentTimelineEvent`, ...)
- nos testes, validas que o service usou **tx** (ex.: `prisma.__tx.incident.create`) em vez do client global.

Este padrão é especialmente útil em:
- `create()` de incidentes (cria incidente + timeline + subscrição)
- `update()` (update + createMany de events + deleteMany de categorias/tags)
- qualquer fluxo que precisa de atomicidade

### Mocking de libs opcionais (pdfkit)
No `reports.service.spec.ts`, `pdfkit` é mockado como virtual para o teste rodar mesmo sem a dependency instalada.
Isso ajuda bastante em CI/ambientes “mínimos”.

### Mocking de fetch + env flags
`notifications.service.spec.ts` mostra um padrão limpo:
- define flags/env vars no `beforeEach`
- limpa tudo no `afterEach/afterAll`
- restaura `global.fetch` para evitar leak entre testes

---

## Checklist para adicionar novos unit tests

1. **Escolhe o tipo certo**
   - Lógica pura ou service isolado? → `test/unit`
   - Prisma + DB real? → `test/integration`
   - HTTP completo? → `e2e`

2. **Mocka dependências “na fronteira”**
   - Prisma: mocka só os métodos usados naquele teste.
   - I/O externo: mocka `fetch`, SDKs, libs.

3. **Testa comportamento, não implementação**
   - asserts no **payload enviado ao Prisma** (ex.: `toHaveBeenCalledWith({ data: expect.objectContaining(...) })`)
   - asserts em **exceções** (`NotFoundException`, `BadRequestException`, `ForbiddenException`, ...)
   - asserts em **efeitos laterais** (timeline/subscription/notifications)

4. **Mantém testes determinísticos**
   - evita `Date.now()` sem controlar
   - usa datas fixas (`new Date('2025-01-01T...Z')`)

---

## Troubleshooting rápido

- **“Jest hangs / open handles”**
  - corre com: `--detectOpenHandles --runInBand`
  - garante que mocks de `fetch` / timers / env vars são restaurados.

- **Falhas por diferenças de enum/string (Role, Status, etc.)**
  - decide padrão: comparar com `Role.ADMIN` (enum) vs `'ADMIN'` (string).
  - mantém o comportamento consistente e cobre com testes (o `ReportsService` já faz isso).

- **Tests a falhar por configs misturadas**
  - usa sempre `-c jest.unit.config.ts` para unit, `-c jest.int.config.ts` para integration.

---

## Notas finais

Este setup já está bem orientado para:
- **rápidos unit tests** (mocks agressivos)
- **integration tests** para validar Prisma + queries reais
- **e2e** para validar fluxos HTTP “de ponta a ponta”

