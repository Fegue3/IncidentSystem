import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

export type E2EContext = {
  app: INestApplication;
  prisma: PrismaService;
  http: ReturnType<INestApplication['getHttpServer']>;
};

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
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma, http: app.getHttpServer() };
}

/**
 * Reset “seguro” (tenta apagar o que existir, pela ordem certa).
 * Mantém o teste resiliente mesmo que mudes o schema.
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
