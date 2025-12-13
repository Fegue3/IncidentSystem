import request from 'supertest';
import { bootstrapE2E, resetDb, registerUser } from './_helpers/e2e-utils';

describe('Services (e2e)', () => {
  const ctxPromise = bootstrapE2E();

  beforeEach(async () => {
    const ctx = await ctxPromise;
    await resetDb(ctx.prisma);

    // ✅ como o resetDb do e2e-utils não apaga Service, limpamos aqui
    await ctx.prisma.service.deleteMany({});

    await ctx.prisma.team.create({ data: { name: 'SRE' } });
    await ctx.prisma.service.create({
      data: { key: 'auth-gateway', name: 'Auth Gateway', isActive: true },
    });
    await ctx.prisma.service.create({
      data: { key: 'old', name: 'Old', isActive: false },
    });
  });

  afterAll(async () => {
    const ctx = await ctxPromise;
    await ctx.app.close();
  });

  it('lists services (auth required)', async () => {
    const ctx = await ctxPromise;

    const { accessToken } = await registerUser(
      ctx.http,
      's@e2e.local',
      'StrongPass1!',
      'Services User',
    );

    const res = await request(ctx.http)
      .get('/api/services')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
  });

  it('filters by q and isActive', async () => {
    const ctx = await ctxPromise;

    const { accessToken } = await registerUser(
      ctx.http,
      's2@e2e.local',
      'StrongPass1!',
      'Services User2',
    );

    const active = await request(ctx.http)
      .get('/api/services?isActive=true')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(active.body.every((s: any) => s.isActive === true)).toBe(true);

    const q = await request(ctx.http)
      .get('/api/services?q=auth')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(q.body.some((s: any) => s.key === 'auth-gateway')).toBe(true);
  });

  it('gets service by key and id', async () => {
    const ctx = await ctxPromise;

    const { accessToken } = await registerUser(
      ctx.http,
      's3@e2e.local',
      'StrongPass1!',
      'Services User3',
    );

    const byKey = await request(ctx.http)
      .get('/api/services/key/auth-gateway')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const byId = await request(ctx.http)
      .get(`/api/services/id/${byKey.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(byId.body.key).toBe('auth-gateway');
  });
});
