import { Test, TestingModule } from '@nestjs/testing';
import { TeamsController } from '../../src/teams/teams.controller';
import { TeamsService } from '../../src/teams/teams.service';

describe('TeamsController', () => {
  let controller: TeamsController;
  let service: jest.Mocked<TeamsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        {
          provide: TeamsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findForUser: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            listMembers: jest.fn(),
            addMember: jest.fn(),
            removeMember: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
    service = module.get(TeamsService) as jest.Mocked<TeamsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create delega para o service', async () => {
    const dto = { name: 'NOC' };
    const created = { id: 'team-1', name: 'NOC' };
    service.create.mockResolvedValue(created as any);

    const result = await controller.create(dto as any);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(created);
  });

  it('findAll delega para o service', async () => {
    const query = { search: 'noc' };
    service.findAll.mockResolvedValue([] as any);

    const result = await controller.findAll(query as any);

    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([]);
  });

  it('findMine usa user do request', async () => {
    const req = { user: { sub: 'user-1' } };
    const teams = [{ id: 'team-1' }];
    service.findForUser.mockResolvedValue(teams as any);

    const result = await controller.findMine(req as any);

    expect(service.findForUser).toHaveBeenCalledWith('user-1');
    expect(result).toBe(teams);
  });

  it('findOne delega para o service', async () => {
    const team = { id: 'team-1' };
    service.findOne.mockResolvedValue(team as any);

    const result = await controller.findOne('team-1');

    expect(service.findOne).toHaveBeenCalledWith('team-1');
    expect(result).toBe(team);
  });

  it('update delega para o service', async () => {
    const dto = { name: 'New' };
    const updated = { id: 'team-1', name: 'New' };
    service.update.mockResolvedValue(updated as any);

    const result = await controller.update('team-1', dto as any);

    expect(service.update).toHaveBeenCalledWith('team-1', dto);
    expect(result).toBe(updated);
  });

  it('remove delega para o service', async () => {
    const payload = { deleted: true };
    service.remove.mockResolvedValue(payload as any);

    const result = await controller.remove('team-1');

    expect(service.remove).toHaveBeenCalledWith('team-1');
    expect(result).toBe(payload);
  });

  it('listMembers delega para o service', async () => {
    const members = [{ id: 'u1' }];
    service.listMembers.mockResolvedValue(members as any);

    const result = await controller.listMembers('team-1');

    expect(service.listMembers).toHaveBeenCalledWith('team-1');
    expect(result).toBe(members);
  });

  it('addMember delega para o service', async () => {
    const updated = { id: 'team-1' };
    service.addMember.mockResolvedValue(updated as any);

    const result = await controller.addMember('team-1', { userId: 'u1' });

    expect(service.addMember).toHaveBeenCalledWith('team-1', 'u1');
    expect(result).toBe(updated);
  });

  it('removeMember delega para o service', async () => {
    const updated = { id: 'team-1' };
    service.removeMember.mockResolvedValue(updated as any);

    const result = await controller.removeMember('team-1', 'u1');

    expect(service.removeMember).toHaveBeenCalledWith('team-1', 'u1');
    expect(result).toBe(updated);
  });
});
