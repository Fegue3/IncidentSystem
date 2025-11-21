# Incident Management System — Lógica de Incidentes

Este documento descreve a lógica de negócio dos **incidentes** no Incident Management System (IMS), alinhada com:

- Personas (IT Ops Manager, Analista NOC, SRE/DevOps, Service Desk, Compliance)
- User Stories (painel 360º, abertura a partir de alertas, status page, export de evidências)
- Cenários unificados (Netwave, integrações com Prometheus/Datadog/PagerDuty, etc.)
- Design System e Interactions (workflow `Open → Investigating → Resolved`, timeline, etc.)

---

## 1. Entidades principais

### 1.1 User & Role

- `User`
  - Campos principais: `id`, `email`, `name`, `password`, `role`.
  - Relacionamentos:
    - `incidents` (como `reporter`)
    - `assigned` (como `assignee`)
    - `teams` (equipas a que pertence)
    - `timelineAuthored` (eventos de timeline que criou)
    - `comments` (comentários em incidentes)

- `Role` (perspetiva de negócio)
  - **User normal** (analista NOC, SRE on-call, Service Desk…)
    - Cria incidentes.
    - Vê incidentes:
      - que reportou
      - da(s) equipa(s) a que pertence
      - que lhe estão atribuídos (`assignee`).
    - Pode assumir incidentes e alterar estado se for responsável.
  - **Admin**
    - Vê todos os incidentes e equipas.
    - Pode reatribuir incidentes (equipa/assignee).
    - Pode corrigir estados/dados e aceder a vistas globais.

### 1.2 Team

- `Team`
  - Representa uma equipa operacional (NOC, SRE, Service Desk, etc.).
  - Campos: `id`, `name`.
  - Relações:
    - `members` → utilizadores que pertencem à equipa.
    - `incidents` → incidentes de que esta equipa é responsável.

### 1.3 Incident

- `Incident`
  - Campos principais:
    - `id`, `title`, `description`
    - `status: IncidentStatus`
    - `priority: Priority` (corresponde ao conceito de SEV/Severidade das user stories)
    - `reporterId` / `reporter`
    - `assigneeId` / `assignee` (responsável atual)
    - `teamId` / `team` (equipa responsável)
    - `triagedAt`, `inProgressAt`, `resolvedAt`, `closedAt` (timestamps para métricas)
    - `createdAt`, `updatedAt`
  - Relações:
    - `categories` (`CategoryOnIncident`)
    - `tags` (`Tag[]`)
    - `timeline` (`IncidentTimelineEvent[]`)
    - `comments` (`IncidentComment[]`)
    - `sources` (`IncidentSource[]`)
    - `subscriptions` (`NotificationSubscription[]`)

### 1.4 Timeline & Comentários

- `IncidentTimelineEvent`
  - Regista todas as alterações relevantes a um incidente.
  - Campos:
    - `type: TimelineEventType` (STATUS_CHANGE, COMMENT, ASSIGNMENT, FIELD_UPDATE)
    - `fromStatus`, `toStatus` (para mudanças de estado)
    - `authorId` (quem fez a ação)
    - `message` (texto livre, ex: motivo da mudança, nota de status page)
    - `createdAt`

- `IncidentComment`
  - Comentários “normais” dos utilizadores (discussão técnica, updates).
  - Também são refletidos na timeline via eventos do tipo `COMMENT`.

### 1.5 Integrações

- `IntegrationSource` e `IncidentSource`
  - Permitem registar **de onde veio o incidente** (Datadog, Prometheus, PagerDuty, etc.).
  - Suportam o cenário de “abertura a partir de alerta” descrito nas user stories.

---

## 2. Visibilidade de incidentes

### 2.1 User normal

Um utilizador normal vê, por defeito:

1. Incidentes que **reportou**  
   `incident.reporterId = currentUser.id`

2. Incidentes das **equipas a que pertence**  
   `incident.teamId` ∈ equipas do utilizador

3. Incidentes em que é **assignee** (responsável atual)  
   `incident.assigneeId = currentUser.id`

Isto suporta vistas como:

