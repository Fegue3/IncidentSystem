# ReportsPage (pages/Reports/ReportsPage.tsx)

**Rota:** `/reports`

## Responsabilidade única
Relatórios e métricas: KPIs, breakdown, série temporal e exportações (CSV/PDF).

## UI/UX
- Header com ações (mostrar filtros, exportar CSV, exportar PDF).
- Filtros opcionais (por defeito: lifetime).
- KPIs (abertos/resolvidos/fechados, MTTR, SLA).
- Breakdown (top 10).
- Gráfico de tendência (AreaChart/Recharts).
- Histórico com botão de exportar PDF por incidente.

## Estado local (principais)
- Filtros (`from`, `to`, `teamId`, `serviceId`, `severity`, `groupBy`, `interval`).
- Dados (`kpis`, `breakdown`, `series`, `history`).
- UI state (`loading`, `err`, `showFilters`).
- Listas auxiliares (`teams`, `services`).

## APIs consumidas
- `ReportsAPI.kpis(filters)`
- `ReportsAPI.breakdown({ ...filters, groupBy })`
- `ReportsAPI.timeseries({ ...filters, interval })`
- `ReportsAPI.exportCsv(filters)` e `ReportsAPI.exportPdf(filters)`
- `IncidentsAPI.list({ teamId, primaryServiceId, severity })` para histórico

## Dependências
- `recharts` (AreaChart, ResponsiveContainer, etc.).
- Services: ReportsAPI, TeamsAPI, ServicesAPI, IncidentsAPI.
- CSS: `ReportsPage.css`.

## Regras/validações
- Filtro de datas usa ISO UTC (from: 00:00:00.000, to: 23:59:59.999).
- Histórico também é filtrado no frontend (refina a lista recebida).
- Nome de ficheiro para export usa `safeFilename()` e `rangeLabel()`.

## Erros e estados vazios
- Se um endpoint falhar, mostra `err` sem bloquear a página inteira.
- Estados vazios: 'Sem dados' para KPI/breakdown/série/histórico.

## Segurança e permissões
- Exportações usam `apiBlob` (mantém auth headers e refresh automático).

## Performance
- `loadAll()` faz chamadas em paralelo via `Promise.all`.
- Breakdown é truncado para top 10 no UI.

## Testabilidade
- Unit: `toRangeIso`, `secondsToHuman`, `safeFilename`.
- Integration: mock dos endpoints de ReportsAPI e valida render dos blocos.

## Notas
- Evitar `any`: tipar respostas de KPI/Breakdown/Series com interfaces/DTOs alinhados com o backend.
