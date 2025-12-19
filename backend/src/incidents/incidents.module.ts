// src/incidents/incidents.module.ts

/**
 * @file src/incidents/incidents.module.ts
 * @module Backend.Incidents.Module
 *
 * @summary
 * Módulo NestJS para Incidents.
 *
 * @description
 * - Importa NotificationsModule para permitir triggers (Discord/PagerDuty).
 * - Expõe IncidentsService para ser usado noutros módulos (export).
 *
 * @wiring
 * imports:
 *  - NotificationsModule
 * controllers:
 *  - IncidentsController
 * providers:
 *  - IncidentsService
 *  - PrismaService
 * exports:
 *  - IncidentsService
 *
 * @notes
 * - PrismaService aqui está como provider direto (em alternativa podia vir de PrismaModule).
 */

import { Module } from "@nestjs/common";
import { IncidentsService } from "./incidents.service";
import { IncidentsController } from "./incidents.controller";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, PrismaService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
