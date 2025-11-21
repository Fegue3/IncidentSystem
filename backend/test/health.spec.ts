import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Garantir secrets para as estratégias JWT durante os testes
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    // (Opcional, caso algum sítio use JWT_SECRET genérico)
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('api'); // usamos /api/health
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/health -> ok', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBeDefined();
  });
});
