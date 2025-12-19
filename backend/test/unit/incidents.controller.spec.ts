/**
 * @file test/unit/incidents.controller.spec.ts
 * @module tests/unit/incidents-controller
 *
 * @summary
 *  - Testes unitários do IncidentsController (camada HTTP/controller).
 *
 * @description
 *  - Garante que cada endpoint do controller:
 *    - passa o DTO correto para o service,
 *    - extrai userId de req.user,
 *    - devolve o output do service.
 *
 * @dependencies
 *  - IncidentsService é mockado (não toca em DB).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsController } from '../../src/incidents/incidents.controller';
import { IncidentsService } from '../../src/incidents/incidents.service';
import { CreateIncidentDto } from '../../src/incidents/dto/create-incident.dto';
import { UpdateIncidentDto } from '../../src/incidents/dto/update-incident.dto';
import { ChangeStatusDto } from '../../src/incidents/dto/change-status.dto';
import { AddCommentDto } from '../../src/incidents/dto/add-comment.dto';
import { ListIncidentsDto } from '../../src/incidents/dto/list-incidents.dto';

describe('IncidentsController (unit)', () => {
  let controller: IncidentsController;
  let service: jest.Mocked<IncidentsService>;

  beforeEach(async () => {
    const serviceMock: any = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      changeStatus: jest.fn(),
      addComment: jest.fn(),
      listComments: jest.fn(),
      listTimeline: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentsController],
      providers: [{ provide: IncidentsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<IncidentsController>(IncidentsController);
    service = module.get(IncidentsService) as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const mockReq = (userId = 'user-1') =>
    ({
      user: { id: userId, sub: userId },
    } as any);

  it('create chama service.create com dto e userId', async () => {
    const dto: CreateIncidentDto = {
      title: 'DB down',
      description: 'desc',
      severity: undefined,
      assigneeId: undefined,
      teamId: undefined,
      categoryIds: [],
      tagIds: [],
    };

    (service.create as jest.Mock).mockResolvedValue({ id: 'inc-1' });

    const result = await controller.create(dto, mockReq());

    expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual({ id: 'inc-1' });
  });

  it('findAll chama service.findAll com query', async () => {
    const query: ListIncidentsDto = {
      status: undefined,
      severity: undefined,
      assigneeId: undefined,
      teamId: undefined,
      search: 'db',
      createdFrom: undefined,
      createdTo: undefined,
    };

    (service.findAll as jest.Mock).mockResolvedValue([]);

    const result = await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([]);
  });

  it('findOne chama service.findOne com id', async () => {
    (service.findOne as jest.Mock).mockResolvedValue({ id: 'inc-1' });

    const result = await controller.findOne('inc-1');

    expect(service.findOne).toHaveBeenCalledWith('inc-1');
    expect(result).toEqual({ id: 'inc-1' });
  });

  it('update chama service.update com id, dto e userId', async () => {
    const dto: UpdateIncidentDto = { title: 'novo' };

    (service.update as jest.Mock).mockResolvedValue({ id: 'inc-1' });

    const result = await controller.update('inc-1', dto, mockReq());

    expect(service.update).toHaveBeenCalledWith('inc-1', dto, 'user-1');
    expect(result).toEqual({ id: 'inc-1' });
  });

  it('changeStatus chama service.changeStatus com id, dto e userId', async () => {
    const dto: ChangeStatusDto = {
      newStatus: undefined as any,
      message: 'msg',
    };

    (service.changeStatus as jest.Mock).mockResolvedValue({ id: 'inc-1' });

    const result = await controller.changeStatus('inc-1', dto, mockReq());

    expect(service.changeStatus).toHaveBeenCalledWith('inc-1', dto, 'user-1');
    expect(result).toEqual({ id: 'inc-1' });
  });

  it('addComment chama service.addComment com id, dto e userId', async () => {
    const dto: AddCommentDto = { body: 'ola' };

    (service.addComment as jest.Mock).mockResolvedValue({ id: 'comment-1' });

    const result = await controller.addComment('inc-1', dto, mockReq());

    expect(service.addComment).toHaveBeenCalledWith('inc-1', dto, 'user-1');
    expect(result).toEqual({ id: 'comment-1' });
  });

  it('listComments chama service.listComments', async () => {
    (service.listComments as jest.Mock).mockResolvedValue([]);

    const result = await controller.listComments('inc-1');

    expect(service.listComments).toHaveBeenCalledWith('inc-1');
    expect(result).toEqual([]);
  });

  it('listTimeline chama service.listTimeline', async () => {
    (service.listTimeline as jest.Mock).mockResolvedValue([]);

    const result = await controller.listTimeline('inc-1');

    expect(service.listTimeline).toHaveBeenCalledWith('inc-1');
    expect(result).toEqual([]);
  });

  it('subscribe chama service.subscribe com id e userId', async () => {
    (service.subscribe as jest.Mock).mockResolvedValue({ subscribed: true });

    const result = await controller.subscribe('inc-1', mockReq());

    expect(service.subscribe).toHaveBeenCalledWith('inc-1', 'user-1');
    expect(result).toEqual({ subscribed: true });
  });

  it('unsubscribe chama service.unsubscribe com id e userId', async () => {
    (service.unsubscribe as jest.Mock).mockResolvedValue({ subscribed: false });

    const result = await controller.unsubscribe('inc-1', mockReq());

    expect(service.unsubscribe).toHaveBeenCalledWith('inc-1', 'user-1');
    expect(result).toEqual({ subscribed: false });
  });
});
