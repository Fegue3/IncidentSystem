import { api, apiBlob } from "./api";

export type SeverityCode = "SEV1" | "SEV2" | "SEV3" | "SEV4";

export type ReportsGroupBy = "severity" | "team" | "service" | "category" | "assignee";
export type ReportsInterval = "day" | "week";

export type ReportsFilters = {
  from?: string;
  to?: string;
  teamId?: string;
  serviceId?: string;
  severity?: SeverityCode;
};

function buildQuery(params: Record<string, any>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const ReportsAPI = {
  kpis: (filters: ReportsFilters) =>
    api(`/reports/kpis${buildQuery(filters)}`, { auth: true }),

  breakdown: (input: ReportsFilters & { groupBy: ReportsGroupBy }) =>
    api(`/reports/breakdown${buildQuery(input)}`, { auth: true }),

  timeseries: (input: { from?: string; to?: string; interval: ReportsInterval }) =>
    api(`/reports/timeseries${buildQuery(input)}`, { auth: true }),

  exportCsv: (filters: ReportsFilters) =>
    apiBlob(`/reports/export.csv${buildQuery(filters)}`, { method: "GET", auth: true }),

  exportPdf: (filters: ReportsFilters & { incidentId?: string }) =>
    apiBlob(`/reports/export.pdf${buildQuery(filters)}`, { method: "GET", auth: true }),
};
