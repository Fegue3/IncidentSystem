# Database Schema (Prisma) — `schema.prisma`

Este documento descreve o **schema Prisma** do backend do IMS (Incident Management System). Serve como referência de domínio para **modelos**, **enums**, **relações**, **constraints** e **índices** utilizados pelo PostgreSQL via Prisma Client.

> **Ficheiro fonte:** `backend/prisma/schema.prisma`  
> **Migrações:** `backend/prisma/migrations/*`

---

## 1) Visão geral do domínio

O núcleo do sistema gira à volta de **Incidents**, com suporte para:
- **Identidade e acesso:** `User` (RBAC via `Role`).
- **Scoping organizacional:** `Team` e membership (regras de scoping vivem no backend, não no schema).
- **Catálogo de serviços afetados:** `Service` (e um `primaryService` no incidente).
- **Auditoria e histórico:** `IncidentTimelineEvent` + `auditHash`.
- **Comentários:** `IncidentComment`.
- **Classificação:** `Category`, `Tag` e `CategoryOnIncident` (join).
- **Integrações:** `IntegrationSource` e `IncidentSource` (dedupe por `integrationId + externalId`).
- **CAPA:** `CAPA` (ações corretivas/preventivas) com owner opcional.
- **Notificações:** `NotificationSubscription` e `IntegrationSetting`.

---

## 2) Datasource e generator

### Datasource
- **Provider:** PostgreSQL  
- **Connection string:** `DATABASE_URL` (env var)

### Generator
- **Prisma Client:** `prisma-client-js` (consumido em NestJS via `PrismaService`).

---

## 3) Enums (vocabulário controlado)

### `IncidentStatus`
- `NEW`, `TRIAGED`, `IN_PROGRESS`, `ON_HOLD`, `RESOLVED`, `CLOSED`, `REOPENED`

### `Severity`
- `SEV1`, `SEV2`, `SEV3`, `SEV4`

### `Role`
- `USER`, `ADMIN`

### `Provider`
- `NAGIOS`, `DATADOG`, `PROMETHEUS`, `OTHER`

### `TimelineEventType`
- `STATUS_CHANGE`, `COMMENT`, `ASSIGNMENT`, `FIELD_UPDATE`

### `CAPAStatus`
- `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED`

### `IntegrationKind`
- `DATADOG`, `PAGERDUTY`, `DISCORD`

---

## 4) Modelos e relações

### 4.1 `User`
**Responsabilidade:** identidade, credenciais e role; relações de domínio (reporter/assignee), teams e settings.

**Campos chave**
- `email` (**unique**)
- `role` (`Role`, default `USER`)
- `password` (hash)
- refresh/reset tokens: `refreshTokenHash`, `resetTokenHash`, `resetTokenExpires`

**Relações**
- `incidents` (como **reporter**) — `Incident` via relação `"Reporter"`
- `assigned` (como **assignee**) — `Incident` via relação `"Assignee"`
- `teams` — N:N com `Team` via `"TeamMembers"`
- `timelineAuthored` — eventos de timeline authored
- `subscriptions` — subscrições de notificação
- `integrationSettings` — preferências por integração
- `capaOwned` — CAPAs atribuídas (owner opcional)

**Índices**
- `@@index([role])`
- `@@index([createdAt])`

---

### 4.2 `Team`
**Responsabilidade:** scoping organizacional e agregação de members/incidents.

**Campos chave**
- `name` (**unique**)

**Relações**
- `members` — N:N com `User` via `"TeamMembers"`
- `incidents` — 1:N (`Incident.teamId`)
- `services` — 1:N opcional (`Service.ownerTeamId`)

---

### 4.3 `Service`
**Responsabilidade:** catálogo de serviços monitorizados/afetados por incidentes.

**Campos chave**
- `key` (**unique**) — ex.: `"public-api"`
- `name` (**unique**) — ex.: `"Public API"`
- `isActive` (`Boolean`, default `true`)

**Relações**
- `ownerTeam` — 0..1 para `Team` (`ownerTeamId`)
- `incidents` — 1:N como `primaryService` do `Incident`

**Índices**
- `@@index([ownerTeamId])`
- `@@index([isActive])`

---

### 4.4 `Incident`
**Responsabilidade:** entidade central do IMS.

**Campos chave**
- Estado e severidade: `status` (default `NEW`), `severity` (default `SEV3`)
- `reporterId` (obrigatório), `assigneeId` (opcional)
- Scoping: `teamId` (opcional), `primaryServiceId` (opcional)
- Métricas: `triagedAt`, `inProgressAt`, `resolvedAt`, `closedAt`
- Auditoria: `auditHash`, `auditHashUpdatedAt`

**Relações**
- `reporter` — 1:1 obrigatório
- `assignee` — 0..1
- `team` — 0..1
- `primaryService` — 0..1
- `timeline` — 1:N (`IncidentTimelineEvent`)
- `comments` — 1:N (`IncidentComment`)
- `categories` — N:N via `CategoryOnIncident`
- `tags` — N:N via relação `"IncidentTags"`
- `sources` — 1:N (`IncidentSource`)
- `capas` — 1:N (`CAPA`)
- `subscriptions` — 1:N (lado oposto em `NotificationSubscription`)

**Índices (performance)**
- `@@index([status, severity])` (dashboards/filas)
- `@@index([createdAt])` (time-series e ordenações)
- `@@index([teamId])`, `@@index([assigneeId])`, `@@index([reporterId])`, `@@index([primaryServiceId])` (filtros/scoping)
- `@@index([auditHashUpdatedAt])` (auditoria)

---

### 4.5 `IncidentTimelineEvent`
**Responsabilidade:** histórico e eventos do incidente (mudança de estado, comentários, assignment, alterações de campos).

