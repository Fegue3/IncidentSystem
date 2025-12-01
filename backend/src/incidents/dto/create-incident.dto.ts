// src/incidents/dto/create-incident.dto.ts
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority; // default P3 no service

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
