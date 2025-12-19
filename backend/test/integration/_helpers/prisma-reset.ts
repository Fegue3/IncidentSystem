/**
 * @file prisma-reset.ts
 * @module test/integration/_helpers/prisma-reset
 *
 * @summary
 *  - Reset rápido e determinístico da base de dados (PostgreSQL) para testes de integração.
 *
 * @description
 *  Helper usado em testes de **integration** para garantir que a base de dados começa limpa
 *  antes de cada suite/teste, evitando dependência de ordem e “flakiness”.
 *
 *  Estratégia:
 *  - usa `prisma.$executeRawUnsafe(...)` para executar um bloco PL/pgSQL que:
 *    - lista todas as tabelas do schema `public` (exceto `_prisma_migrations`);
 *    - constrói um `TRUNCATE TABLE ... RESTART IDENTITY CASCADE`;
 *    - executa o TRUNCATE caso existam tabelas.
 *
 *  Porque TRUNCATE:
 *  - é tipicamente mais rápido do que múltiplos `deleteMany`;
 *  - `RESTART IDENTITY` repõe sequences/IDs;
 *  - `CASCADE` resolve FKs apagando dependências automaticamente.
 *
 * @dependencies
 *  - Prisma (PrismaClient/PrismaService): precisa do método `$executeRawUnsafe`.
 *  - PostgreSQL: a query usa `pg_tables` e um bloco `DO $$ ... $$;` (PL/pgSQL).
 *
 * @security
 *  - **Perigoso fora de ambiente de teste**: apaga dados do schema `public`.
 *  - Deve ser usado APENAS com uma DB de testes (ex.: `DATABASE_URL` de test).
 *  - `$executeRawUnsafe` executa SQL arbitrário; manter o SQL constante e não interpolar input do utilizador.
 *
 * @errors
 *  - Lança `Error` se o prisma não expuser `$executeRawUnsafe` (ex.: mock incompleto).
 *  - Pode falhar se a ligação à DB estiver em baixo ou se o utilizador não tiver permissões.
 *
 * @performance
 *  - TRUNCATE + CASCADE é geralmente O(n tabelas) e muito rápido em DB de testes.
 *  - Em schemas grandes pode continuar eficiente, mas atenção a locks se correr em paralelo.
 *
 * @example
 *  import { resetDb } from './_helpers/prisma-reset';
 *  beforeEach(async () => resetDb(prisma));
 */

// test/integration/_helpers/prisma-reset.ts
import type { PrismaClient } from '@prisma/client';

/**
 * Limpa todas as tabelas do schema `public` (exceto `_prisma_migrations`) com TRUNCATE.
 *
 * Aceita `PrismaClient` ou `PrismaService` porque ambos expõem `$executeRawUnsafe` em runtime.
 *
 * @param prisma Instância PrismaClient/PrismaService conectada à DB de testes.
 * @throws Error se `prisma.$executeRawUnsafe` não existir.
 */
export async function resetDb(prisma: PrismaClient | any) {
  // isto funciona tanto com PrismaClient como PrismaService
  if (typeof prisma?.$executeRawUnsafe !== 'function') {
    throw new Error('resetDb: prisma.$executeRawUnsafe não existe');
  }

  await prisma.$executeRawUnsafe(`
DO $$
DECLARE
  trunc_sql text;
BEGIN
  SELECT
    'TRUNCATE TABLE ' ||
    string_agg(format('%I.%I', schemaname, tablename), ', ') ||
    ' RESTART IDENTITY CASCADE;'
  INTO trunc_sql
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';

  IF trunc_sql IS NOT NULL THEN
    EXECUTE trunc_sql;
  END IF;
END $$;
  `);
}
