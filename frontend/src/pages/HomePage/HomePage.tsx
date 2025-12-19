/**
 * @file HomePage.tsx
 * @module pages/HomePage/HomePage
 *
 * @summary
 *  - Página principal (dashboard) que apresenta a visão geral dos incidentes ativos,
 *    em investigação e resolvidos.
 *
 * @description
 *  - Funções principais:
 *    - Carrega dados do utilizador autenticado (`UsersAPI.me`).
 *    - Carrega lista de serviços (`ServicesAPI.list`) para filtros.
 *    - Carrega lista de incidentes (`IncidentsAPI.list`) aplicando filtros locais.
 *    - Mostra incidentes agrupados por estado (open, investigating, resolved).
 *
 * @dependencies
 *  - `UsersAPI`: obtém utilizador atual.
 *  - `ServicesAPI`: lista de serviços ativos (para filtro).
 *  - `IncidentsAPI`: incidentes filtrados e ordenados por severidade/data.
 *
 * @security
 *  - Todas as chamadas dependem de autenticação (JWT via context).
 *
 * @performance
 *  - Carregamentos paralelos e memorização de filtros locais.
 *  - Re-render controlado apenas quando filtros mudam.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";
import { UsersAPI, type Me } from "../../services/users";
import {
  IncidentsAPI,
  type IncidentSummary,
  type IncidentStatus,
  type SeverityCode,
  getSeverityShortLabel,
  getSeverityOrder,
} from "../../services/incidents";
import { ServicesAPI, type ServiceLite } from "../../services/services";

const TEAM_STORAGE_KEY = "selectedTeamId";

/**
 * Página principal com visão geral dos incidentes.
 */
