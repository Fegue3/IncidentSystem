# `test/e2e/_helpers/e2e-utils.ts`

## Overview
Helper utilities para **testes E2E** (End-to-End) do backend NestJS.

Este ficheiro existe para:
- reduzir boilerplate (bootstrap do Nest + `supertest`);
- garantir **defaults seguros** para env vars em execução local/CI;
- disponibilizar uma forma simples de **resetar a base de dados** entre testes;
- centralizar helpers de **auth** (register/login) para construir cenários E2E.

## Onde é usado
- Em specs E2E (`test/e2e/**/*.e2e.spec.ts`), normalmente em `beforeAll/beforeEach/afterAll`.

## Public API (exports)

- `export type E2EContext`
- `export async function bootstrapE2E(): Promise<E2EContext>`
- `export async function resetDb(prisma: PrismaService): Promise<void>`
- `export async function registerUser(http, email, password, name?)`
- `export async function loginUser(http, email, password)`

## Lifecycle recomendado (Data flow)

1) `bootstrapE2E()`
   - Define defaults de env vars (sem sobrescrever valores já definidos).
   - Cria o módulo de testes com `AppModule`.
   - Inicializa a app Nest.
   - Aplica `globalPrefix('api')` e `ValidationPipe({ whitelist: true, transform: true })`.
   - Devolve `{ app, prisma, http }`.

2) `resetDb(prisma)` (opcional mas recomendado)
   - Limpa tabelas por ordem (child → core).
   - É “resiliente” a mudanças de schema (silencia erros em modelos que não existam).

3) Helpers de auth:
   - `registerUser(http, ...)` → POST `/api/auth/register` (espera `201`)
   - `loginUser(http, ...)` → POST `/api/auth/login` (espera `200`)

4) Teardown
   - No `afterAll`, fechar a app: `await ctx.app.close()`.

## Security & Access Control
- Os helpers **não bypassam** segurança: exercitam o sistema via HTTP.
- Os endpoints `/api/auth/register` e `/api/auth/login` devem existir e devolver tokens.
- As permissões reais (roles, guards) continuam a ser verificadas pelo backend.

## Errors & Edge cases
- `bootstrapE2E`
  - Pode falhar se o `AppModule` tiver dependências obrigatórias não configuradas por env.
  - Pode falhar se a DB não estiver acessível (ex.: Docker/CI mal configurado).

- `resetDb`
  - Silencia erros intencionalmente (`try/catch {}`) para manter compatibilidade com schema em evolução.
  - Se precisares de detetar “reset incompleto”, remove o catch (ou faz logging) durante debug.

- `registerUser` / `loginUser`
  - Fazem `expect(201)` e `expect(200)` respetivamente:
    - qualquer alteração no contrato HTTP quebra imediatamente os testes (bom para contratos estáveis).
  - Dependem do `globalPrefix('api')` e do path usado (`/api/...`).

## Performance notes
- `maxWorkers: 1` na config E2E ajuda a evitar conflitos de DB.
- `resetDb` faz múltiplos `deleteMany` (barato) mas pode crescer com mais tabelas.
  - Se o schema crescer muito, pode valer a pena:
    - `TRUNCATE ... CASCADE` (com raw SQL) **ou**
    - limpar por transaction/ordem definida.

## Examples

### Exemplo típico de spec E2E
```ts
import { bootstrapE2E, resetDb, registerUser } from './_helpers/e2e-utils';

describe('Auth (e2e)', () => {
  const ctx: any = {};

  beforeAll(async () => {
    Object.assign(ctx, await bootstrapE2E());
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('regista e devolve tokens', async () => {
    const out = await registerUser(ctx.http, 'a@a.com', 'pass123', 'Alice');
    expect(out.accessToken).toBeTruthy();
    expect(out.user.email).toBe('a@a.com');
  });
});
```

## Onde encaixar na estrutura
**Código (helper):**
- `backend/test/e2e/_helpers/e2e-utils.ts`

**Documentação:**
- `backend/docs/tests/e2e/E2E-UTILS.md`

Se preferirem que a doc esteja junto do helper (menos “docs folder”), alternativa aceitável:
- `backend/test/e2e/_helpers/README.md`
