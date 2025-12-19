/**
 * @file reports.export.int.spec.ts
 * @module test/integration/reports.export
 *
 * @summary
 *  - Teste de integração do export CSV do ReportsService (com PrismaClient real).
 *
 * @description
 *  Cria fixtures mínimas na DB e valida que:
 *  - o CSV contém header esperado;
 *  - o CSV contém uma linha com o incidente criado.
 *
 * @dependencies
 *  - PrismaClient real (ligação direta à DB de teste).
 *  - resetDb (TRUNCATE): isolamento.
 *  - ReportsService: instanciado com prisma (via constructor).
 *
 * @notes
 *  - O user é passado como ADMIN para evitar restrições de scoping/roles em reports.
 */

import { PrismaClient, IncidentStatus, Severity } from '@prisma/client';
import { resetDb } from './_helpers/prisma-reset';
import { ReportsService } from '../../src/reports/reports.service';

describe('Reports CSV (integration)', () => {
  let prisma: PrismaClient;
  let service: ReportsService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    service = new ReportsService(prisma as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(prisma as any);
  });

  it('exportCsv: inclui headers e uma linha com o incidente', async () => {
    const reporter = await prisma.user.create({
      data: { email: 'rep@csv.com', name: 'Reporter', password: 'x' },
    });

    const now = new Date();
    const createdAt = new Date(now.getTime() - 60 * 60 * 1000);
    const resolvedAt = now;

    await prisma.incident.create({
      data: {
        title: 'CSV Incident',
        description: 'd',
        status: IncidentStatus.RESOLVED,
        severity: Severity.SEV2,
        reporterId: reporter.id,
        createdAt,
        resolvedAt,
      },
    });

    const csv = await service.exportCsv({}, { id: reporter.id, role: 'ADMIN' });

    const header = csv.split('\n')[0];

    // Header esperado conforme formato atual do export
    expect(header).toContain(
      'id,createdAt,title,severity,status,team,service,assignee,reporter,mttrSeconds,slaTargetSeconds,slaMet,capaCount,resolvedAt,closedAt,categories,tags',
    );

    expect(csv).toContain('CSV Incident');
  });
});
