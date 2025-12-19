# Reports Module (backend/src/reports)

Documentação técnica dos ficheiros do **módulo de Reports** (NestJS + Prisma) responsáveis por KPIs, breakdowns, séries temporais e exportação (CSV/PDF) de incidentes.

---

## Estrutura dos ficheiros

- `src/reports/dto/reports-breakdown.dto.ts`
- `src/reports/dto/reports-export-csv.dto.ts`
- `src/reports/dto/reports-export-pdf.dto.ts`
- `src/reports/dto/reports-kpis.dto.ts`
- `src/reports/dto/reports-timeseries.dto.ts`
- `src/reports/reports.controller.ts`
- `src/reports/reports.module.ts`
- `src/reports/reports.service.ts` *(serviço principal; inclui geração de PDF com PDFKit e export CSV)*

---

## Visão geral

O módulo `Reports` agrega **métricas e exportações** sobre incidentes, com:

- **KPIs** (abertos, resolvidos, fechados, MTTR avg/median/p90, SLA compliance)
- **Breakdown** (distribuições por severidade/status/equipa/serviço/categoria/assignee)
- **Timeseries** (contagens por dia ou semana)
- **Export CSV** com colunas operacionais (inclui MTTR + SLA alvo e SLA met)
- **Export PDF** em 2 modos:
  - **Relatório** (capa + KPIs + tendência + targets de SLA + quick stats + páginas por incidente)
  - **Incidente único** (PDF detalhado com timeline e comentários em 2 colunas)

Todos os endpoints estão protegidos por `AccessJwtGuard` no controller.

---

## Autorização e scoping

### Modelo de role (JWT)
O serviço espera um utilizador com o shape:

```ts
type JwtUserLike = {
  id?: string;
  sub?: string;
  userId?: string;
  email?: string;
  role?: Role | 'USER' | 'ADMIN' | undefined;
};
```

### Regras de escopo de equipa (Team Scope)
- **ADMIN**: pode consultar/exportar qualquer equipa (quando `teamId` é fornecido).
- **USER**: é automaticamente limitado à **sua equipa**.
  - Se o user tentar pedir `teamId` diferente → `ForbiddenException`
  - Se o user não tiver equipa → `ForbiddenException`

O scoping é aplicado por `resolveTeamScope()` e usado em KPIs/Breakdown/Timeseries/Exports.

### Export de incidente (PDF por `incidentId`)
Na exportação de **incidente único**, o serviço valida permissões com:

- `assertIncidentExportAllowed(role, scopedTeamId, incident.teamId)`

Isto bloqueia um user não-admin de exportar incidentes de outra equipa.

---

## DTOs

### `reports-breakdown.dto.ts`

Define:
- `ReportsGroupBy`: enum que controla a dimensão do agrupamento:
  - `severity | status | team | service | category | assignee`
- `ReportsBreakdownQueryDto`:
  - `groupBy` *(obrigatório)*
  - `from`, `to` *(strings; range opcional)*
  - `teamId`, `serviceId` *(opcionais)*
  - `severity` *(opcional; enum `Severity` do Prisma)*

Uso típico: `/reports/breakdown?groupBy=severity&from=...&to=...`

---

### `reports-export-csv.dto.ts`

`ReportsExportCsvQueryDto`:
- `from`, `to` *(strings; opcionais)*
- `lastDays` *(1..365; comentado como “default no service (30)”)*
- `teamId`, `serviceId`, `severity`
- `limit` *(1..10000)*

⚠️ Nota: no `ReportsService.exportCsv()` mostrado, o range é “lifetime” quando não há `from/to` e o `take` default é `5000` (máximo 10000 se `limit` vier). Se quiseres aplicar `lastDays` efetivamente, tens de o traduzir para `{from,to}` no controller/service.

---

### `reports-export-pdf.dto.ts`

`ReportsExportPdfQueryDto`:
- `from`, `to` *(ISO8601; opcionais)*
- `lastDays` *(1..365)*
- `teamId`, `serviceId`, `severity`
- `incidentId` *(opcional: quando presente gera PDF de incidente único)*

⚠️ Tal como no CSV: `lastDays` existe no DTO, mas a lógica efetiva no service depende de como chamas o `exportPdf()` (ou aplicas `lastDays` antes).

---

### `reports-kpis.dto.ts`

`ReportsKpisQueryDto`:
- `from`, `to` *(ISO8601; opcionais)*
- `teamId`, `serviceId`, `severity` *(opcionais)*

---

### `reports-timeseries.dto.ts`

Define:
- `ReportsInterval`: `day | week`
- `ReportsTimeseriesQueryDto`:
  - `from`, `to` *(ISO8601; opcionais)*
  - `teamId`, `serviceId`, `severity` *(opcionais)*
  - `interval` *(obrigatório)*

---

## Controller

### `reports.controller.ts`

Base route: `@Controller('reports')`

Proteção: `@UseGuards(AccessJwtGuard)` (todos os endpoints)

Endpoints:
- `GET /reports/kpis`
  - chama `reports.getKpis(q, req.user)`
- `GET /reports/breakdown`
  - chama `reports.getBreakdown(q, req.user)`
- `GET /reports/timeseries`
  - chama `reports.getTimeseries(q, req.user)`
- `GET /reports/export.csv`
  - chama `reports.exportCsv(q, req.user)`
  - define headers para download (`Content-Disposition`) e envia string CSV
- `GET /reports/export.pdf`
  - chama `reports.exportPdf(q, req.user)`
  - define headers e envia `Buffer` PDF

Utilitários internos do controller:
- `safePart()`: sanitiza strings para filename seguro
- `dateOnly()`: extrai `YYYY-MM-DD` para naming do ficheiro

