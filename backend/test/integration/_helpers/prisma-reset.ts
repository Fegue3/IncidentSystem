// test/integration/_helpers/prisma-reset.ts
import type { PrismaClient } from '@prisma/client';

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
