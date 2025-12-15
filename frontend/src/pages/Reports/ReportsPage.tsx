import { useEffect, useMemo, useState } from "react";
import "./ReportsPage.css";
import { ReportsAPI, type ReportsGroupBy, type ReportsInterval } from "../../services/reports";
import { TeamsAPI } from "../../services/teams";
import { ServicesAPI } from "../../services/services";
import type { SeverityCode } from "../../services/incidents";

function toISODateOnly(d: string) {
  // aceita YYYY-MM-DD e devolve igual; se vier ISO completo mantém só YYYY-MM-DD
  if (!d) return "";
  return d.length >= 10 ? d.slice(0, 10) : d;
}

function secondsToHuman(s: number | null) {
  if (s === null) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const mins = s / 60;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hours = mins / 60;
  return `${hours.toFixed(1)} h`;
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

  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

  const [from, setFrom] = useState(() => toISODateOnly(new Date().toISOString()));
  const [to, setTo] = useState(() => toISODateOnly(new Date().toISOString()));
  const [teamId, setTeamId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [severity, setSeverity] = useState<SeverityCode | "">("");

  const [groupBy, setGroupBy] = useState<ReportsGroupBy>("severity");
  const [interval, setInterval] = useState<ReportsInterval>("day");

  const [kpis, setKpis] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);

  const filters = useMemo(
    () => ({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      teamId: teamId || undefined,
      serviceId: serviceId || undefined,
      severity: (severity || undefined) as any,
    }),
    [from, to, teamId, serviceId, severity]
  );

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [k, b, s] = await Promise.all([
        ReportsAPI.kpis(filters),
        ReportsAPI.breakdown({ ...filters, groupBy }),
        ReportsAPI.timeseries({ from: filters.from, to: filters.to, interval }),
      ]);
      setKpis(k);
      setBreakdown(b);
      setSeries(s);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [t, svcs] = await Promise.all([TeamsAPI.list(), ServicesAPI.list()]);
        setTeams(t.items ?? t); // dependendo do teu DTO
        setServices(svcs.items ?? svcs);
      } catch {
        // não bloqueia a página
      }
      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onExportCsv() {
    try {
      const blob = await ReportsAPI.exportCsv(filters);
      downloadBlob(blob, "relatorio-incidentes.csv");
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao exportar CSV");
    }
  }

  async function onExportPdf() {
    try {
      const blob = await ReportsAPI.exportPdf(filters);
      downloadBlob(blob, "relatorio-incidentes.pdf");
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao exportar PDF");
    }
  }

  return (
    <div className="reports">
      <header className="reports__header">
        <div className="reports__eyebrow">Incident Manager</div>
        <h1 className="reports__title">Relatórios e Métricas</h1>
        <p className="reports__subtitle">
          KPIs (MTTR, SLA), breakdowns e tendências — com filtros por período, equipa, serviço e severidade.
        </p>
      </header>

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
                <option value="">Todas</option>
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
                <option value="status">Estado</option>
                <option value="team">Equipa</option>
                <option value="service">Serviço</option>
                <option value="category">Categoria</option>
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
              <button className="btn btn--secondary" type="button" onClick={loadAll} disabled={loading}>
                {loading ? "A carregar..." : "Aplicar filtros"}
              </button>
              <button className="btn btn--secondary" type="button" onClick={onExportCsv}>
                Exportar CSV
              </button>
              <button className="btn btn--primary" type="button" onClick={onExportPdf}>
                Exportar PDF
              </button>
            </div>
          </div>

          {err ? <div className="reports-error">{err}</div> : null}
        </div>
      </section>

      <section className="reports-grid">
        <div className="reports-card">
          <h2 className="reports-card__title">KPIs</h2>

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
                <div className="kpi__value">{kpis.slaCompliancePct == null ? "—" : `${kpis.slaCompliancePct}%`}</div>
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
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Incidentes</th>
                </tr>
              </thead>
              <tbody>
                {series.map((p) => (
                  <tr key={p.date}>
                    <td>{new Date(p.date).toLocaleDateString()}</td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}