// src/incidents/dto/update-incident.dto.ts
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class UpdateIncidentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}
