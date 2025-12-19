/**
 * @file TeamsPage.tsx
 * @module pages/Teams/TeamsPage
 *
 * @summary
 *  - Página de gestão de equipas: lista equipas, permite criar novas e definir a “minha equipa” do utilizador.
 *
 * @description
 *  - Esta página apresenta duas áreas principais:
 *    1) Lista de equipas existentes (com métricas de membros/incidentes).
 *    2) Painel lateral para:
 *       - criar equipa (admin/gestão, dependendo das permissões do backend)
 *       - selecionar e guardar a equipa principal do utilizador autenticado
 *
 *  - Persistência de seleção (UX):
 *    - A seleção é guardada em `localStorage`, MAS:
 *      - ✅ chave é por utilizador (`selectedTeamId:<userId>`)
 *      - ✅ utilizador autenticado SEM equipa no backend não herda preferências antigas
 *    - A “fonte de verdade” é sempre `/teams/me`.
 *
 * @dependencies
 *  - React (`useEffect`, `useMemo`, `useState`) para state/side-effects.
 *  - `TeamsAPI` para chamadas ao backend (listar, criar, adicionar/remover membro).
 *  - `useAuth` para obter o utilizador autenticado e usar `user.id` em operações.
 *  - CSS: `./TeamsPage.css` (layout, cards, badges, responsivo).
 *
 * @security
 *  - A página depende do `AuthContext` para saber se existe sessão (`user`).
 *  - Operações que alteram membership (add/remove) só executam quando `user` existe.
 *  - Permissões reais (ex.: quem pode criar equipas) são validadas no backend.
 *
 * @errors
 *  - Erros de carregamento de equipas são mostrados como status message.
 *  - Erros ao criar equipa são mostrados no formulário.
 *  - Erros ao guardar equipa são refletidos em `saveTeamMessage`.
 *
 * @performance
 *  - Carrega equipas ao montar (e quando `user?.id` muda).
 *  - `selectedTeam` usa `useMemo` para evitar `find()` repetido em render.
 *  - `refreshTeams()` re-fetch para atualizar contagens após alterações.
 *
 * @notes
 *  - `TeamsAPI.addMember(teamId, userId)` assume comportamento do backend:
 *    mover utilizador para a equipa alvo (removendo de outras equipas). Se isso mudar, ajustar UI.
 *  - ✅ Fix: evitar “leak” de seleção entre contas via localStorage global.
 */

import { useEffect, useMemo, useState } from "react";
import "./TeamsPage.css";
import { TeamsAPI, type TeamSummary } from "../../services/teams";
import { useAuth } from "../../context/AuthContext";

/**
 * Devolve a chave de localStorage para a seleção de equipa.
 *
 * @remarks
 * - A chave é por utilizador para evitar heranças entre contas no mesmo browser.
 * - Para sessões sem login (guest), usa chave separada.
 */
function teamStorageKey(userId?: string) {
  return userId ? `selectedTeamId:${userId}` : "selectedTeamId:guest";
}

