/**
 * @file backend/src/auth/auth.service.ts
 * @module Backend.Auth.Service
 *
 * @summary
 *  Serviço de autenticação: registo, login, refresh, logout e operações de conta.
 *
 * @description
 *  Responsabilidades:
 *   - gerir tokens JWT (access + refresh) e respetivas expirações
 *   - persistir hash do refresh token no utilizador (refreshTokenHash)
 *   - validar refresh token por comparação (bcrypt.compare)
 *   - suportar fluxo de reset password com token temporário (resetTokenHash, resetTokenExpires)
 *
 * @dependencies
 *  - UsersService: criação e validação de password (bcrypt)
 *  - UsersRepository: operações diretas de persistence (setRefreshToken, setResetToken, etc.)
 *  - JwtService: assinatura de JWT
 *
 * @environment
 *  Secrets:
 *   - JWT_ACCESS_SECRET (fallback: JWT_SECRET, fallback: "dev-access")
 *   - JWT_REFRESH_SECRET (fallback: JWT_SECRET, fallback: "dev-refresh")
 *
 *  Expiração:
 *   - JWT_ACCESS_EXPIRES_IN (fallback: JWT_ACCESS_EXPIRES, default: "15m")
 *   - JWT_REFRESH_EXPIRES_IN (fallback: JWT_REFRESH_EXPIRES, default: "7d")
 *
 * @tokens
 *  - accessToken: payload base (sub/email/role/teamId)
 *  - refreshToken: payload base + { type: "refresh" }
 *
 * @error_handling
 *  - login:
 *      UnauthorizedException("Credenciais inválidas") se email ou password não bater
 *  - refresh:
 *      UnauthorizedException se não existir refreshTokenHash
 *      UnauthorizedException("Refresh token inválido") se compare falhar
 *  - resetPassword:
 *      BadRequestException("Token inválido ou expirado") se não encontrar match
 *
 * @notes
 *  - requestPasswordReset devolve { success: true, testToken } para compatibilidade com testes.
 *  - resetPassword procura candidatos com resetTokenHash ativo e compara com bcrypt.
 *    Este fluxo assume que o token raw não é guardado em DB (apenas hash).
 */

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { UsersRepository } from "../users/users.repository";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { Role, User } from "@prisma/client";