---

## Module

### `reports.module.ts`

Regista:
- `ReportsController`
- `ReportsService`

> Nota: `ReportsService` depende de `PrismaService`. Se no teu projeto o `PrismaModule` é `@Global()`, não precisas importar. Caso contrário, adiciona `imports: [PrismaModule]`.

---

## Service

### `reports.service.ts` (núcleo)

Responsabilidades principais:

1) **Scoping e autorização**
- `getAuthUserId()` e `getAuthRole()`
- `resolveTeamScope()` limita queries por equipa para USER

2) **Resolução de range**
- `resolveRange()`:
  - sem `from/to` → modo **lifetime**
  - com `from/to` → modo **range**
- `resolveReportRangeAndLabels()`:
  - se lifetime: calcula `_min/_max createdAt` para gerar um range real para o gráfico diário

3) **Construção de filtros Prisma**
- `buildIncidentWhere()` constrói `Prisma.IncidentWhereInput` com:
  - `severity`, `teamId`, `serviceId`
  - `createdAt.gte/lte` quando `from/to` existe

4) **KPIs**
`getKpis()` retorna:
- `openCount`: incidentes em `OPEN_STATUSES`
- `resolvedCount`: `resolvedAt != null`
- `closedCount`: status `CLOSED`
- `mttrSeconds`: `avg`, `median`, `p90` (via SQL com `PERCENTILE_CONT`)
- `slaCompliancePct`: média de incidentes resolvidos dentro do SLA por severidade

SLA targets (segundos):
- SEV1: 45m
- SEV2: 2h
- SEV3: 8h
- SEV4: 24h

5) **Breakdown**
`getBreakdown()` usa `groupBy()` do Prisma ou `categoryOnIncident.groupBy()` e depois resolve labels (users/teams/services/categories).

6) **Timeseries**
`getTimeseries()` usa SQL com:
- `date_trunc('day' | 'week', createdAt)`
- `COUNT(*)`
- agrupa e ordena

7) **Export CSV**
`exportCsv()`:
- `take` default `5000` (ou min(`limit`, 10000))
- inclui:
  - reporter/assignee/team/service/categorias/tags
  - computa MTTR e SLA met por linha
- formato seguro de CSV via `csvCell()` (escapa aspas, vírgulas e newlines)

8) **Export PDF (PDFKit)**
`exportPdf()` decide:
- **Incidente único** quando `incidentId` existe → `exportSingleIncidentPdf()`
- **Relatório** quando não existe → `exportReportPdf()`

#### Geração do PDF (conceito)
- `pdfToBuffer()` cria documento A4 com margens e buffer de páginas
- adiciona header fixo “INCIDENT MANAGER” em todas as páginas
- layout:
  - **cards** (KPIs) com cor de destaque
  - **tendência** (line chart desenhado manualmente)
  - **incident page**: título + KPIs + (Detalhes | Descrição) em 2 colunas
  - **Timeline | Comentários** também em 2 colunas, com paginação inteligente

#### Paginação de texto (sem truncar)
Para descrições longas:
- tenta escrever o máximo possível na coluna direita
- se sobrar texto, continua em full-width com `writeTextPaged()`

9) **Audit / Integridade (PDF de incidente único)**
Se `AUDIT_HMAC_SECRET` estiver definido:
- valida `auditHash` atual do incidente contra `computeIncidentAuditHash()`
- se mismatch:
  - cria evento de timeline (`FIELD_UPDATE`) com alerta
  - lança `ConflictException` e bloqueia export

---

## Variáveis de ambiente (relevantes)

- `AUDIT_HMAC_SECRET`
  - ativa validação de integridade do incidente na exportação PDF (incidente único)

---

## Notas de qualidade e limites

- **Cap de PDF report**: `take: 200` incidentes para não explodir o tamanho do PDF.
- **Cap de CSV**: default `5000` linhas (até `10000` via `limit`).
- Para datasets muito grandes, recomenda-se paginação server-side e exports assíncronos (job queue), mas este design é ótimo para projetos académicos / MVP.

---

## Exemplos de chamadas

### KPIs (range manual)
```http
GET /api/reports/kpis?from=2025-11-01T00:00:00.000Z&to=2025-12-01T23:59:59.999Z
Authorization: Bearer <token>
```

### Breakdown por severidade
```http
GET /api/reports/breakdown?groupBy=severity&from=2025-12-01T00:00:00.000Z&to=2025-12-18T23:59:59.999Z
Authorization: Bearer <token>
```

### Timeseries diário
```http
GET /api/reports/timeseries?interval=day&from=2025-12-01T00:00:00.000Z&to=2025-12-18T23:59:59.999Z
Authorization: Bearer <token>
```

### Export CSV
```http
GET /api/reports/export.csv?teamId=<TEAM_ID>&limit=5000
Authorization: Bearer <token>
```

### Export PDF (incidente único)
```http
GET /api/reports/export.pdf?incidentId=<INCIDENT_ID>
Authorization: Bearer <token>
```

---

## Checklist rápido (se algo “não aparece”)

Se o frontend “não mostra tudo” ou export “não bate certo”, confirma:

- Estás a passar `from/to`? Se não, **é lifetime** e pode puxar muita coisa (mas com caps: 200 PDF / 5000 CSV).
- `teamId` está a ser filtrado sem quereres (user scope)?
- `serviceId` no filtro é `primaryServiceId` (ID) — se tens “key”, tens de resolver key→id antes.
- A seed criou incidentes com `createdAt` fora do range?
- `limit` e caps (200/5000) estão a cortar o output.
- PDF de incidente único pode falhar por audit hash mismatch (se `AUDIT_HMAC_SECRET` estiver ativo).

---

**Fim.**
