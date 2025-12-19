/**
 * @file health.e2e.spec.ts
 * @module test/e2e/health.e2e
 *
 * @summary
 *  - Smoke test E2E para o endpoint de healthcheck.
 *
 * @description
 *  Garante que a aplicação está a responder via HTTP e que o endpoint `/api/health`
 *  devolve um payload esperado (ex.: `{ status: ... }`).
 *
 * @dependencies
 *  - bootstrapE2E: inicializa a app Nest.
 *  - supertest: faz o request HTTP.
 */

import request from 'supertest';
import { bootstrapE2E } from './_helpers/e2e-utils';

jest.setTimeout(60_000);

describe('Health (e2e)', () => {
  const ctxP = bootstrapE2E();

  afterAll(async () => {
    const ctx = await ctxP;
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('GET /api/health -> ok', async () => {
    const ctx = await ctxP;

    const res = await request(ctx.http).get('/api/health').expect(200);
    expect(res.body.status).toBeDefined();
  });
});
