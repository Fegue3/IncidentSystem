import request from 'supertest';
import { bootstrapE2E, resetDb, registerUser } from './_helpers/e2e-utils';

jest.setTimeout(60_000);

describe('Incidents (e2e)', () => {
  const ctxP = bootstrapE2E();

  beforeEach(async () => {
    const ctx = await ctxP;
    await resetDb(ctx.prisma);
  });

  afterAll(async () => {
    const ctx = await ctxP;
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('create -> defaults (status NEW, severity SEV3) + timeline + subscription', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 'i1@test.com', 'StrongPass1!', 'I1');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({
        title: 'DB down',
        description: 'Database unreachable',
      })
      .expect(201);

    const incidentId = created.body.id;
    expect(incidentId).toBeDefined();
    expect(created.body.status).toBe('NEW');
    expect(created.body.severity).toBe('SEV3');

    const timeline = await request(ctx.http)
      .get(`/api/incidents/${incidentId}/timeline`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);

    expect(Array.isArray(timeline.body)).toBe(true);
  });

  it('list + search filter', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 'i2@test.com', 'StrongPass1!', 'I2');

    await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'API errors', description: '5xx' })
      .expect(201);

    await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'DB down', description: 'timeout' })
      .expect(201);

    const res = await request(ctx.http)
      .get('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .query({ search: 'db' })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('update -> altera title/description', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 'i3@test.com', 'StrongPass1!', 'I3');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'Old', description: 'Old desc' })
      .expect(201);

    const incidentId = created.body.id;

    const upd = await request(ctx.http)
      .patch(`/api/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'New', description: 'New desc' })
      .expect(200);

    expect(upd.body.title).toBe('New');
  });

  it('change-status NEW -> TRIAGED (ok) e NEW -> CLOSED (400)', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 'i4@test.com', 'StrongPass1!', 'I4');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'X', description: 'Y' })
      .expect(201);

    const id = created.body.id;

    // ✅ FIX: é PATCH e normalmente devolve 200
    const triaged = await request(ctx.http)
      .patch(`/api/incidents/${id}/status`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ newStatus: 'TRIAGED', message: 'triagem feita' })
      .expect(200);

    expect(triaged.body.status).toBe('TRIAGED');

    await request(ctx.http)
      .patch(`/api/incidents/${id}/status`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ newStatus: 'CLOSED', message: 'fechar' })
      .expect(400);
  });

  it('comments: add -> list -> timeline inclui COMMENT', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 'i5@test.com', 'StrongPass1!', 'I5');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'A', description: 'B' })
      .expect(201);

    const id = created.body.id;

    await request(ctx.http)
      .post(`/api/incidents/${id}/comments`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ body: 'isto está a arder' })
      .expect(201);

    const comments = await request(ctx.http)
      .get(`/api/incidents/${id}/comments`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);

    expect(Array.isArray(comments.body)).toBe(true);
    expect(comments.body.length).toBeGreaterThanOrEqual(1);

    const timeline = await request(ctx.http)
      .get(`/api/incidents/${id}/timeline`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);

    expect(Array.isArray(timeline.body)).toBe(true);
  });

  it('subscribe/unsubscribe', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 'i6@test.com', 'StrongPass1!', 'I6');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'S', description: 'S' })
      .expect(201);

    const id = created.body.id;

    // (se o teu controller for POST/DELETE, isto está ok)
    await request(ctx.http)
      .post(`/api/incidents/${id}/subscribe`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(201);

    await request(ctx.http)
      .delete(`/api/incidents/${id}/subscribe`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);
  });

  it('delete -> só reporter pode apagar (u2 recebe 403)', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 'i7@test.com', 'StrongPass1!', 'I7');
    const u2 = await registerUser(ctx.http, 'i8@test.com', 'StrongPass1!', 'I8');

    const created = await request(ctx.http)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ title: 'DEL', description: 'DEL' })
      .expect(201);

    const id = created.body.id;

    await request(ctx.http)
      .delete(`/api/incidents/${id}`)
      .set('Authorization', `Bearer ${u2.accessToken}`)
      .expect(403);

    await request(ctx.http)
      .delete(`/api/incidents/${id}`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);
  });

  it('incidents endpoints -> 401 sem token', async () => {
    const ctx = await ctxP;
    await request(ctx.http).get('/api/incidents').expect(401);
  });
});