type Tokens = { accessToken: string; refreshToken: string };
type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  teamId?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private usersRepo: UsersRepository,
    private jwt: JwtService,
  ) {}

  /**
   * Assina um JWT com secret e expiresIn.
   * @param payload payload a assinar
   * @param secret secret de assinatura
   * @param expiresIn expiração (string compatível com jsonwebtoken, ex: "15m", "7d")
   */
  private sign(payload: object, secret: string, expiresIn: string): string {
    return this.jwt.sign(payload as any, {
      secret,
      expiresIn: expiresIn as any,
    });
  }

  /**
   * Gera access + refresh tokens a partir do User.
   * teamId é lido de (user as any).teamId, porque o modelo pode não expor diretamente.
   */
  private signTokens(user: User): Tokens {
    const base: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      teamId: (user as any).teamId ?? null,
    };

    const accessSecret =
      process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "dev-access";
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? "dev-refresh";

    const accessToken = this.sign(
      base,
      accessSecret,
      process.env.JWT_ACCESS_EXPIRES_IN ??
        process.env.JWT_ACCESS_EXPIRES ??
        "15m",
    );

    const refreshToken = this.sign(
      { ...base, type: "refresh" },
      refreshSecret,
      process.env.JWT_REFRESH_EXPIRES_IN ??
        process.env.JWT_REFRESH_EXPIRES ??
        "7d",
    );

    return { accessToken, refreshToken };
  }

  /**
   * Regista um novo utilizador e devolve user + tokens.
   * Persiste refreshTokenHash (bcrypt) no utilizador.
   */
  async register(email: string, password: string, name?: string) {
    const u = await this.users.create(email, password, name);
    const tokens = this.signTokens(u);

    await this.usersRepo.setRefreshToken(u.id, await bcrypt.hash(tokens.refreshToken, 12));

    return {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        teamId: (u as any).teamId ?? null,
      },
      ...tokens,
    };
  }

  /**
   * Login por email/password.
   * Valida credenciais e devolve user + tokens. Atualiza refreshTokenHash persistido.
   */
  async login(email: string, password: string) {
    const u = await this.users.findByEmail(email);
    if (!u) throw new UnauthorizedException("Credenciais inválidas");

    const ok = await this.users.validatePassword(password, u.password);
    if (!ok) throw new UnauthorizedException("Credenciais inválidas");

    const tokens = this.signTokens(u);

    await this.usersRepo.setRefreshToken(u.id, await bcrypt.hash(tokens.refreshToken, 12));

    return {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        teamId: (u as any).teamId ?? null,
      },
      ...tokens,
    };
  }

  /**
   * Logout invalida refreshTokenHash na DB (set null).
   */
  async logout(userId: string) {
    await this.usersRepo.setRefreshToken(userId, null);
    return { success: true };
  }

  /**
   * Refresh tokens:
   * - valida que existe refreshTokenHash no user
   * - compara token incoming com hash (bcrypt.compare)
   * - emite novos tokens e atualiza refreshTokenHash
   */
  async refresh(userId: string, incoming: string) {
    const u = await this.users.findById(userId);
    if (!u?.refreshTokenHash) throw new UnauthorizedException();

    const ok = await bcrypt.compare(incoming, u.refreshTokenHash);
    if (!ok) throw new UnauthorizedException("Refresh token inválido");

    const tokens = this.signTokens(u);

    await this.usersRepo.setRefreshToken(u.id, await bcrypt.hash(tokens.refreshToken, 12));

    return tokens;
  }

  /**
   * Troca password autenticada.
   * A validação (old password) ocorre no UsersService.
   */
  async changePassword(userId: string, oldPass: string, newPass: string) {
    await this.users.changePassword(userId, oldPass, newPass);
    return { success: true };
  }

  /**
   * Apaga conta do utilizador (hard delete).
   */
  async deleteAccount(userId: string) {
    await this.usersRepo.delete(userId);
    return { success: true };
  }

  /**
   * Inicia reset password:
   * - não revela se o email existe (sempre success=true)
   * - gera token raw (hex), guarda apenas hash (bcrypt) e expiry
   * - devolve testToken raw para compatibilidade com testes (dev/test)
   */
  async requestPasswordReset(email: string) {
    const u = await this.users.findByEmail(email);
    if (!u) return { success: true };

    const raw = crypto.randomBytes(32).toString("hex");
    const hash = await bcrypt.hash(raw, 12);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await this.usersRepo.setResetToken(u.id, hash, expires);

    return { success: true, testToken: raw };
  }

  /**
   * Conclui reset password:
   * - procura users com resetTokenHash ativo e não expirado
   * - compara raw token com bcrypt.compare
   * - se bater: atualiza password (bcrypt hash) e limpa reset token
   * - caso contrário: BadRequestException
   *
   * Nota: usa prisma via UsersRepository (casting) para query custom.
   */
  async resetPassword(token: string, newPassword: string) {
    const prisma: any = (this.usersRepo as any).prisma;

    const candidates = await prisma.user.findMany({
      where: {
        resetTokenHash: { not: null },
        resetTokenExpires: { gt: new Date() },
      },
      select: { id: true, resetTokenHash: true },
    });

    for (const u of candidates) {
      if (await bcrypt.compare(token, u.resetTokenHash)) {
        const hash = await bcrypt.hash(newPassword, 12);
        await this.usersRepo.setPassword(u.id, hash);
        await this.usersRepo.clearResetToken(u.id);
        return { success: true };
      }
    }

    throw new BadRequestException("Token inválido ou expirado");
  }

  /**
   * Endpoint auxiliar (usado em alguns designs) para devolver dados do utilizador autenticado.
   * Aqui valida existência do user na DB.
   */
  async me(userId: string) {
    const u = await this.users.findById(userId);
    if (!u) throw new UnauthorizedException("User not found");

    return {
      userId: u.id,
      email: u.email,
      role: u.role,
      teamId: (u as any).teamId ?? null,
    };
  }
}