export function HomePage() {
  // Perfil do utilizador
  const [me, setMe] = useState<Me | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Lista de incidentes
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);

  // Filtros locais
  const [filterSeverity, setFilterSeverity] = useState<SeverityCode | "">("");
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | "">("");
  const [filterServiceKey, setFilterServiceKey] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");

  // Lista de serviços para dropdown
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [loadingServices, setLoadingServices] = useState<boolean>(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const navigate = useNavigate();

  /* ---------------------------------------------------------------------- */
  /* Perfil do utilizador                                                   */
  /* ---------------------------------------------------------------------- */
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
          e instanceof Error ? e.message : "Erro a carregar o teu perfil.";
        if (active) setProfileError(msg);
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Lista de serviços (para filtros)                                       */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let active = true;

    async function loadServices() {
      setLoadingServices(true);
      setServicesError(null);
      try {
        const list = await ServicesAPI.list({ isActive: true });
        if (active) setServices(list);
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Erro a carregar lista de serviços.";
        if (active) setServicesError(msg);
      } finally {
        if (active) setLoadingServices(false);
      }
    }

    loadServices();
    return () => {
      active = false;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Lista de incidentes com filtros aplicados                              */
  /* ---------------------------------------------------------------------- */
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
          severity: filterSeverity || undefined,
          status: filterStatus || undefined,
          primaryServiceKey: filterServiceKey || undefined,
          search: searchText || undefined,
        });

        if (active) setIncidents(data);
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message
            : "Erro ao carregar a lista de incidentes.";
        if (active) setIncidentsError(msg);
      } finally {
        if (active) setLoadingIncidents(false);
      }
    }

    loadIncidents();
    return () => {
      active = false;
    };
  }, [filterSeverity, filterStatus, filterServiceKey, searchText]);

  /* ---------------------------------------------------------------------- */
  /* Helpers e render utils                                                 */
  /* ---------------------------------------------------------------------- */
  const displayName = me?.name ?? me?.email ?? "Operador";

  function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max) + "…";
  }

  function sortIncidents(list: IncidentSummary[]): IncidentSummary[] {
    return [...list].sort((a, b) => {
      const sa = getSeverityOrder(a.severity);
      const sb = getSeverityOrder(b.severity);
      if (sa !== sb) return sa - sb;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  function byStatuses(statuses: IncidentStatus[]): IncidentSummary[] {
    return sortIncidents(incidents.filter((i) => statuses.includes(i.status)));
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

  /* ---------------------------------------------------------------------- */
  /* Card de incidente                                                      */
  /* ---------------------------------------------------------------------- */
  function IncidentCard({ incident }: { incident: IncidentSummary }) {
    return (
      <button
        type="button"
        className="incident-card"
        onClick={() => handleIncidentClick(incident.id)}
      >
        <div className="incident-card__top">
          <p className="incident-card__title">{truncate(incident.title, 34)}</p>

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

        <div className="incident-card__service-row">
          <span className="incident-card__service-pill">
            {incident.primaryService ? renderService(incident) : "Sem serviço"}
          </span>
        </div>

        <p className="incident-card__desc">
          <span className="incident-card__desc-label">Descrição:</span>{" "}
          {truncate(incident.description, 90)}
        </p>

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

  /* ---------------------------------------------------------------------- */
  /* Render principal                                                       */
  /* ---------------------------------------------------------------------- */
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

      {/* Filtros */}
      <section className="dashboard__filters" aria-label="Filtros de incidentes">
        <span className="dashboard__filters-label">Filtros</span>
        <div className="dashboard__filters-group">
          {/* Estado */}
          <select
            className="dashboard__filter-input"
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as IncidentStatus | "")
            }
            title="Filtrar por estado"
          >
            <option value="">Estado (todos)</option>
            {[
              "NEW",
              "TRIAGED",
              "IN_PROGRESS",
              "ON_HOLD",
              "RESOLVED",
              "CLOSED",
              "REOPENED",
            ].map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Severidade */}
          <select
            className="dashboard__filter-input"
            value={filterSeverity}
            onChange={(e) =>
              setFilterSeverity(e.target.value as SeverityCode | "")
            }
            title="Filtrar por severidade"
          >
            <option value="">Severidade (todas)</option>
            {["SEV1", "SEV2", "SEV3", "SEV4"].map((sev) => (
              <option key={sev} value={sev}>
                {sev}
              </option>
            ))}
          </select>

          {/* Serviço */}
          <select
            className="dashboard__filter-input"
            value={filterServiceKey}
            onChange={(e) => setFilterServiceKey(e.target.value)}
            title="Filtrar por serviço"
          >
            <option value="">
              {loadingServices ? "A carregar serviços…" : "Serviço (todos)"}
            </option>
            {services.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} ({s.key})
              </option>
            ))}
          </select>

          {/* Pesquisa */}
          <input
            className="dashboard__filter-input"
            placeholder="Pesquisar título/descrição"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            title="Pesquisa"
          />
        </div>
      </section>

      {/* Estados de carregamento/erro */}
      <div className="dashboard__status-area">
        {loadingProfile && (
          <p className="dashboard__status">A carregar dados do perfil…</p>
        )}
        {profileError && (
          <p className="dashboard__status dashboard__status--error" role="alert">
            {profileError}
          </p>
        )}
        {servicesError && (
          <p className="dashboard__status dashboard__status--error" role="alert">
            {servicesError}
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

      {/* Colunas por estado */}
      <section
        className="dashboard__columns"
        aria-label="Incidentes organizados por estado"
      >
        <IncidentColumn
          title="Open"
          hint="Incidentes recém-criados ou em triagem."
          list={openIncidents}
          loading={loadingIncidents}
          emptyMessage="Nenhum incidente open neste momento."
        />
        <IncidentColumn
          title="Investigating"
          hint="Incidentes em análise ativa pela equipa."
          list={investigatingIncidents}
          loading={loadingIncidents}
          emptyMessage="Nenhum incidente em investigação."
        />
        <IncidentColumn
          title="Resolved"
          hint="Incidentes resolvidos registados para histórico."
          list={resolvedIncidents}
          loading={loadingIncidents}
          emptyMessage="Ainda não tens incidentes resolvidos."
        />
      </section>
    </section>
  );

  /* ---------------------------------------------------------------------- */
  /* Sub-componente: coluna de incidentes                                   */
  /* ---------------------------------------------------------------------- */
  function IncidentColumn({
    title,
    hint,
    list,
    loading,
    emptyMessage,
  }: {
    title: string;
    hint: string;
    list: IncidentSummary[];
    loading: boolean;
    emptyMessage: string;
  }) {
    return (
      <article className={`incident-column incident-column--${title.toLowerCase()}`}>
        <header className="incident-column__header">
          <div>
            <h2 className="incident-column__title">
              {title}{" "}
              <span className="incident-column__counter">({list.length})</span>
            </h2>
            <p className="incident-column__hint">{hint}</p>
          </div>
          <span className="incident-column__badge">{list.length}</span>
        </header>

        <div className="incident-column__body">
          {list.length === 0 && !loading && (
            <p className="incident-column__empty">{emptyMessage}</p>
          )}
          {list.length > 0 && (
            <ul className="incident-list">
              {list.map((incident) => (
                <li key={incident.id}>
                  <IncidentCard incident={incident} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    );
  }
}
