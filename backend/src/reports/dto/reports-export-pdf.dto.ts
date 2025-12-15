import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Severity } from '@prisma/client';

export class ReportsExportPdfQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  // se vier, exporta “PDF auditável” de um incidente só
  @IsOptional()
  @IsString()
  incidentId?: string;
}