import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class ListServicesDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string; // "true" | "false"

  @IsOptional()
  @IsString()
  q?: string; // pesquisa por name/key
}
