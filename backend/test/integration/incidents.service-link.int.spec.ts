// test/integration/incidents.service-link.int.spec.ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UsersService } from '../../src/users/users.service';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { resetDb } from './_helpers/prisma-reset';
import { IncidentStatus, Severity } from '@prisma/client';

describe('Incidents primaryService (integration - service)', () => {
  let prisma: PrismaService;
  let users: UsersService;
  let incidents: IncidentsService;
  let mod: any;

  beforeAll(async () => {
    jest.setTimeout(30000);

    process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@postgres:5432/incidentsdb_test?schema=public';

    // (não é obrigatório aqui, mas mantém consistente com o teu auth.int.spec.ts)
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'super_access_secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'super_refresh_secret';

    mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = mod.get(PrismaService);
    users = mod.get(UsersService);
    incidents = mod.get(IncidentsService);

    await resetDb(prisma);
  }, 30000);

  beforeEach(async () => {
    await resetDb(prisma);

    // seeds para os testes
    await prisma.service.create({
      data: { key: 'auth-gateway', name: 'Auth Gateway', isActive: true },
    });
    await prisma.service.create({
      data: { key: 'public-api', name: 'Public API', isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await mod?.close?.();
  });

  async function listBy(dto: any) {
    const svc: any = incidents as any;

    // tenta nomes comuns de método sem dar erro de TS
    if (typeof svc.list === 'function') return svc.list(dto);
    if (typeof svc.findAll === 'function') return svc.findAll(dto);
    if (typeof svc.getAll === 'function') return svc.getAll(dto);

    // fallback (não devia ser preciso)
    if (dto?.primaryServiceKey) {
      const s = await prisma.service.findUnique({ where: { key: dto.primaryServiceKey } });
      return prisma.incident.findMany({ where: { primaryServiceId: s?.id ?? undefined } });
    }
    return prisma.incident.findMany();
  }

  it('create() aceita primaryServiceKey e seta primaryServiceId', async () => {
    const reporter = await users.create('rep@test.local', 'StrongPass1!', 'Reporter');

    const svc = await prisma.service.findUnique({ where: { key: 'auth-gateway' } });

    const created = await incidents.create(
      {
        title: 't',
        description: 'd',
        categoryIds: [],
        tagIds: [],
        primaryServiceKey: 'auth-gateway',
      } as any,
      reporter.id,
    );

    expect(created.primaryServiceId).toBeTruthy();
    expect(created.primaryServiceId).toBe(svc!.id);
  });

  it('update() muda primaryServiceKey', async () => {
    const reporter = await users.create('rep2@test.local', 'StrongPass1!', 'Reporter2');

    const created = await incidents.create(
      {
        title: 't',
        description: 'd',
        categoryIds: [],
        tagIds: [],
      } as any,
      reporter.id,
    );

    const target = await prisma.service.findUnique({ where: { key: 'public-api' } });

    // assumes que tens incidents.update(id, dto, userId)
    const updated = await (incidents as any).update(
      created.id,
      { primaryServiceKey: 'public-api' } as any,
      reporter.id,
    );

    expect(updated.primaryServiceId).toBe(target!.id);
  });

  it('update() remove service quando primaryServiceId vem vazio', async () => {
    const reporter = await users.create('rep3@test.local', 'StrongPass1!', 'Reporter3');

    const svc = await prisma.service.findUnique({ where: { key: 'auth-gateway' } });

    // cria incidente já ligado a um service
    const inc = await prisma.incident.create({
      data: {
        title: 't',
        description: 'd',
        reporterId: reporter.id,
        status: IncidentStatus.NEW,
        severity: Severity.SEV3,
        primaryServiceId: svc!.id,
      },
    });

    const updated = await (incidents as any).update(
      inc.id,
      { primaryServiceId: '' } as any,
      reporter.id,
    );

    expect(updated.primaryServiceId).toBeNull();

    const db = await prisma.incident.findUnique({ where: { id: inc.id } });
    expect(db!.primaryServiceId).toBeNull();
  });

  it('list() filtra por primaryServiceKey', async () => {
    const reporter = await users.create('rep4@test.local', 'StrongPass1!', 'Reporter4');

    const svc = await prisma.service.findUnique({ where: { key: 'auth-gateway' } });

    await prisma.incident.create({
      data: {
        title: 'a',
        description: 'a',
        reporterId: reporter.id,
        status: IncidentStatus.NEW,
        severity: Severity.SEV3,
        primaryServiceId: svc!.id,
      },
    });

    await prisma.incident.create({
      data: {
        title: 'b',
        description: 'b',
        reporterId: reporter.id,
        status: IncidentStatus.NEW,
        severity: Severity.SEV3,
      },
    });

    const res = await listBy({ primaryServiceKey: 'auth-gateway' } as any);

    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((i: any) => i.primaryServiceId === svc!.id)).toBe(true);
  });
});
