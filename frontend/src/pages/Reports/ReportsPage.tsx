/**
 * @file ReportsPage.tsx
 * @module pages/Reports/ReportsPage
 *
 * @summary
 *  - Página de relatórios: KPIs, breakdown, tendência (timeseries) e exportações (CSV/PDF),
 *    incluindo PDF por incidente a partir do histórico.
 *
 * @description
 *  - Responsabilidades principais:
 *    - Carregar e mostrar KPIs (`/reports/kpis`)
 *    - Carregar e mostrar breakdown (`/reports/breakdown`) com `groupBy`
 *    - Carregar e mostrar tendência (`/reports/timeseries`) com `interval`
 *    - Carregar histórico de incidentes (`/incidents`) para tabela + export PDF por incidente
 *    - Aplicar filtros (data, equipa, serviço, severidade) e exportações
 *
 * @dependencies
 *  - `recharts`: gráficos (AreaChart)
 *  - `ReportsAPI`: KPIs, breakdown, timeseries, export CSV/PDF
 *  - `TeamsAPI`: equipas do utilizador (para filtro)
 *  - `ServicesAPI`: serviços (para filtro)
 *  - `IncidentsAPI`: histórico (para tabela e export por incidente)
 *
 * @security
 *  - As chamadas são autenticadas via services (`api/auth` no wrapper). O backend valida permissões.
 *
 * @errors
 *  - Erros de IO são apresentados em `err` e renderizados no UI.
 *
 * @performance
 *  - `loadAll()` faz `Promise.all` para carregar datasets em paralelo.
 *  - `useMemo` para filtros e histórico filtrado.
 */


import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./ReportsPage.css";
import {
  ReportsAPI,
  type ReportsFilters,
  type ReportsGroupBy,
  type ReportsInterval,
} from "../../services/reports";
import { TeamsAPI } from "../../services/teams";
import { ServicesAPI, type ServiceLite } from "../../services/services";
import {
  IncidentsAPI,
  type IncidentSummary,
  type SeverityCode,
  getSeverityLabel,
} from "../../services/incidents";

/* ----------------------------- Tipos locais ----------------------------- */

type TeamOption = { id: string; name: string };
type ServiceOption = { id: string; name: string };

type ReportsKpis = {
  openCount: number;
  resolvedCount: number;
  closedCount: number;
  mttrSeconds?: {
    avg: number | null;
    median: number | null;
    p90: number | null;
  } | null;
  slaCompliancePct?: number | null;
};

type ReportsBreakdownItem = {
  key: string;
  label: string;
  count: number;
};

type ReportsTimeseriesPoint = {
  date: string; // ISO date string
  count: number;
};

/* ----------------------------- Helpers locais ---------------------------- */

/**
 * Converte Date para string `YYYY-MM-DD` (para inputs type="date").
 */
function toISODateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Converte datas do input `date` para ISO range completo.
 * - `fromDate` -> `T00:00:00.000Z`
 * - `toDate` -> `T23:59:59.999Z`
 */
function toRangeIso(fromDate: string, toDate: string): {
  fromIso?: string;
  toIso?: string;
} {
  const fromIso = fromDate
    ? new Date(`${fromDate}T00:00:00.000`).toISOString()
    : undefined;

  const toIso = toDate
    ? new Date(`${toDate}T23:59:59.999`).toISOString()
    : undefined;

  return { fromIso, toIso };
}

/**
 * Converte segundos (ex.: MTTR) para string humana.
 */
function secondsToHuman(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const mins = s / 60;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hours = mins / 60;
  return `${hours.toFixed(1)} h`;
}

/**
 * Sanitiza texto para usar em filenames.
 */
function safeFilename(name: string): string {
  return name
    .trim()
    .slice(0, 60)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * Trigger de download de um Blob no browser.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Extrai mensagem “humana” de um erro desconhecido.
 */
function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;

  if (typeof e === "object" && e !== null && "message" in e) {
    const msg = (e as Record<string, unknown>).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.map(String).join(", ");
    return String(msg);
  }

  return fallback;
}

/**
 * Permite tolerar respostas `{ items: [...] }` ou `[...]` sem usar `any`.
 */
function extractItemsArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
  }

  return [];
}

/* ----------------------------- Guards de select -------------------------- */

const SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4"] as const;
function isSeverityCode(v: string): v is SeverityCode {
  return (SEVERITIES as readonly string[]).includes(v);
}

const GROUP_BYS = ["severity", "team", "service", "category", "assignee"] as const;
function isReportsGroupBy(v: string): v is ReportsGroupBy {
  return (GROUP_BYS as readonly string[]).includes(v);
}

const INTERVALS = ["day", "week"] as const;
function isReportsInterval(v: string): v is ReportsInterval {
  return (INTERVALS as readonly string[]).includes(v);
}

