# Teams Module

## O que este módulo faz
O **Teams Module** implementa a gestão de **equipas** e da relação **Equipa ↔ Membros (Users)**:

- CRUD de equipas (`create`, `list`, `get`, `update`, `delete`)
- Listagem de membros de uma equipa
- Adição/remoção de membros
- Endpoint “minhas equipas” (equipas onde o utilizador autenticado é membro)

## Porque existe
As equipas são usadas como unidade de organização e, tipicamente, como **âmbito (scope)** para incidentes e relatórios.  
Este módulo centraliza as operações de equipas e define uma regra de domínio importante: **um utilizador só pode pertencer a 1 equipa** (aplicada ao adicionar membros).

---

## Ficheiros e responsabilidades

### `dto/add-member.dto.ts`
**Responsabilidade:** validar o corpo do request para adicionar um membro a uma equipa.

- `userId` (obrigatório): string

> Nota: a regra “um user só pode estar em 1 equipa” não é do DTO; é aplicada no service.

---

### `dto/create-team.dto.ts`
**Responsabilidade:** validar o corpo do request para criação de equipa.

- `name` (obrigatório): `string` + `notEmpty`
- `memberIds` (opcional): `string[]` (IDs para `connect` na criação)

> Não garante existência dos IDs (isso é responsabilidade do Prisma/DB ou validação adicional).

---

### `dto/list-teams.dto.ts`
**Responsabilidade:** validar query params da listagem.

- `search` (opcional): string para filtrar por nome (contains + case-insensitive)

---

### `dto/update-team.dto.ts`
**Responsabilidade:** validar o corpo do request para atualização.

- `name` (opcional): string
- `memberIds` (opcional): `string[]`

**Regra importante:** se `memberIds` vier presente, o update faz **reset total** de membros via `set`, ou seja:
- remove todos os atuais
- mantém apenas os IDs enviados

---

### `teams.controller.ts`
**Responsabilidade:** expor endpoints REST e delegar a lógica para `TeamsService`.

**Segurança:** todas as rotas usam `@UseGuards(AccessJwtGuard)`.  
Assume-se que o utilizador autenticado está em `req.user` e que o seu id existe em `req.user.sub` ou `req.user.id`.

---

### `teams.service.ts`
**Responsabilidade:** lógica de negócio e acesso a dados via `PrismaService`.

Pontos-chave:
- CRUD com `prisma.team.*`
- gestão de membros com includes e contagens (`_count`)
- **regra “um user só pode estar em 1 equipa”** implementada em `addMember()` com transação

---

### `teams.module.ts`
**Responsabilidade:** declarar controller + providers e exportar o `TeamsService`.

> Nota: este módulo fornece `PrismaService` diretamente.  
> Se já tiveres `PrismaModule` global/importado, podes preferir usar `imports: [PrismaModule]` e remover `PrismaService` de `providers`.

---

## Endpoints (API)

Base path: `/teams` (com JWT obrigatório)

### Criar equipa
`POST /teams`

Body: `CreateTeamDto`
```json
{
  "name": "Equipa SRE",
  "memberIds": ["userId1", "userId2"]
}
