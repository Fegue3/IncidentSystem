import request from 'supertest';
import { bootstrapE2E, resetDb, registerUser } from './_helpers/e2e-utils';

jest.setTimeout(60_000);

describe('Teams (e2e)', () => {
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

  it('CRUD team + members + /teams/me', async () => {
    const ctx = await ctxP;

    const u1 = await registerUser(ctx.http, 't1@test.com', 'StrongPass1!', 'T1');
    const u2 = await registerUser(ctx.http, 't2@test.com', 'StrongPass1!', 'T2');

    // create
    const created = await request(ctx.http)
      .post('/api/teams')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ name: 'NOC' })
      .expect(201);

    const teamId = created.body.id;
    expect(teamId).toBeDefined();

    // list
    await request(ctx.http)
      .get('/api/teams')
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);

    // add member
    await request(ctx.http)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ userId: u2.user.id })
      .expect(201);

    // members
    const members = await request(ctx.http)
      .get(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);

    expect(Array.isArray(members.body)).toBe(true);

    // /teams/me do u2 deve incluir a equipa
    const mine = await request(ctx.http)
      .get('/api/teams/me')
      .set('Authorization', `Bearer ${u2.accessToken}`)
      .expect(200);

    expect(Array.isArray(mine.body)).toBe(true);

    // update
    const updated = await request(ctx.http)
      .patch(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .send({ name: 'NOC 24/7' })
      .expect(200);

    expect(updated.body.name).toBe('NOC 24/7');

    // remove member
    await request(ctx.http)
      .delete(`/api/teams/${teamId}/members/${u2.user.id}`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);

    // delete team
    await request(ctx.http)
      .delete(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${u1.accessToken}`)
      .expect(200);
  });

  it('teams endpoints -> 401 sem token', async () => {
    const ctx = await ctxP;

    await request(ctx.http).get('/api/teams').expect(401);
  });
});
