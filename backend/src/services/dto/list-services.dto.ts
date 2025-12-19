// src/services/dto/list-services.dto.ts
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

/**
 * Query DTO para listagem de serviços.
 *
 * Usado em: GET /services
 *
 * Campos:
 * - isActive: string ("true" | "false") — filtragem por estado ativo.
 * - q: string — pesquisa por "key" ou "name" (contains, case-insensitive).
 */
export class ListServicesDto {
  /**
   * Filtra serviços por estado ativo.
   *
   * Nota: vem como string no querystring, por isso usa @IsBooleanString().
   * Exemplos: "true", "false"
   */
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  /**
   * Termo de pesquisa (name/key).
   * Ex.: ?q=auth
   */
  @IsOptional()
  @IsString()
  q?: string;
}
