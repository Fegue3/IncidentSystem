/**
 * @file backend/src/health/health.module.ts
 * @module Backend.Health.Module
 *
 * @summary
 * Módulo NestJS que expõe o endpoint de health-check.
 *
 * @description
 * - Importa PrismaModule para ter acesso ao PrismaService no HealthController.
 * - Regista o HealthController.
 *
 * @wiring
 * imports:
 *  - PrismaModule
 * controllers:
 *  - HealthController
 *
 * @notes
 * - Não define providers próprios; depende do PrismaService vindo do PrismaModule.
 */

import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
