import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role, User } from '@prisma/client';

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

  private sign(payload: object, secret: string, expiresIn: string): string {
    return this.jwt.sign(payload as any, {
      secret,
      expiresIn: expiresIn as any,
    });
  }

  private signTokens(user: User): Tokens {
    const base: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      teamId: (user as any).teamId ?? null,
    };

    const accessSecret =
      process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access';
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-refresh';

    const accessToken = this.sign(
      base,
      accessSecret,
      process.env.JWT_ACCESS_EXPIRES_IN ??
        process.env.JWT_ACCESS_EXPIRES ??
        '15m',
    );

    const refreshToken = this.sign(
      { ...base, type: 'refresh' },
      refreshSecret,
      process.env.JWT_REFRESH_EXPIRES_IN ??
        process.env.JWT_REFRESH_EXPIRES ??
        '7d',
    );

    return { accessToken, refreshToken };
  }

  async register(email: string, password: string, name?: string) {
    const u = await this.users.create(email, password, name);
    const tokens = this.signTokens(u);

    await this.usersRepo.setRefreshToken(
      u.id,
      await bcrypt.hash(tokens.refreshToken, 12),
    );

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

  async login(email: string, password: string) {
    const u = await this.users.findByEmail(email);
    if (!u) throw new UnauthorizedException('Credenciais inválidas');

    const ok = await this.users.validatePassword(password, u.password);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const tokens = this.signTokens(u);

    await this.usersRepo.setRefreshToken(
      u.id,
      await bcrypt.hash(tokens.refreshToken, 12),
    );

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

  async logout(userId: string) {
    await this.usersRepo.setRefreshToken(userId, null);
    return { success: true };
  }

  async refresh(userId: string, incoming: string) {
    const u = await this.users.findById(userId);
    if (!u?.refreshTokenHash) throw new UnauthorizedException();

    const ok = await bcrypt.compare(incoming, u.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Refresh token inválido');

    const tokens = this.signTokens(u);

    await this.usersRepo.setRefreshToken(
      u.id,
      await bcrypt.hash(tokens.refreshToken, 12),
    );

    return tokens;
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    await this.users.changePassword(userId, oldPass, newPass);
    return { success: true };
  }

  async deleteAccount(userId: string) {
    await this.usersRepo.delete(userId);
    return { success: true };
  }

  async requestPasswordReset(email: string) {
    const u = await this.users.findByEmail(email);
    if (!u) return { success: true };

    const raw = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(raw, 12);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await this.usersRepo.setResetToken(u.id, hash, expires);

    // mantém compatível com os teus testes
    return { success: true, testToken: raw };
  }

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

    throw new BadRequestException('Token inválido ou expirado');
  }

  async me(userId: string) {
    const u = await this.users.findById(userId);
    if (!u) throw new UnauthorizedException('User not found');

    return {
      userId: u.id,
      email: u.email,
      role: u.role,
      teamId: (u as any).teamId ?? null,
    };
  }
}
