# `src/services/reports.ts`

## Overview
Integração do domínio **Reports**:
- KPIs (`/reports/kpis`)
- breakdown (`/reports/breakdown`)
- série temporal (`/reports/timeseries`)
- exportações (CSV/PDF) via `apiBlob()`

## Porque existe
- Mantém o contrato de relatórios num único local.
- Reutiliza filtros e builder de query param.
- Separa endpoints JSON de endpoints binários (Blob).

## Public API
- `ReportsAPI.kpis(filters: ReportsFilters): Promise<unknown>`
- `ReportsAPI.breakdown(input: ReportsFilters & { groupBy: ReportsGroupBy }): Promise<unknown>`
- `ReportsAPI.timeseries(input: { from?: string; to?: string; interval: ReportsInterval }): Promise<unknown>`
- `ReportsAPI.exportCsv(filters: ReportsFilters): Promise<Blob>`
- `ReportsAPI.exportPdf(filters: ReportsFilters & { incidentId?: string }): Promise<Blob>`

### Tipos
- `ReportsFilters` (`from`, `to`, `teamId`, `serviceId`, `severity`)
- `ReportsGroupBy` (`severity|team|service|category|assignee`)
- `ReportsInterval` (`day|week`)

## Data flow
- UI define filtros → `buildQuery()` → chama endpoint.
- JSON usa `api()`; downloads usam `apiBlob()`.

## Security & Access Control
- `auth:true` em todas as chamadas.
- Backend deve validar permissões para exportação de dados.

## Errors & edge cases
- Erros são lançados por `api()`/`apiBlob()`.
- `buildQuery()` ignora `undefined/null/""` para evitar query “suja”.

## Performance notes
- Exportações podem ser pesadas — usar filtros (`from/to/team/service`) quando possível.
- Para UI, considerar estados de loading e desabilitar botões durante export.

## Examples
### KPIs com intervalo temporal
```ts
import { ReportsAPI } from "./reports";

const kpis = await ReportsAPI.kpis({ from: "2025-01-01", to: "2025-01-31" });
```

### Export CSV
```ts
const csv = await ReportsAPI.exportCsv({ teamId: "t1" });
const url = URL.createObjectURL(csv);
```

## Testabilidade
- Mockar `api()` e `apiBlob()`.
- Testar `buildQuery()` para garantir que ignora valores vazios.
