import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * UsersRepository
 *
 * Responsabilidade:
 * - Camada de acesso a dados (DAO/Repository) para `User` via Prisma.
 * - Encapsula queries e updates frequentes (find, create, update de tokens/password, delete).
 *
 * Porque existe:
 * - Separar lógica de persistência (Prisma) da lógica de negócio (UsersService).
 * - Facilitar testes (mock do repo ou spy dos métodos) e reduzir acoplamento ao Prisma no service.
 *
 * Segurança:
 * - Este ficheiro NÃO faz hashing nem valida passwords; assume que a camada acima (service) fornece hashes.
 * - Guarda apenas `refreshTokenHash` e `resetTokenHash` (nunca tokens em claro).
 *
 * Erros e estados:
 * - Métodos `find*` retornam `null` se não existir.
 * - Métodos `update/delete/create` podem lançar erros do Prisma (ex.: constraints/unique).
 */
@Injectable()
export class UsersRepository {
  /**
   * PrismaService é exposto como `public` por conveniência (ex.: em testes),
   * mas recomenda-se usar métodos do repositório em vez de aceder ao prisma diretamente.
   */
  constructor(public prisma: PrismaService) {}

  /**
   * Procura um utilizador por email.
   *
   * @param email Email do utilizador (unique no DB)
   * @returns User | null
   */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Procura um utilizador por id.
   *
   * @param id ID do utilizador
   * @returns User | null
   */
  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Cria um utilizador novo.
   *
   * Regras/assunções:
   * - `name` nunca deve ser undefined (garantido pela camada de serviço).
   * - `password` deve vir já com hash (bcrypt/argon2/etc).
   * - `role` é opcional; se não vier, o Prisma aplica o default do schema.
   *
   * @param params Dados para criação do user
   * @returns User criado
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

  /**
   * Atualiza (ou remove) o hash do refresh token.
   *
   * @param userId ID do utilizador
   * @param hash Hash do refresh token; `null` para limpar (logout)
   */
  setRefreshToken(userId: string, hash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  /**
   * Atualiza a password (hash) do utilizador.
   *
   * @param userId ID do utilizador
   * @param hash Hash da nova password
   */
  setPassword(userId: string, hash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
  }

  /**
   * Define token de reset (guardado em hash) e data de expiração.
   *
   * @param userId ID do utilizador
   * @param tokenHash Hash do token de reset (não guardar token em claro)
   * @param expires Data de expiração
   */
  setResetToken(userId: string, tokenHash: string, expires: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpires: expires,
      },
    });
  }

  /**
   * Limpa o token de reset e expiração.
   *
   * Útil após uso bem sucedido do reset ou se expirar.
   *
   * @param userId ID do utilizador
   */
  clearResetToken(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    });
  }

  /**
   * Elimina um utilizador por id.
   *
   * @param userId ID do utilizador
   */
  delete(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }
}
