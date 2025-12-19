# Incidents Module — Gestão de Incidentes, Timeline, Comentários e Subscrições

Este documento descreve o módulo `incidents/` do backend IMS: DTOs, endpoints, regras de negócio (workflow de status), integrações (notificações) e auditoria (audit hash).

---

## 1) Estrutura do módulo

Localização: `backend/src/incidents/`

Ficheiros principais:
- `incidents.controller.ts` — endpoints HTTP `/incidents/*`
- `incidents.service.ts` — lógica de domínio (CRUD + workflow + timeline)
- `incidents.module.ts` — wiring do módulo
- `dto/`
  - `create-incident.dto.ts`
  - `update-incident.dto.ts`
  - `list-incidents.dto.ts`
  - `change-status.dto.ts`
  - `add-comment.dto.ts`

Dependências externas:
- `PrismaService` (PostgreSQL) — persistência de Incident + relações
- `NotificationsService` (módulo notifications) — Discord/PagerDuty
- `ensureIncidentAuditHash` (módulo audit) — integridade/auditoria por HMAC

---

## 2) Objetivo e responsabilidades

O módulo Incidents implementa:
- criação e manutenção de incidentes (title/description/severity/assignee/team/service)
- listagem com filtros e pesquisa textual
- detalhe completo com includes (categorias/tags/capas/sources/comments/timeline)
- workflow de status com transições validadas + timestamps por fase
- comentários e timeline (auditável e ordenado)
- subscrições de notificações por incidente
- delete com regra de autorização (apenas reporter)

Além disso, após alterações relevantes, o módulo tenta atualizar um `auditHash` (best-effort).

---

## 3) Autenticação e contexto do utilizador

Todos os endpoints estão protegidos com `AccessJwtGuard` (JWT Bearer).

O `userId` é extraído do request:
- `req.user.sub` (payload do JWT)  
- fallback: `req.user.id`

---

## 4) Modelos / Relações (perspetiva funcional)

O service trabalha principalmente com:
- `Incident`
- `IncidentTimelineEvent` (timeline)
- `IncidentComment` (comentários)
- `NotificationSubscription` (subscrições)
- `CategoryOnIncident` (tabela de junção)
- `Tag` (ligação many-to-many)
- `Service` (primaryService)
- `Team`
- `User` (reporter/assignee/author)

---

## 5) DTOs e validações

### 5.1 CreateIncidentDto
Obrigatório:
- `title: string`
- `description: string`

Opcional:
- `severity?: Severity` (default aplicado no service: `SEV3`)
- `assigneeId?: string`
- `teamId?: string`
- serviço principal:
  - `primaryServiceId?: string` (por id)
  - `primaryServiceKey?: string` (por key)
- `categoryIds?: string[]`
- `tagIds?: string[]`

### 5.2 UpdateIncidentDto
Todos opcionais:
- `title`, `description`, `severity`
- `assigneeId`, `teamId`
- `primaryServiceId` ou `primaryServiceKey`
- `categoryIds`, `tagIds`

Regra especial para remover service:
- enviar `primaryServiceId: ""` ou `primaryServiceKey: ""`  
  => o service interpreta como `null` e faz `disconnect`.

### 5.3 ListIncidentsDto (query params)
Filtros:
- `status?: IncidentStatus`
- `severity?: Severity`
- `assigneeId?: string`
- `teamId?: string`
- `primaryServiceId?: string`
- `primaryServiceKey?: string` (resolve para id internamente)
- `search?: string` (contains em `title/description`, case-insensitive)
- `createdFrom?: Date` e `createdTo?: Date` (transformados com `class-transformer`)

### 5.4 ChangeStatusDto
- `newStatus: IncidentStatus` (obrigatório)
- `message?: string` (opcional; texto para timeline)

### 5.5 AddCommentDto
- `body: string` (obrigatório e não vazio)

---

## 6) Endpoints (IncidentsController)

Base route: `/incidents`  
Guard: `AccessJwtGuard` (no controller inteiro)

### 6.1 POST `/incidents`
Cria um incidente.

Body: `CreateIncidentDto`

Comportamento:
- cria incident com `status=NEW`
- cria evento de timeline: `STATUS_CHANGE (to NEW)` com mensagem “Incidente criado”
- cria subscrição para o reporter (`NotificationSubscription`)
- se tiver `primaryService`, adiciona evento `FIELD_UPDATE` (“Serviço definido: ...”)
- se severity for `SEV1` ou `SEV2`, dispara notificações:
  - Discord (mensagem formatada)
  - PagerDuty (trigger)
  - grava na timeline o resultado (OK/FAIL)

Resposta:
- objeto de `Incident` com includes: reporter, assignee, team, primaryService (inclui ownerTeam)

Erros típicos:
- `400 BadRequest` se `primaryServiceId/key` não existir

---

### 6.2 GET `/incidents`
Lista incidentes com filtros.

Query: `ListIncidentsDto`

Notas:
- se `primaryServiceKey` for fornecida e não existir service com essa key, devolve `[]`
- ordenação: `createdAt desc`
- inclui reporter, assignee, team, primaryService (ownerTeam)

---

### 6.3 GET `/incidents/:id`
Devolve detalhe completo do incidente.

Includes:
- reporter, assignee, team
- primaryService (ownerTeam)
- categories (inclui category)
- tags
- capas (com owner)
- comments (ASC, com author)
- timeline (ASC, com author)
- sources (com integration)

Erros:
- `404 Not Found` se o id não existir

---

### 6.4 PATCH `/incidents/:id`
Atualiza campos do incidente.

Body: `UpdateIncidentDto`

