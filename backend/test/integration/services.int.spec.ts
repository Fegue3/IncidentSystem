// test/integration/services.int.spec.ts
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from './_helpers/prisma-reset';
import { createIntegrationApp } from './_helpers/create-integration-app';

describe('Services (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const setup = await createIntegrationApp();
    app = setup.app;
    prisma = setup.prisma;
  });

  beforeEach(async () => {
    await resetDb(prisma);

    await prisma.team.create({ data: { name: 'SRE' } });

    await prisma.service.create({
      data: {
        key: 'auth-gateway',
        name: 'Auth Gateway',
        description: 'Gateway de autenticação',
        isActive: true,
      },
    });

    await prisma.service.create({
      data: {
        key: 'old-service',
        name: 'Old Service',
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/services returns list', async () => {
    const res = await request(app.getHttpServer()).get('/api/services').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/services?q=auth filters', async () => {
    const res = await request(app.getHttpServer()).get('/api/services?q=auth').expect(200);
    expect(res.body.some((s: any) => s.key === 'auth-gateway')).toBe(true);
  });

  it('GET /api/services?isActive=true filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/services?isActive=true')
      .expect(200);

    expect(res.body.every((s: any) => s.isActive === true)).toBe(true);
  });

  it('GET /api/services/key/:key returns one', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/services/key/auth-gateway')
      .expect(200);

    expect(res.body.key).toBe('auth-gateway');
  });

  it('GET /api/services/id/:id returns one', async () => {
    const svc = await prisma.service.findUnique({ where: { key: 'auth-gateway' } });

    const res = await request(app.getHttpServer())
      .get(`/api/services/id/${svc!.id}`)
      .expect(200);

    expect(res.body.id).toBe(svc!.id);
  });

  it('GET /api/services/key/:key returns 404 when not found', async () => {
    await request(app.getHttpServer()).get('/api/services/key/nope').expect(404);
  });
});
