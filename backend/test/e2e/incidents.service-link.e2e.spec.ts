/**
 * @file incidents.service-link.e2e.spec.ts
 * @module test/e2e/incidents.service-link.e2e
 *
 * @summary
 *  - Testes E2E para associação de Incident <-> Service (primaryService).
 *
 * @description
 *  Valida que:
 *  - é possível criar incidente com `primaryServiceKey`;
 *  - é possível trocar o serviço via PATCH;
 *  - é possível remover o serviço (primaryServiceId null);
 *  - GET do incidente inclui o objeto `primaryService`;
 *  - listagem filtra por `primaryServiceKey`.
 *
 * @notes
 *  - O `resetDb` do helper E2E pode não limpar a tabela Service (dependendo do schema),
 *    por isso esta suite faz `ctx.prisma.service.deleteMany({})` explicitamente.
 */

import request from 'supertest';
import { bootstrapE2E, resetDb, registerUser } from './_helpers/e2e-utils';

describe('Incidents primaryService (e2e)', () => {
  const ctxPromise = bootstrapE2E();

  beforeEach(async () => {
    const ctx = await ctxPromise;
    await resetDb(ctx.prisma);

    // Nota: se o resetDb do e2e-utils não apagar Service, limpamos aqui
    await ctx.prisma.service.deleteMany({});

    const team = await ctx.prisma.team.create({ data: { name: 'IT Ops' } });

    await ctx.prisma.service.create({
      data: { key: 'auth-gateway', name: 'Auth Gateway', isActive: true },
    });
    await ctx.prisma.service.create({
      data: { key: 'public-api', name: 'Public API', isActive: true },
    });

    // Seed simples para garantir utilizador/equipa no estado base (se necessário por scoping)
    await ctx.prisma.user.create({
      data: {
        email: 'seed@local',
        name: 'Seed',
        password: '123456',
        role: 'USER' as any,
        teams: { connect: [{ id: team.id }] },
      },
    });
  });

  afterAll(async () => {
    const ctx = await ctxPromise;
    await ctx.app.close();
  });

  it('create -> update service -> remove service', async () => {
    const ctx = await ctxPromise;

    // Password forte para passar validação do DTO
    const { accessToken } = await registerUser(ctx.http, 'i@e2e.local', 'StrongPass1!', 'Inc User');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 't',
        description: 'd',
        primaryServiceKey: 'auth-gateway',
      })
      .expect(201);

    expect(created.body.primaryServiceId).toBeTruthy();

    const updated = await request(ctx.http)
      .patch(`/api/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ primaryServiceKey: 'public-api' })
      .expect(200);

    expect(updated.body.primaryServiceId).toBeTruthy();
    expect(updated.body.primaryServiceId).not.toBe(created.body.primaryServiceId);

    const removed = await request(ctx.http)
      .patch(`/api/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ primaryServiceId: '' })
      .expect(200);

    expect(removed.body.primaryServiceId).toBeNull();
  });

  it('GET /api/incidents/:id includes primaryService', async () => {
    const ctx = await ctxPromise;

    const { accessToken } = await registerUser(ctx.http, 'i2@e2e.local', 'StrongPass1!', 'Inc User2');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 't',
        description: 'd',
        primaryServiceKey: 'auth-gateway',
      })
      .expect(201);

    const got = await request(ctx.http)
      .get(`/api/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(got.body.primaryService).toBeTruthy();
    expect(got.body.primaryService.key).toBe('auth-gateway');
  });

  it('GET /api/incidents?primaryServiceKey=... filters', async () => {
    const ctx = await ctxPromise;

    const { accessToken } = await registerUser(ctx.http, 'i3@e2e.local', 'StrongPass1!', 'Inc User3');

    await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'a',
        description: 'a',
        primaryServiceKey: 'auth-gateway',
      })
      .expect(201);

    await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'b',
        description: 'b',
      })
      .expect(201);

    const list = await request(ctx.http)
      .get('/api/incidents?primaryServiceKey=auth-gateway')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);
    expect(list.body.every((i: any) => i.primaryServiceId)).toBe(true);
  });
});
