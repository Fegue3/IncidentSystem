// src/reports/dto/reports-kpis.dto.ts

import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Severity } from '@prisma/client';

/**
 * @file src/reports/dto/reports-kpis.dto.ts
 * @module Backend.Reports.DTO
 *
 * @summary
 * DTO de query params para KPIs de incidentes.
 *
 * @description
 * Define filtros para o cálculo de KPIs (ex.: contagens, MTTR/MTTA, etc.),
 * conforme a implementação do ReportsService.
 *
 * - from/to: ISO8601 (quando presentes)
 * - teamId/serviceId/severity: filtros opcionais
 */
export class ReportsKpisQueryDto {
  /**
   * Data/hora inicial (opcional, ISO8601).
   */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /**
   * Data/hora final (opcional, ISO8601).
   */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /**
   * Filtra por Team (opcional).
   */
  @IsOptional()
  @IsString()
  teamId?: string;

  /**
   * Filtra por Service (opcional).
   */
  @IsOptional()
  @IsString()
  serviceId?: string;

  /**
   * Filtra por Severity (opcional).
   */
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;
}
