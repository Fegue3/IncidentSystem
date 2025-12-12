import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from './_helpers/prisma-reset';

describe('Incidents primaryService (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let reporterId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);

    const team = await prisma.team.create({ data: { name: 'IT Ops' } });
    const user = await prisma.user.create({
      data: {
        email: 'rep@test.local',
        name: 'Reporter',
        password: '123456',
        role: 'USER' as any,
        teams: { connect: [{ id: team.id }] },
      },
    });
    reporterId = user.id;

    await prisma.service.create({
      data: { key: 'auth-gateway', name: 'Auth Gateway', isActive: true },
    });
    await prisma.service.create({
      data: { key: 'public-api', name: 'Public API', isActive: true },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function authHeader() {
    return { Authorization: `Bearer fake` };
  }

  it('POST /api/incidents accepts primaryServiceKey', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/incidents')
      .set(authHeader())
      .send({
        title: 't',
        description: 'd',
        primaryServiceKey: 'auth-gateway',
      })
      .expect(201);

    expect(res.body.primaryServiceId).toBeTruthy();
  });

  it('PATCH /api/incidents/:id changes primaryServiceKey', async () => {
    const created = await prisma.incident.create({
      data: {
        title: 't',
        description: 'd',
        reporterId,
        status: 'NEW' as any,
        severity: 'SEV3' as any,
      },
    });

    const svc = await prisma.service.findUnique({ where: { key: 'public-api' } });

    const res = await request(app.getHttpServer())
      .patch(`/api/incidents/${created.id}`)
      .set(authHeader())
      .send({ primaryServiceKey: 'public-api' })
      .expect(200);

    expect(res.body.primaryServiceId).toBe(svc!.id);
  });

  it('PATCH /api/incidents/:id removes service with empty string', async () => {
    const svc = await prisma.service.findUnique({ where: { key: 'auth-gateway' } });

    const created = await prisma.incident.create({
      data: {
        title: 't',
        description: 'd',
        reporterId,
        status: 'NEW' as any,
        severity: 'SEV3' as any,
        primaryServiceId: svc!.id,
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/incidents/${created.id}`)
      .set(authHeader())
      .send({ primaryServiceId: '' })
      .expect(200);

    expect(res.body.primaryServiceId).toBeNull();
  });

  it('GET /api/incidents?primaryServiceKey=... filters list', async () => {
    const svc = await prisma.service.findUnique({ where: { key: 'auth-gateway' } });

    await prisma.incident.create({
      data: {
        title: 'a',
        description: 'a',
        reporterId,
        status: 'NEW' as any,
        severity: 'SEV3' as any,
        primaryServiceId: svc!.id,
      },
    });

    await prisma.incident.create({
      data: {
        title: 'b',
        description: 'b',
        reporterId,
        status: 'NEW' as any,
        severity: 'SEV3' as any,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/incidents?primaryServiceKey=auth-gateway')
      .set(authHeader())
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((i: any) => i.primaryServiceId === svc!.id)).toBe(true);
  });
});
