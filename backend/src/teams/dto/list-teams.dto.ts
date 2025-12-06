import { IsOptional, IsString } from 'class-validator';

export class ListTeamsDto {
  @IsOptional()
  @IsString()
  search?: string;
}