- “Incidentes da minha equipa”
- “Incidentes atribuídos a mim”
- “Incidentes que reportei”

### 2.2 Admin

O `Admin` vê:

- **Todos os incidentes de todas as equipas**, com filtros opcionais por:
  - equipa (`teamId`)
  - estado (`status`)
  - severidade/prioridade (`priority`)
  - datas, etc.

Este papel suporta o “Painel 360º” da persona Marta (IT Ops Manager).

---

## 3. Ciclo de vida do incidente

Os estados técnicos no schema:

```prisma
enum IncidentStatus {
  NEW
  TRIAGED
  IN_PROGRESS
  ON_HOLD
  RESOLVED
  CLOSED
  REOPENED
}
```

No design system, o board é apresentado como:

- **Open → Investigating → Resolved**

A correspondência é:

- **Open**
  - `NEW`
  - `TRIAGED`
- **Investigating**
  - `IN_PROGRESS`
  - `ON_HOLD`
- **Resolved**
  - `RESOLVED`
  - `CLOSED`
  - `REOPENED` (quando volta a abrir depois de fechado)

### 3.1 Criação de incidente

Pode acontecer:

- Manualmente (por um utilizador, ex: Rui – Analista NOC).
- Automaticamente a partir de um alerta (via `IncidentSource` integrado com Prometheus/Datadog).

Regras na criação:

- `reporterId = currentUser.id`
- `teamId` deve ser definido:
  - escolhido pelo utilizador no formulário
  - ou inferido (ex: se o user só tem uma equipa)
- `assigneeId = null` (por defeito, ainda ninguém assumiu)
- `status = NEW`
- Cria-se um evento de timeline:
  - `type = STATUS_CHANGE`
  - `fromStatus = null`
  - `toStatus = NEW`
  - `message = "Incidente criado"` (ou equivalente)

### 3.2 Triagem (`NEW` → `TRIAGED`)

Objetivo:

- Confirmar que o problema é real.
- Ajustar prioridade/severidade (P1–P4 / SEV1–SEV4).
- Verificar se a equipa responsável (`teamId`) está correta.

Regras:

- Pode ser feita por membros da equipa responsável ou por Admin.
- Timeline:
  - `STATUS_CHANGE` de `NEW` para `TRIAGED`
  - `message` com nota de triagem (opcional).

### 3.3 Atribuição de responsável (assignee)

Depois de triage:

- Um membro da equipa assume o incidente:
  - `assigneeId = currentUser.id`
- Opcionalmente, um admin pode reatribuir a outro membro.

Regras:

- Um incidente sem `assignee` é mostrado como “Sem owner”.
- Só utilizadores da equipa/administradores podem ser assignee (dependendo da política).

Timeline:

- Evento `ASSIGNMENT` sempre que se altera `assigneeId` ou `teamId`.

### 3.4 Investigação (`TRIAGED` → `IN_PROGRESS` / `ON_HOLD`)

Quando o assignee começa a trabalhar:

- `status: TRIAGED → IN_PROGRESS`
- `inProgressAt` é preenchido.
- Pode alternar entre:
  - `IN_PROGRESS`
  - `ON_HOLD` (bloqueado à espera de terceiros, aprovações, outros sistemas, etc.)

Regras:

- **Só o assignee ou Admin** podem fazer estas transições.
- Timeline:
  - `STATUS_CHANGE` com `fromStatus` / `toStatus` e `message`.

### 3.5 Resolução (`IN_PROGRESS` → `RESOLVED`)

Quando o assignee considera o problema resolvido:

- `status: IN_PROGRESS → RESOLVED`
- `resolvedAt` preenchido.
- A timeline deve capturar:
  - resumo da correção
  - links para PRs, deploys, etc. (via `message` ou campos adicionais no futuro)

### 3.6 Fecho (`RESOLVED` → `CLOSED`)

Depois de verificação (pela equipa, Service Desk ou IT Ops):

- `status: RESOLVED → CLOSED`
- `closedAt` preenchido.

Este passo liga-se à persona Marta (IT Ops Manager) e Sofia (Compliance), porque:

