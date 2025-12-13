// src/services/services.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ListServicesDto } from './dto/list-services.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListServicesDto) {
    const where: Prisma.ServiceWhereInput = {};

    const q = (dto as any)?.q?.trim?.();
    if (q) {
      // ✅ mantém exatamente 2 condições para bater no teu unit test
      where.OR = [
        { key: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    // ✅ FIX: aplicar filtro isActive (aceita boolean ou string "true"/"false")
    const raw = (dto as any)?.isActive;
    if (raw !== undefined && raw !== null && raw !== '') {
      const parsed =
        typeof raw === 'string' ? raw.toLowerCase() === 'true' : Boolean(raw);
      where.isActive = parsed;
    }

    return this.prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  // compatibilidade se houver código a chamar findAll
  async findAll(dto: ListServicesDto) {
    return this.list(dto);
  }

  async findByKey(key: string) {
    const svc = await this.prisma.service.findUnique({ where: { key } });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async getByKey(key: string) {
    return this.findByKey(key);
  }

  async findById(id: string) {
    const svc = await this.prisma.service.findUnique({ where: { id } });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async getById(id: string) {
    return this.findById(id);
  }
}
