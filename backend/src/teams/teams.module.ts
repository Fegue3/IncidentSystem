// src/teams/teams.module.ts
import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { PrismaService } from '../prisma/prisma.service';

/**
 * TeamsModule
 *
 * ## Responsabilidade
 * Agrupa controller + service do domínio de Equipas.
 *
 * ## Providers
 * - `TeamsService` (lógica de negócio)
 * - `PrismaService` (acesso a dados via Prisma)
 *
 * ## Exports
 * - `TeamsService` é exportado para ser reutilizado noutros módulos.
 *
 * ## Nota de arquitetura
 * Aqui o `PrismaService` é injetado diretamente.
 * Se já tens `PrismaModule` global/importável, podes preferir:
 * `imports: [PrismaModule]` e remover `PrismaService` dos providers.
 */
@Module({
  controllers: [TeamsController],
  providers: [TeamsService, PrismaService],
  exports: [TeamsService],
})
export class TeamsModule {}
