// src/incidents/dto/change-status.dto.ts

/**
 * @file src/incidents/dto/change-status.dto.ts
 * @module Backend.Incidents.DTO.ChangeStatusDto
 *
 * @summary
 * DTO para mudança de status de um incidente.
 *
 * @description
 * Permite atualizar o estado do incidente e opcionalmente registar uma mensagem
 * que será usada na timeline como contexto da mudança.
 *
 * @validation
 * - newStatus: enum IncidentStatus (obrigatório)
 * - message: string opcional (texto para timeline)
 */

import { IsEnum, IsOptional, IsString } from "class-validator";
import { IncidentStatus } from "@prisma/client";

export class ChangeStatusDto {
  @IsEnum(IncidentStatus)
  newStatus: IncidentStatus;

  @IsString()
  @IsOptional()
  message?: string; // texto para a timeline
}
