// src/reports/dto/reports-breakdown.dto.ts

import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Severity } from '@prisma/client';

/**
 * @file src/reports/dto/reports-breakdown.dto.ts
 * @module Backend.Reports.DTO
 *
 * @summary
 * DTO de query params para o endpoint de breakdown/agregação de incidentes.
 *
 * @description
 * Define:
 * - a dimensão pela qual os incidentes devem ser agrupados (groupBy)
 * - filtros opcionais (intervalo temporal, team, service, severity)
 *
 * O parsing/validação é feito pelo Nest ValidationPipe (class-validator).
 */

/**
 * Dimensões suportadas para agregação de resultados no breakdown.
 */
export enum ReportsGroupBy {
  severity = 'severity',
  status = 'status',
  team = 'team',
  service = 'service',
  category = 'category',
  assignee = 'assignee',
}

/**
 * Query DTO para GET /reports/breakdown.
 *
 * Campos:
 * - groupBy (obrigatório): dimensão de agrupamento
 * - from/to (opcionais): strings de data (o service decide como interpretar/validar)
 * - teamId/serviceId (opcionais): filtros por equipa/serviço
 * - severity (opcional): filtro por severidade
 */
export class ReportsBreakdownQueryDto {
  /**
   * Dimensão do breakdown (obrigatório).
   */
  @IsEnum(ReportsGroupBy)
  groupBy!: ReportsGroupBy;

  /**
   * Data/hora inicial (opcional). Tipicamente ISO string (o service trata).
   */
  @IsOptional()
  @IsString()
  from?: string;

  /**
   * Data/hora final (opcional). Tipicamente ISO string (o service trata).
   */
  @IsOptional()
  @IsString()
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
