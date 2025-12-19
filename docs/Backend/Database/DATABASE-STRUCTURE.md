# IMS — Modelo de Dados (PostgreSQL via Prisma)

Este documento descreve a **lógica e estrutura da base de dados** do Incident Management System (IMS): entidades principais, relações, regras de integridade, e como o modelo suporta incidentes, equipas, integrações, CAPA e notificações.

---

## 1) Visão geral do domínio

O IMS gira em torno de **Incidents**, que representam ocorrências operacionais (falhas, degradações, alertas) com:
- **severidade** e **estado**
- **reporter** (quem reportou) e **assignee** (quem está responsável)
- **equipa** e **serviço principal** (contexto operacional)
- **timeline** (auditoria e evolução do incidente) e **comentários**
- **categorias** e **tags** (classificação)
- **fontes externas** (integrações como Nagios/Datadog/Prometheus)
- **CAPA** (ações corretivas/preventivas ligadas ao incidente)
- **subscriptions** (notificações por incidente e/ou categoria)

---

## 2) Enums (vocabulário controlado)

### IncidentStatus
Ciclo de vida do incidente:
- `NEW` → `TRIAGED` → `IN_PROGRESS` → (`ON_HOLD`) → `RESOLVED` → `CLOSED`
- `REOPENED` permite reabrir após resolução/fecho.

### Severity
Prioridade/impacto operacional:
- `SEV1` (crítico) … `SEV4` (baixo).

### Role
Acesso do utilizador:
- `USER`, `ADMIN`.

### Provider
Fonte “técnica” do alerta/incidente:
- `NAGIOS`, `DATADOG`, `PROMETHEUS`, `OTHER`.

### TimelineEventType
Tipos de eventos registados na timeline:
- `STATUS_CHANGE`, `COMMENT`, `ASSIGNMENT`, `FIELD_UPDATE`.

### CAPAStatus
Estado de ações corretivas/preventivas:
- `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED`.

### IntegrationKind
Preferências de integração por utilizador:
- `DATADOG`, `PAGERDUTY`, `DISCORD`.

---

## 3) Entidades e responsabilidades

### 3.1 User
Representa utilizadores do sistema.
- Campos chave: `email (unique)`, `role`, `password`
- Suporte de autenticação: `refreshTokenHash`, `resetTokenHash`, `resetTokenExpires`
- Relações:
  - Incidentes reportados (`incidents`) e atribuídos (`assigned`)
  - Comentários (`comments`)
  - Membros de equipas (`teams`)
  - Eventos de timeline criados (`timelineAuthored`)
  - Subscrições (`subscriptions`)
  - Preferências por integração (`integrationSettings`)
  - Dono opcional de CAPA (`capaOwned`)

**Notas de integridade**
- `email` é único.
- Índices em `role` e `createdAt` para filtros rápidos (admin/users; listagens por data).

---

### 3.2 Team
Agrupa utilizadores e pode “possuir” serviços.
- Campos chave: `name (unique)`
- Relações:
  - `members` (N:N User↔Team)
  - `incidents` (1:N Team→Incident)
  - `services` (1:N Team→Service)

**Ideia principal**
- Teams suportam **scoping** (ex.: ver apenas incidentes da equipa), e ownership de serviços.

---

### 3.3 Service
Representa um serviço/aplicação monitorizada (ex.: “Public API”).
- Campos chave: `key (unique)`, `name (unique)`, `isActive`
- Relações:
  - `ownerTeam` (opcional) — equipa responsável
  - `incidents` (1:N) — incidentes cujo serviço principal é este

**Notas de integridade e performance**
- Índices em `ownerTeamId` e `isActive` para listagens e filtros.
- `key` serve como identificador “estável” (bom para integrações e seed).

---

### 3.4 Incident (núcleo do sistema)
Registo principal do domínio.
- Campos funcionais:
  - `title`, `description`
  - `status`, `severity`
  - `reporter` (obrigatório) e `assignee` (opcional)
  - `team` (opcional)
  - `primaryService` (opcional)
- Classificação:
  - `categories` via tabela de junção `CategoryOnIncident`
  - `tags` via relação N:N
- Colaboração:
  - `timeline` (eventos)
  - `comments` (texto livre)
- Integrações:
  - `sources` (incident sources externas)
- CAPA:
  - `capas` (ações corretivas/preventivas)
- Notificações:
  - `subscriptions` (lado oposto)

**Métricas (timestamps de estado)**
- `triagedAt`, `inProgressAt`, `resolvedAt`, `closedAt`
> Permite construir KPIs (MTTA, MTTR, throughput por período, etc.).

**Compliance / Audit**
- `auditHash`, `auditHashUpdatedAt`
> Serve para detetar alterações indevidas/fora de fluxo (cadeia de integridade ao longo do tempo).

**Índices**
- `status,severity` para dashboards e filas (triage)
- `createdAt` para relatórios e paginação temporal
- FKs (`teamId`, `reporterId`, `assigneeId`, `primaryServiceId`)
- `auditHashUpdatedAt` para rotinas de verificação/refresh.

---

### 3.5 IncidentTimelineEvent
Histórico estruturado do incidente.
- Campos: `type`, `fromStatus`, `toStatus`, `message`, `createdAt`
- Ligações:
  - sempre a um `incident`
  - `author` opcional (permite eventos automáticos/sistema)

**Uso típico**
- Registar transições de estado, reatribuições, atualizações de campos, etc.
- Índice `(incidentId, createdAt)` otimiza “carregar timeline por ordem cronológica”.

---

### 3.6 IncidentComment
Comentários associados ao incidente (texto).
- Sempre com `author` obrigatório.
- Índice `(incidentId, createdAt)` otimiza histórico e paginação.

---

