// test/auth.spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/incidents';


    // secrets mínimos para JWT nos testes
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'a';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'b';

    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();

    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('register -> me -> refresh -> delete', async () => {
    const email = 'u@u.com';

    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass1!' })
      .expect(201);

    const access = reg.body.accessToken;
    const refresh = reg.body.refreshToken;

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);

    const ref = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/auth/delete-account')
      .set('Authorization', `Bearer ${ref.body.accessToken}`)
      .expect(200);
  });
});
