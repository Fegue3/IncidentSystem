// src/reports/dto/reports-export-csv.dto.ts

import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Severity } from '@prisma/client';

/**
 * @file src/reports/dto/reports-export-csv.dto.ts
 * @module Backend.Reports.DTO
 *
 * @summary
 * DTO de query params para exportação CSV de incidentes.
 *
 * @description
 * Permite filtrar por intervalo temporal (from/to), por últimos N dias (lastDays),
 * por team/service/severity e controlar o limite máximo de linhas exportadas.
 *
 * Regras de validação:
 * - lastDays: 1..365
 * - limit: 1..10000
 *
 * @remarks
 * O valor default de `lastDays` (ex.: 30) é aplicado no service.
 */
export class ReportsExportCsvQueryDto {
  /**
   * Data/hora inicial (opcional).
   */
  @IsOptional()
  @IsString()
  from?: string;

  /**
   * Data/hora final (opcional).
   */
  @IsOptional()
  @IsString()
  to?: string;

  /**
   * Intervalo relativo (opcional) usado quando from/to não são fornecidos.
   * Default é aplicado no service (ex.: 30).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  lastDays?: number;

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

  /**
   * Limite máximo de linhas no CSV (opcional).
   * Útil para evitar exports gigantes.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
}
