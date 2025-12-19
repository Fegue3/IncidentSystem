// src/incidents/dto/add-comment.dto.ts

/**
 * @file src/incidents/dto/add-comment.dto.ts
 * @module Backend.Incidents.DTO.AddCommentDto
 *
 * @summary
 * DTO para adicionar um comentário a um incidente.
 *
 * @validation
 * - body: string obrigatória e não vazia
 */

import { IsNotEmpty, IsString } from "class-validator";

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}
