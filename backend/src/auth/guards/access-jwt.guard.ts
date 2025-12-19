/**
 * @file backend/src/auth/guards/access-jwt.guard.ts
 * @module Backend.Auth.Guards.AccessJwtGuard
 *
 * @summary
 *  Guard de autenticação para Access Token (Bearer).
 *
 * @description
 *  Extende `@nestjs/passport` AuthGuard usando a strategy `jwt`
 *  (ver `AccessJwtStrategy`), que extrai o token de:
 *   - Authorization: Bearer <token>
 *
 * @usage
 *  Aplicado em endpoints que requerem autenticação normal (access token),
 *  por exemplo:
 *   - POST /auth/logout
 *   - GET  /auth/me
 *   - POST /auth/change-password
 *   - DELETE /auth/delete-account
 */

import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class AccessJwtGuard extends AuthGuard("jwt") {}