**Campos chave**
- `type` (`TimelineEventType`)
- `fromStatus`, `toStatus` (quando aplicável)
- `authorId` opcional (eventos do sistema)
- `message` opcional

**Índices**
- `@@index([incidentId, createdAt])` (timeline ordenada e paginação)

---

### 4.6 `IncidentComment`
**Responsabilidade:** comentários “formais” associados ao incidente (tabela dedicada).

**Campos chave**
- `body` (texto do comentário)
- `authorId` obrigatório

**Índices**
- `@@index([incidentId, createdAt])`

> Nota: o sistema também pode representar comentários como eventos de timeline (`TimelineEventType.COMMENT`).  
> O backend pode precisar de “merge/dedup” destes dois canais (depende da lógica do módulo de reports/export).

---

### 4.7 `Category` e `CategoryOnIncident`
**Responsabilidade:** classificação por categorias (N:N).

**`Category`**
- `name` (**unique**)

**`CategoryOnIncident` (join)**
- PK composta: `@@id([incidentId, categoryId])`  
  → garante que **não duplicas** a mesma categoria no mesmo incidente.
- `assignedAt` (timestamp)

---

### 4.8 `Tag`
**Responsabilidade:** labels livres para incidentes (N:N).

- `label` (**unique**)
- Relação N:N com `Incident` via `"IncidentTags"`

---

### 4.9 `CAPA`
**Responsabilidade:** ações corretivas/preventivas associadas ao incidente.

**Campos chave**
- `status` (`CAPAStatus`, default `OPEN`)
- `ownerId` opcional
- `dueAt` opcional

**Índices**
- `@@index([incidentId])`
- `@@index([status])`
- `@@index([ownerId])`

---

### 4.10 `IntegrationSource` e `IncidentSource`
**Responsabilidade:** representar integrações externas e ligações de incidentes a eventos/IDs externos.

**`IntegrationSource`**
- metadados da integração (`provider`, `name`, `baseUrl`, `apiKey`)
- `@@index([provider])`

**`IncidentSource`**
- link `incidentId` + `integrationId` + `externalId`
- `@@unique([integrationId, externalId])`  
  → evita colisões/duplicação de eventos externos.
- `payload` (`Json?`) para dados brutos
- `@@index([incidentId])`

---

### 4.11 `NotificationSubscription`
**Responsabilidade:** subscrições para notificações por user, com scope opcional a incidente e/ou categoria.

- `incidentId` opcional (subscrição por incidente)
- `categoryId` opcional (subscrição por categoria)
- `@@unique([userId, incidentId, categoryId])`  
  → evita duplicar subscrições iguais.
- `@@index([userId])`

**Semântica recomendada (contrato)**
- `(userId, incidentId!=null, categoryId=null)` → segue um incidente específico
- `(userId, incidentId=null, categoryId!=null)` → segue uma categoria
- `(userId, incidentId!=null, categoryId!=null)` → segue incidente + categoria (super específico)
- `(userId, incidentId=null, categoryId=null)` **não faz sentido** (evitar no backend)

---

### 4.12 `IntegrationSetting`
**Responsabilidade:** preferências do user por tipo de integração (Discord/PagerDuty/Datadog…).

- `kind` (`IntegrationKind`)
- `notificationsEnabled` (default `false`)
- `@@unique([userId, kind])` → 1 registo por user por integração
- `@@index([userId])`

---

## 5) Constraints e “garantias” do schema

### Unicidade (catálogos/identidade)
- `User.email`
- `Team.name`
- `Service.key`, `Service.name`
- `Tag.label`
- `Category.name`

### Joins e dedup
- `CategoryOnIncident @@id([incidentId, categoryId])`
- `IncidentSource @@unique([integrationId, externalId])`
- `NotificationSubscription @@unique([userId, incidentId, categoryId])`
- `IntegrationSetting @@unique([userId, kind])`

---

## 6) Índices e impacto em performance

Principais leituras do sistema (típicas) e suportes do schema:
- **Listagens/filas de incidentes:** `Incident(status, severity)`, `Incident(createdAt)`
- **Scoping/filtros:** `Incident(teamId)`, `Incident(primaryServiceId)`, `Incident(assigneeId)`, `Incident(reporterId)`
- **Timeline:** `IncidentTimelineEvent(incidentId, createdAt)`
- **Auditoria:** `Incident(auditHashUpdatedAt)`
- **CAPA:** `CAPA(status)`, `CAPA(ownerId)`

> Se reports fizerem agregações pesadas por `teamId + createdAt`, considera índice composto adicional (só se justificar por profiling).

---

## 7) Notas de consistência e evolução

### Boas práticas ao mudar o schema
- Alterações **sempre via migrations** (`prisma migrate dev`).
- Ao adicionar campos que entram em filtros/relatórios: considerar índices.
- Ao alterar enums: alinhar com DTOs/services/seeds (evitar drift).

### Campos “sensíveis”
- `password` e tokens (hashes): nunca expor diretamente em DTOs/responses.
- `apiKey` em `IntegrationSource`: tratar como segredo (não devolver em listagens).

---

## 8) Operações (comandos típicos)

```bash
# gerar prisma client
npx prisma generate

# criar migrações (dev)
npx prisma migrate dev --name <nome>

# aplicar migrações (prod)
npx prisma migrate deploy

# reset DB (dev)
npx prisma migrate reset

# abrir Prisma Studio (debug)
npx prisma studio
```

---

## 9) Glossário rápido

- **Incident:** evento/problema operacional a ser gerido.
- **Timeline:** audit trail de mudanças e eventos do incidente.
- **CAPA:** Corrective And Preventive Action (ação corretiva/preventiva).
- **Subscription:** regra de quem recebe notificações de quê.
- **Integration Source:** sistema externo que origina/sincroniza eventos.

