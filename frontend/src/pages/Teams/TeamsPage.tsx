import { useEffect, useMemo, useState } from "react";
import "./TeamsPage.css";
import { TeamsAPI, type TeamSummary } from "../../services/teams";
import { useAuth } from "../../context/AuthContext";

const TEAM_STORAGE_KEY = "selectedTeamId";

export function TeamsPage() {
  const { user } = useAuth();

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // --- A minha equipa ---
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [saveTeamMessage, setSaveTeamMessage] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await TeamsAPI.listAll();
        if (!active) return;

        setTeams(data);

        // Preferência inicial:
        // 1) se estiver autenticado: usa a equipa real do backend (/teams/me)
        // 2) se não: tenta localStorage (apenas UI)
        if (user) {
          try {
            const mine = await TeamsAPI.listMine();
            if (!active) return;

            const mineId = mine?.[0]?.id ?? "";
            if (mineId && data.some((t) => t.id === mineId)) {
              setSelectedTeamId(mineId);
              localStorage.setItem(TEAM_STORAGE_KEY, mineId);
              return;
            }
          } catch {
            // se falhar /teams/me, cai para localStorage
          }
        }

        const stored = localStorage.getItem(TEAM_STORAGE_KEY) ?? "";
        if (stored && data.some((t) => t.id === stored)) {
          setSelectedTeamId(stored);
        } else {
          setSelectedTeamId("");
        }
      } catch (e: unknown) {
        if (!active) return;
        const msg =
          e instanceof Error ? e.message : "Não foi possível carregar as equipas.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function refreshTeams() {
    const data = await TeamsAPI.listAll();
    setTeams(data);
    return data;
  }

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
        e instanceof Error ? e.message : "Não foi possível criar a equipa.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveTeam() {
    if (!user) return;

    setSavingTeam(true);
    setSaveTeamMessage(null);

    try {
      if (selectedTeamId) {
        // ✅ backend agora move o user (remove de outras equipas e adiciona nesta)
        await TeamsAPI.addMember(selectedTeamId, user.id);
        localStorage.setItem(TEAM_STORAGE_KEY, selectedTeamId);
        setSaveTeamMessage("Equipa atualizada com sucesso.");
      } else {
        // Se escolher "Nenhuma equipa", remove o user de qualquer equipa (se houver)
        const mine = await TeamsAPI.listMine();
        await Promise.all(mine.map((t) => TeamsAPI.removeMember(t.id, user.id)));

        localStorage.removeItem(TEAM_STORAGE_KEY);
        setSaveTeamMessage("Equipa removida com sucesso.");
      }

      // Atualiza contagens (membersCount/incidentsCount) no UI
      await refreshTeams();

      // Re-sincroniza a seleção com o backend
      try {
        const mine = await TeamsAPI.listMine();
        const mineId = mine?.[0]?.id ?? "";
        setSelectedTeamId(mineId);
        if (mineId) localStorage.setItem(TEAM_STORAGE_KEY, mineId);
      } catch {
        // ignora
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Não foi possível guardar a equipa.";
      setSaveTeamMessage(msg);
    } finally {
      setSavingTeam(false);
    }
  }

  const saveMessageIsError =
    !!saveTeamMessage &&
    (saveTeamMessage.toLowerCase().includes("não foi") ||
      saveTeamMessage.toLowerCase().includes("erro") ||
      saveTeamMessage.toLowerCase().includes("unauthorized"));

  return (
    <section className="teams">
      <header className="teams__header">
        <p className="teams__eyebrow">Configuração</p>
        <h1 className="teams__title">Equipas</h1>
        <p className="teams__subtitle">
          Gere as equipas responsáveis por responder a incidentes. Podes criar novas
          equipas, ver métricas e definir a tua equipa principal.
        </p>
      </header>

      <div className="teams__grid">
        {/* ESQUERDA: lista */}
        <section className="teams-card">
          <div className="teams-card__head">
            <h2 className="teams-card__title">Equipas existentes</h2>
            {!loading && !error && teams.length > 0 && (
              <p className="teams-card__count">{teams.length}</p>
            )}
          </div>

          {loading && <p className="teams__status">A carregar lista de equipas…</p>}

          {error && (
            <p className="teams__status teams__status--error" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && teams.length === 0 && (
            <p className="teams__status">
              Ainda não existem equipas registadas. Cria a primeira equipa ao lado.
            </p>
          )}

          {!loading && !error && teams.length > 0 && (
            <ul className="teams-list teams-list--scroll">
              {teams.map((team) => {
                const isSelected = team.id === selectedTeamId;

                return (
                  <li key={team.id} className="teams-list__item">
                    <div className={`team-badge ${isSelected ? "team-badge--selected" : ""}`}>
                      <div className="team-badge__top">
                        <p className="team-badge__name">{team.name}</p>
                        {isSelected && <span className="team-badge__pill">Atual</span>}
                      </div>

                      <p className="team-badge__meta">
                        {team.membersCount} membro{team.membersCount === 1 ? "" : "s"} ·{" "}
                        {team.incidentsCount} incidente{team.incidentsCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* DIREITA: criar + minha equipa */}
        <section className="teams-card">
          <h2 className="teams-card__title">Criar nova equipa</h2>
          <p className="teams-card__text">
            Utiliza este formulário para registar equipas como{" "}
            <strong>NOC 24/7</strong>, <strong>SRE Platform</strong> ou{" "}
            <strong>Service Desk</strong>.
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

          <div className="teams-divider" />

          <h2 className="teams-card__title">A minha equipa</h2>

          {!user && (
            <p className="teams-card__hint">
              Inicia sessão para definires a tua equipa principal.
            </p>
          )}

          {user && (
            <>
              <label className="teams-field">
                <span className="teams-field__label">Seleciona a tua equipa principal</span>
                <select
                  className="teams-field__select"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  disabled={loading || !!error}
                >
                  <option value="">— Nenhuma equipa —</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.membersCount} membro
                      {team.membersCount === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              </label>

              {selectedTeam && (
                <p className="teams-card__hint">
                  Equipa atual: <strong>{selectedTeam.name}</strong>
                </p>
              )}

              {saveTeamMessage && (
                <p
                  className={`teams__status ${saveMessageIsError ? "teams__status--error" : ""}`}
                  role="status"
                >
                  {saveTeamMessage}
                </p>
              )}

              <button
                type="button"
                className="teams-btn teams-btn--secondary"
                onClick={handleSaveTeam}
                disabled={savingTeam}
              >
                {savingTeam ? "A guardar…" : "Guardar equipa"}
              </button>

              <p className="teams-card__hint">
                Estás autenticado como <strong>{user.email}</strong>. Esta escolha fica
                guardada e é usada como contexto principal.
              </p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
