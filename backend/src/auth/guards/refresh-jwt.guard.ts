/**
 * @file backend/src/auth/guards/refresh-jwt.guard.ts
 * @module Backend.Auth.Guards.RefreshJwtGuard
 *
 * @summary
 *  Guard de autenticação para Refresh Token.
 *
 * @description
 *  Extende `@nestjs/passport` AuthGuard usando a strategy `jwt-refresh`
 *  (ver `RefreshJwtStrategy`). O refresh token é extraído por um extractor
 *  custom, podendo vir em:
 *   - body.refreshToken
 *   - body.token
 *   - header x-refresh-token
 *
 * @usage
 *  Aplicado no endpoint:
 *   - POST /auth/refresh
 */

import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class RefreshJwtGuard extends AuthGuard("jwt-refresh") {}