- “CLOSED” é o estado que entra em relatórios, KPI de MTTR, etc.
- A timeline serve de evidência para auditorias.

### 3.7 Reabertura (`CLOSED` → `REOPENED`)

Se o problema regressar:

- `status: CLOSED → REOPENED`
- Pode ser iniciada por:
  - reporter
  - assignee anterior
  - admin

Depois da reabertura, o ciclo volta a seguir via `IN_PROGRESS`, etc.

---

## 4. Regras de permissões por ação

### 4.1 Editar campos base (título, descrição, prioridade, equipa)

- **Reporter**
  - Pode editar enquanto o incidente está em estados iniciais (ex: `NEW`, `TRIAGED`).
  - Serve para clarificar o problema.

- **Assignee**
  - Pode editar durante estados ativos (`TRIAGED`, `IN_PROGRESS`, `ON_HOLD`, `RESOLVED`).
  - Ajusta descrição técnica, notas, prioridade.

- **Admin**
  - Pode editar sempre.

### 4.2 Mudar estado

- **Triagem** (`NEW → TRIAGED`):
  - Membros da equipa ou Admin.

- **Investigação** (`TRIAGED → IN_PROGRESS`, `ON_HOLD`, etc.):
  - Assignee ou Admin.

- **Resolução** (`IN_PROGRESS → RESOLVED`):
  - Assignee ou Admin.

- **Fecho** (`RESOLVED → CLOSED`):
  - Tipicamente Admin, IT Ops Manager ou papel equivalente.

- **Reabertura** (`CLOSED → REOPENED`):
  - Reporter, assignee ou Admin (dependendo da política final).

Em todas as transições:
- é criado um evento `STATUS_CHANGE` na timeline;
- a UI pode pedir uma mensagem (`message`) obrigatória para SEV1/SEV2, alinhado com user stories de comunicação.

### 4.3 Atribuir incidente (`assigneeId` / `teamId`)

- Assignee (self-assign) ou Admin (atribuir a outros/para outras equipas).
- Mudanças de equipa (`teamId`) afetam quem vê o incidente por defeito.
- Registadas sempre como `ASSIGNMENT` na timeline.

### 4.4 Comentários

- Qualquer utilizador com acesso ao incidente:
  - Reporter
  - Membros da equipa responsável
  - Assignee
  - Admin

Cada comentário:
- cria um `IncidentComment`
- gera um evento `COMMENT` na timeline.

---

## 5. Relação com Personas & User Stories

- **Marta — IT Operations Manager**
  - Painel 360º → vista agregada de incidentes por severidade/impacto/estado.
  - Usa `Priority`, `status`, `teamId` e métricas (`triagedAt`, `resolvedAt`, etc.).
  - KPIs: MTTR, incidentes SEV1/SEV2, post-mortems, etc.

- **Rui — Analista NOC**
  - Criação a partir de alerta → suporte via `IncidentSource` + criação rápida.
  - Triagem inicial (`NEW → TRIAGED`), confirmação de severidade, acionamento de on-call.

- **Ana — SRE / DevOps**
  - Chega com contexto pronto no incidente (logs, links, etc.).
  - Trabalha em `IN_PROGRESS`, muda estados, documenta na timeline.

- **Daniel — Service Desk**
  - Usa o incidente para responder a clientes, atualizar status page.
  - Comentários e timeline servem como histórico oficial.

- **Sofia — Compliance & Risk**
  - Usa `IncidentTimelineEvent` + comentários para export de evidências.
  - Estados e timestamps permitem provar cumprimento de SLAs e CAPAs.

---

## 6. Integrações & Automação (futuro)

O schema já prevê integração com:

- Monitorização (Prometheus, Datadog, etc.) → `IntegrationSource`, `IncidentSource`.
- Notificações on-call (PagerDuty).
- Canais de comunicação (Slack/Discord), status page, etc.

A lógica de incidentes descrita aqui é compatível com estes cenários:

- Criação automática de incidentes com dados do alerta.
- Atualização automática de timeline (ex: quando se envia update para status page).
- Export de timeline e CAPAs para auditoria.

