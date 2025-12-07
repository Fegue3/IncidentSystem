import { useEffect, useState } from "react";
import "./TeamsPage.css";
import { TeamsAPI, type TeamSummary } from "../../services/teams";
import { useAuth } from "../../context/AuthContext";

export function TeamsPage() {
  const { user } = useAuth();

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await TeamsAPI.listAll();
        if (!active) return;
        setTeams(data);
      } catch (e: unknown) {
        if (!active) return;
        const msg =
          e instanceof Error
            ? e.message
            : "Não foi possível carregar as equipas.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    setCreateError(null);

    try {
      const team = await TeamsAPI.create(newTeamName.trim());
      setTeams((prev) => [...prev, team]);
      setNewTeamName("");
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Não foi possível criar a equipa.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="teams">
      <header className="teams__header">
        <p className="teams__eyebrow">Configuração</p>
        <h1 className="teams__title">Equipas</h1>
        <p className="teams__subtitle">
          Gere as equipas responsáveis por responder a incidentes. Podes criar
          novas equipas e acompanhar quantos membros e incidentes cada uma tem.
        </p>
      </header>

      <div className="teams__grid">
        <section className="teams-card">
          <h2 className="teams-card__title">Equipas existentes</h2>

          {loading && (
            <p className="teams__status">A carregar lista de equipas…</p>
          )}

          {error && (
            <p className="teams__status teams__status--error" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && teams.length === 0 && (
            <p className="teams__status">
              Ainda não existem equipas registadas. Cria a primeira equipa ao
              lado.
            </p>
          )}

          {!loading && !error && teams.length > 0 && (
            <ul className="teams-list">
              {teams.map((team) => (
                <li key={team.id} className="teams-list__item">
                  <div className="team-badge">
                    <p className="team-badge__name">{team.name}</p>
                    <p className="team-badge__meta">
                      {team.membersCount} membro
                      {team.membersCount === 1 ? "" : "s"} ·{" "}
                      {team.incidentsCount} incidente
                      {team.incidentsCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="teams-card">
          <h2 className="teams-card__title">Criar nova equipa</h2>
          <p className="teams-card__text">
            Utiliza este formulário para registar equipas como{" "}
            <strong>NOC 24/7</strong>, <strong>SRE Platform</strong> ou{" "}
            <strong>Service Desk</strong>. Podes associar-te a uma equipa na
            página de Conta.
          </p>

          <form className="teams-form" onSubmit={handleCreateTeam}>
            <label className="form-field">
              <span className="form-field__label">Nome da equipa</span>
              <input
                className="form-field__input"
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Ex.: NOC 24/7"
              />
            </label>

            {createError && (
              <p className="teams__status teams__status--error" role="alert">
                {createError}
              </p>
            )}

            <button
              type="submit"
              className="teams-btn"
              disabled={creating || !newTeamName.trim()}
            >
              {creating ? "A criar equipa…" : "Criar equipa"}
            </button>
          </form>

          {user && (
            <p className="teams-card__hint">
              Estás autenticado como <strong>{user.email}</strong>. Depois de
              criares equipas, podes associar-te a uma delas em{" "}
              <strong>Conta &gt; Equipa de trabalho</strong>.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
