import request from 'supertest';
import { bootstrapE2E, resetDb, registerUser, loginUser } from './_helpers/e2e-utils';

jest.setTimeout(60_000);

describe('Auth (e2e)', () => {
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

  it('register -> me -> refresh -> delete-account', async () => {
    const ctx = await ctxP;

    const reg = await registerUser(ctx.http, 'u@u.com', 'StrongPass1!', 'U');
    await request(ctx.http)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .expect(200);

    const ref = await request(ctx.http)
      .post('/api/auth/refresh')
      .send({ refreshToken: reg.refreshToken })
      .expect(201);

    expect(ref.body.accessToken).toBeDefined();
    expect(ref.body.refreshToken).toBeDefined();

    await request(ctx.http)
      .delete('/api/auth/delete-account')
      .set('Authorization', `Bearer ${ref.body.accessToken}`)
      .expect(200);
  });

  it('login -> falha com credenciais inválidas', async () => {
    const ctx = await ctxP;

    await registerUser(ctx.http, 'a@a.com', 'StrongPass1!', 'A');

    const res = await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: 'a@a.com', password: 'WRONG' })
      .expect(401);

    expect(res.status).toBe(401);
  });

  it('logout -> invalida refresh (refresh deve falhar)', async () => {
    const ctx = await ctxP;

    const reg = await registerUser(ctx.http, 'b@b.com', 'StrongPass1!', 'B');

    const logout = await request(ctx.http)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .expect(201);

    expect(logout.status).toBe(201);

    const refresh = await request(ctx.http)
      .post('/api/auth/refresh')
      .send({ refreshToken: reg.refreshToken })
      .expect(401);

    expect(refresh.status).toBe(401);
  });

  it('change-password -> old falha, new funciona', async () => {
    const ctx = await ctxP;

    const reg = await registerUser(ctx.http, 'c@c.com', 'StrongPass1!', 'C');

    await request(ctx.http)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${reg.accessToken}`)
      .send({ oldPassword: 'StrongPass1!', newPassword: 'NewPass1!' })
      .expect(201);

    await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: 'c@c.com', password: 'StrongPass1!' })
      .expect(401);

    await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: 'c@c.com', password: 'NewPass1!' })
      .expect(200);
  });

  it('request-password-reset + reset-password -> altera password', async () => {
    const ctx = await ctxP;

    await registerUser(ctx.http, 'd@d.com', 'StrongPass1!', 'D');

    const reqReset = await request(ctx.http)
      .post('/api/auth/request-password-reset')
      .send({ email: 'd@d.com' })
      .expect(201);

    expect(reqReset.body.success).toBe(true);
    expect(reqReset.body.testToken).toBeDefined();

    await request(ctx.http)
      .post('/api/auth/reset-password')
      .send({ token: reqReset.body.testToken, newPassword: 'ResetPass1!' })
      .expect(201);

    await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: 'd@d.com', password: 'StrongPass1!' })
      .expect(401);

    await request(ctx.http)
      .post('/api/auth/login')
      .send({ email: 'd@d.com', password: 'ResetPass1!' })
      .expect(200);
  });

  it('me -> 401 sem token', async () => {
    const ctx = await ctxP;

    const res = await request(ctx.http).get('/api/auth/me').expect(401);
    expect(res.status).toBe(401);
  });

  it('refresh -> 401 sem refresh token', async () => {
    const ctx = await ctxP;

    const res = await request(ctx.http).post('/api/auth/refresh').send({}).expect(401);
    expect(res.status).toBe(401);
  });

  it('login -> tokens e refresh guardado (refresh funciona)', async () => {
    const ctx = await ctxP;

    await registerUser(ctx.http, 'e@e.com', 'StrongPass1!', 'E');
    const login = await loginUser(ctx.http, 'e@e.com', 'StrongPass1!');

    const ref = await request(ctx.http)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(201);

    expect(ref.body.accessToken).toBeDefined();
    expect(ref.body.refreshToken).toBeDefined();
  });
});
