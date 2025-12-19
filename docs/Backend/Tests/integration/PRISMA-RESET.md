# `test/integration/_helpers/prisma-reset.ts`

## Overview
Helper de testes de **Integração** para fazer reset rápido da DB (PostgreSQL) usando `TRUNCATE ... RESTART IDENTITY CASCADE`.

**Responsabilidade única:** garantir um estado “limpo” e determinístico da base de dados antes de correr suites/testes de integração.

## Onde é usado
- Em `test/integration/**/*.spec.ts`, tipicamente em `beforeEach` (ou `beforeAll` se a suite gerir o seu próprio reset).

## Public API (exports)
- `resetDb(prisma: PrismaClient | any): Promise<void>`

## Como funciona (Data flow)
1) Valida que `prisma.$executeRawUnsafe` existe.
2) Executa um bloco PL/pgSQL (`DO $$ ... $$`) que:
   - lê todas as tabelas de `pg_tables` no schema `public`,
   - exclui `_prisma_migrations`,
   - monta um comando:
     - `TRUNCATE TABLE <t1>, <t2>, ... RESTART IDENTITY CASCADE;`
   - executa o TRUNCATE se houver tabelas.

## Segurança
- **Nunca apontar isto a uma DB real** (dev/prod). Apaga dados do schema `public`.
- `$executeRawUnsafe` é “unsafe” por natureza:
  - aqui é aceitável porque o SQL é **constante** e não recebe input do utilizador.

## Erros & Edge cases
- Se `prisma.$executeRawUnsafe` não existir, lança:
  - `Error('resetDb: prisma.$executeRawUnsafe não existe')`
- Se a DB não for PostgreSQL (ou não suportar PL/pgSQL/pg_tables), pode falhar.
- Se a role do utilizador da DB não tiver permissões para TRUNCATE, falha.

## Performance notes
- Em geral, `TRUNCATE` é muito mais rápido do que apagar registos tabela a tabela.
- `CASCADE` resolve FKs automaticamente.
- `RESTART IDENTITY` volta a repor sequences para testes determinísticos.
- Se testarem em paralelo (workers > 1) e partilharem a mesma DB, isto pode causar locks/conflitos.

## Example
```ts
import { resetDb } from './_helpers/prisma-reset';

describe('Reports (integration)', () => {
  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('...', async () => {
    // arrange/act/assert
  });
});
```

## Onde encaixar na estrutura
**Código (helper):**
- `backend/test/integration/_helpers/prisma-reset.ts`

**Documentação:**
- `backend/docs/tests/integration/PRISMA-RESET.md`