/**
 * Página de Equipas.
 *
 * Funcionalidades:
 * - Listar equipas e métricas (membros/incidentes).
 * - Criar nova equipa.
 * - Selecionar e guardar a equipa principal do utilizador autenticado.
 */
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

  /**
   * Equipa atualmente selecionada na UI (ou null).
   */
  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  /**
   * Carrega equipas:
   * - lista global (`/teams`)
   * - e, se houver utilizador, tenta obter equipa “real” do backend (`/teams/me`)
   *
   * Regras de seleção inicial:
   * - ✅ Se houver `user`:
   *   - tenta `/teams/me`
   *   - se vier equipa: seleciona-a e guarda em localStorage (por user)
   *   - se vier vazio: limpa seleção e remove localStorage (não herda do user anterior)
   *   - só cai para localStorage se `/teams/me` falhar (erro)
   * - Se não houver `user`:
   *   - usa localStorage "guest"
   *
   * @remarks
   * - Usa a flag `active` para evitar setState após unmount.
   */
  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const key = teamStorageKey(user?.id);

      try {
        const data = await TeamsAPI.listAll();
        if (!active) return;

        setTeams(data);

        // --- Se estiver autenticado, a fonte de verdade é /teams/me ---
        if (user) {
          try {
            const mine = await TeamsAPI.listMine();
            if (!active) return;

            const mineId = mine?.[0]?.id ?? "";

            if (mineId && data.some((t) => t.id === mineId)) {
              setSelectedTeamId(mineId);
              localStorage.setItem(key, mineId);
            } else {
              // ✅ user autenticado mas SEM equipa -> não herdar seleção antiga
              setSelectedTeamId("");
              localStorage.removeItem(key);
            }

            return; // ✅ importante: não cair para fallback quando /teams/me respondeu
          } catch {
            // Se falhar /teams/me, aí sim: fallback para localStorage (por user)
          }
        }

        // --- Fallback (guest ou /teams/me falhou) ---
        const stored = localStorage.getItem(key) ?? "";
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

  /**
   * Recarrega a lista global de equipas (útil após alterações para atualizar contagens).
   *
   * @returns Lista atualizada de equipas.
   */
  async function refreshTeams() {
    const data = await TeamsAPI.listAll();
    setTeams(data);
    return data;
  }

  /**
   * Handler do formulário de criação de equipa.
   *
   * @param e Evento de submit do form.
   */
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

  /**
   * Guarda a equipa principal do utilizador.
   *
   * Regras:
   * - Se `selectedTeamId` tiver valor:
   *   - chama `TeamsAPI.addMember(selectedTeamId, user.id)` e guarda no localStorage (por user)
   * - Se `selectedTeamId` for vazio:
   *   - remove o user de todas as equipas atuais (`TeamsAPI.listMine` + removeMember)
   *   - remove a chave do localStorage (por user)
   *
   * Depois:
   * - refresh de equipas para atualizar métricas
   * - tenta re-sincronizar a seleção com `/teams/me`
   */
  async function handleSaveTeam() {
    if (!user) return;

    const key = teamStorageKey(user.id);

    setSavingTeam(true);
    setSaveTeamMessage(null);

    try {
      if (selectedTeamId) {
        // ✅ backend agora move o user (remove de outras equipas e adiciona nesta)
        await TeamsAPI.addMember(selectedTeamId, user.id);
        localStorage.setItem(key, selectedTeamId);
        setSaveTeamMessage("Equipa atualizada com sucesso.");
      } else {
        // Se escolher "Nenhuma equipa", remove o user de qualquer equipa (se houver)
        const mine = await TeamsAPI.listMine();
        await Promise.all(mine.map((t) => TeamsAPI.removeMember(t.id, user.id)));

        localStorage.removeItem(key);
        setSaveTeamMessage("Equipa removida com sucesso.");
      }

      // Atualiza contagens (membersCount/incidentsCount) no UI
      await refreshTeams();

      // Re-sincroniza a seleção com o backend
      try {
        const mine = await TeamsAPI.listMine();
        const mineId = mine?.[0]?.id ?? "";

        setSelectedTeamId(mineId);

        if (mineId) localStorage.setItem(key, mineId);
        else localStorage.removeItem(key);
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

  /**
   * Heurística simples para aplicar estilo de erro na mensagem de save.
   *
   * @remarks
   * - Idealmente, a UI deveria ter estados explícitos (success/error) em vez de heurística por string.
   */
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
                    <div
                      className={`team-badge ${isSelected ? "team-badge--selected" : ""}`}
                    >
                      <div className="team-badge__top">
                        <p className="team-badge__name">{team.name}</p>
                        {isSelected && <span className="team-badge__pill">Atual</span>}
                      </div>

                      <p className="team-badge__meta">
                        {team.membersCount} membro{team.membersCount === 1 ? "" : "s"} ·{" "}
                        {team.incidentsCount} incidente
                        {team.incidentsCount === 1 ? "" : "s"}
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
                <span className="teams-field__label">
                  Seleciona a tua equipa principal
                </span>
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
