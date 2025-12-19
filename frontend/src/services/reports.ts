/**
 * @file reports.ts
 * @module services/reports
 *
 * @summary
 *  - API client para relatórios (KPIs, breakdown, time series) e exportações CSV/PDF.
 *
 * @description
 *  - Centraliza chamadas a `/reports/*`.
 *  - Inclui helper de query string que ignora valores vazios/undefined.
 *
 * @dependencies
 *  - `api()` para JSON.
 *  - `apiBlob()` para downloads (CSV/PDF).
 *
 * @security
 *  - Todas as chamadas são autenticadas (`auth:true`).
 *
 * @errors
 *  - Erros HTTP resultam em `Error` lançado por `api()` / `apiBlob()`.
 *
 * @performance
 *  - Filtros via query reduzem carga no backend (from/to/team/service/severity).
 */

import { api, apiBlob } from "./api";

/** Severidade (alinhada com backend). */
export type SeverityCode = "SEV1" | "SEV2" | "SEV3" | "SEV4";

/** Dimensões possíveis para breakdown (alinhado com o backend). */
export type ReportsGroupBy =
  | "severity"
  | "team"
  | "service"
  | "category"
  | "assignee";

/** Intervalo temporal para séries temporais. */
export type ReportsInterval = "day" | "week";

/**
 * Filtros base usados em relatórios.
 *
 * @notes
 * - `from` e `to` tipicamente são datas ISO (YYYY-MM-DD).
 * - `teamId`/`serviceId` filtram o universo analisado.
 */
export type ReportsFilters = {
  from?: string;
  to?: string;
  teamId?: string;
  serviceId?: string;
  severity?: SeverityCode;
};

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

/**
 * Constrói query string ignorando undefined/null/"".
 *
 * @param params Mapa de query params.
 * @returns Query string (`?a=1&b=2`) ou "".
 */
function buildQuery(params: QueryParams): string {
  const qs = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }

  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * API client de relatórios.
 *
 * @notes
 * - `exportCsv` e `exportPdf` devolvem Blob para download.
 */
export const ReportsAPI = {
  /**
   * Obtém KPIs agregados (ex.: total incidentes, por status, etc.).
   *
   * @param filters Filtros opcionais.
   * @returns JSON do backend (estrutura depende do contrato).
   */
  kpis: (filters: ReportsFilters) =>
    api(`/reports/kpis${buildQuery(filters)}`, { auth: true }),

  /**
   * Obtém breakdown agregando por uma dimensão (severity/team/service/...).
   *
   * @param input Filtros + `groupBy`.
   * @returns JSON do backend.
   */
  breakdown: (input: ReportsFilters & { groupBy: ReportsGroupBy }) =>
    api(`/reports/breakdown${buildQuery(input)}`, { auth: true }),

  /**
   * Obtém série temporal agregada por `interval`.
   *
   * @param input Intervalo e datas opcionais.
   * @returns JSON do backend.
   */
  timeseries: (input: { from?: string; to?: string; interval: ReportsInterval }) =>
    api(`/reports/timeseries${buildQuery(input)}`, { auth: true }),

  /**
   * Exporta CSV (download).
   *
   * @param filters Filtros opcionais.
   * @returns Blob (CSV).
   */
  exportCsv: (filters: ReportsFilters) =>
    apiBlob(`/reports/export.csv${buildQuery(filters)}`, {
      method: "GET",
      auth: true,
    }),

  /**
   * Exporta PDF (download).
   *
   * @param filters Filtros + opcional `incidentId` (quando o backend suporta PDF por incidente).
   * @returns Blob (PDF).
   */
  exportPdf: (filters: ReportsFilters & { incidentId?: string }) =>
    apiBlob(`/reports/export.pdf${buildQuery(filters)}`, {
      method: "GET",
      auth: true,
    }),
};
