import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(public prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Cria um utilizador novo.
   * - `name` nunca deve ser undefined (garantimos isso no service)
   * - `password` já vem com hash
   * - `role` é opcional; se não vier, o Prisma usa o default (REPORTER / USER)
   */
  create(params: { email: string; name: string; password: string; role?: Role }) {
    const { email, name, password, role } = params;

    return this.prisma.user.create({
      data: {
        email,
        name,
        password,
        ...(role ? { role } : {}), // só envia role se estiver definida
      },
    });
  }

  setRefreshToken(userId: string, hash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  setPassword(userId: string, hash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
  }

  setResetToken(userId: string, tokenHash: string, expires: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpires: expires,
      },
    });
  }

  clearResetToken(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    });
  }

  delete(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }
}
