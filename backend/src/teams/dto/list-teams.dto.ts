// src/teams/dto/list-teams.dto.ts
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO de query params para listar equipas.
 *
 * ## Responsabilidade
 * Validar querystring para a rota:
 * `GET /teams`
 *
 * ## Campos
 * - `search` (opcional): termo para filtrar por nome (contains, case-insensitive)
 *
 * ## Notas
 * - Não há paginação neste DTO. Se precisares, adicionar `page`/`pageSize`.
 */
export class ListTeamsDto {
  /**
   * Termo de pesquisa aplicado ao nome da equipa.
   * Implementado no service via `contains` + `mode: 'insensitive'`.
   */
  @IsOptional()
  @IsString()
  search?: string;
}
