# Auth Module (NestJS) — Autenticação, Tokens e RBAC

Este documento descreve o módulo `auth/` do backend IMS: DTOs, guards, strategies, controller, service, e autorização por roles.

---

## 1) Estrutura do módulo

Localização: `backend/src/auth/`

Conteúdo:
- `dto/auth.dto.ts` — DTOs e validação (class-validator)
- `guards/`
  - `access-jwt.guard.ts` — proteção por access token (Bearer)
  - `refresh-jwt.guard.ts` — proteção por refresh token (custom extractor)
- `strategies/`
  - `access-jwt.strategy.ts` — strategy `jwt`
  - `refresh-jwt.strategy.ts` — strategy `jwt-refresh`
- `auth.controller.ts` — endpoints HTTP `/auth/*`
- `auth.service.ts` — lógica de autenticação e gestão de credenciais
- `roles.decorator.ts` — decorator `@Roles(...)`
- `roles.guard.ts` — RBAC guard (global via `APP_GUARD`)
- `auth.module.ts` — wiring NestJS

---

## 2) Modelo de autenticação

### 2.1 Tokens
O módulo trabalha com dois JWTs:
- `accessToken`
  - usado em requests normais (Authorization: Bearer)
  - expiração curta (default: `15m`)
- `refreshToken`
  - usado apenas para renovar tokens
  - expiração mais longa (default: `7d`)
  - o valor do refresh token é guardado na DB apenas como `hash` (`refreshTokenHash`)

### 2.2 Payload (conteúdo do JWT)
O `AuthService` assina tokens com:
- `sub`: id do utilizador
- `email`: email
- `role`: `Role` (`USER` | `ADMIN`)
- `teamId`: opcional (vem de `(user as any).teamId ?? null`)
- no refresh token: adiciona `{ type: "refresh" }`

---

## 3) Variáveis de ambiente

### Segredos
- Access:
  - `JWT_ACCESS_SECRET`
  - fallback: `JWT_SECRET`
  - fallback final: `"dev-access"`
- Refresh:
  - `JWT_REFRESH_SECRET`
  - fallback: `JWT_SECRET`
  - fallback final: `"dev-refresh"`

### Expiração
- Access:
  - `JWT_ACCESS_EXPIRES_IN` (ou `JWT_ACCESS_EXPIRES`)
  - default: `15m`
- Refresh:
  - `JWT_REFRESH_EXPIRES_IN` (ou `JWT_REFRESH_EXPIRES`)
  - default: `7d`

---

## 4) DTOs e validação (auth.dto.ts)

### `RegisterDto`
Campos:
- `email` (IsEmail)
- `password` (string, min length 8)
- `name` (opcional)

### `LoginDto`
Campos:
- `email` (IsEmail)
- `password` (string)

### `ChangePasswordDto`
Campos:
- `oldPassword` (string)
- `newPassword` (string, min length 8)

### `ResetPasswordDto`
Campos:
- `token` (string)
- `newPassword` (string, min length 8)

Nota: a validação depende do `ValidationPipe` estar ativo no bootstrap da app.

---

## 5) Guards e Strategies (Passport)

### 5.1 Access JWT (`AccessJwtGuard` + `AccessJwtStrategy`)
- Guard: `AuthGuard('jwt')`
- Strategy:
  - Extrai token do header `Authorization: Bearer <token>`
  - Valida com `JWT_ACCESS_SECRET`
  - `validate()` devolve o payload para `req.user`

### 5.2 Refresh JWT (`RefreshJwtGuard` + `RefreshJwtStrategy`)
- Guard: `AuthGuard('jwt-refresh')`
- Strategy:
  - Extrai token via custom extractor:
    - `req.body.refreshToken` ou `req.body.token`
    - `x-refresh-token` header
  - Valida com `JWT_REFRESH_SECRET`
  - `validate(req, payload)` anexa `{ refreshToken: token }` ao objeto que vai para `req.user`
  - Se o token não existir, lança `UnauthorizedException("Refresh token ausente")`

Importante: a strategy valida assinatura/expiração, mas a validação de posse do refresh token é feita no `AuthService.refresh()` comparando com `refreshTokenHash`.

---

## 6) RBAC (Roles) — roles.decorator + roles.guard

### `@Roles(...roles)`
- Define metadata com key `ROLES_KEY = "roles"` no handler/class.

