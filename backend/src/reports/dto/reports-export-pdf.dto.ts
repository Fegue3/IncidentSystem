// src/reports/dto/reports-export-pdf.dto.ts

import {
  IsEnum,
  IsOptional,
  IsString,
  IsISO8601,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Severity } from '@prisma/client';

/**
 * @file src/reports/dto/reports-export-pdf.dto.ts
 * @module Backend.Reports.DTO
 *
 * @summary
 * DTO de query params para exportação PDF.
 *
 * @description
 * Suporta dois modos principais (dependendo do service):
 * - Export por intervalo (from/to ou lastDays) com filtros
 * - Export focado num incidente específico via `incidentId`
 *
 * Regras de validação:
 * - from/to: ISO8601 quando presentes
 * - lastDays: 1..365 quando presente
 */
export class ReportsExportPdfQueryDto {
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
   * Intervalo relativo em dias (opcional).
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
   * Export direcionado a um incidente específico (opcional).
   * Quando presente, o controller usa isto para naming do ficheiro.
   */
  @IsOptional()
  @IsString()
  incidentId?: string;
}
