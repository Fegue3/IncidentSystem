import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Severity } from '@prisma/client';

export enum ReportsGroupBy {
  severity = 'severity',
  status = 'status',
  team = 'team',
  service = 'service',
  category = 'category',
  assignee = 'assignee',
}

export class ReportsBreakdownQueryDto {
  @IsEnum(ReportsGroupBy)
  groupBy!: ReportsGroupBy;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
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
