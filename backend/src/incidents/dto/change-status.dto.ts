// src/incidents/dto/change-status.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IncidentStatus } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(IncidentStatus)
  newStatus: IncidentStatus;

  @IsString()
  @IsOptional()
  message?: string; // texto para a timeline
}
