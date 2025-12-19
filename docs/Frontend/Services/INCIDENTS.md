# `src/services/incidents.ts`

## Overview
Camada de integração do domínio **Incidents**. Define:
- tipos (IncidentSummary, IncidentDetails, TimelineEvent, etc.)
- helpers de severidade (labels e ordenação)
- API client `IncidentsAPI` para CRUD + status + comentários

## Porque existe
Centraliza regras de:
- contrato com `/incidents`
- filtros de listagem via query string
- normalização e consistência para pages (evita duplicação)

## Public API
### Helpers
- `getSeverityOrder(code: SeverityCode): number`
- `getSeverityLabel(code: SeverityCode): string`
- `getSeverityShortLabel(code: SeverityCode): string`

### Client
- `IncidentsAPI.list(params?: ListIncidentsParams): Promise<IncidentSummary[]>`
- `IncidentsAPI.get(id: string): Promise<IncidentDetails>`
- `IncidentsAPI.create(input: CreateIncidentInput): Promise<IncidentDetails>`
- `IncidentsAPI.changeStatus(id: string, input: ChangeStatusInput): Promise<IncidentDetails>`
- `IncidentsAPI.updateFields(id: string, input: UpdateFieldsInput): Promise<IncidentDetails>`
- `IncidentsAPI.addComment(id: string, input: AddCommentInput): Promise<IncidentComment>`
- `IncidentsAPI.delete(id: string): Promise<void>`

## Data flow
- Pages chamam `IncidentsAPI.*`
- Este módulo chama `api()` com `auth:true`
- Filtros são convertidos em query string por `buildQuery()`

## Security & Access Control
- Todas as operações usam `auth:true`.
- Scoping/permissões (equipa/role) são responsabilidade do backend.
- Frontend deve tratar `401/403` com UX coerente.

## Errors & Edge cases
- Qualquer `!ok` lança `Error` a partir de `api()`.
- `TimelineEventType` é “open union” para tolerar novos tipos sem quebrar UI.
- `UpdateFieldsInput.assigneeId` permite `null` para remover assignee.

## Performance notes
- `list()` suporta filtros (reduz payload/latência).
- Evitar re-fetch redundante quando o utilizador altera filtros rapidamente (debounce/controle de efeitos).

## Examples
### Listagem com filtros
```ts
import { IncidentsAPI } from "./incidents";

const items = await IncidentsAPI.list({ status: "IN_PROGRESS", teamId: "t1" });
```

### Criar incidente
```ts
await IncidentsAPI.create({
  title: "DB down",
  description: "Primary database is not responding",
  severity: "SEV1",
  primaryServiceId: "svc_1",
});
```

### Mudar status + mensagem
```ts
await IncidentsAPI.changeStatus("inc_1", { newStatus: "RESOLVED", message: "Fixed and validated" });
```

## Testabilidade
- Mockar `api()` e validar:
  - paths e métodos corretos
  - body JSON correto
  - query string correta em `list()`
- Testes unitários para helpers de severidade.
