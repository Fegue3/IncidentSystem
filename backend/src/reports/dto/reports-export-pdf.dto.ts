import { IsEnum, IsOptional, IsString, IsISO8601, IsInt, Min, Max } from 'class-validator';
import { Severity } from '@prisma/client';

export class ReportsExportPdfQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  lastDays?: number;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  @IsString()
  incidentId?: string;
}
