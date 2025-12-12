import { Test } from '@nestjs/testing';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Severity } from '@prisma/client';

describe('IncidentsService - primaryService linking (unit)', () => {
  let service: IncidentsService;

  const tx = {
    incident: {
      create: jest.fn(),
      update: jest.fn(),
    },
    service: {
      findUnique: jest.fn(),
    },
    incidentTimelineEvent: {
      create: jest.fn(),
    },
    notificationSubscription: {
      create: jest.fn(),
    },
    categoryOnIncident: {
      deleteMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((cb: any) => cb(tx)),
    incident: {
      findUnique: jest.fn(),
    },
    service: {
      findUnique: jest.fn(),
    },
    categoryOnIncident: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(IncidentsService);
  });

  it('create() should connect primaryService by key', async () => {
    prisma.service.findUnique.mockResolvedValueOnce({ id: 'svc1' });
    tx.incident.create.mockResolvedValueOnce({
      id: 'inc1',
      primaryServiceId: 'svc1',
      primaryService: { name: 'Auth Gateway' },
    });

    const res = await service.create(
      {
        title: 't',
        description: 'd',
        severity: Severity.SEV2,
        primaryServiceKey: 'auth-gateway',
      } as any,
      'user1',
    );

    expect(prisma.service.findUnique).toHaveBeenCalledWith({
      where: { key: 'auth-gateway' },
      select: { id: true },
    });

    const createArgs = tx.incident.create.mock.calls[0][0];
    expect(createArgs.data.primaryService).toEqual({ connect: { id: 'svc1' } });
    expect(res.id).toBe('inc1');
  });

  it('update() should disconnect primaryService when empty string', async () => {
    prisma.incident.findUnique.mockResolvedValueOnce({
      id: 'inc1',
      assigneeId: null,
      teamId: null,
      primaryServiceId: 'svc1',
    });

    tx.incident.update.mockResolvedValueOnce({
      id: 'inc1',
      primaryServiceId: null,
      primaryService: null,
    });

    const res = await service.update(
      'inc1',
      { primaryServiceId: '' } as any,
      'user1',
    );

    const updateArgs = tx.incident.update.mock.calls[0][0];
    expect(updateArgs.data.primaryService).toEqual({ disconnect: true });
    expect(res.primaryServiceId).toBeNull();
  });

  it('create() should throw if primaryServiceKey does not exist', async () => {
    prisma.service.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.create(
        { title: 't', description: 'd', primaryServiceKey: 'nope' } as any,
        'user1',
      ),
    ).rejects.toThrow('Service not found (primaryServiceKey)');
  });
});
