# `src/services/services.ts`

## Overview
Integração do domínio **Services** (catálogo de serviços):
- listagem (com filtro `isActive`)
- obter por id

## Porque existe
- Centraliza endpoints `/services`.
- Garante tipagem consistente do modelo `ServiceLite` usado na UI.

## Public API
- `ServicesAPI.list(params?: ListServicesParams): Promise<ServiceLite[]>`
- `ServicesAPI.get(id: string): Promise<ServiceLite>`

### Tipos
- `ServiceLite`: `{ id, key, name, description?, isActive, ownerTeam? }`
- `ListServicesParams`: `{ isActive?: boolean }`

## Data flow
- Pages chamam `ServicesAPI.*`
- Este módulo chama `api()` com `auth:true`
- `buildQuery()` injeta `isActive` quando definido

## Security & Access Control
- `auth:true` obrigatório.
- Backend valida o que cada role pode ver (ativos/inativos, etc.).

## Errors & edge cases
- Erros lançados por `api()`.
- `isActive` só vai na query se explicitamente definido (evita filtrar sem querer).

## Performance notes
- Filtro `isActive` reduz payload quando só precisas de serviços ativos.

## Examples
```ts
import { ServicesAPI } from "./services";

const active = await ServicesAPI.list({ isActive: true });
const svc = await ServicesAPI.get("svc_1");
```

## Testabilidade
- Mockar `api()` e validar:
  - endpoint e query corretos
  - casting do resultado
