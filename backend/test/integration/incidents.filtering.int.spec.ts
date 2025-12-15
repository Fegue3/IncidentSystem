// test/integration/incidents.filtering.int.spec.ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { UsersService } from '../../src/users/users.service';
import { TeamsService } from '../../src/teams/teams.service';
import { ServicesService } from '../../src/services/services.service';
import { resetDb } from './_helpers/prisma-reset';
import { Severity, IncidentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

describe('Incidents Filtering & Search (integration)', () => {
  let prisma: PrismaService;
  let incidents: IncidentsService;
  let users: UsersService;
  let teams: TeamsService;
  let services: ServicesService;
  let mod: any;

  let userId: string;
  let teamId1: string;
  let teamId2: string;
  let serviceId1: string;
  let serviceId2: string;

  beforeAll(async () => {
    jest.setTimeout(30000);

    process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@postgres:5432/incidentsdb_test?schema=public';

    mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = mod.get(PrismaService);
    incidents = mod.get(IncidentsService);
    users = mod.get(UsersService);
    teams = mod.get(TeamsService);
    services = mod.get(ServicesService);

    await resetDb(prisma);
  }, 30000);

  beforeEach(async () => {
    await resetDb(prisma);

    // Setup: user, teams, services (email único por teste)
    const email = `filter+${randomUUID()}@test.com`;
    const user = await users.create(email, 'Pass1!', 'Filter Tester');
    userId = user.id;

    const team1 = await teams.create({ name: 'SRE' } as any);
    const team2 = await teams.create({ name: 'NOC' } as any);
    teamId1 = team1.id;
    teamId2 = team2.id;

    const svc1 = await prisma.service.create({
      data: { key: 'postgres', name: 'PostgreSQL', isActive: true },
    });
    const svc2 = await prisma.service.create({
      data: { key: 'api-gateway', name: 'API Gateway', isActive: true },
    });
    serviceId1 = svc1.id;
    serviceId2 = svc2.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await mod?.close?.();
  });

  describe('Filter by status', () => {
    it('deve listar incidentes por status NEW', async () => {
      await incidents.create(
        {
          title: 'New Incident 1',
          description: 'Status NEW',
          severity: Severity.SEV3,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({ status: IncidentStatus.NEW });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((i) => i.status === IncidentStatus.NEW)).toBe(true);
      expect(result.some((i) => i.title === 'New Incident 1')).toBe(true);
    });
  });

  describe('Filter by severity', () => {
    it('deve listar incidentes por severidade SEV1', async () => {
      await incidents.create(
        {
          title: 'Critical Issue',
          description: 'SEV1 issue',
          severity: Severity.SEV1,
          teamId: teamId1,
        },
        userId,
      );

      await incidents.create(
        {
          title: 'Minor Issue',
          description: 'SEV3 issue',
          severity: Severity.SEV3,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({ severity: Severity.SEV1 });

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(Severity.SEV1);
      expect(result[0].title).toBe('Critical Issue');
    });

    it('deve listar incidentes por severidade SEV2', async () => {
      await incidents.create(
        {
          title: 'High Issue',
          description: 'SEV2',
          severity: Severity.SEV2,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({ severity: Severity.SEV2 });

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(Severity.SEV2);
    });
  });

  describe('Filter by team', () => {
    it('deve listar incidentes da equipa', async () => {
      await incidents.create(
        {
          title: 'Team 1 Incident',
          description: 'Belongs to team 1',
          severity: Severity.SEV3,
          teamId: teamId1,
        },
        userId,
      );

      await incidents.create(
        {
          title: 'Team 2 Incident',
          description: 'Belongs to team 2',
          severity: Severity.SEV3,
          teamId: teamId2,
        },
        userId,
      );

      const result = await incidents.findAll({ teamId: teamId1 });

      expect(result).toHaveLength(1);
      expect(result[0].team?.id).toBe(teamId1);
      expect(result[0].title).toBe('Team 1 Incident');
    });
  });

  describe('Filter by service', () => {
    it('deve listar incidentes por primaryServiceId', async () => {
      await incidents.create(
        {
          title: 'DB Issue',
          description: 'Postgres related',
          severity: Severity.SEV2,
          teamId: teamId1,
          primaryServiceId: serviceId1,
        },
        userId,
      );

      await incidents.create(
        {
          title: 'API Issue',
          description: 'API Gateway related',
          severity: Severity.SEV2,
          teamId: teamId1,
          primaryServiceId: serviceId2,
        },
        userId,
      );

      const result = await incidents.findAll({ primaryServiceId: serviceId1 });

      expect(result).toHaveLength(1);
      expect(result[0].primaryService?.id).toBe(serviceId1);
      expect(result[0].title).toBe('DB Issue');
    });

    it('deve listar incidentes por primaryServiceKey', async () => {
      await incidents.create(
        {
          title: 'Postgres Issue',
          description: 'DB problem',
          severity: Severity.SEV2,
          teamId: teamId1,
          primaryServiceKey: 'postgres',
        },
        userId,
      );

      const result = await incidents.findAll({ primaryServiceKey: 'postgres' });

      expect(result).toHaveLength(1);
      expect(result[0].primaryService?.key).toBe('postgres');
    });

    it('deve retornar vazio se primaryServiceKey não existir', async () => {
      const result = await incidents.findAll({
        primaryServiceKey: 'nonexistent-service',
      });

      expect(result).toEqual([]);
    });
  });

  describe('Search by text', () => {
    it('deve pesquisar por título (case-insensitive)', async () => {
      await incidents.create(
        {
          title: 'Database Connection Failed',
          description: 'Cannot reach postgres',
          severity: Severity.SEV1,
          teamId: teamId1,
        },
        userId,
      );

      await incidents.create(
        {
          title: 'API Timeout',
          description: 'Gateway is slow',
          severity: Severity.SEV2,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({ search: 'database' });

      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('Database');
    });

    it('deve pesquisar por descrição (case-insensitive)', async () => {
      await incidents.create(
        {
          title: 'Issue A',
          description: 'Connection problem to postgres',
          severity: Severity.SEV2,
          teamId: teamId1,
        },
        userId,
      );

      await incidents.create(
        {
          title: 'Issue B',
          description: 'Gateway latency problem',
          severity: Severity.SEV2,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({ search: 'postgres' });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('postgres');
    });

    it('deve buscar case-insensitive (UPPERCASE)', async () => {
      await incidents.create(
        {
          title: 'database issue',
          description: 'some description',
          severity: Severity.SEV1,
          teamId: teamId1,
        },
        userId,
      );

      const resultUpper = await incidents.findAll({ search: 'DATABASE' });
      const resultLower = await incidents.findAll({ search: 'database' });

      expect(resultUpper).toHaveLength(1);
      expect(resultLower).toHaveLength(1);
    });
  });

  describe('Combined filters', () => {
    it('deve combinar status + severidade', async () => {
      await incidents.create(
        {
          title: 'Critical and New',
          description: 'NEW + SEV1',
          severity: Severity.SEV1,
          teamId: teamId1,
        },
        userId,
      );

      await incidents.create(
        {
          title: 'High and New',
          description: 'NEW + SEV2',
          severity: Severity.SEV2,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({
        status: IncidentStatus.NEW,
        severity: Severity.SEV1,
      });

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(Severity.SEV1);
      expect(result[0].status).toBe(IncidentStatus.NEW);
    });

    it('deve combinar team + service + search', async () => {
      await incidents.create(
        {
          title: 'Database critical failure',
          description: 'Postgres is down',
          severity: Severity.SEV1,
          teamId: teamId1,
          primaryServiceId: serviceId1,
        },
        userId,
      );

      await incidents.create(
        {
          title: 'API critical failure',
          description: 'Gateway is down',
          severity: Severity.SEV1,
          teamId: teamId1,
          primaryServiceId: serviceId2,
        },
        userId,
      );

      const result = await incidents.findAll({
        teamId: teamId1,
        primaryServiceId: serviceId1,
        search: 'database',
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('Database');
    });
  });

  describe('Date range filtering', () => {
    it('deve filtrar por createdFrom (date range start)', async () => {
      const before = new Date('2020-01-01');

      await incidents.create(
        {
          title: 'Recent incident',
          description: 'Created now',
          severity: Severity.SEV3,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({ createdFrom: before });

      expect(result.length).toBeGreaterThan(0);
      expect(new Date(result[0].createdAt).getTime()).toBeGreaterThan(
        before.getTime(),
      );
    });
  });

  describe('Ordering', () => {
    it('deve retornar incidentes ordenados por createdAt DESC (mais recentes primeiro)', async () => {
      const inc1 = await incidents.create(
        {
          title: 'First Incident',
          description: 'Created first',
          severity: Severity.SEV3,
          teamId: teamId1,
        },
        userId,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const inc2 = await incidents.create(
        {
          title: 'Second Incident',
          description: 'Created second',
          severity: Severity.SEV3,
          teamId: teamId1,
        },
        userId,
      );

      const result = await incidents.findAll({});

      expect(result[0].id).toBe(inc2.id);
      expect(result[1].id).toBe(inc1.id);
    });
  });
});
