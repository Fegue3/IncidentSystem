import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

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

  @IsEnum(ReportsInterval)
  interval!: ReportsInterval;
}