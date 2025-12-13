import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";
import { UsersAPI, type Me } from "../../services/users";
import {
  IncidentsAPI,
  type IncidentSummary,
  type IncidentStatus,
  getSeverityShortLabel,
  getSeverityOrder,
} from "../../services/incidents";

const TEAM_STORAGE_KEY = "selectedTeamId";

export function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    UsersAPI.me()
      .then((data: Me) => {
        if (active) {
          setMe(data);
          setProfileError(null);
        }
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : "Erro a carregar o teu perfil";
        if (active) setProfileError(msg);
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadIncidents() {
      setLoadingIncidents(true);
      setIncidentsError(null);

      const selectedTeamId =
        localStorage.getItem(TEAM_STORAGE_KEY) ?? undefined;

      try {
        const data = await IncidentsAPI.list({ teamId: selectedTeamId });
        if (active) setIncidents(data);
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message
            : "Erro a carregar a lista de incidentes";
        if (active) setIncidentsError(msg);
      } finally {
        if (active) setLoadingIncidents(false);
      }
    }

    loadIncidents();

    return () => {
      active = false;
    };
  }, []);

  const displayName = me?.name ?? me?.email ?? "Operador";

  function truncate(text: string, max: number) {
    if (text.length <= max) return text;
    return text.slice(0, max) + "…";
  }

  function renderTitle(text: string) {
    return truncate(text, 34);
  }

  function renderDescription(text: string) {
    return truncate(text, 90);
  }

  function sortIncidents(list: IncidentSummary[]): IncidentSummary[] {
    return [...list].sort((a, b) => {
      const sa = getSeverityOrder(a.severity);
      const sb = getSeverityOrder(b.severity);

      if (sa !== sb) return sa - sb;

      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return da - db;
    });
  }

  function byStatuses(statuses: IncidentStatus[]) {
    const filtered = incidents.filter((i) => statuses.includes(i.status));
    return sortIncidents(filtered);
  }

  const openIncidents = byStatuses(["NEW", "TRIAGED"]);
  const investigatingIncidents = byStatuses([
    "IN_PROGRESS",
    "ON_HOLD",
    "REOPENED",
  ]);
  const resolvedIncidents = byStatuses(["RESOLVED", "CLOSED"]);

  function handleNewIncidentClick() {
    navigate("/incidents/new");
  }

  function handleIncidentClick(id: string) {
    navigate(`/incidents/${id}`);
  }

  function renderOwner(incident: IncidentSummary): string {
    if (!incident.assignee) return "Sem owner";
    const label = incident.assignee.name ?? incident.assignee.email;
    return truncate(label, 16);
  }

  function renderService(incident: IncidentSummary): string {
    const s = incident.primaryService;
    if (!s) return "Sem serviço";
    return truncate(s.name, 42);
  }

  function IncidentCard({ incident }: { incident: IncidentSummary }) {
    return (
      <button
        type="button"
        className="incident-card"
        onClick={() => handleIncidentClick(incident.id)}
      >
        {/* Linha 1: título + chips */}
        <div className="incident-card__top">
          <p className="incident-card__title">{renderTitle(incident.title)}</p>

          <div className="incident-card__chips">
            <span
              className={`chip chip--status chip--status-${incident.status.toLowerCase()}`}
              title={incident.status}
            >
              {incident.status}
            </span>

            <span
              className={`chip chip--severity chip--severity-${incident.severity.toLowerCase()}`}
              title={incident.severity}
            >
              {getSeverityShortLabel(incident.severity)}
            </span>
          </div>
        </div>

        {/* Linha 2: SERVIÇO (antes da descrição) */}
        <div className="incident-card__service-row">
          <span className="incident-card__service-pill">
            {incident.primaryService ? renderService(incident) : "Sem serviço"}
          </span>
        </div>

        {/* Linha 3: descrição */}
        <p className="incident-card__desc">
          <span className="incident-card__desc-label">Descrição:</span>{" "}
          {renderDescription(incident.description)}
        </p>

        {/* Linha 4: meta */}
        <div className="incident-card__footer">
          <span className="incident-card__meta-item">
            <span className="incident-card__meta-label">Owner:</span>{" "}
            {incident.assignee ? (
              <span className="incident-card__meta-value">
                {renderOwner(incident)}
              </span>
            ) : (
              <span className="incident-card__owner-badge">Sem owner</span>
            )}
          </span>

          <span className="incident-card__meta-item">
            <span className="incident-card__meta-label">Criado:</span>{" "}
            <span className="incident-card__meta-value">
              {new Date(incident.createdAt).toLocaleString()}
            </span>
          </span>
        </div>
      </button>
    );
  }

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Incident Manager</p>
          <h1 className="dashboard__title">Visão geral dos incidentes</h1>
          <p className="dashboard__subtitle">
            {me
              ? `Bem-vindo, ${displayName}. Acompanha o ciclo de vida dos incidentes em tempo real.`
              : "Acompanha o ciclo de vida dos incidentes em tempo real."}
          </p>
        </div>

        <div className="dashboard__actions">
          <button
            className="dashboard-btn dashboard-btn--ghost"
            type="button"
            onClick={() => window.location.reload()}
          >
            Atualizar
          </button>
          <button
            className="dashboard-btn dashboard-btn--primary"
            type="button"
            onClick={handleNewIncidentClick}
          >
            Novo incidente
          </button>
        </div>
      </header>

      <section className="dashboard__filters" aria-label="Filtros de incidentes">
        <span className="dashboard__filters-label">Filtros</span>
        <div className="dashboard__filters-group">
          <select className="dashboard__filter-input" disabled>
            <option>Fornecedor (brevemente)</option>
          </select>
          <select className="dashboard__filter-input" disabled>
            <option>Serviço (brevemente)</option>
          </select>
          <select className="dashboard__filter-input" disabled>
            <option>Severidade (brevemente)</option>
          </select>
        </div>
        <button
          type="button"
          className="dashboard__auto-refresh"
          disabled
          title="Auto-refresh manual para já"
        >
          Atualiza a cada 30s
        </button>
      </section>

      <div className="dashboard__status-area">
        {loadingProfile && (
          <p className="dashboard__status">A carregar dados do perfil…</p>
        )}

        {profileError && (
          <p className="dashboard__status dashboard__status--error" role="alert">
            {profileError}
          </p>
        )}

        {incidentsError && (
          <p className="dashboard__status dashboard__status--error" role="alert">
            {incidentsError}
          </p>
        )}

        {loadingIncidents && !incidentsError && (
          <p className="dashboard__status">A carregar incidentes…</p>
        )}
      </div>

      <section
        className="dashboard__columns"
        aria-label="Incidentes organizados por estado"
      >
        <article className="incident-column incident-column--open">
          <header className="incident-column__header">
            <div>
              <h2 className="incident-column__title">
                Open{" "}
                <span className="incident-column__counter">
                  ({openIncidents.length})
                </span>
              </h2>
              <p className="incident-column__hint">
                Incidentes recém-criados ou ainda à espera de triagem.
              </p>
            </div>
            <span className="incident-column__badge">{openIncidents.length}</span>
          </header>

          <div className="incident-column__body">
            {openIncidents.length === 0 && !loadingIncidents && (
              <p className="incident-column__empty">
                Nenhum incidente open neste momento.
              </p>
            )}

            {openIncidents.length > 0 && (
              <ul className="incident-list">
                {openIncidents.map((incident) => (
                  <li key={incident.id}>
                    <IncidentCard incident={incident} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="incident-column incident-column--investigating">
          <header className="incident-column__header">
            <div>
              <h2 className="incident-column__title">
                Investigating{" "}
                <span className="incident-column__counter">
                  ({investigatingIncidents.length})
                </span>
              </h2>
              <p className="incident-column__hint">
                Incidentes em análise ativa pela equipa.
              </p>
            </div>
            <span className="incident-column__badge">
              {investigatingIncidents.length}
            </span>
          </header>

          <div className="incident-column__body">
            {investigatingIncidents.length === 0 && !loadingIncidents && (
              <p className="incident-column__empty">
                Nenhum incidente em investigação neste momento.
              </p>
            )}

            {investigatingIncidents.length > 0 && (
              <ul className="incident-list">
                {investigatingIncidents.map((incident) => (
                  <li key={incident.id}>
                    <IncidentCard incident={incident} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="incident-column incident-column--resolved">
          <header className="incident-column__header">
            <div>
              <h2 className="incident-column__title">
                Resolved{" "}
                <span className="incident-column__counter">
                  ({resolvedIncidents.length})
                </span>
              </h2>
              <p className="incident-column__hint">
                Incidentes resolvidos que ficam registados para histórico.
              </p>
            </div>
            <span className="incident-column__badge">
              {resolvedIncidents.length}
            </span>
          </header>

          <div className="incident-column__body">
            {resolvedIncidents.length === 0 && !loadingIncidents && (
              <p className="incident-column__empty">
                Ainda não tens incidentes resolvidos.
              </p>
            )}

            {resolvedIncidents.length > 0 && (
              <ul className="incident-list">
                {resolvedIncidents.map((incident) => (
                  <li key={incident.id}>
                    <IncidentCard incident={incident} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
