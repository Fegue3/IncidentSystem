/**
 * @file IncidentCreatePage.tsx
 * @module pages/Incidents/IncidentCreatePage
 *
 * @summary
 *  - Página de criação de incidentes: recolhe título/descrição/severidade/serviço e opcionalmente owner inicial.
 *
 * @description
 *  - Fluxo:
 *    1) Carrega “me” (UsersAPI.me) para obter contexto do utilizador (incl. teamId quando existir).
 *    2) Carrega serviços ativos (ServicesAPI.list({ isActive: true })) e exige seleção de serviço.
 *    3) Valida inputs (título/descrição, limites e serviço obrigatório).
 *    4) Cria incidente via IncidentsAPI.create().
 *    5) Redireciona para `/incidents/:id`.
 *
 *  - Team selection:
 *    - Usa (por ordem):
 *      1) `me.team.id` (quando disponível)
 *      2) `localStorage[selectedTeamId]` (preferência UI)
 *      3) undefined (sem equipa)
 *
 * @dependencies
 *  - `react-router-dom`: navegação
 *  - `IncidentsAPI`: create
 *  - `UsersAPI`: me (contexto do utilizador)
 *  - `ServicesAPI`: serviços ativos
 *  - `AuthContext`: user.id para “atribuir a mim”
 *
 * @security
 *  - O backend valida permissões e autenticação; a UI assume sessão existente para criar.
 *
 * @errors
 *  - `servicesError`: falha ao carregar serviços
 *  - `error`: validações locais e falha de criação
 */

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./IncidentCreatePage.css";
import { IncidentsAPI, type SeverityCode, getSeverityLabel } from "../../services/incidents";
import { UsersAPI, type Me } from "../../services/users";
import { useAuth } from "../../context/AuthContext";
import { ServicesAPI, type ServiceLite } from "../../services/services";

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const TEAM_STORAGE_KEY = "selectedTeamId";

type MeWithTeam = Me & {
  team?: {
    id: string;
    name: string;
  } | null;
};

type OwnerMode = "none" | "self";

