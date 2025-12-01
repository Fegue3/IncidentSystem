// test/incidents.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  IncidentStatus,
  Priority,
  TimelineEventType,
} from '@prisma/client';
import { IncidentsService } from '../src/incidents/incidents.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreateIncidentDto } from '../src/incidents/dto/create-incident.dto';
import { UpdateIncidentDto } from '../src/incidents/dto/update-incident.dto';
import { ChangeStatusDto } from '../src/incidents/dto/change-status.dto';
import { AddCommentDto } from '../src/incidents/dto/add-comment.dto';
import { ListIncidentsDto } from '../src/incidents/dto/list-incidents.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prisma: any; // prisma como any para não chatear com mockResolvedValue

  beforeEach(async () => {
    const prismaMock: any = {
      incident: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      incidentTimelineEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      incidentComment: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      notificationSubscription: {
        create: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
      categoryOnIncident: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ---------- CREATE ----------

  it('deve criar incidente com prioridade default P3 e status NEW', async () => {
    const dto: CreateIncidentDto = {
      title: 'DB down',
      description: 'Database unreachable',
      priority: undefined,
      assigneeId: 'user-2',
      teamId: 'team-1',
      categoryIds: ['cat-1'],
      tagIds: ['tag-1'],
    };

    const createdIncident = {
      id: 'inc-1',
      title: dto.title,
      description: dto.description,
      status: IncidentStatus.NEW,
      priority: Priority.P3,
    };

    prisma.incident.create.mockResolvedValue(createdIncident as any);

    await service.create(dto, 'user-1');

    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: dto.title,
        description: dto.description,
        priority: Priority.P3,
        status: IncidentStatus.NEW,
        reporter: { connect: { id: 'user-1' } },
      }),
    });

    expect(prisma.incidentTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId: 'inc-1',
        authorId: 'user-1',
        type: TimelineEventType.STATUS_CHANGE,
        fromStatus: null,
        toStatus: IncidentStatus.NEW,
      }),
    });
    expect(prisma.notificationSubscription.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', incidentId: 'inc-1' },
    });
  });

  // ---------- FIND ALL / ONE ----------

  it('deve listar incidentes com filtros (findAll)', async () => {
    const query: ListIncidentsDto = {
      status: IncidentStatus.NEW,
      priority: Priority.P1,
      assigneeId: 'user-2',
      teamId: 'team-1',
      search: 'db',
      createdFrom: new Date('2024-01-01'),
      createdTo: new Date('2024-01-31'),
    };

    prisma.incident.findMany.mockResolvedValue([] as any);

    await service.findAll(query);

    expect(prisma.incident.findMany).toHaveBeenCalledWith({
      where: {
        status: IncidentStatus.NEW,
        priority: Priority.P1,
        assigneeId: 'user-2',
        teamId: 'team-1',
        OR: [
          { title: { contains: 'db', mode: 'insensitive' } },
          { description: { contains: 'db', mode: 'insensitive' } },
        ],
        createdAt: {
          gte: query.createdFrom,
          lte: query.createdTo,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: true,
        assignee: true,
        team: true,
      },
    });
  });

  it('deve devolver incidente em findOne', async () => {
    prisma.incident.findUnique.mockResolvedValue({ id: 'inc-1' } as any);

    const result = await service.findOne('inc-1');

    expect(prisma.incident.findUnique).toHaveBeenCalledWith({
      where: { id: 'inc-1' },
      include: expect.any(Object),
    });
    expect(result).toEqual({ id: 'inc-1' });
  });

  it('deve lançar NotFoundException se incidente não existir em findOne', async () => {
    prisma.incident.findUnique.mockResolvedValue(null);

    await expect(service.findOne('inc-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ---------- UPDATE ----------

  it('deve atualizar incidente e registar evento de FIELD_UPDATE', async () => {
    const dto: UpdateIncidentDto = {
      title: 'Novo título',
      description: 'Nova descrição',
      priority: Priority.P2,
      assigneeId: 'user-2',
      teamId: 'team-1',
      categoryIds: ['cat-1', 'cat-2'],
      tagIds: ['tag-1'],
    };

    prisma.incident.findUnique.mockResolvedValue({
      id: 'inc-1',
      status: IncidentStatus.NEW,
    } as any);
    prisma.incident.update.mockResolvedValue({
      id: 'inc-1',
      ...dto,
    } as any);

    const result = await service.update('inc-1', dto, 'user-1');

    expect(prisma.categoryOnIncident.deleteMany).toHaveBeenCalledWith({
      where: { incidentId: 'inc-1' },
    });

    expect(prisma.incident.update).toHaveBeenCalledWith({
      where: { id: 'inc-1' },
      data: expect.objectContaining({
        title: 'Novo título',
        description: 'Nova descrição',
        priority: Priority.P2,
      }),
    });

    expect(prisma.incidentTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId: 'inc-1',
        authorId: 'user-1',
        type: TimelineEventType.FIELD_UPDATE,
      }),
    });

    expect(result.id).toBe('inc-1');
  });

  it('deve lançar NotFoundException ao atualizar incidente inexistente', async () => {
    prisma.incident.findUnique.mockResolvedValue(null);

    await expect(
      service.update('inc-x', {} as UpdateIncidentDto, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---------- CHANGE STATUS ----------

  it('deve mudar status NEW -> TRIAGED e preencher triagedAt', async () => {
    const dto: ChangeStatusDto = {
      newStatus: IncidentStatus.TRIAGED,
      message: 'triagem feita',
    };

    prisma.incident.findUnique.mockResolvedValue({
      id: 'inc-1',
      status: IncidentStatus.NEW,
      triagedAt: null,
    } as any);

    prisma.incident.update.mockImplementation(async ({ data }: any) => ({
      id: 'inc-1',
      status: dto.newStatus,
      triagedAt: data.triagedAt,
    })) as any;

    const result = await service.changeStatus('inc-1', dto, 'user-1');

    expect(prisma.incident.update).toHaveBeenCalledWith({
      where: { id: 'inc-1' },
      data: expect.objectContaining({ status: IncidentStatus.TRIAGED }),
    });

    expect(prisma.incidentTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId: 'inc-1',
        authorId: 'user-1',
        type: TimelineEventType.STATUS_CHANGE,
        fromStatus: IncidentStatus.NEW,
        toStatus: IncidentStatus.TRIAGED,
        message: 'triagem feita',
      }),
    });

    expect(result.status).toBe(IncidentStatus.TRIAGED);
  });

  it('deve recusar transição inválida NEW -> CLOSED', async () => {
    const dto: ChangeStatusDto = {
      newStatus: IncidentStatus.CLOSED,
      message: 'fechar',
    };

    prisma.incident.findUnique.mockResolvedValue({
      id: 'inc-1',
      status: IncidentStatus.NEW,
    } as any);

    await expect(
      service.changeStatus('inc-1', dto, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ---------- COMMENTS ----------

  it('deve adicionar comentário e criar evento de COMMENT', async () => {
    prisma.incident.findUnique.mockResolvedValue({
      id: 'inc-1',
    } as any);

    const commentResult = {
      id: 'comment-1',
      body: 'isto está a arder',
    };

    prisma.incidentComment.create.mockResolvedValue(commentResult as any);
    prisma.incidentTimelineEvent.create.mockResolvedValue({} as any);

    const dto: AddCommentDto = { body: 'isto está a arder' };

    const result = await service.addComment('inc-1', dto, 'user-1');

    expect(prisma.incidentComment.create).toHaveBeenCalledWith({
      data: {
        incidentId: 'inc-1',
        authorId: 'user-1',
        body: dto.body,
      },
    });

    expect(prisma.incidentTimelineEvent.create).toHaveBeenCalledWith({
      data: {
        incidentId: 'inc-1',
        authorId: 'user-1',
        type: TimelineEventType.COMMENT,
        message: dto.body,
      },
    });

    expect(result).toEqual(commentResult);
  });

  it('deve lançar NotFound ao adicionar comentário a incidente inexistente', async () => {
    prisma.incident.findUnique.mockResolvedValue(null);

    await expect(
      service.addComment('inc-x', { body: 'ola' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deve listar comentários', async () => {
    prisma.incidentComment.findMany.mockResolvedValue([] as any);

    const result = await service.listComments('inc-1');

    expect(prisma.incidentComment.findMany).toHaveBeenCalledWith({
      where: { incidentId: 'inc-1' },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
    expect(result).toEqual([]);
  });

  // ---------- TIMELINE ----------

  it('deve listar timeline', async () => {
    prisma.incidentTimelineEvent.findMany.mockResolvedValue([] as any);

    const result = await service.listTimeline('inc-1');

    expect(prisma.incidentTimelineEvent.findMany).toHaveBeenCalledWith({
      where: { incidentId: 'inc-1' },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
    expect(result).toEqual([]);
  });

  // ---------- SUBSCRIPTIONS ----------

  it('deve criar subscription se ainda não existir', async () => {
    prisma.notificationSubscription.findFirst.mockResolvedValue(null);
    prisma.notificationSubscription.create.mockResolvedValue({} as any);

    const result = await service.subscribe('inc-1', 'user-1');

    expect(prisma.notificationSubscription.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', incidentId: 'inc-1' },
    });
    expect(prisma.notificationSubscription.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        incidentId: 'inc-1',
      },
    });
    expect(result).toEqual({ subscribed: true });
  });

  it('não deve criar subscription se já existir', async () => {
    prisma.notificationSubscription.findFirst.mockResolvedValue({
      id: 'sub-1',
    } as any);

    const result = await service.subscribe('inc-1', 'user-1');

    expect(prisma.notificationSubscription.create).not.toHaveBeenCalled();
    expect(result).toEqual({ subscribed: true });
  });

  it('deve remover subscription em unsubscribe', async () => {
    prisma.notificationSubscription.deleteMany.mockResolvedValue({
      count: 1,
    } as any);

    const result = await service.unsubscribe('inc-1', 'user-1');

    expect(prisma.notificationSubscription.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        incidentId: 'inc-1',
      },
    });
    expect(result).toEqual({ subscribed: false });
  });
});
