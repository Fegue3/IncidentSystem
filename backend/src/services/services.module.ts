// src/services/services.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

/**
 * ServicesModule
 *
 * Responsabilidades:
 * - Expor endpoints REST para consultar serviços (list/byId/byKey)
 * - Centralizar lógica de acesso a dados de Service via Prisma
 *
 * Dependências:
 * - PrismaModule: fornece PrismaService global/injetável
 */
@Module({
  imports: [PrismaModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