Comportamento:
- calcula diffs e gera eventos de timeline coerentes:
  - `FIELD_UPDATE` se serviço muda/remove
  - `ASSIGNMENT` se assignee muda/remove
  - `FIELD_UPDATE` se severity muda
  - se não houver eventos específicos mas houver outras alterações: “Campos atualizados”
- categorias:
  - apaga todas as ligações em `CategoryOnIncident` e recria (se `categoryIds` vierem)
- tags:
  - substitui via `set` (se `tagIds` vierem)

Erros:
- `404 Not Found` se não existir
- `400 BadRequest` se service por id/key não existir

---

### 6.5 PATCH `/incidents/:id/status`
Muda status do incidente, validando transições.

Body: `ChangeStatusDto`

Comportamento:
- valida transição (ver secção 7)
- atualiza `status`
- define timestamp de fase (se ainda não existia):
  - TRIAGED -> `triagedAt`
  - IN_PROGRESS -> `inProgressAt`
  - RESOLVED -> `resolvedAt`
  - CLOSED -> `closedAt`
- cria evento de timeline `STATUS_CHANGE` (from/to + message)
- se severity for `SEV1/SEV2`, envia notificação Discord e regista resultado na timeline

Erros:
- `404 Not Found` se não existir
- `400 BadRequest` se transição for inválida

---

### 6.6 POST `/incidents/:id/comments`
Adiciona comentário.

Body: `AddCommentDto`

Comportamento:
- cria `IncidentComment`
- cria evento de timeline `COMMENT` com a mesma mensagem

Erros:
- `404 Not Found` se não existir

---

### 6.7 GET `/incidents/:id/comments`
Lista comentários (ASC) com include do author.

---

### 6.8 GET `/incidents/:id/timeline`
Lista timeline events (ASC) com include do author.

---

### 6.9 POST `/incidents/:id/subscribe`
Cria subscrição do utilizador autenticado ao incidente.

Comportamento:
- evita duplicados (se já existir, não cria novamente)
- cria timeline event `FIELD_UPDATE`: “Subscrição de notificações ativada”

Resposta:
- `{ subscribed: true }`

---

### 6.10 DELETE `/incidents/:id/subscribe`
Remove subscrição do utilizador autenticado.

Comportamento:
- `deleteMany` para garantir remoção
- cria timeline event `FIELD_UPDATE`: “Subscrição de notificações desativada”

Resposta:
- `{ subscribed: false }`

---

### 6.11 DELETE `/incidents/:id`
Apaga incidente.

Regra de autorização:
- apenas o reporter (`incident.reporterId`) pode apagar

O delete remove, em transação:
- comments
- timeline events
- subscriptions
- categoryOnIncident
- incident

Resposta:
- `{ deleted: true }`

Erros:
- `404 Not Found` se não existir
- `403 Forbidden` se não for o reporter

---

## 7) Workflow de status (regras de transição)

As transições permitidas são:

- NEW -> TRIAGED | IN_PROGRESS
- TRIAGED -> IN_PROGRESS | ON_HOLD | RESOLVED
- IN_PROGRESS -> ON_HOLD | RESOLVED
- ON_HOLD -> IN_PROGRESS | RESOLVED
- RESOLVED -> CLOSED | REOPENED
- CLOSED -> REOPENED
- REOPENED -> IN_PROGRESS | ON_HOLD | RESOLVED

Transição fora destas regras:
- lança `BadRequestException("Transição inválida de X para Y")`

---

## 8) Resolução do serviço principal (primaryService)

O service aceita dois modos:
- `primaryServiceId` (id)
- `primaryServiceKey` (key)

Regras:
- Se `primaryServiceId` ou `primaryServiceKey` forem strings vazias:
  - interpreta como `null` e faz `disconnect` do service
- Se id/key forem fornecidos mas não existirem na DB:
  - lança `BadRequestException("Service not found (...)")`

---

## 9) Notificações (SEV1/SEV2)

### 9.1 Na criação
Se `severity` for `SEV1` ou `SEV2`, o service:
- compõe uma mensagem (inclui short id, status, service, team, owner e link opcional)
- envia para Discord (`NotificationsService.sendDiscord`)
- dispara PagerDuty (`NotificationsService.triggerPagerDuty`)
- grava na timeline o resultado:
  - `Notificações: Discord=OK/FAIL | PagerDuty=OK/FAIL`

### 9.2 Na mudança de status
Se `severity` for `SEV1` ou `SEV2`, o service:
- envia notificação Discord sobre mudança `from -> to`
- grava na timeline:
  - `Notificação de status: Discord=OK/FAIL`

---

## 10) Auditoria (auditHash) — best-effort

Após operações que alteram dados relevantes (create/update/changeStatus/addComment/subscribe/unsubscribe), o service chama:

- `ensureIncidentAuditHash(prisma, incidentId, process.env.AUDIT_HMAC_SECRET)`

Notas:
- se `AUDIT_HMAC_SECRET` estiver ausente, o audit pode não ser aplicado (depende da implementação do audit)
- o cálculo é “best-effort”: falhas não interrompem a operação principal

---

## 11) Erros e respostas (resumo)

Erros principais:
- `404 Not Found`:
  - incident inexistente (findOne/update/changeStatus/addComment/delete)
- `400 Bad Request`:
  - transição de status inválida
  - service por id/key não encontrado
- `403 Forbidden`:
  - delete apenas permitido ao reporter

---

## 12) Tests associados (referência)

Ainda não foi fornecida a lista/nomes dos ficheiros de testes específicos do módulo Incidents.
Quando tiveres os paths exatos (unit/integration/e2e), adiciono aqui a secção com:
- suites por camada (unit/integration/e2e)
- principais cenários cobertos (transições, permissões, side-effects)

---
