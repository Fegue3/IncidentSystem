import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Severity } from '@prisma/client';

export class ReportsExportCsvQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  lastDays?: number; // default aplicado no service (30)

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
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
}