export function IncidentCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [severity, setSeverity] = useState<SeverityCode>("SEV3");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<MeWithTeam | null>(null);
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("none");

  const [services, setServices] = useState<ServiceLite[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [primaryServiceId, setPrimaryServiceId] = useState<string>("");

  /**
   * Lista ordenada por nome para o dropdown.
   */
  const servicesSorted = useMemo(() => {
    return [...services].sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  /**
   * Carrega o utilizador atual (para inferir equipa e permitir “atribuir a mim”).
   */
  useEffect(() => {
    let active = true;

    UsersAPI.me()
      .then((data) => {
        if (!active) return;
        setMe(data as MeWithTeam);
      })
      .catch((e) => {
        console.error("Falha ao carregar o utilizador atual", e);
      });

    return () => {
      active = false;
    };
  }, []);

  /**
   * Carrega serviços ativos e pré-seleciona se existir apenas 1.
   */
  useEffect(() => {
    let active = true;

    async function loadServices() {
      setServicesLoading(true);
      setServicesError(null);

      try {
        const data = await ServicesAPI.list({ isActive: true });
        if (!active) return;

        setServices(data);

        if (data.length === 1) {
          setPrimaryServiceId(data[0].id);
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Não foi possível carregar a lista de serviços.";
        if (active) setServicesError(msg);
      } finally {
        if (active) setServicesLoading(false);
      }
    }

    loadServices();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Submit do formulário:
   * - valida inputs
   * - resolve teamId e assigneeId inicial
   * - cria incidente
   * - navega para o detalhe
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle || !cleanDescription) {
      setError("Preenche pelo menos o título e a descrição.");
      return;
    }

    if (cleanTitle.length > TITLE_MAX_LENGTH) {
      setError(`O título não pode ter mais de ${TITLE_MAX_LENGTH} caracteres.`);
      return;
    }

    if (cleanDescription.length > DESCRIPTION_MAX_LENGTH) {
      setError(`A descrição não pode ter mais de ${DESCRIPTION_MAX_LENGTH} caracteres.`);
      return;
    }

    if (!primaryServiceId) {
      setError("Seleciona um serviço para associar ao incidente.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const selectedTeamFromStorage = localStorage.getItem(TEAM_STORAGE_KEY) ?? undefined;
      const teamId = me?.team?.id ?? selectedTeamFromStorage ?? undefined;

      let assigneeId: string | undefined;
      if (ownerMode === "self" && user) {
        assigneeId = user.id;
      }

      const incident = await IncidentsAPI.create({
        title: cleanTitle,
        description: cleanDescription,
        severity,
        teamId,
        assigneeId,
        primaryServiceId,
      });

      navigate(`/incidents/${incident.id}`, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível criar o incidente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    navigate("/", { replace: false });
  }

  return (
    <section className="incident-create">
      <header className="incident-create__header">
        <p className="incident-create__eyebrow">Incidentes</p>
        <h1 className="incident-create__title">Novo incidente</h1>
        <p className="incident-create__subtitle">
          Regista um novo incidente com informação suficiente para que a equipa responsável possa investigar e resolver
          o problema.
        </p>
      </header>

      <form className="incident-create__form" onSubmit={handleSubmit}>
        <div className="incident-create__grid">
          <div className="incident-create__main">
            <label className="form-field">
              <span className="form-field__label">Título</span>
              <input
                type="text"
                className="form-field__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: SEV2 – Latência elevada no Auth Gateway"
                required
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">Descrição</span>
              <textarea
                className="form-field__textarea"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumo dos sintomas, impacto e qualquer contexto relevante para a equipa."
                required
              />
            </label>
          </div>

          <aside className="incident-create__side">
            <label className="form-field">
              <span className="form-field__label">Serviço</span>
              <select
                className="form-field__select"
                value={primaryServiceId}
                onChange={(e) => setPrimaryServiceId(e.target.value)}
                disabled={servicesLoading || submitting || services.length === 0}
              >
                {servicesLoading && <option value="">A carregar serviços…</option>}
                {!servicesLoading && servicesSorted.length === 0 && <option value="">Sem serviços ativos</option>}
                {!servicesLoading && servicesSorted.length > 0 && (
                  <>
                    <option value="">Seleciona um serviço…</option>
                    {servicesSorted.map((s) => {
                      const owner = s.ownerTeam?.name ? ` · ${s.ownerTeam.name}` : "";
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.key}){owner}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>

              <p className="form-field__hint incident-create__service-note">
                O serviço fica associado ao incidente e não pode ser trocado depois.
              </p>

              {servicesError && (
                <p className="incident-create__error" role="alert">
                  {servicesError}
                </p>
              )}
            </label>

            <label className="form-field">
              <span className="form-field__label">Severidade (SEV)</span>
              <select
                className="form-field__select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityCode)}
                disabled={submitting}
              >
                {(["SEV1", "SEV2", "SEV3", "SEV4"] as SeverityCode[]).map((code) => (
                  <option key={code} value={code}>
                    {getSeverityLabel(code)}
                  </option>
                ))}
              </select>
            </label>

            <div className="incident-create__owner">
              <span className="form-field__label">Responsável inicial (opcional)</span>
              <p className="form-field__hint">
                Podes deixar o incidente sem owner ou assumir já a responsabilidade.
              </p>

              <div className="incident-create__owner-options">
                <label className="radio-pill">
                  <input
                    type="radio"
                    name="ownerMode"
                    value="none"
                    checked={ownerMode === "none"}
                    onChange={() => setOwnerMode("none")}
                    disabled={submitting}
                  />
                  <span>Sem owner</span>
                </label>

                {user && (
                  <label className="radio-pill">
                    <input
                      type="radio"
                      name="ownerMode"
                      value="self"
                      checked={ownerMode === "self"}
                      onChange={() => setOwnerMode("self")}
                      disabled={submitting}
                    />
                    <span>Atribuir a mim</span>
                  </label>
                )}
              </div>
            </div>
          </aside>
        </div>

        {error && (
          <p className="incident-create__error" role="alert">
            {error}
          </p>
        )}

        <div className="incident-create__actions">
          <button type="button" className="incident-btn incident-btn--ghost" onClick={handleCancel} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="submit"
            className="incident-btn incident-btn--primary"
            disabled={submitting || servicesLoading}
          >
            {submitting ? "A criar incidente…" : "Criar incidente"}
          </button>
        </div>
      </form>
    </section>
  );
}
