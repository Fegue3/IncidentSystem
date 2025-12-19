/**
 * @file backend/src/auth/strategies/refresh-jwt.strategy.ts
 * @module Backend.Auth.Strategies.RefreshJwtStrategy
 *
 * @summary
 *  Strategy Passport JWT para refresh token (rota /auth/refresh).
 *
 * @description
 *  - Usa extractor custom para ir buscar token a:
 *      - req.body.refreshToken
 *      - req.body.token
 *      - header x-refresh-token
 *  - Valida assinatura com JWT_REFRESH_SECRET (env)
 *  - Faz passReqToCallback para:
 *      - validar se o token existe no request
 *      - anexar refreshToken ao objeto retornado (req.user)
 *
 * @environment
 *  - JWT_REFRESH_SECRET: segredo do refresh token
 *
 * @error_handling
 *  - Lança UnauthorizedException se o refresh token não existir no request.
 *
 * @notes
 *  - A validação de “token pertence ao utilizador” não é feita aqui.
 *    É feita no AuthService.refresh comparando com refreshTokenHash persistido.
 */

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";

function getRefresh(req: Request) {
  return (
    (req.body && (req.body.refreshToken || req.body.token)) ||
    (req.headers["x-refresh-token"] as string | undefined) ||
    null
  );
}

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: Request) => getRefresh(req)]),
      secretOrKey: process.env.JWT_REFRESH_SECRET,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const token = getRefresh(req);
    if (!token) throw new UnauthorizedException("Refresh token ausente");
    return { ...payload, refreshToken: token };
  }
}
