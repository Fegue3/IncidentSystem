import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateTeamDto {
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
