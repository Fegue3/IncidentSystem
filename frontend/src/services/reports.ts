import { api, getAuth, setAuth, clearAuth } from "./api";
import type { SeverityCode } from "./incidents";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString() ?? "http://localhost:3000/api";

export type ReportsGroupBy = "severity" | "status" | "team" | "service" | "category";
export type ReportsInterval = "day" | "week";

export type ReportsKpis = {
  openCount: number;
  resolvedCount: number;
  closedCount: number;
  mttrSeconds: { avg: number | null; median: number | null; p90: number | null };
  slaCompliancePct: number | null;
};

export type BreakdownItem = { key: string; label: string; count: number };
export type TimeseriesPoint = { date: string; count: number };

export type ReportsFilters = {
  from?: string; // ISO string ou YYYY-MM-DD
  to?: string; // ISO string ou YYYY-MM-DD
  teamId?: string;
  serviceId?: string;
  severity?: SeverityCode;
};

function buildQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function fetchWithAuth(path: string): Promise<Response> {
  const auth = getAuth();
  const headers: Record<string, string> = {};
  if (auth?.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`;

  let res = await fetch(`${API_BASE}${path}`, { headers });

  // tenta refresh 1x (igual ao api.ts faz)
  if (res.status === 401 && auth?.refreshToken) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setAuth(data.accessToken, data.refreshToken);
      const auth2 = getAuth();
      const headers2: Record<string, string> = {};
      if (auth2?.accessToken) headers2.Authorization = `Bearer ${auth2.accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { headers: headers2 });
    } else {
      clearAuth();
    }
  }

  return res;
}

export const ReportsAPI = {
  async kpis(filters: ReportsFilters): Promise<ReportsKpis> {
    return api<ReportsKpis>(
      `/reports/kpis${buildQuery({
        from: filters.from,
        to: filters.to,
        teamId: filters.teamId,
        serviceId: filters.serviceId,
        severity: filters.severity,
      })}`
    );
  },

  async breakdown(input: ReportsFilters & { groupBy: ReportsGroupBy }): Promise<BreakdownItem[]> {
    return api<BreakdownItem[]>(
      `/reports/breakdown${buildQuery({
        groupBy: input.groupBy,
        from: input.from,
        to: input.to,
        teamId: input.teamId,
        serviceId: input.serviceId,
        severity: input.severity,
      })}`
    );
  },

  async timeseries(input: { interval: ReportsInterval } & Pick<ReportsFilters, "from" | "to">) {
    return api<TimeseriesPoint[]>(
      `/reports/timeseries${buildQuery({
        interval: input.interval,
        from: input.from,
        to: input.to,
      })}`
    );
  },

  async exportCsv(filters: ReportsFilters): Promise<Blob> {
    const res = await fetchWithAuth(
      `/reports/export.csv${buildQuery({
        from: filters.from,
        to: filters.to,
        teamId: filters.teamId,
        serviceId: filters.serviceId,
        severity: filters.severity,
      })}`
    );
    if (!res.ok) throw new Error(`Export CSV falhou: ${res.status}`);
    return res.blob();
  },

  async exportPdf(filters: ReportsFilters): Promise<Blob> {
    const res = await fetchWithAuth(
      `/reports/export.pdf${buildQuery({
        from: filters.from,
        to: filters.to,
        teamId: filters.teamId,
        serviceId: filters.serviceId,
        severity: filters.severity,
      })}`
    );
    if (!res.ok) throw new Error(`Export PDF falhou: ${res.status}`);
    return res.blob();
  },
};