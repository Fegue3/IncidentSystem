// frontend/src/pages/Incidents/IncidentCreatePage.tsx
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./IncidentCreatePage.css";
import {
  IncidentsAPI,
  type SeverityCode,
  getSeverityLabel,
} from "../../services/incidents";
import { UsersAPI, type Me } from "../../services/users";
import { useAuth } from "../../context/AuthContext";

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
  const { user } = useAuth(); // utilizador autenticado

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Severidade (SEV1–SEV4)
  const [severity, setSeverity] = useState<SeverityCode>("SEV3");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<MeWithTeam | null>(null);

  // modo de owner inicial: nenhum (default) ou o próprio
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("none");

  // carregar info do utilizador (para saber a equipa), sem mostrar nada no UI
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle || !cleanDescription) {
      setError("Preenche pelo menos o título e a descrição.");
      return;
    }

    if (cleanTitle.length > TITLE_MAX_LENGTH) {
      setError(
        `O título não pode ter mais de ${TITLE_MAX_LENGTH} caracteres.`
      );
      return;
    }

    if (cleanDescription.length > DESCRIPTION_MAX_LENGTH) {
      setError(
        `A descrição não pode ter mais de ${DESCRIPTION_MAX_LENGTH} caracteres.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1º tenta usar a equipa do utilizador, 2º a equipa escolhida na app (localStorage)
      const selectedTeamFromStorage =
        localStorage.getItem(TEAM_STORAGE_KEY) ?? undefined;

      const teamId = me?.team?.id ?? selectedTeamFromStorage ?? undefined;

      // calcula owner inicial
      let assigneeId: string | undefined;
      if (ownerMode === "self" && user) {
        assigneeId = user.id;
      }

      const incident = await IncidentsAPI.create({
        title: cleanTitle,
        description: cleanDescription,
        severity,     // <<< já vai como SEV1–SEV4
        teamId,
        assigneeId,   // opcional
      });

      navigate(`/incidents/${incident.id}`, { replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível criar o incidente.";
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
          Regista um novo incidente com informação suficiente para que a equipa
          responsável possa investigar e resolver o problema.
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
            {/* Severidade */}
            <label className="form-field">
              <span className="form-field__label">Severidade (SEV)</span>
              <select
                className="form-field__select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityCode)}
              >
                {(["SEV1", "SEV2", "SEV3", "SEV4"] as SeverityCode[]).map(
                  (code) => (
                    <option key={code} value={code}>
                      {getSeverityLabel(code)}
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Responsável inicial */}
            <div className="incident-create__owner">
              <span className="form-field__label">
                Responsável inicial (opcional)
              </span>
              <p className="form-field__hint">
                Podes deixar o incidente sem owner ou assumir já a
                responsabilidade.
              </p>

              <div className="incident-create__owner-options">
                <label className="radio-pill">
                  <input
                    type="radio"
                    name="ownerMode"
                    value="none"
                    checked={ownerMode === "none"}
                    onChange={() => setOwnerMode("none")}
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
          <button
            type="button"
            className="incident-btn incident-btn--ghost"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="incident-btn incident-btn--primary"
            disabled={submitting}
          >
            {submitting ? "A criar incidente…" : "Criar incidente"}
          </button>
        </div>
      </form>
    </section>
  );
}
