// src/incidents/dto/add-comment.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}