### `RolesGuard`
- É registado como `APP_GUARD` (global).
- Só aplica restrições se existir metadata `@Roles(...)`.
- Regra:
  - sem `@Roles` -> permite
  - com `@Roles` -> exige `req.user.role` e que role esteja na lista

---

## 7) Endpoints (AuthController)

Base route: `/auth`

### 7.1 `POST /auth/register`
Body: `RegisterDto`  
Fluxo:
1) cria user via `UsersService.create`
2) assina tokens
3) guarda `refreshTokenHash` na DB
Resposta:
- `{ user: { id, email, name, role, teamId }, accessToken, refreshToken }`

### 7.2 `POST /auth/login` (HTTP 200)
Body: `LoginDto`  
Fluxo:
1) valida credenciais
2) assina tokens
3) atualiza `refreshTokenHash`
Resposta:
- `{ user: { ... }, accessToken, refreshToken }`
Erros:
- `UnauthorizedException("Credenciais inválidas")`

### 7.3 `POST /auth/logout`
Guard: `AccessJwtGuard`  
Fluxo:
- `setRefreshToken(userId, null)`
Resposta:
- `{ success: true }`

### 7.4 `POST /auth/refresh`
Guard: `RefreshJwtGuard`  
Body: aceita `refreshToken` (ou `token`)  
Fluxo:
1) compara token incoming com `refreshTokenHash` (bcrypt.compare)
2) assina novos tokens
3) atualiza `refreshTokenHash`
Resposta:
- `{ accessToken, refreshToken }`
Erros:
- Unauthorized (sem hash ou mismatch)

### 7.5 `GET /auth/me`
Guard: `AccessJwtGuard`  
Resposta:
- `{ userId, email, role, teamId }`

Nota: aqui o controller devolve diretamente a partir de `req.user`, não faz lookup em DB.

### 7.6 `POST /auth/change-password`
Guard: `AccessJwtGuard`  
Body: `ChangePasswordDto`  
Fluxo:
- delega para `UsersService.changePassword(userId, oldPass, newPass)`
Resposta:
- `{ success: true }`

### 7.7 `DELETE /auth/delete-account`
Guard: `AccessJwtGuard`  
Fluxo:
- `UsersRepository.delete(userId)`
Resposta:
- `{ success: true }`

### 7.8 `POST /auth/request-password-reset`
Body: `{ email }` (não tipado com DTO neste controller)  
Fluxo:
- se user não existir -> `{ success: true }` (não revela)
- se existir:
  - gera token raw (crypto.randomBytes)
  - guarda `resetTokenHash` (bcrypt) + `resetTokenExpires` (15 min)
Resposta:
- `{ success: true, testToken?: string }`
Nota: `testToken` existe para compatibilidade com testes.

### 7.9 `POST /auth/reset-password`
Body: `ResetPasswordDto`  
Fluxo:
- procura utilizadores com `resetTokenHash != null` e `resetTokenExpires > now`
- compara token raw com hash (bcrypt.compare)
- se match:
  - guarda nova password (bcrypt.hash)
  - limpa reset token
- senão:
  - `BadRequestException("Token inválido ou expirado")`
Resposta:
- `{ success: true }`

---

## 8) AuthService — comportamento detalhado

### 8.1 Refresh token persistence
- A DB guarda apenas `refreshTokenHash` (bcrypt hash do refresh token).
- Em cada login/refresh, o hash é atualizado.

Implicação:
- refresh tokens são “single-use” no sentido em que, após refresh, o token antigo deixa de bater com o novo hash.

### 8.2 Reset password flow
- O raw token não é guardado em DB, apenas `resetTokenHash`.
- O serviço devolve raw token como `testToken` para testes.
- O reset varre candidatos (findMany) e compara token com bcrypt.

---

## 9) Tests associados (referência)

### Unit
- `backend/test/unit/auth.controller.spec.ts`
- `backend/test/unit/auth.dto.spec.ts`
- `backend/test/unit/auth.service.spec.ts`
- `backend/test/unit/jwt.strategies.spec.ts`
- `backend/test/unit/roles.guard.spec.ts`

### Integration
- `backend/test/integration/auth.int.spec.ts`

### E2E
- `backend/test/e2e/auth.e2e.spec.ts`

---
