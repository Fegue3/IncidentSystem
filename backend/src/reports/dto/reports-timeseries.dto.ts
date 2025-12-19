// src/reports/dto/reports-timeseries.dto.ts

import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Severity } from '@prisma/client';

/**
 * @file src/reports/dto/reports-timeseries.dto.ts
 * @module Backend.Reports.DTO
 *
 * @summary
 * DTO de query params para séries temporais de incidentes.
 *
 * @description
 * Permite solicitar uma série temporal agregada por intervalos (day/week)
 * para métricas de incidentes (conforme ReportsService).
 */
export enum ReportsInterval {
  day = 'day',
  week = 'week',
}

/**
 * Query DTO para GET /reports/timeseries.
 */
export class ReportsTimeseriesQueryDto {
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

  /**
   * Intervalo de agregação (obrigatório): day ou week.
   */
  @IsEnum(ReportsInterval)
  interval!: ReportsInterval;
}
