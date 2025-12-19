// src/services/services.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Service as ServiceModel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListServicesDto } from './dto/list-services.dto';

/**
 * ServicesService
 *
 * Lógica de negócio para leitura de "Service".
 * Nota: Este serviço é "read-only" no teu fluxo atual.
 */
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista serviços aplicando filtros opcionais:
   * - q: pesquisa por key OU name (case-insensitive)
   * - isActive: filtra por boolean (aceita "true"/"false" no query)
   *
   * Importante: mantém exatamente 2 condições em OR para bater no unit test.
   */
  async list(dto: ListServicesDto): Promise<ServiceModel[]> {
    const where: Prisma.ServiceWhereInput = {};

    // Pesquisa por name/key (contains, insensitive)
    const q = (dto as any)?.q?.trim?.();
    if (q) {
      // manter exatamente 2 condições (unit test)
      where.OR = [
        { key: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filtro isActive (string "true"/"false" ou boolean)
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

  /**
   * Alias para compatibilidade retroativa (se houver código a chamar findAll()).
   */
  async findAll(dto: ListServicesDto): Promise<ServiceModel[]> {
    return this.list(dto);
  }

  /**
   * Procura serviço por key (lança 404 se não existir).
   */
  async findByKey(key: string): Promise<ServiceModel> {
    const svc = await this.prisma.service.findUnique({ where: { key } });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  /**
   * Alias "getByKey" (mantém naming do controller).
   */
  async getByKey(key: string): Promise<ServiceModel> {
    return this.findByKey(key);
  }

  /**
   * Procura serviço por id (lança 404 se não existir).
   */
  async findById(id: string): Promise<ServiceModel> {
    const svc = await this.prisma.service.findUnique({ where: { id } });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  /**
   * Alias "getById" (mantém naming do controller).
   */
  async getById(id: string): Promise<ServiceModel> {
    return this.findById(id);
  }
}
