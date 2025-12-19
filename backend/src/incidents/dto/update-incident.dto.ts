// src/incidents/dto/update-incident.dto.ts

/**
 * @file src/incidents/dto/update-incident.dto.ts
 * @module Backend.Incidents.DTO.UpdateIncidentDto
 *
 * @summary
 * DTO de atualização parcial de incidente (PATCH).
 *
 * @description
 * Permite atualizar:
 * - title, description, severity
 * - assigneeId, teamId
 * - serviço principal por id ou key
 * - categorias e tags (substituição via set)
 *
 * @service_behavior
 * - remover serviço explicitamente:
 *    enviar { primaryServiceId: "" } ou { primaryServiceKey: "" }
 *    (o service interpreta string vazia como null => disconnect)
 *
 * @validation
 * - todos os campos são opcionais
 * - enums validados quando fornecidos
 * - categoryIds/tagIds: arrays opcionais de string
 */

import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { Severity } from "@prisma/client";

export class UpdateIncidentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Severity)
  @IsOptional()
  severity?: Severity;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

  // mudar serviço por id
  @IsString()
  @IsOptional()
  primaryServiceId?: string;

  // mudar serviço por key
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
