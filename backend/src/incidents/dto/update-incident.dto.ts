import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Severity } from '@prisma/client';

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

  // permitir remover serviço explicitamente
  // envia { primaryServiceId: "" } ou { primaryServiceKey: "" } para remover
  // (o service trata disso)

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}
