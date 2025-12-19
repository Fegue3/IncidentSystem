// src/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * @file src/prisma/prisma.service.ts
 * @module Backend.Prisma.Service
 *
 * @summary
 * Wrapper NestJS para PrismaClient com lifecycle hooks.
 *
 * @description
 * `PrismaService` estende `PrismaClient` e integra-se com o ciclo de vida do Nest:
 * - conecta automaticamente à base de dados quando o módulo inicia
 * - desconecta quando a aplicação encerra (shutdown hooks)
 *
 * Isto evita ter de chamar manualmente `$connect()`/`$disconnect()` em cada contexto.
 *
 * @remarks
 * - Requer que `DATABASE_URL` esteja configurada (via Prisma).
 * - Se estiveres a usar shutdown hooks no main.ts, o `onModuleDestroy()` garante
 *   uma saída limpa e evita ligações penduradas.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Executado quando o módulo Nest inicializa.
   * Estabelece ligação à base de dados.
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Executado quando o módulo Nest é destruído (shutdown).
   * Fecha ligação à base de dados.
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
