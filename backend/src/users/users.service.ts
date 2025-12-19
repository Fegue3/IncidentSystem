import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import * as bcrypt from 'bcrypt';

/**
 * UsersService
 *
 * Responsabilidade:
 * - Lógica de negócio relacionada com utilizadores (criação, validação de credenciais, alteração de password).
 *
 * Porque existe:
 * - Centraliza regras como "email não pode repetir" e hashing/validação de passwords.
 * - Mantém o repositório focado apenas em persistência.
 *
 * Segurança:
 * - Usa bcrypt para hashing e comparação (`saltRounds = 12`).
 * - Nunca guarda password em claro (apenas hash).
 *
 * Erros e estados:
 * - `create`: lança BadRequest se email já estiver registado.
 * - `changePassword`: lança NotFound se user não existir; BadRequest se password atual inválida.
 *
 * Notas:
 * - `role: 'USER' as any` é um workaround: ideal é usar `Role.USER` do Prisma e tipar corretamente.
 */
@Injectable()
export class UsersService {
  constructor(private repo: UsersRepository) {}

  /**
   * Cria um novo utilizador.
   *
   * Fluxo:
   * 1) Verifica se já existe utilizador com o mesmo email.
   * 2) Gera hash bcrypt para a password.
   * 3) Cria utilizador no DB (role forçado para USER).
   *
   * @param email Email único
   * @param password Password em claro (será hashed aqui)
   * @param name Nome opcional (fallback: string vazia)
   * @throws BadRequestException se email já estiver registado
   */
  async create(email: string, password: string, name?: string) {
    const exists = await this.repo.findByEmail(email);
    if (exists) throw new BadRequestException('Email já registado');

    const hash = await bcrypt.hash(password, 12);

    // Ideal: usar Role.USER (import do @prisma/client) e remover "as any".
    return this.repo.create({
      email,
      password: hash,
      name: name ?? '',
      role: 'USER' as any,
    });
  }

  /**
   * Wrapper de acesso: procurar user por email.
   */
  findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  /**
   * Wrapper de acesso: procurar user por id.
   */
  findById(id: string) {
    return this.repo.findById(id);
  }

  /**
   * Compara password em claro com hash bcrypt.
   *
   * @param raw Password em claro
   * @param hash Hash armazenado
   * @returns true se match, false caso contrário
   */
  validatePassword(raw: string, hash: string) {
    return bcrypt.compare(raw, hash);
  }

  /**
   * Altera a password do utilizador (com validação da password atual).
   *
   * Fluxo:
   * 1) Carrega o user por id.
   * 2) Compara `oldPass` com o hash atual.
   * 3) Gera novo hash e atualiza no DB.
   *
   * @param userId ID do utilizador
   * @param oldPass Password atual em claro
   * @param newPass Nova password em claro
   * @throws NotFoundException se user não existir
   * @throws BadRequestException se oldPass não corresponder ao hash guardado
   */
  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException();

    const ok = await bcrypt.compare(oldPass, user.password);
    if (!ok) throw new BadRequestException('Password atual inválida');

    const hash = await bcrypt.hash(newPass, 12);
    await this.repo.setPassword(userId, hash);
  }
}
