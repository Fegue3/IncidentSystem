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
        const data = await IncidentsAPI.list({
          teamId: selectedTeamId,
        });
        if (active) {
          setIncidents(data);
        }
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
    return truncate(text, 29);
  }

  function renderDescription(text: string) {
    return truncate(text, 30);
  }

  function sortIncidents(list: IncidentSummary[]): IncidentSummary[] {
    return [...list].sort((a, b) => {
      const sa = getSeverityOrder(a.severity);
      const sb = getSeverityOrder(b.severity);

      if (sa !== sb) {
        return sa - sb; // SEV1 antes de SEV2, etc.
      }

      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();

      return da - db; // mais antigo primeiro
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

  // label do responsável (owner)
  function renderOwner(incident: IncidentSummary): string {
    if (!incident.assignee) return "Sem owner";
    const label = incident.assignee.name ?? incident.assignee.email;
    return truncate(label, 10);
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

      {/* Barra de filtros */}
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
        {/* OPEN */}
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
            <span className="incident-column__badge">
              {openIncidents.length}
            </span>
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
                    <button
                      type="button"
                      className="incident-card"
                      onClick={() => handleIncidentClick(incident.id)}
                    >
                      {/* topo: título a ocupar tudo */}
                      <div className="incident-card__header-row">
                        <p className="incident-card__title">
                          {renderTitle(incident.title)}
                        </p>
                      </div>

                      {/* meio: descrição à esquerda, estado+severidade à direita */}
                      <div className="incident-card__middle">
                        <div className="incident-card__description-block">
                          <span className="incident-card__label">
                            Descrição:
                          </span>
                          <span className="incident-card__value incident-card__description">
                            {renderDescription(incident.description)}
                          </span>
                        </div>

                        <div className="incident-card__side">
                          <span
                            className={`chip chip--status chip--status-${incident.status.toLowerCase()} incident-card__status-chip`}
                          >
                            {incident.status}
                          </span>
                          <span
                            className={`chip chip--severity chip--severity-${incident.severity.toLowerCase()} incident-card__priority-chip`}
                          >
                            {getSeverityShortLabel(incident.severity)}
                          </span>
                        </div>
                      </div>

                      {/* fundo: Owner + Criado */}
                      <div className="incident-card__footer">
                        <span className="incident-card__meta-item">
                          <span className="incident-card__label">Owner:</span>
                          {incident.assignee ? (
                            <span className="incident-card__value">
                              {renderOwner(incident)}
                            </span>
                          ) : (
                            <span className="incident-card__owner-badge">
                              Sem owner
                            </span>
                          )}
                        </span>
                        <span className="incident-card__meta-item">
                          <span className="incident-card__label">Criado:</span>
                          <span className="incident-card__value">
                            {new Date(incident.createdAt).toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        {/* INVESTIGATING */}
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
                    <button
                      type="button"
                      className="incident-card"
                      onClick={() => handleIncidentClick(incident.id)}
                    >
                      <div className="incident-card__header-row">
                        <p className="incident-card__title">
                          {renderTitle(incident.title)}
                        </p>
                      </div>

                      <div className="incident-card__middle">
                        <div className="incident-card__description-block">
                          <span className="incident-card__label">
                            Descrição:
                          </span>
                          <span className="incident-card__value incident-card__description">
                            {renderDescription(incident.description)}
                          </span>
                        </div>

                        <div className="incident-card__side">
                          <span
                            className={`chip chip--status chip--status-${incident.status.toLowerCase()} incident-card__status-chip`}
                          >
                            {incident.status}
                          </span>
                          <span
                            className={`chip chip--severity chip--severity-${incident.severity.toLowerCase()} incident-card__priority-chip`}
                          >
                            {getSeverityShortLabel(incident.severity)}
                          </span>
                        </div>
                      </div>

                      <div className="incident-card__footer">
                        <span className="incident-card__meta-item">
                          <span className="incident-card__label">Owner:</span>
                          {incident.assignee ? (
                            <span className="incident-card__value">
                              {renderOwner(incident)}
                            </span>
                          ) : (
                            <span className="incident-card__owner-badge">
                              Sem owner
                            </span>
                          )}
                        </span>
                        <span className="incident-card__meta-item">
                          <span className="incident-card__label">Criado:</span>
                          <span className="incident-card__value">
                            {new Date(incident.createdAt).toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        {/* RESOLVED */}
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
                    <button
                      type="button"
                      className="incident-card"
                      onClick={() => handleIncidentClick(incident.id)}
                    >
                      <div className="incident-card__header-row">
                        <p className="incident-card__title">
                          {renderTitle(incident.title)}
                        </p>
                      </div>

                      <div className="incident-card__middle">
                        <div className="incident-card__description-block">
                          <span className="incident-card__label">
                            Descrição:
                          </span>
                          <span className="incident-card__value incident-card__description">
                            {renderDescription(incident.description)}
                          </span>
                        </div>

                        <div className="incident-card__side">
                          <span
                            className={`chip chip--status chip--status-${incident.status.toLowerCase()} incident-card__status-chip`}
                          >
                            {incident.status}
                          </span>
                          <span
                            className={`chip chip--severity chip--severity-${incident.severity.toLowerCase()} incident-card__priority-chip`}
                          >
                            {getSeverityShortLabel(incident.severity)}
                          </span>
                        </div>
                      </div>

                      <div className="incident-card__footer">
                        <span className="incident-card__meta-item">
                          <span className="incident-card__label">Owner:</span>
                          {incident.assignee ? (
                            <span className="incident-card__value">
                              {renderOwner(incident)}
                            </span>
                          ) : (
                            <span className="incident-card__owner-badge">
                              Sem owner
                            </span>
                          )}
                        </span>
                        <span className="incident-card__meta-item">
                          <span className="incident-card__label">Criado:</span>
                          <span className="incident-card__value">
                            {new Date(incident.createdAt).toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </button>
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
