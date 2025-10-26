import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }

  create(data: Pick<User, 'email' | 'name' | 'password' | 'role'>) {
    return this.prisma.user.create({ data });
  }

  setRefreshToken(userId: string, hash: string | null) {
    return this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: hash } });
  }

  setPassword(userId: string, hash: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { password: hash } });
  }

  setResetToken(userId: string, tokenHash: string, expires: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { resetTokenHash: tokenHash, resetTokenExpires: expires },
    });
  }

  clearResetToken(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { resetTokenHash: null, resetTokenExpires: null },
    });
  }

  delete(userId: string) { return this.prisma.user.delete({ where: { id: userId } }); }
}
