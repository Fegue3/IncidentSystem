import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * UsersModule
 *
 * Responsabilidade:
 * - Agregar e expor os componentes do "domínio" de utilizadores (Users).
 * - Disponibilizar a camada de serviço (`UsersService`) e a camada de acesso a dados (`UsersRepository`).
 *
 * Porque existe:
 * - Centraliza a lógica de utilizadores num módulo dedicado.
 * - Permite que outros módulos (ex.: Auth) consumam `UsersService/UsersRepository` via DI.
 *
 * Dependências:
 * - PrismaModule: fornece `PrismaService`, usado pelo `UsersRepository` para aceder ao DB.
 *
 * Exports:
 * - UsersService: operações de domínio (criar user, validar password, changePassword, etc.)
 * - UsersRepository: operações CRUD/DB de baixo nível.
 */
@Module({
  imports: [PrismaModule],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
