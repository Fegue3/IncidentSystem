// src/incidents/dto/list-incidents.dto.ts

/**
 * @file src/incidents/dto/list-incidents.dto.ts
 * @module Backend.Incidents.DTO.ListIncidentsDto
 *
 * @summary
 * DTO de filtros para listagem de incidentes.
 *
 * @description
 * Usado em query params (GET /incidents) para filtrar por:
 * - status, severity
 * - assigneeId, teamId
 * - primaryServiceId ou primaryServiceKey
 * - search (contains em title/description, case-insensitive)
 * - janela temporal createdFrom/createdTo
 *
 * @parsing
 * - createdFrom e createdTo são transformados para Date via class-transformer.
 *
 * @validation
 * - status: enum IncidentStatus (opcional)
 * - severity: enum Severity (opcional)
 * - restantes: strings opcionais
 * - createdFrom/createdTo: Date opcional (derivado de string)
 */

import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { IncidentStatus, Severity } from "@prisma/client";

export class ListIncidentsDto {
  @IsEnum(IncidentStatus)
  @IsOptional()
  status?: IncidentStatus;

  @IsEnum(Severity)
  @IsOptional()
  severity?: Severity;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

  // filtrar por serviço
  @IsString()
  @IsOptional()
  primaryServiceId?: string;

  // filtrar por key sem precisares de id
  @IsString()
  @IsOptional()
  primaryServiceKey?: string;

  @IsString()
  @IsOptional()
  search?: string; // procura em title/description

  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsOptional()
  createdFrom?: Date;

  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsOptional()
  createdTo?: Date;
}
