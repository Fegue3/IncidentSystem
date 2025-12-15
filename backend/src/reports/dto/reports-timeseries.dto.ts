import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Severity } from '@prisma/client';

export enum ReportsInterval {
  day = 'day',
  week = 'week',
}

export class ReportsTimeseriesQueryDto {
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

  @IsEnum(ReportsInterval)
  interval!: ReportsInterval;
}
