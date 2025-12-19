// src/teams/dto/update-team.dto.ts
import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * DTO de input para atualizar uma equipa.
 *
 * ## Responsabilidade
 * Validar o corpo do request para a rota:
 * `PATCH /teams/:id`
 *
 * ## Campos
 * - `name` (opcional): novo nome
 * - `memberIds` (opcional): lista de IDs para substituir a lista de membros
 *
 * ## Regra importante
 * Se `memberIds` for enviado, o update faz um **reset total** de membros:
 * - remove todos os atuais
 * - mantém apenas os IDs enviados (via `set`)
 *
 * ## Notas
 * - O DTO valida o formato do array, mas não verifica existência dos users.
 * - O comportamento “reset” é implementado no `TeamsService.update`.
 */
export class UpdateTeamDto {
  /** Novo nome da equipa (opcional). */
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * Opcional: se enviares este array, faz um "reset" aos membros
   * (remove todos os atuais e mete só estes).
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}
