import { Test } from '@nestjs/testing';
import { ServicesService } from '../../src/services/services.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('ServicesService (unit)', () => {
  let service: ServicesService;
  const prisma = {
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ServicesService);
  });

  it('list() should call prisma.service.findMany with filters', async () => {
    prisma.service.findMany.mockResolvedValueOnce([{ id: '1' }]);

    const res = await service.list({ isActive: 'true', q: 'api' });

    expect(prisma.service.findMany).toHaveBeenCalledTimes(1);
    const args = prisma.service.findMany.mock.calls[0][0];
    expect(args.where.isActive).toBe(true);
    expect(args.where.OR.length).toBe(2);
    expect(res).toEqual([{ id: '1' }]);
  });

  it('getByKey() should return service when found', async () => {
    prisma.service.findUnique.mockResolvedValueOnce({ id: 'svc1', key: 'k' });
    const res = await service.getByKey('k');
    expect(res).toEqual({ id: 'svc1', key: 'k' });
  });

  it('getById() should throw when not found', async () => {
    prisma.service.findUnique.mockResolvedValueOnce(null);
    await expect(service.getById('x')).rejects.toThrow('Service not found');
  });
});
