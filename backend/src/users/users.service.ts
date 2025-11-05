import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private repo: UsersRepository) {}

  async create(email: string, password: string, name?: string) {
    const exists = await this.repo.findByEmail(email);
    if (exists) throw new BadRequestException('Email já registado');
    const hash = await bcrypt.hash(password, 12);
    return this.repo.create({ email, password: hash, name: name ?? '', role: 'REPORTER' as any });
  }

  findByEmail(email: string) { return this.repo.findByEmail(email); }
  findById(id: string) { return this.repo.findById(id); }
  validatePassword(raw: string, hash: string) { return bcrypt.compare(raw, hash); }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException();
    const ok = await bcrypt.compare(oldPass, user.password);
    if (!ok) throw new BadRequestException('Password atual inválida');
    const hash = await bcrypt.hash(newPass, 12);
    await this.repo.setPassword(userId, hash);
  }
}
