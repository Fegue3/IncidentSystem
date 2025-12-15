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

    await prisma.incident.create({
      data: {
        title: 'CSV Incident',
        description: 'd',
        status: IncidentStatus.RESOLVED,
        severity: Severity.SEV2,
        reporterId: reporter.id,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        resolvedAt: new Date('2025-01-01T01:00:00.000Z'),
      },
    });

    const csv = await service.exportCsv({ from: '2025-01-01T00:00:00.000Z', to: '2025-12-31T00:00:00.000Z' });

    expect(csv).toContain('id,title,status,severity');
    expect(csv).toContain('CSV Incident');
  });
});