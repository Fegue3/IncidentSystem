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
import { ReportsAPI, type ReportsGroupBy, type ReportsInterval } from "../../services/reports";
import { TeamsAPI } from "../../services/teams";
import { ServicesAPI } from "../../services/services";
import {
  IncidentsAPI,
  type IncidentSummary,
  type SeverityCode,
  getSeverityLabel,
} from "../../services/incidents";

function toISODateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

// datas do input date => range completo (UTC via ISO)
function toRangeIso(fromDate: string, toDate: string) {
  const fromIso = fromDate ? new Date(`${fromDate}T00:00:00.000`).toISOString() : undefined;
  const toIso = toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : undefined;
  return { fromIso, toIso };
}

function secondsToHuman(s: number | null) {
  if (s === null) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const mins = s / 60;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hours = mins / 60;
  return `${hours.toFixed(1)} h`;
}

function safeFilename(name: string) {
  return name
    .trim()
    .slice(0, 60)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

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

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

  // ✅ default: LIFETIME (vazio = sem range)
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [teamId, setTeamId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [severity, setSeverity] = useState<SeverityCode | "">("");

  const [groupBy, setGroupBy] = useState<ReportsGroupBy>("severity");
  const [interval, setInterval] = useState<ReportsInterval>("day");

  const [kpis, setKpis] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [history, setHistory] = useState<IncidentSummary[]>([]);

  function setLastDays(days: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - (days - 1));
    setFrom(toISODateOnly(f));
    setTo(toISODateOnly(t));
  }

  function setLifetime() {
    setFrom("");
    setTo("");
  }

  const filters = useMemo(() => {
    const { fromIso, toIso } = toRangeIso(from, to);
    return {
      from: fromIso,
      to: toIso,
      teamId: teamId || undefined,
      serviceId: serviceId || undefined,
      severity: (severity || undefined) as any,
    };
  }, [from, to, teamId, serviceId, severity]);

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

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const listParams = {
        teamId: filters.teamId,
        primaryServiceId: filters.serviceId,
        severity: filters.severity,
      };

      const [k, b, s, h] = await Promise.all([
        ReportsAPI.kpis(filters),
        ReportsAPI.breakdown({ ...filters, groupBy }),
        // ✅ FIX: timeseries tem de receber os mesmos filtros
        ReportsAPI.timeseries({ ...filters, interval }),
        IncidentsAPI.list(listParams),
      ]);

      setKpis(k);
      setBreakdown(b);
      setSeries(s);

      setHistory(
        h.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [t, svcs] = await Promise.all([TeamsAPI.listMine(), ServicesAPI.list()]);
        setTeams((t as any).items ?? (t as any));
        setServices((svcs as any).items ?? (svcs as any));
      } catch {
        // não bloqueia
      }
      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rangeLabel() {
    if (from && to) return `${from}_a_${to}`;
    if (from && !to) return `${from}_a_hoje`;
    if (!from && to) return `inicio_a_${to}`;
    return "lifetime";
  }

  async function onExportCsv() {
    try {
      const blob = await ReportsAPI.exportCsv(filters);
      downloadBlob(blob, `relatorio-incidentes_${rangeLabel()}.csv`);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao exportar CSV");
    }
  }

  async function onExportPdf() {
    try {
      const blob = await ReportsAPI.exportPdf(filters);
      downloadBlob(blob, `relatorio-incidentes_${rangeLabel()}.pdf`);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao exportar PDF");
    }
  }

  async function onExportIncidentPdf(incidentId: string, title: string) {
    try {
      const blob = await ReportsAPI.exportPdf({ incidentId });
      downloadBlob(blob, `incidente_${safeFilename(title)}_${incidentId.slice(0, 8)}.pdf`);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao exportar PDF do incidente");
    }
  }

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
                <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
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
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
                  <option value="severity">Severidade</option>
                  <option value="team">Equipa</option>
                  <option value="service">Serviço</option>
                  <option value="category">Categoria</option>
                  <option value="assignee">Responsável</option>
                </select>
              </label>

              <label className="reports-field">
                <span>Intervalo</span>
                <select value={interval} onChange={(e) => setInterval(e.target.value as any)}>
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                </select>
              </label>

              <div className="reports-actions">
                <button className="btn btn--secondary" type="button" onClick={() => setLastDays(7)}>
                  Últimos 7d
                </button>
                <button className="btn btn--secondary" type="button" onClick={() => setLastDays(30)}>
                  Últimos 30d
                </button>
                <button className="btn btn--secondary" type="button" onClick={setLifetime}>
                  Lifetime
                </button>

                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={loadAll}
                  disabled={loading}
                >
                  {loading ? "A carregar..." : "Aplicar filtros"}
                </button>
              </div>
            </div>

            {err ? <div className="reports-error">{err}</div> : null}
          </div>
        </section>
      ) : err ? (
        <section className="reports-card">
          <div className="reports-error">{err}</div>
        </section>
      ) : null}

      <section className="reports-grid">
        <div className="reports-card">
          <h2 className="reports-card__title">KPIs</h2>

          <p className="reports-help">
            <b>MTTR</b> = tempo até resolver. <b>avg/median/p90</b> = média / mediana / 90% abaixo deste valor.
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
                  {secondsToHuman(kpis.mttrSeconds?.avg)} / {secondsToHuman(kpis.mttrSeconds?.median)} /{" "}
                  {secondsToHuman(kpis.mttrSeconds?.p90)}
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
                      <stop offset="0%" stopColor="var(--deep-navy, #1b2a41)" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="var(--deep-navy, #1b2a41)" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(27,42,65,0.12)" />

                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) =>
                      new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" })
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
                    labelFormatter={(val) => new Date(val).toLocaleDateString()}
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
              Dica: o botão <b>PDF</b> exporta um relatório completo do incidente (detalhes + timeline).
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
