/**
 * @file e2e-utils.ts
 * @module test/e2e/_helpers/e2e-utils
 *
 * @summary
 *  - Helpers para bootstrap de testes E2E (NestJS) + reset de DB + ações de auth via HTTP.
 *
 * @description
 *  Este ficheiro centraliza utilitários comuns em E2E:
 *  - bootstrap da aplicação Nest (Test.createTestingModule + app.init());
 *  - defaults “seguros” de env vars (apenas define se não existirem);
 *  - reset resiliente da base de dados (apaga tabelas por ordem child → core);
 *  - helpers de autenticação para criar cenários (register/login) via `supertest`.
 *
 * @dependencies
 *  - @nestjs/testing: cria módulo de testes e app Nest em memória.
 *  - supertest: faz requests HTTP ao server da app.
 *  - AppModule: módulo raiz do backend (wiring completo).
 *  - PrismaService: acesso à DB real durante E2E (queries/reset/seed).
 *
 * @security
 *  - Não “bypassa” segurança: as operações de auth são feitas via endpoints HTTP reais.
 *  - Os testes dependem do `globalPrefix('api')` e paths `/api/...`.
 *
 * @errors
 *  - Pode falhar no bootstrap se a DB não estiver acessível ou envs estiverem incompletas.
 *  - `resetDb` engole erros intencionalmente para manter compatibilidade com schema em evolução.
 *
 * @performance
 *  - `resetDb` executa múltiplos `deleteMany`. Em schemas grandes, pode ser mais rápido usar TRUNCATE via SQL.
 *
 * @example
 *  const ctx = await bootstrapE2E();
 *  await resetDb(ctx.prisma);
 *  const { accessToken } = await registerUser(ctx.http, 'a@a.com', 'pass123');
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

/**
 * Contexto típico de testes E2E.
 *
 * @property app   Instância Nest (para init/close).
 * @property prisma PrismaService real (para reset/seed/asserts diretos).
 * @property http  HTTP server da app (para `supertest`).
 */
export type E2EContext = {
  app: INestApplication;
  prisma: PrismaService;
  http: ReturnType<INestApplication['getHttpServer']>;
};

/**
 * Faz bootstrap da app Nest para testes E2E, com defaults de env vars (sem sobrescrever).
 *
 * O bootstrap aplica:
 * - `app.setGlobalPrefix('api')` (para alinhar com routes `/api/...`)
 * - `ValidationPipe({ whitelist: true, transform: true })` (para validar DTOs e limpar payloads)
 *
 * @returns Contexto E2E com `{ app, prisma, http }`.
 *
 * @throws Error se o módulo não compilar, se a app não inicializar, ou se serviços essenciais falharem.
 */
export async function bootstrapE2E(): Promise<E2EContext> {
  // Não rebentes envs do Docker/CI — só mete defaults se não existirem
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/incidentsdb?schema=public';

  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

  const mod = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = mod.createNestApplication();

  // Mantém contrato /api/...
  app.setGlobalPrefix('api');

  // Validação consistente com runtime (DTOs)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma, http: app.getHttpServer() };
}

/**
 * Reset “seguro” e resiliente da DB para E2E.
 *
 * Estratégia:
 * - tenta apagar tabelas por ordem correta (child tables → core tables),
 * - silencia erros para não falhar quando o schema muda (ex.: modelo removido/renomeado).
 *
 * ⚠️ Nota: ao engolir erros, este reset privilegia “robustez de suite” vs “fail fast”.
 * Durante debug, pode ser útil logar os erros.
 *
 * @param prisma PrismaService real (conectado à DB de testes).
 */
export async function resetDb(prisma: PrismaService) {
  const p: any = prisma as any;

  // child tables primeiro
  for (const model of [
    'notificationSubscription',
    'incidentTimelineEvent',
    'incidentComment',
    'categoryOnIncident',
    'tagOnIncident',
  ]) {
    try {
      if (p[model]?.deleteMany) await p[model].deleteMany({});
    } catch (_) {}
  }

  // core
  for (const model of ['incident', 'team', 'user', 'category', 'tag']) {
    try {
      if (p[model]?.deleteMany) await p[model].deleteMany({});
    } catch (_) {}
  }
}

/**
 * Regista um utilizador via endpoint HTTP real.
 *
 * @param http   HTTP server obtido via `ctx.http`.
 * @param email  Email do utilizador.
 * @param password Password em claro (apenas para testes).
 * @param name   Nome opcional.
 *
 * @returns `{ user, accessToken, refreshToken }` conforme contrato do backend.
 *
 * @throws supertest/jest assertion se status != 201 ou contrato mudar.
 */
export async function registerUser(
  http: any,
  email: string,
  password: string,
  name?: string,
) {
  const res = await request(http)
    .post('/api/auth/register')
    .send({ email, password, ...(name ? { name } : {}) })
    .expect(201);

  return {
    user: res.body.user,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

/**
 * Faz login de um utilizador via endpoint HTTP real.
 *
 * @param http HTTP server obtido via `ctx.http`.
 * @param email Email do utilizador.
 * @param password Password em claro (apenas para testes).
 *
 * @returns `{ user, accessToken, refreshToken }` conforme contrato do backend.
 *
 * @throws supertest/jest assertion se status != 200 ou contrato mudar.
 */
export async function loginUser(http: any, email: string, password: string) {
  const res = await request(http)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    user: res.body.user,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}
