import request from 'supertest';
import { bootstrapE2E, registerUser } from './_helpers/e2e-utils';
import { IncidentStatus, Severity } from '@prisma/client';

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
      const p: any = ctx.prisma as any;
      for (const model of [
        'incidentComment',
        'incidentTimelineEvent',
        'notificationSubscription',
        'categoryOnIncident',
        '_IncidentTags',
        'incidentSource',
        'cAPA',
        'incident',
        'service',
        '_TeamMembers',
        'team',
        'user',
        'tag',
        'category',
      ]) {
        try {
          if (p[model]?.deleteMany) await p[model].deleteMany({});
        } catch {}
      }

      const { user, accessToken } = await registerUser(
        ctx.http,
        'admin@x.com',
        'password123',
        'Admin',
      );

      const team = await ctx.prisma.team.create({ data: { name: 'Ops' } });
      const svc = await ctx.prisma.service.create({
        data: { key: 'public-api', name: 'Public API', ownerTeamId: team.id },
      });
      const cat = await ctx.prisma.category.create({ data: { name: 'Network' } });

      const inc = await ctx.prisma.incident.create({
        data: {
          title: 'Incident 1',
          description: 'd',
          status: IncidentStatus.RESOLVED,
          severity: Severity.SEV1,
          reporterId: user.id,
          teamId: team.id,
          primaryServiceId: svc.id,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          resolvedAt: new Date('2025-01-01T00:30:00.000Z'),
        },
      });

      await ctx.prisma.categoryOnIncident.create({
        data: { incidentId: inc.id, categoryId: cat.id },
      });

      // kpis
      await request(ctx.http)
        .get('/api/reports/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // breakdown
      const brRes = await request(ctx.http)
        .get('/api/reports/breakdown')
        .query({ groupBy: 'category' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(brRes.body)).toBe(true);

      // export csv
      const csvRes = await request(ctx.http)
        .get('/api/reports/export.csv')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('Incident 1');

      // export pdf (summary)
      const pdfRes = await request(ctx.http)
        .get('/api/reports/export.pdf')
        .set('Authorization', `Bearer ${accessToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(Buffer.isBuffer(pdfRes.body)).toBe(true);
      expect(pdfRes.body.length).toBeGreaterThan(500);

      // export pdf (incident audit)
      const pdfIncident = await request(ctx.http)
        .get('/api/reports/export.pdf')
        .query({ incidentId: inc.id })
        .set('Authorization', `Bearer ${accessToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(pdfIncident.body.length).toBeGreaterThan(500);

      // tamper: muda o título direto na DB (não atualiza auditHash)
      await ctx.prisma.incident.update({
        where: { id: inc.id },
        data: { title: 'TAMPERED' },
      });

      await request(ctx.http)
        .get('/api/reports/export.pdf')
        .query({ incidentId: inc.id })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      // auth required
      await request(ctx.http).get('/api/reports/kpis').expect(401);
    } finally {
      await ctx.app.close();
    }
  });
});