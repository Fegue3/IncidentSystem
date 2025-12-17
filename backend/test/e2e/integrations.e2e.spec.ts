import request from 'supertest';
import { bootstrapE2E, registerUser } from './_helpers/e2e-utils';
import { resetDb } from '../integration/_helpers/prisma-reset';

describe('Integrations (e2e)', () => {
    it('GET /api/integrations/settings requires auth', async () => {
        const ctx = await bootstrapE2E();
        await resetDb(ctx.prisma);

        await request(ctx.http).get('/api/integrations/settings').expect(401);

        await ctx.app.close();
    });

    it('returns defaults for a new user', async () => {
        const ctx = await bootstrapE2E();
        await resetDb(ctx.prisma);

        const u = await registerUser(ctx.http, 'u1@x.com', 'pass1234', 'U1');

        const res = await request(ctx.http)
            .get('/api/integrations/settings')
            .set('Authorization', `Bearer ${u.accessToken}`)
            .expect(200);

        expect(res.body).toHaveProperty('datadog');
        expect(res.body).toHaveProperty('pagerduty');

        expect(res.body.datadog.notificationsEnabled).toBe(false);
        expect(res.body.pagerduty.notificationsEnabled).toBe(false);

        expect(res.body.datadog.lastSavedAt).toBeNull();
        expect(res.body.pagerduty.lastSavedAt).toBeNull();

        await ctx.app.close();
    });

    it('PATCH toggles and persists per-user (Datadog)', async () => {
        const ctx = await bootstrapE2E();
        await resetDb(ctx.prisma);

        const u = await registerUser(ctx.http, 'u2@x.com', 'pass1234', 'U2');

        const patch = await request(ctx.http)
            .patch('/api/integrations/settings/datadog')
            .set('Authorization', `Bearer ${u.accessToken}`)
            .send({ notificationsEnabled: true })
            .expect(200);

        expect(patch.body.datadog.notificationsEnabled).toBe(true);
        expect(patch.body.datadog.lastSavedAt).toBeTruthy();

        // re-fetch
        const res2 = await request(ctx.http)
            .get('/api/integrations/settings')
            .set('Authorization', `Bearer ${u.accessToken}`)
            .expect(200);

        expect(res2.body.datadog.notificationsEnabled).toBe(true);

        await ctx.app.close();
    });

    it('settings are isolated between users', async () => {
        const ctx = await bootstrapE2E();
        await resetDb(ctx.prisma);

        const u1 = await registerUser(ctx.http, 'u3@x.com', 'pass1234', 'U3');
        const u2 = await registerUser(ctx.http, 'u4@x.com', 'pass1234', 'U4');

        await request(ctx.http)
            .patch('/api/integrations/settings/pagerduty')
            .set('Authorization', `Bearer ${u1.accessToken}`)
            .send({ notificationsEnabled: true })
            .expect(200);

        const resU1 = await request(ctx.http)
            .get('/api/integrations/settings')
            .set('Authorization', `Bearer ${u1.accessToken}`)
            .expect(200);

        const resU2 = await request(ctx.http)
            .get('/api/integrations/settings')
            .set('Authorization', `Bearer ${u2.accessToken}`)
            .expect(200);

        expect(resU1.body.pagerduty.notificationsEnabled).toBe(true);
        expect(resU2.body.pagerduty.notificationsEnabled).toBe(false);

        await ctx.app.close();
    });

    it('PATCH validates id', async () => {
        const ctx = await bootstrapE2E();
        await resetDb(ctx.prisma);

        const u = await registerUser(ctx.http, 'u5@x.com', 'pass1234', 'U5');

        await request(ctx.http)
            .patch('/api/integrations/settings/invalid')
            .set('Authorization', `Bearer ${u.accessToken}`)
            .send({ notificationsEnabled: true })
            .expect(400);

        await ctx.app.close();
    });

    it('PATCH validates body', async () => {
        const ctx = await bootstrapE2E();
        await resetDb(ctx.prisma);

        const u = await registerUser(ctx.http, 'u6@x.com', 'pass1234', 'U6');

        // notificationsEnabled tem de ser boolean
        await request(ctx.http)
            .patch('/api/integrations/settings/datadog')
            .set('Authorization', `Bearer ${u.accessToken}`)
            .send({ notificationsEnabled: 'yes' })
            .expect(400);

        await ctx.app.close();
    });
});
