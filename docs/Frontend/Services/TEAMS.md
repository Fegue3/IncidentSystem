# `src/services/teams.ts`

## Overview
Integração do domínio **Teams**:
- listar todas as equipas (`/teams`)
- listar equipas do utilizador (`/teams/me`)
- criar equipa
- adicionar/remover membro
- listar membros de uma equipa (`/teams/:id/members`)

Inclui normalização defensiva de `_count` vindo do backend.

## Porque existe
- Centraliza contratos de equipas e gestão de membros.
- Evita duplicação de mapeamentos `_count` nas pages.
- Fornece `listMembers` para dropdowns (owner/assignee).

## Public API
- `TeamsAPI.listAll(): Promise<TeamSummary[]>`
- `TeamsAPI.listMine(): Promise<TeamSummary[]>`
- `TeamsAPI.create(name: string): Promise<TeamSummary>`
- `TeamsAPI.addMember(teamId: string, userId: string): Promise<void>`
- `TeamsAPI.removeMember(teamId: string, userId: string): Promise<void>`
- `TeamsAPI.listMembers(teamId: string): Promise<UserSummary[]>`

### Tipos
- `TeamSummary`: `{ id, name, membersCount, incidentsCount }`

## Data flow
- Resposta do backend inclui `_count` (opcional).
- `mapTeam()` converte para `TeamSummary` com defaults seguros.

## Security & Access Control
- `auth:true` em todas as chamadas.
- Backend valida permissões (ex.: admin para criar/editar equipas).

## Errors & edge cases
- `_count` pode não existir → counts retornam `0`.
- `listMembers` devolve formato leve (`UserSummary`) para UI.

## Performance notes
- `listMembers` deve ser chamada apenas quando necessário (ex.: abrir modal de seleção).
- Preferir `listMine` quando o ecrã é específico do utilizador.

## Examples
```ts
import { TeamsAPI } from "./teams";

const teams = await TeamsAPI.listAll();
await TeamsAPI.addMember("t1", "u1");
const members = await TeamsAPI.listMembers("t1");
```

## Testabilidade
- Mockar `api()` e validar:
  - endpoints corretos
  - mapping de `_count` com defaults
