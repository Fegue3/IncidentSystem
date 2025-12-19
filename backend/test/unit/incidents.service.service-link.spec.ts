/**
 * @file test/unit/incidents.service.service-link.spec.ts
 * @module tests/unit/incidents-service-service-link
 *
 * @summary
 *  - Testes unitários do comportamento de ligação/desligação do primaryService no IncidentsService.
 *
 * @description
 *  - Valida:
 *    - create: resolve primaryServiceKey para serviceId e conecta
 *    - update: disconnect quando primaryServiceId é string vazia
 *    - create: erro quando primaryServiceKey não existe
 *
 * @dependencies
 *  - PrismaService é mockado (inclui transação e tx client).
 *  - NotificationsService é mockado (não é o foco aqui).
 */
import { Test } from '@nestjs/testing';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { Severity } from '@prisma/client';

describe('IncidentsService - primaryService linking (unit)', () => {
  let service: IncidentsService;

  const tx = {
    incident: { create: jest.fn(), update: jest.fn() },
    service: { findUnique: jest.fn() },
    incidentTimelineEvent: { create: jest.fn(), createMany: jest.fn() },
    notificationSubscription: { create: jest.fn() },
    categoryOnIncident: { deleteMany: jest.fn() },
  };

  const prisma = {
    $transaction: jest.fn((cb: any) => cb(tx)),
    incident: { findUnique: jest.fn() },
    service: { findUnique: jest.fn() },
    categoryOnIncident: { deleteMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: {
            sendDiscord: jest.fn().mockResolvedValue({ ok: true }),
            triggerPagerDuty: jest.fn().mockResolvedValue({ ok: true }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(IncidentsService);
  });

  it('create() conecta primaryService por key', async () => {
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

  it('update() desconecta primaryService quando primaryServiceId é string vazia', async () => {
    prisma.incident.findUnique.mockResolvedValueOnce({
      id: 'inc1',
      title: 't',
      description: 'd',
      severity: Severity.SEV3,
      assigneeId: null,
      teamId: null,
      primaryServiceId: 'svc1',
    });

    tx.incident.update.mockResolvedValueOnce({
      id: 'inc1',
      primaryServiceId: null,
      primaryService: null,
    });

    const res = await service.update('inc1', { primaryServiceId: '' } as any, 'user1');

    const updateArgs = tx.incident.update.mock.calls[0][0];
    expect(updateArgs.data.primaryService).toEqual({ disconnect: true });
    expect(res.primaryServiceId).toBeNull();
  });

  it('create() lança erro se primaryServiceKey não existir', async () => {
    prisma.service.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create({ title: 't', description: 'd', primaryServiceKey: 'nope' } as any, 'user1'),
    ).rejects.toThrow('Service not found (primaryServiceKey)');
  });
});
