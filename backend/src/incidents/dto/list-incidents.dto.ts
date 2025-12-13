import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IncidentStatus, Severity } from '@prisma/client';

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
