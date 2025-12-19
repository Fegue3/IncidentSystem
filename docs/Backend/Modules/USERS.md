# Users Module

> NestJS module responsável por **gestão de utilizadores** (criação e operações base) e por **segurança de credenciais** (hash/validação de passwords).  
> Este módulo é tipicamente consumido por **Auth** (login/refresh/reset) e por funcionalidades que precisem de obter utilizadores por `id`/`email`.

---

## Responsabilidade

- **Criar utilizadores** garantindo unicidade de email e hashing de password.
- **Consultar utilizadores** por `email` e por `id`.
- **Validar passwords** (bcrypt compare).
- **Alterar password** com verificação da password atual.

O módulo não define endpoints HTTP diretamente (não há controller aqui); expõe serviços/repositórios para outros módulos.

---

## Ficheiros

### `users.module.ts`
- Agrega e exporta:
  - `UsersService`
  - `UsersRepository`
- Importa:
  - `PrismaModule` (para disponibilizar `PrismaService` via DI)

### `users.repository.ts`
Camada de persistência (Prisma) para `User`:
- `findByEmail(email)`
- `findById(id)`
- `create({ email, name, password, role? })`
- `setRefreshToken(userId, hash | null)`
- `setPassword(userId, hash)`
- `setResetToken(userId, tokenHash, expires)`
- `clearResetToken(userId)`
- `delete(userId)`

> Nota: o repository **não faz hashing**, assume que recebe hashes.

### `users.service.ts`
Camada de negócio:
- `create(email, password, name?)`
- `findByEmail(email)`
- `findById(id)`
- `validatePassword(raw, hash)`
- `changePassword(userId, oldPass, newPass)`

---

## Como usar

### Importar no módulo consumidor (ex.: AuthModule)
```ts
@Module({
  imports: [UsersModule],
})
export class AuthModule {}
