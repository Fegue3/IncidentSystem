// src/teams/dto/add-member.dto.ts
import { IsString } from 'class-validator';

/**
 * DTO de input para adicionar um membro a uma equipa.
 *
 * ## Responsabilidade
 * Validar o corpo do request para a rota:
 * `POST /teams/:id/members`
 *
 * ## Regras
 * - `userId` é obrigatório e deve ser string não vazia (validação base de string).
 *
 * ## Notas
 * - A regra de negócio “um user só pode estar em 1 equipa” não é do DTO;
 *   é aplicada no `TeamsService.addMember`.
 */
export class AddMemberDto {
  /** ID do utilizador a adicionar à equipa alvo. */
  @IsString()
  userId: string;
}
