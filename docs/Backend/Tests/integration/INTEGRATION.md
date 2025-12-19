# Testes de Integração (Backend)

Esta secção documenta os testes **de integração** do backend NestJS.

Aqui, “integração” significa tipicamente:
- chamar **services reais** (Nest providers) em vez de HTTP,
- usar **base de dados real** (Postgres + Prisma),
- validar regras de domínio, persistência e erros.

> Nota importante: existe pelo menos um ficheiro que é “integração” no sentido de *integração entre classes*, mas usa **mocks** (ex.: `notifications.int.spec.ts`). Está tudo bem — só convém saber que esse teste não depende da DB.

---

## Estrutura

```
test/
  integration/
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
    jest.int.config.ts
```

### Helper principal: reset da DB
- `test/integration/_helpers/prisma-reset.ts`
  - Executa um `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as tabelas do schema `public` (exceto `_prisma_migrations`).
  - Funciona tanto com `PrismaClient` como com `PrismaService` (desde que tenha `$executeRawUnsafe`).

**Porque existe:** garante isolamento forte entre testes e evita dependências de ordem.

---

## Quantidade de testes e cobertura funcional

Atualmente, a suite de integração inclui **10 ficheiros** (mais helpers), cobrindo:

1) **Auth** (`auth.int.spec.ts`)
   - `register`: cria user e persiste `refreshTokenHash`
   - `login`: erro com credenciais inválidas + sucesso atualiza refresh hash
   - `refresh`: troca tokens (válido / inválido)
   - `logout`: limpa `refreshTokenHash`
   - `requestPasswordReset + resetPassword`: altera password e invalida token

2) **Incidents - filtros e pesquisa** (`incidents.filtering.int.spec.ts`)
   - filtros por `status`, `severity`, `teamId`
   - filtros por serviço: `primaryServiceId` e `primaryServiceKey`
   - pesquisa por texto (título/descrição, case-insensitive)
   - combinações de filtros
   - filtro por `createdFrom`
   - ordenação por `createdAt DESC`

3) **Incidents - regras core** (`incidents.int.spec.ts`)
   - `create`: defaults + timeline `STATUS_CHANGE` + subscription do reporter
   - `changeStatus`: transição válida (NEW->TRIAGED) e inválida (NEW->CLOSED)
   - `addComment`: cria comment + timeline `COMMENT`
   - `delete`: só reporter (403 para outros)

4) **Incidents - ligação a Service** (`incidents.service-link.int.spec.ts`)
   - `create` com `primaryServiceKey` resolve para `primaryServiceId`
   - `update` muda service por key
   - `update` remove associação quando `primaryServiceId` vem vazio
   - `list` filtra por `primaryServiceKey`

5) **Notificações** (`notifications.int.spec.ts`)
   - Integração “interna” com mocks:
     - SEV1/SEV2 disparam Discord + PagerDuty
     - SEV3/SEV4 não disparam
     - Mensagem inclui `FRONTEND_BASE_URL` quando definido

6) **Reports - export CSV** (`reports.export.int.spec.ts`)
   - Garante header do CSV e inclusão do incidente no output

7) **Reports - KPIs/Breakdown/Timeseries** (`reports.int.spec.ts`)
   - KPIs: contagens + MTTR (avg/median/p90) + SLA compliance
   - Breakdown por categoria (labels e counts)
   - Timeseries por dia (buckets e contagens)

8) **Services** (`services.int.spec.ts`)
   - list + filtros (`q`, `isActive`)
   - get por key e por id
   - NotFound quando não existe

9) **Teams** (`teams.int.spec.ts`)
   - create com `memberIds`
   - add/remove member
   - update com reset completo de membros
   - NotFound quando team não existe

10) **Users** (`users.int.spec.ts`)
   - create guarda password com hash (não plaintext)
   - rejeita email repetido
   - changePassword (sucesso e falha)

---

## Como correr

### Suite completa de integração
```bash
npx jest -c test/config/jest.int.config.ts
```

### Um ficheiro específico
```bash
npx jest -c test/config/jest.int.config.ts test/integration/auth.int.spec.ts
```

### Um teste específico (pattern)
```bash
npx jest -c test/config/jest.int.config.ts -t "refresh\(\) -> troca tokens"
```

---

## Setup/Teardown (padrões existentes)

Há dois padrões na suite:

### A) TestingModule (Nest) + PrismaService
Usado na maioria dos testes (Auth/Incidents/Teams/Users/Services):

- `beforeAll`: cria `TestingModule` com `AppModule`, obtém providers, faz `resetDb`.
- `beforeEach`: faz `resetDb` para isolamento.
- `afterAll`: `prisma.$disconnect()` e `mod.close()`.

Vantagem: valida wiring real do Nest + providers reais.

### B) PrismaClient direto (Reports)
Usado em `reports.int.spec.ts` e `reports.export.int.spec.ts`:

- Instancia `new PrismaClient()` e passa para `ReportsService(prisma as any)`.

Vantagem: tests mais simples e rápidos quando só precisas da DB e da classe.

**Recomendação prática:** escolher um padrão e aplicar consistentemente (reduz surprises).
Se mantiveres os dois, documenta no topo de cada ficheiro (já está).

---

## Variáveis de ambiente (em teste)

Os testes costumam definir defaults apenas se não existirem:

- `NODE_ENV=test`
- `DATABASE_URL=...incidentsdb_test...`
- `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` (nos testes de auth e alguns outros)
- `FRONTEND_BASE_URL` (apenas em `notifications.int.spec.ts`)

---

## Boas práticas e notas de manutenção

- **Reset forte**: o TRUNCATE global evita “flakiness” por dados residuais.
- **Dados únicos por teste**: quando há `unique` (ex.: email), usar sufixos únicos (`randomUUID`).
- **Não depender de ordem**: cada teste deve criar as fixtures que precisa.
- **Evitar timeouts mascarados**: aumentar `testTimeout` só quando fizer sentido; preferir otimizar fixtures/reset.
- **Cuidado com `DATABASE_URL` diferente**: se algum ficheiro apontar para uma DB diferente, a suite fica incoerente.
  - Ideal: todos apontarem para a mesma DB de teste (ex.: `incidentsdb_test`).

---

## Onde encaixar no projeto

Recomendado:
- `backend/docs/tests/integration.md` (este ficheiro)
- `backend/test/integration/**` (código de integração)
- `backend/test/config/jest.int.config.ts` (config Jest)