### 3.7 Category e CategoryOnIncident
Categorias são entidades próprias (com `name unique`).
- `CategoryOnIncident` é uma **tabela de junção N:N** entre Incident e Category
- PK composta: `@@id([incidentId, categoryId])` garante:
  - não existe a mesma categoria duplicada no mesmo incidente
- `assignedAt` dá auditoria “quando foi aplicada”.

**Porque existe uma tabela explícita em vez de N:N direto**
- Permite campos extra (`assignedAt`) e evoluir para suportar “assignedBy”, etc.

---

### 3.8 Tag
Etiquetas simples para classificação livre, com `label unique`.
- Relação N:N com Incident (`IncidentTags`).

---

### 3.9 CAPA (Corrective and Preventive Action)
Ações corretivas/preventivas ligadas a um incidente.
- Campos: `action`, `status`, `dueAt`
- Relações:
  - sempre a um `incident`
  - `owner` opcional (quem é responsável pela ação)

**Índices**
- `incidentId`: listar CAPAs por incidente
- `status`: filas de CAPA em aberto
- `ownerId`: trabalho por responsável

---

### 3.10 IntegrationSource e IncidentSource
Suportam ligação a sistemas externos.

**IntegrationSource**
- Representa uma “origem” configurada (provider + credenciais/opções).
- Campos: `provider`, `name`, `baseUrl?`, `apiKey?`
- Índice em `provider` para filtros.

**IncidentSource**
- Liga um incidente a um item externo.
- Campos: `externalId`, `payload (Json?)`, `createdAt`
- Regra crítica: `@@unique([integrationId, externalId])`
  - evita duplicar o mesmo alerta/evento externo.

---

### 3.11 NotificationSubscription
Sistema de subscrições para notificações.
- Uma subscrição pertence a um `user`
- Pode ser:
  - por **incident** (`incidentId`) **ou**
  - por **category** (`categoryId`)
- Regra de unicidade: `@@unique([userId, incidentId, categoryId])`

**Interpretação**
- Permite subscrever:
  - “Quero updates deste incidente específico”
  - “Quero updates de incidentes desta categoria”
- Índice em `userId` otimiza “quais as minhas subscrições”.

> Nota: O modelo permite combinações onde ambos `incidentId` e `categoryId` podem estar `null`/preenchidos — a lógica de negócio deve impor regras (ex.: pelo menos um dos dois tem de existir).

---

### 3.12 IntegrationSetting
Preferências por utilizador para integrações (ex.: Discord/PagerDuty).
- Campos: `notificationsEnabled`, `lastSavedAt`
- Regra: `@@unique([userId, kind])` (1 config por integração por utilizador)
- Índice `userId` para carregar settings rapidamente no login/profile.

---

## 4) Relações principais (resumo)

- **User ↔ Team**: N:N (`TeamMembers`)
- **Team → Service**: 1:N (ownership opcional)
- **Service → Incident**: 1:N (serviço principal opcional)
- **Team → Incident**: 1:N (equipa opcional)
- **User → Incident**:
  - reporter (1:N obrigatório)
  - assignee (1:N opcional)
- **Incident → TimelineEvent**: 1:N
- **Incident → Comment**: 1:N
- **Incident ↔ Category**: N:N via `CategoryOnIncident`
- **Incident ↔ Tag**: N:N
- **Incident → CAPA**: 1:N
- **IntegrationSource → IncidentSource**: 1:N
- **Incident → IncidentSource**: 1:N
- **User → NotificationSubscription**: 1:N
- **Category → NotificationSubscription**: 1:N (opcional)
- **Incident → NotificationSubscription**: 1:N (opcional)
- **User → IntegrationSetting**: 1:N (único por kind)

---

## 5) Regras e invariantes recomendadas (lógica de negócio)

Estas regras não estão todas “forçadas” pela DB, mas são importantes na aplicação:

1. **Transições de estado válidas**
   - Validar o fluxo (ex.: não saltar de `NEW` direto para `CLOSED` sem `RESOLVED`, se for regra do produto).
2. **Métricas coerentes**
   - Ao mudar `status` para `TRIAGED`, preencher `triagedAt` se vazio.
   - Ao mudar para `IN_PROGRESS`, preencher `inProgressAt`.
   - Ao mudar para `RESOLVED`, preencher `resolvedAt`.
   - Ao mudar para `CLOSED`, preencher `closedAt`.
3. **Subscrições**
   - Impor “pelo menos um alvo”: `incidentId != null OR categoryId != null`.
4. **IncidentSource**
   - `externalId` deve ser estável e vindo do provider; `payload` deve conter os campos mínimos para auditoria/debug.
5. **AuditHash**
   - Atualizar `auditHash`/`auditHashUpdatedAt` sempre que campos sensíveis mudam (status, assignee, severity, etc.)

---

## 6) Porque este modelo é “bom” para relatórios e dashboards

- Índices orientados para:
  - listagens por estado/severidade
  - scoping por equipa
  - filtros por serviço principal
  - métricas por data (`createdAt`, timestamps de estado)
- A timeline e timestamps permitem:
  - MTTA (createdAt → triagedAt)
  - MTTR (createdAt → resolvedAt)
  - Tempo em progress (inProgressAt → resolvedAt)
- `IncidentSource` dá rastreabilidade externa (importante para auditoria e reconciliação).

---

## 7) Possíveis extensões futuras (sem quebrar o modelo)

- Guardar `assignedBy` e `categoryAssignedBy` (em timeline ou na tabela de junção).
- Multi-serviço por incidente (além do “primaryService”).
- SLA/SLO por Service e severidade.
- Notificações por Team ou por Service (subscrições mais ricas).
- Soft delete (campos `deletedAt`) em entidades de catálogo como Category/Tag/Service.

---
