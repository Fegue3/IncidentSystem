// src/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @file src/prisma/prisma.module.ts
 * @module Backend.Prisma
 *
 * @summary
 * Módulo global do Prisma (NestJS).
 *
 * @description
 * Este módulo regista e exporta `PrismaService` como provider global, permitindo
 * injeção de dependências (`constructor(private prisma: PrismaService)`) em qualquer
 * módulo/serviço sem precisar de importar explicitamente `PrismaModule` em todo o lado.
 *
 * @remarks
 * - A anotação `@Global()` torna este módulo disponível globalmente no container do Nest.
 * - Mesmo sendo global, pode ser importado explicitamente (não faz mal).
 */
@Global()
@Module({
  /**
   * Providers registados neste módulo.
   */
  providers: [PrismaService],

  /**
   * Exports para permitir injeção do PrismaService noutros módulos.
   */
  exports: [PrismaService],
})
export class PrismaModule {}
