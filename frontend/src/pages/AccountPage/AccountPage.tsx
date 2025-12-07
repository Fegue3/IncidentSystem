import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AccountPage.css";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { TeamsAPI, type TeamSummary } from "../../services/teams";

const TEAM_STORAGE_KEY = "selectedTeamId";

export function AccountPage() {
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const displayName = user?.name ?? user?.email ?? "Utilizador";

  // --- estado para equipas / seleção ---

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState<string | "">("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [saveTeamMessage, setSaveTeamMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTeams() {
      setTeamsLoading(true);
      setTeamsError(null);

      try {
        const data = await TeamsAPI.listAll();
        if (!active) return;

        setTeams(data);

        const stored = localStorage.getItem(TEAM_STORAGE_KEY) ?? "";
        if (stored && data.some((t) => t.id === stored)) {
          setSelectedTeamId(stored);
        } else {
          setSelectedTeamId("");
        }
      } catch (e: unknown) {
        if (!active) return;
        const msg =
          e instanceof Error
            ? e.message
            : "Não foi possível carregar as equipas.";
        setTeamsError(msg);
      } finally {
        if (active) setTeamsLoading(false);
      }
    }

    loadTeams();

    return () => {
      active = false;
    };
  }, []);

  async function handleSaveTeam() {
    if (!user) return;
    setSavingTeam(true);
    setSaveTeamMessage(null);

    try {
      if (selectedTeamId) {
        // associa o utilizador à equipa escolhida
        await TeamsAPI.addMember(selectedTeamId, user.id);
        localStorage.setItem(TEAM_STORAGE_KEY, selectedTeamId);
        setSaveTeamMessage("Equipa atualizada com sucesso.");
      } else {
        // sem equipa selecionada: apenas limpa a preferência local
        localStorage.removeItem(TEAM_STORAGE_KEY);
        setSaveTeamMessage("Preferência de equipa limpa.");
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Não foi possível guardar a equipa.";
      setSaveTeamMessage(msg);
    } finally {
      setSavingTeam(false);
    }
  }

  // --- apagar conta ---

  async function handleDelete() {
    const confirmed = window.confirm(
      "Tens a certeza que queres apagar a tua conta? Esta ação é irreversível."
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await api("/auth/delete-account", {
        method: "DELETE",
        auth: true,
      });

      await logout?.();
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message ?? "Não foi possível apagar a conta.");
      } else {
        setError("Não foi possível apagar a conta.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="account">
      <header className="account__header">
        <p className="account__eyebrow">Conta</p>
        <h1 className="account__title">Definições de utilizador</h1>
        <p className="account__subtitle">
          Gere os dados da tua conta, sessão, equipa de trabalho e ações
          sensíveis relacionadas com o teu perfil.
        </p>
      </header>

      <div className="account__grid">
        {/* Perfil */}
        <section className="account-card">
          <h2 className="account-card__title">Perfil</h2>
          <p className="account-card__label">Nome</p>
          <p className="account-card__value">{displayName}</p>

          <p className="account-card__label">Email</p>
          <p className="account-card__value">{user?.email ?? "—"}</p>

          <p className="account-card__hint">
            Os dados do perfil são definidos no momento de registo. Futuras
            iterações da aplicação poderão permitir edição direta.
          </p>
        </section>

        {/* Equipa de trabalho */}
        <section className="account-card">
          <h2 className="account-card__title">Equipa de trabalho</h2>

          {teamsLoading && (
            <p className="account-card__text">
              A carregar equipas disponíveis…
            </p>
          )}

          {teamsError && (
            <p className="account-card__error" role="alert">
              {teamsError}
            </p>
          )}

          {!teamsLoading && !teamsError && (
            <>
              <label className="account-field">
                <span className="account-field__label">
                  Seleciona a tua equipa principal
                </span>
                <select
                  className="account-field__select"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
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

              {saveTeamMessage && (
                <p className="account-card__status" role="status">
                  {saveTeamMessage}
                </p>
              )}

              <button
                type="button"
                className="account-btn account-btn--primary"
                onClick={handleSaveTeam}
                disabled={savingTeam}
              >
                {savingTeam ? "A guardar…" : "Guardar equipa"}
              </button>

              <p className="account-card__hint">
                Esta equipa é usada como contexto principal em ecrãs como o
                Dashboard e criação de incidentes.
              </p>
            </>
          )}
        </section>

        {/* Sessão */}
        <section className="account-card">
          <h2 className="account-card__title">Sessão</h2>
          <p className="account-card__text">
            A tua sessão está ativa neste dispositivo. Utiliza o botão abaixo
            para terminar sessão.
          </p>

          <button
            type="button"
            className="account-btn account-btn--secondary"
            onClick={() => logout?.()}
          >
            Terminar sessão
          </button>
        </section>

        {/* Zona perigosa */}
        <section className="account-card account-card--danger">
          <h2 className="account-card__title">Zona perigosa</h2>
          <p className="account-card__text">
            Apagar a conta remove definitivamente o teu utilizador e os dados
            associados. Esta operação não pode ser desfeita.
          </p>

          {error && (
            <p className="account-card__error" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="account-btn account-btn--danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "A apagar conta..." : "Apagar conta"}
          </button>
        </section>
      </div>
    </section>
  );
}
