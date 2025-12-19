# `src/services/users.ts`

## Overview
Integração do domínio **Users**:
- `me()` via `/auth/me` (perfil do utilizador autenticado)
- `updateMe()` via `/users/me` (preparado; depende do backend)
- `listAll()` via `/users` (dropdowns/owners)

## Porque existe
- Centraliza o contrato do perfil e listagens simples.
- Normaliza o id (`userId` vs `id`) para um campo único `id`.

## Public API
- `UsersAPI.me(): Promise<Me>`
- `UsersAPI.updateMe(payload: unknown): Promise<unknown>`
- `UsersAPI.listAll(): Promise<UserSummary[]>`

### Tipos
- `Me`: `{ id, email, name?, role?, teamId? }`
- `UserSummary`: `{ id, email, name? }`

## Data flow
- `me()` chama `/auth/me` e normaliza `id`.
- `listAll()` converte para `UserSummary[]` com `name ?? null`.

## Security & Access Control
- `auth:true` em todas as chamadas.
- Backend deve restringir `/users` (tipicamente admin) se necessário.

## Errors & edge cases
- Se o backend não devolver `userId` nem `id`, o `id` fica `""` (edge case a monitorizar).
- `updateMe()` assume JSON payload.

## Performance notes
- `listAll()` é “light” para dropdowns; evitar pedir repetidamente (cache local se necessário).

## Examples
```ts
import { UsersAPI } from "./users";

const me = await UsersAPI.me();
const all = await UsersAPI.listAll();
```

## Testabilidade
- Mockar `api()` e testar:
  - normalização de `id`
  - mapping de listagens
