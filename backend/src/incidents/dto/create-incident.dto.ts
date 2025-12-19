// src/incidents/dto/create-incident.dto.ts

/**
 * @file src/incidents/dto/create-incident.dto.ts
 * @module Backend.Incidents.DTO.CreateIncidentDto
 *
 * @summary
 * DTO de criação de incidente.
 *
 * @description
 * Permite criar um incidente com:
 * - título/descrição (obrigatórios)
 * - severidade opcional (default é aplicado no service: SEV3)
 * - ligações opcionais a assignee, team, e service (por id ou por key)
 * - categorias e tags (arrays de ids)
 *
 * @validation
 * - title, description: string não vazia
 * - severity: enum Severity (opcional)
 * - assigneeId, teamId, primaryServiceId, primaryServiceKey: string (opcionais)
 * - categoryIds, tagIds: arrays opcionais de string
 */

import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { Severity } from "@prisma/client";

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(Severity)
  @IsOptional()
  severity?: Severity; // default SEV3 no service

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

  // serviço afetado (principal)
  @IsString()
  @IsOptional()
  primaryServiceId?: string;

  // alternativa por key (mais amigável com seed)
  @IsString()
  @IsOptional()
  primaryServiceKey?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}
