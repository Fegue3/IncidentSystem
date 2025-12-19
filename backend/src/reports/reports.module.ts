// src/reports/reports.module.ts

import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * @file src/reports/reports.module.ts
 * @module Backend.Reports
 *
 * @summary
 * Módulo NestJS de relatórios (KPIs, breakdown, timeseries e exports).
 *
 * @description
 * Regista:
 * - ReportsController (rotas HTTP /reports/*)
 * - ReportsService (lógica de geração de relatórios/exportação)
 *
 * @remarks
 * Dependências como PrismaService podem ser:
 * - injetadas diretamente no ReportsService (se for provider global via PrismaModule),
 * - ou adicionadas explicitamente aqui caso não seja global.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
