# Testes E2E (Backend)

Esta secção documenta os testes **End-to-End (E2E)** do backend NestJS.
Os E2E validam o sistema “de ponta a ponta”: **HTTP + validação (pipes) + guards/auth + módulos + DB + serialização**.

> Nota: existe um ficheiro com nome “e2e” que é, na prática, mais próximo de **integração** (chama services diretamente).
> Isso não é um problema, mas convém ter isso claro na leitura da suite.

---

## Estrutura

```
test/
  e2e/
    _helpers/
      e2e-utils.ts
    auth.e2e.spec.ts
    health.e2e.spec.ts
    incidents.e2e.spec.ts
    incidents.service-link.e2e.spec.ts
    reports.e2e.spec.ts
    services.e2e.spec.ts
    teams.e2e.spec.ts

  config/
    jest.e2e.config.ts
```

### Helper principal
- `test/e2e/_helpers/e2e-utils.ts`
  - `bootstrapE2E()` cria a app Nest com:
    - `globalPrefix('api')`
    - `ValidationPipe({ whitelist: true, transform: true })`
  - `resetDb(prisma)` limpa DB entre testes (ordem child → core, resiliente a schema changes).
  - `registerUser(...)` / `loginUser(...)` fazem auth via endpoints reais.

### Config Jest
- `test/config/jest.e2e.config.ts`
  - seleciona `test/e2e/**/*.e2e.spec.ts`
  - `maxWorkers: 1` (execução sequencial)
  - `testTimeout: 60000`

---

## Quantidade de testes e cobertura funcional

Nesta suite E2E existem **7 ficheiros principais** (mais helpers), cobrindo os módulos:

1) **Auth** (`auth.e2e.spec.ts`)
   - Fluxo completo: register → me → refresh → delete-account
   - Login inválido (401)
   - Logout invalida refresh (refresh falha)
   - Change password (old falha, new funciona)
   - Password reset (request + reset)
   - Endpoints protegidos sem token (401)

2) **Health** (`health.e2e.spec.ts`)
   - Smoke test: `/api/health` responde 200 e payload contém `status`.

3) **Incidents** (`incidents.e2e.spec.ts`)
   - Create com defaults (status NEW, severity SEV3)
   - Timeline acessível e coerente
   - List + filtro por search
   - Update (title/description)
   - Mudança de status (transição válida e inválida 400)
   - Comments (add/list + timeline)
   - Subscribe/unsubscribe
   - Delete com permissões (403 para não-reporter)
   - Endpoints sem token (401)

4) **Incidents primaryService** (`incidents.service-link.e2e.spec.ts`)
   - Create com `primaryServiceKey`
   - Troca de serviço via PATCH
   - Remoção (primaryServiceId -> null)
   - GET inclui objeto `primaryService`
   - Filtro por `primaryServiceKey` na listagem

5) **Reports** (`reports.e2e.spec.ts`)
   - Endpoints protegidos (401 sem token)
   - Fixtures completas (team + membership + service + category + incident resolvido)
   - KPIs (200)
   - Breakdown por categoria (200 + array)
   - Export CSV (content-type text/csv + contém dados)
   - Export PDF (content-type application/pdf + buffer válido)
   - Export PDF por incidentId
   - Tamper detection (409 após modificar incidente)

6) **Services** (`services.e2e.spec.ts`)
   - Listagem com auth (200)
   - Filtros: `isActive` e `q`
   - Get por key e por id

7) **Teams** (`teams.e2e.spec.ts`)
   - CRUD de team
   - Gestão de membros
   - Endpoint `/api/teams/me`
   - Endpoints sem token (401)

---

## Como correr

### Suite completa E2E
```bash
npx jest -c test/config/jest.e2e.config.ts
```

### Um ficheiro específico
```bash
npx jest -c test/config/jest.e2e.config.ts test/e2e/auth.e2e.spec.ts
```

### Um teste específico (pattern)
```bash
npx jest -c test/config/jest.e2e.config.ts -t "register -> me"
```

---

## Setup e teardown (padrão recomendado)

Em geral, as suites seguem o padrão:

- `const ctxP = bootstrapE2E()` uma vez por ficheiro
- `beforeEach` faz `resetDb(ctx.prisma)` para isolamento
- `afterAll` faz:
  - `await ctx.app.close()`
  - (opcional) `await ctx.prisma.$disconnect()` quando usado

Exemplo base:
```ts
const ctxP = bootstrapE2E();

beforeEach(async () => {
  const ctx = await ctxP;
  await resetDb(ctx.prisma);
});

afterAll(async () => {
  const ctx = await ctxP;
  await ctx.app.close();
  await ctx.prisma.$disconnect();
});
```

---

## Boas práticas e decisões

### Porquê `maxWorkers: 1`
E2E costuma partilhar recursos:
- base de dados de testes
- estado global/seed
- tempo/clock
- possíveis portas/servers

Execução sequencial reduz flakiness e simplifica debugging.

### Reset da DB
Se o helper E2E não limpar algumas tabelas (ex.: `service`), algumas suites limpam explicitamente:
```ts
await ctx.prisma.service.deleteMany({});
```
Isto é aceitável, mas se se tornar recorrente vale a pena:
- incluir `service` no `resetDb` E2E, ou
- garantir TRUNCATE global (como no helper de integration).

### Timeouts
`60s` por teste é suficiente para bootstrap + DB.
Se falhar por timeout:
- otimizar reset/fixtures
- reduzir trabalho repetido
- aumentar timeout apenas quando necessário (evitar esconder lentidão real)

---

## Troubleshooting rápido

- **401 inesperado**
  - confirmar `Authorization: Bearer <token>`
  - confirmar `app.setGlobalPrefix('api')` e paths com `/api/...`

- **403 em reports/incidents**
  - normalmente é scoping (user não pertence ao team)
  - garantir ligação user-team nas fixtures

- **CSV/PDF inconsistentes**
  - confirmar fixtures (dados realmente criados)
  - validar content-type e tamanho do buffer
  - para PDFs: usar parser binário (Buffer) no supertest

- **Falhas intermitentes**
  - verificar dependência de ordem
  - garantir reset DB por teste
  - evitar `Date.now()` sem controle quando não é necessário

---

## Onde encaixar no projeto

Recomendado:
- `backend/docs/tests/E2E.md` (este ficheiro)
- `backend/test/e2e/**` (código dos testes)
- `backend/test/config/jest.e2e.config.ts` (config Jest)