/* ------------------------------------------------------------------------ */

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);

  // default: LIFETIME (vazio = sem range)
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [teamId, setTeamId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [severity, setSeverity] = useState<SeverityCode | "">("");

  const [groupBy, setGroupBy] = useState<ReportsGroupBy>("severity");
  const [interval, setInterval] = useState<ReportsInterval>("day");

  const [kpis, setKpis] = useState<ReportsKpis | null>(null);
  const [breakdown, setBreakdown] = useState<ReportsBreakdownItem[]>([]);
  const [series, setSeries] = useState<ReportsTimeseriesPoint[]>([]);
  const [history, setHistory] = useState<IncidentSummary[]>([]);

  /**
   * Define range para os últimos N dias (inclui hoje).
   */
  function setLastDays(days: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - (days - 1));
    setFrom(toISODateOnly(f));
    setTo(toISODateOnly(t));
  }

  /**
   * Remove range (lifetime).
   */
  function setLifetime() {
    setFrom("");
    setTo("");
  }

  /**
   * Limpa filtros e recarrega resultados sem filtros.
   */
  function clearFilters() {
    setFrom("");
    setTo("");
    setTeamId("");
    setServiceId("");
    setSeverity("");

    // Se quiseres que isto NÃO resete estes 2, remove as linhas abaixo.
    setGroupBy("severity");
    setInterval("day");

    void loadAll({
      from: undefined,
      to: undefined,
      teamId: undefined,
      serviceId: undefined,
      severity: undefined,
    });
  }

  /**
   * Filtros normalizados para o formato esperado pelo ReportsAPI.
   * - `from/to`: ISO completo (ou undefined)
   * - `teamId/serviceId/severity`: undefined quando vazios
   */
  const filters = useMemo<ReportsFilters>(() => {
    const { fromIso, toIso } = toRangeIso(from, to);

    const sev: SeverityCode | undefined = severity ? severity : undefined;

    return {
      from: fromIso,
      to: toIso,
      teamId: teamId || undefined,
      serviceId: serviceId || undefined,
      severity: sev,
    };
  }, [from, to, teamId, serviceId, severity]);

  /**
   * Histórico filtrado localmente por data (para tabela).
   * (Mesmo que o backend não aplique from/to ao endpoint de incidents.)
   */
  const filteredHistory = useMemo(() => {
    const { fromIso, toIso } = toRangeIso(from, to);
    const fromTs = fromIso ? new Date(fromIso).getTime() : null;
    const toTs = toIso ? new Date(toIso).getTime() : null;

    return history.filter((inc) => {
      const t = new Date(inc.createdAt).getTime();
      if (fromTs !== null && t < fromTs) return false;
      if (toTs !== null && t > toTs) return false;
      return true;
    });
  }, [history, from, to]);

  /**
   * Carrega todos os datasets do ecrã em paralelo:
   * - KPIs
   * - breakdown
   * - timeseries
   * - histórico de incidentes (para a tabela)
   *
   * @param overrideFilters Opcional: filtros explícitos para esta execução.
   */
  async function loadAll(
    overrideFilters?: Partial<ReportsFilters> & { severity?: SeverityCode },
  ) {
    setLoading(true);
    setErr(null);

    try {
      const f: ReportsFilters = {
        ...filters,
        ...overrideFilters,
      };

      // Para a tabela de histórico, usamos o endpoint de incidents com filtros equivalentes.
      const listParams = {
        teamId: f.teamId,
        primaryServiceId: f.serviceId,
        severity: f.severity,
      };

      const [k, b, s, h] = await Promise.all([
        ReportsAPI.kpis(f) as Promise<unknown>,
        ReportsAPI.breakdown({ ...f, groupBy }) as Promise<unknown>,
        ReportsAPI.timeseries({ ...f, interval }) as Promise<unknown>,
        IncidentsAPI.list(listParams),
      ]);

      setKpis(k as ReportsKpis);
      setBreakdown(extractItemsArray<ReportsBreakdownItem>(b));
      setSeries(extractItemsArray<ReportsTimeseriesPoint>(s));

      setHistory(
        h.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Erro ao carregar relatórios"));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Inicialização:
   * - carrega opções de filtros (equipas/serviços)
   * - carrega os dados do dashboard
   */
  useEffect(() => {
    (async () => {
      try {
        const [t, svcs] = await Promise.all([
          TeamsAPI.listMine() as Promise<unknown>,
          ServicesAPI.list() as Promise<unknown>,
        ]);

        const teamList = extractItemsArray<TeamOption>(t).map((x) => ({
          id: x.id,
          name: x.name,
        }));

        const serviceList = extractItemsArray<ServiceLite>(svcs).map((x) => ({
          id: x.id,
          name: x.name,
        }));

        setTeams(teamList);
        setServices(serviceList);
      } catch {
        // não bloqueia a página
      }

      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Rótulo para downloads baseado no intervalo selecionado.
   */
  function rangeLabel() {
    if (from && to) return `${from}_a_${to}`;
    if (from && !to) return `${from}_a_hoje`;
    if (!from && to) return `inicio_a_${to}`;
    return "lifetime";
  }

  /**
   * Exporta CSV do relatório (aplica filtros atuais).
   */
  async function onExportCsv() {
    try {
      const blob = await ReportsAPI.exportCsv(filters);
      downloadBlob(blob, `relatorio-incidentes_${rangeLabel()}.csv`);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Falha ao exportar CSV"));
    }
  }

  /**
   * Exporta PDF do relatório (aplica filtros atuais).
   */
  async function onExportPdf() {
    try {
      const blob = await ReportsAPI.exportPdf(filters);
      downloadBlob(blob, `relatorio-incidentes_${rangeLabel()}.pdf`);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Falha ao exportar PDF"));
    }
  }

  /**
   * Exporta PDF completo de um incidente (detalhes + timeline).
   */
  async function onExportIncidentPdf(incidentId: string, title: string) {
    try {
      const blob = await ReportsAPI.exportPdf({ incidentId });
      downloadBlob(blob, `incidente_${safeFilename(title)}_${incidentId.slice(0, 8)}.pdf`);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Falha ao exportar PDF do incidente"));
    }
  }

  /**
   * Heurística para aplicar estilo de erro na mensagem global (quando aplicável).
   * (Ideal: distinguir estado success/error explicitamente.)
   */
  const hasError = !!err;

  return (
    <div className="reports">
      <header className="reports__header">
        <div className="reports__eyebrow">Incident Manager</div>

        <div className="reports__headerRow">
          <div>
            <h1 className="reports__title">Relatórios e Métricas</h1>
            <p className="reports__subtitle">
              KPIs, tendências e exportações. O PDF por incidente inclui detalhes + timeline.
              <br />
              <span style={{ color: "#6b7280" }}>
                Dica: se deixares <b>De</b> e <b>Até</b> vazios, é <b>lifetime</b>.
              </span>
            </p>
          </div>

          <div className="reports__headerActions">
            <button
              className="btn btn--secondary"
              type="button"
              onClick={() => setShowFilters((v) => !v)}
            >
              {showFilters ? "Esconder filtros" : "Mostrar filtros"}
            </button>

            <button className="btn btn--secondary" type="button" onClick={onExportCsv}>
              Exportar CSV
            </button>

            <button className="btn btn--primary" type="button" onClick={onExportPdf}>
              Exportar PDF
            </button>
          </div>
        </div>
      </header>

      {showFilters ? (
        <section className="reports-card">
          <div className="reports-filters">
            <div className="reports-filters__row">
              <label className="reports-field">
                <span>De</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>

              <label className="reports-field">
                <span>Até</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>

              <label className="reports-field">
                <span>Severidade</span>
                <select
                  value={severity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSeverity(isSeverityCode(v) ? v : "");
                  }}
                >
                  <option value="">Todas</option>
                  <option value="SEV1">SEV1</option>
                  <option value="SEV2">SEV2</option>
                  <option value="SEV3">SEV3</option>
                  <option value="SEV4">SEV4</option>
                </select>
              </label>

              <label className="reports-field">
                <span>Equipa</span>
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Todas (minhas)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="reports-field">
                <span>Serviço</span>
                <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  <option value="">Todos</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="reports-filters__row">
              <label className="reports-field">
                <span>Agrupar por</span>
                <select
                  value={groupBy}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isReportsGroupBy(v)) setGroupBy(v);
                  }}
                >
                  <option value="severity">Severidade</option>
                  <option value="team">Equipa</option>
                  <option value="service">Serviço</option>
                  <option value="category">Categoria</option>
                  <option value="assignee">Responsável</option>
                </select>
              </label>

              <label className="reports-field">
                <span>Intervalo</span>
                <select
                  value={interval}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isReportsInterval(v)) setInterval(v);
                  }}
                >
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                </select>
              </label>

              <div className="reports-actions">
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => setLastDays(7)}
                >
                  Últimos 7d
                </button>

                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => setLastDays(30)}
                >
                  Últimos 30d
                </button>

                <button className="btn btn--secondary" type="button" onClick={setLifetime}>
                  Lifetime
                </button>

                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={clearFilters}
                  disabled={loading}
                >
                  Limpar filtros
                </button>

                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => loadAll()}
                  disabled={loading}
                >
                  {loading ? "A carregar..." : "Aplicar filtros"}
                </button>
              </div>
            </div>

            {hasError ? <div className="reports-error">{err}</div> : null}
          </div>
        </section>
      ) : hasError ? (
        <section className="reports-card">
          <div className="reports-error">{err}</div>
        </section>
      ) : null}

      <section className="reports-grid">
        <div className="reports-card">
          <h2 className="reports-card__title">KPIs</h2>

          <p className="reports-help">
            <b>MTTR</b> = tempo até resolver. <b>avg/median/p90</b> = média / mediana / 90%
            abaixo deste valor.
            <br />
            <b>SLA</b> = % resolvidos dentro do alvo por severidade.
          </p>

          {!kpis ? (
            <div className="reports-muted">Sem dados.</div>
          ) : (
            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi__label">Abertos</div>
                <div className="kpi__value">{kpis.openCount}</div>
              </div>

              <div className="kpi">
                <div className="kpi__label">Resolvidos</div>
                <div className="kpi__value">{kpis.resolvedCount}</div>
              </div>

              <div className="kpi">
                <div className="kpi__label">Fechados</div>
                <div className="kpi__value">{kpis.closedCount}</div>
              </div>

              <div className="kpi kpi--wide">
                <div className="kpi__label">MTTR (avg / median / p90)</div>
                <div className="kpi__value kpi__value--small">
                  {secondsToHuman(kpis.mttrSeconds?.avg ?? null)} /{" "}
                  {secondsToHuman(kpis.mttrSeconds?.median ?? null)} /{" "}
                  {secondsToHuman(kpis.mttrSeconds?.p90 ?? null)}
                </div>
              </div>

              <div className="kpi">
                <div className="kpi__label">SLA</div>
                <div className="kpi__value">
                  {kpis.slaCompliancePct == null ? "—" : `${kpis.slaCompliancePct}%`}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="reports-card">
          <h2 className="reports-card__title">Breakdown</h2>

          {breakdown.length === 0 ? (
            <div className="reports-muted">Sem dados.</div>
          ) : (
            <div className="breakdown">
              {breakdown.slice(0, 10).map((it) => (
                <div key={it.key} className="breakdown__row">
                  <div className="breakdown__label">{it.label}</div>
                  <div className="breakdown__count">{it.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="reports-card reports-card--full">
          <h2 className="reports-card__title">Tendência</h2>

          {series.length === 0 ? (
            <div className="reports-muted">Sem dados.</div>
          ) : (
            <div className="reports-chart">
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--deep-navy, #1b2a41)"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--deep-navy, #1b2a41)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(27,42,65,0.12)"
                  />

                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) =>
                      new Date(val).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    stroke="rgba(27,42,65,0.55)"
                    fontSize={12}
                  />

                  <YAxis stroke="rgba(27,42,65,0.55)" fontSize={12} />

                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid rgba(27,42,65,0.18)",
                      borderRadius: "10px",
                      boxShadow: "0 10px 26px rgba(0,0,0,0.08)",
                    }}
                    labelFormatter={(val) => new Date(String(val)).toLocaleDateString()}
                  />

                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--deep-navy, #1b2a41)"
                    strokeWidth={2}
                    fill="url(#areaFill)"
                    name="Incidentes"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="reports-card reports-card--full">
        <h2 className="reports-card__title">Histórico de Incidentes</h2>

        {filteredHistory.length === 0 ? (
          <div className="reports-muted">Sem incidentes no intervalo selecionado.</div>
        ) : (
          <div className="history-table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Severidade</th>
                  <th>Estado</th>
                  <th>Serviço</th>
                  <th>Equipa</th>
                  <th>Data</th>
                  <th className="reports-table__actionsHead">Export</th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.map((inc) => (
                  <tr key={inc.id}>
                    <td className="mono text-small" title={inc.id}>
                      {inc.id.slice(0, 8)}...
                    </td>
                    <td>{inc.title}</td>
                    <td>
                      <span className={`badge badge--${inc.severity.toLowerCase()}`}>
                        {getSeverityLabel(inc.severity)}
                      </span>
                    </td>
                    <td>
                      <span className="badge">{inc.status}</span>
                    </td>
                    <td>{inc.primaryService?.name ?? "—"}</td>
                    <td>{inc.team?.name ?? "—"}</td>
                    <td>{new Date(inc.createdAt).toLocaleString()}</td>
                    <td className="reports-table__actionsCell">
                      <button
                        className="btn btn--secondary btn--small"
                        type="button"
                        onClick={() => onExportIncidentPdf(inc.id, inc.title)}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="reports-muted reports-muted--mt">
              Dica: o botão <b>PDF</b> exporta um relatório completo do incidente (detalhes +
              timeline).
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
