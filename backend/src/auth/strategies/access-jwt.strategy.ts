/**
 * @file backend/src/auth/strategies/access-jwt.strategy.ts
 * @module Backend.Auth.Strategies.AccessJwtStrategy
 *
 * @summary
 *  Strategy Passport JWT para autenticação via Access Token (Bearer).
 *
 * @description
 *  - Extrai o token do header Authorization: Bearer <token>
 *  - Valida assinatura com JWT_ACCESS_SECRET (env)
 *  - Devolve `payload` no `req.user` (sub, email, role)
 *
 * @environment
 *  - JWT_ACCESS_SECRET: segredo do access token
 *
 * @payload
 *  JwtPayload:
 *   - sub: user id
 *   - email: email do user
 *   - role: Role (USER|ADMIN)
 *
 * @notes
 *  - Esta strategy só valida assinatura e expiração do token.
 *  - A lógica de autorização (roles) é feita por guards separados (RolesGuard).
 */

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

@Injectable()
export class AccessJwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  validate(payload: JwtPayload) {
    // Este objeto passa para req.user
    return payload;
  }
}
