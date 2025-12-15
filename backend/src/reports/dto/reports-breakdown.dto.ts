import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Severity } from '@prisma/client';

export enum ReportsGroupBy {
  severity = 'severity',
  assignee = 'assignee',
  service = 'service',
  team = 'team',
  category = 'category',
}

export class ReportsBreakdownQueryDto {
  @IsEnum(ReportsGroupBy)
  groupBy!: ReportsGroupBy;

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
}