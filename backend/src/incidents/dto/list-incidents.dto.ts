// src/incidents/dto/list-incidents.dto.ts
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IncidentStatus, Priority } from '@prisma/client';

export class ListIncidentsDto {
  @IsEnum(IncidentStatus)
  @IsOptional()
  status?: IncidentStatus;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

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
