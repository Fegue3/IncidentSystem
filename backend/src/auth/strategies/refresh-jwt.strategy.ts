import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

function getRefresh(req: Request) {
  return (req.body && (req.body.refreshToken || req.body.token)) ||
         (req.headers['x-refresh-token'] as string | undefined) ||
         null;
}

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: Request) => getRefresh(req)]),
      secretOrKey: process.env.JWT_REFRESH_SECRET,
      passReqToCallback: true,
    });
  }
  validate(req: Request, payload: any) {
    const token = getRefresh(req);
    if (!token) throw new UnauthorizedException('Refresh token ausente');
    return { ...payload, refreshToken: token };
  }
}
