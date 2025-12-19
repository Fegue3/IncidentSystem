/**
 * @file reports.e2e.spec.ts
 * @module test/e2e/reports.e2e
 *
 * @summary
 *  - Testes E2E para endpoints de relatórios (KPIs, breakdown, export CSV e export PDF) com scoping e audit.
 *
 * @description
 *  Valida que:
 *  - endpoints de reports requerem autenticação (401 sem token);
 *  - o utilizador tem de estar no team para passar scoping (evita 403);
 *  - export CSV devolve `text/csv` e contém dados;
 *  - export PDF devolve `application/pdf` e gera um buffer válido;
 *  - export PDF por `incidentId` funciona;
 *  - deteção de tamper (auditoria) devolve 409 quando o incidente foi alterado.
 *
 * @dependencies
 *  - bootstrapE2E: app real Nest.
 *  - Prisma: criação de fixtures (team/service/category/incident) para alimentar o report.
 *  - supertest: requests HTTP.
 */

import request from 'supertest';
import { bootstrapE2E, registerUser } from './_helpers/e2e-utils';
import { IncidentStatus, Severity } from '@prisma/client';

/**
 * Parser para respostas binárias (PDF) via supertest.
 * Converte a resposta em Buffer.
 */
const binaryParser = (res: any, cb: any) => {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => (data += chunk));
  res.on('end', () => cb(null, Buffer.from(data, 'binary')));
};

describe('Reports (e2e)', () => {
  it('GET /api/reports/kpis /breakdown /export.csv /export.pdf (auth required)', async () => {
    process.env.AUDIT_HMAC_SECRET = 'test-audit-secret';

    const ctx = await bootstrapE2E();

    try {
      const uniq = Date.now();

      // Password forte para não falhar validações de DTO (se existirem)
      const { user, accessToken } = await registerUser(
        ctx.http,
        `admin+${uniq}@x.com`,
        'StrongPass1!',
        'Admin',
      );

      const team = await ctx.prisma.team.create({
        data: { name: `Ops-${uniq}` },
      });

      // Importante: garantir que o user é membro da equipa (scoping)
      await ctx.prisma.team.update({
        where: { id: team.id },
        data: { members: { connect: { id: user.id } } },
      });

      // Nota: `name` também é unique; manter único por teste
      const svc = await ctx.prisma.service.create({
        data: {
          key: `public-api-${uniq}`,
          name: `Public API ${uniq}`,
          ownerTeamId: team.id,
        },
      });

      const cat = await ctx.prisma.category.create({
        data: { name: `Network-${uniq}` },
      });

      // Incidente resolvido para alimentar KPIs (MTTR, etc.)
      const now = new Date();
      const createdAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const resolvedAt = new Date(
        now.getTime() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
      );

      const inc = await ctx.prisma.incident.create({
        data: {
          title: 'Incident 1',
          description: 'd',
          status: IncidentStatus.RESOLVED,
          severity: Severity.SEV1,
          reporterId: user.id,
          teamId: team.id,
          primaryServiceId: svc.id,
          createdAt,
          resolvedAt,
        },
      });

      await ctx.prisma.categoryOnIncident.create({
        data: { incidentId: inc.id, categoryId: cat.id },
      });

      await request(ctx.http)
        .get('/api/reports/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const brRes = await request(ctx.http)
        .get('/api/reports/breakdown')
        .query({ groupBy: 'category' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(brRes.body)).toBe(true);

      const csvRes = await request(ctx.http)
        .get('/api/reports/export.csv')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('Incident 1');

      const pdfRes = await request(ctx.http)
        .get('/api/reports/export.pdf')
        .set('Authorization', `Bearer ${accessToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(Buffer.isBuffer(pdfRes.body)).toBe(true);
      expect(pdfRes.body.length).toBeGreaterThan(500);

      const pdfIncident = await request(ctx.http)
        .get('/api/reports/export.pdf')
        .query({ incidentId: inc.id })
        .set('Authorization', `Bearer ${accessToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(pdfIncident.body.length).toBeGreaterThan(500);

      // Simula tamper: altera dados do incidente após auditoria prevista
      await ctx.prisma.incident.update({
        where: { id: inc.id },
        data: { title: 'TAMPERED' },
      });

      await request(ctx.http)
        .get('/api/reports/export.pdf')
        .query({ incidentId: inc.id })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      // Sem token: 401
      await request(ctx.http).get('/api/reports/kpis').expect(401);
    } finally {
      await ctx.app.close();
    }
  });
});
