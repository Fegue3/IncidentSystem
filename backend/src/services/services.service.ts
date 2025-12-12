import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListServicesDto } from './dto/list-services.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async list(dto: ListServicesDto) {
    const isActive =
      dto.isActive === undefined ? undefined : dto.isActive === 'true';

    const q = dto.q?.trim();

    return this.prisma.service.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { key: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        ownerTeam: { select: { id: true, name: true } },
      },
    });
  }

  async getById(id: string) {
    const svc = await this.prisma.service.findUnique({
      where: { id },
      include: { ownerTeam: { select: { id: true, name: true } } },
    });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async getByKey(key: string) {
    const svc = await this.prisma.service.findUnique({
      where: { key },
      include: { ownerTeam: { select: { id: true, name: true } } },
    });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }
}
