// src/teams/dto/create-team.dto.ts
import { IsArray, IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO de input para criar uma equipa.
 *
 * ## Responsabilidade
 * Validar o corpo do request para a rota:
 * `POST /teams`
 *
 * ## Campos
 * - `name` (obrigatório): nome da equipa
 * - `memberIds` (opcional): lista de IDs de utilizadores a associar na criação
 *
 * ## Regras / Validações
 * - `name` não pode ser vazio.
 * - `memberIds`, quando presente, deve ser um array de strings.
 *
 * ## Notas de domínio
 * - A regra “um user só pode estar em 1 equipa” **não** é aplicada aqui.
 *   O `create()` apenas faz `connect` dos membros indicados (se existirem).
 */
export class CreateTeamDto {
  /** Nome da equipa. Obrigatório e não vazio. */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * IDs de utilizadores para associar à equipa na criação.
   * Opcional: se não vier, a equipa é criada sem membros.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}
