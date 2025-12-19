/**
 * @file backend/src/auth/auth.module.ts
 * @module Backend.Auth.Module
 *
 * @summary
 *  Módulo NestJS de autenticação.
 *
 * @description
 *  - Importa UsersModule (dependências de user persistence/queries)
 *  - Regista JwtModule (HS256) para assinar tokens
 *  - Regista controllers e providers:
 *      - AuthService
 *      - AccessJwtStrategy (passport-jwt strategy 'jwt')
 *      - RefreshJwtStrategy (passport-jwt strategy 'jwt-refresh')
 *      - RolesGuard como APP_GUARD (global guard para RBAC via decorator @Roles)
 *
 * @notes
 *  - O JwtModule aqui não fixa secrets; secrets são lidos em runtime via env no AuthService/strategies.
 *  - O RolesGuard é aplicado globalmente, mas só restringe endpoints com metadata @Roles.
 */

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";

import { UsersModule } from "../users/users.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AccessJwtStrategy } from "./strategies/access-jwt.strategy";
import { RefreshJwtStrategy } from "./strategies/refresh-jwt.strategy";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      signOptions: { algorithm: "HS256" },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessJwtStrategy,
    RefreshJwtStrategy,
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
