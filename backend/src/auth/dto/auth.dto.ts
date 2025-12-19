/**
 * @file backend/src/auth/dto/auth.dto.ts
 * @module Backend.Auth.DTO
 *
 * @summary
 *  DTOs de autenticação e gestão de credenciais.
 *
 * @description
 *  Estes DTOs são usados pelo AuthController para validar o payload recebido via HTTP.
 *  A validação é feita via `class-validator` e tipicamente aplicada através de `ValidationPipe`
 *  no bootstrap do Nest (main.ts).
 *
 * @dto
 *  - RegisterDto: registo de utilizador (email, password, name opcional)
 *  - LoginDto: login (email, password)
 *  - ChangePasswordDto: alteração de password autenticada (oldPassword, newPassword)
 *  - ResetPasswordDto: reset de password via token (token, newPassword)
 *
 * @validation_rules
 *  - email: formato válido (IsEmail)
 *  - password/newPassword: string, mínimo 8 caracteres onde aplicável
 *  - name: opcional, string
 */

import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
