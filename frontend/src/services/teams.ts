/**
 * @file teams.ts
 * @module services/teams
 *
 * @summary
 *  - API client para equipas: listar, criar, gerir membros e obter membros de equipa.
 *
 * @description
 *  - Este módulo abstrai endpoints `/teams`.
 *  - Inclui mapeamento defensivo de `_count` vindo do backend.
 *  - Exposição de funções usadas tipicamente em ecrãs de gestão (admin) e em dropdowns.
 *
 * @dependencies
 *  - `api()` do módulo `./api`.
 *  - Tipos `UserSummary` do módulo `./users` (para listagem de membros).
 *
 * @security
 *  - Todas as chamadas requerem autenticação (`auth:true`).
 *  - Permissões (admin/owner/member) devem ser validadas no backend.
 *
 * @errors
 *  - Qualquer erro HTTP lança `Error` via `api()`.
 *
 * @performance
 *  - `listAll`/`listMine` devolvem summaries (evitar payloads grandes).
 *  - `listMembers` deve ser usado apenas quando necessário (ex.: abrir modal/select owner).
 */

// frontend/src/services/teams.ts
import { api } from "./api";
import type { UserSummary } from "./users";

/**
 * Modelo resumido de equipa usado na UI (cards/tabelas).
 */
export type TeamSummary = {
  id: string;
  name: string;
  membersCount: number;
  incidentsCount: number;
};

// estrutura esperada vinda do backend
type RawTeamFromApi = {
  id: string;
  name: string;
  _count?: {
    members?: number | null;
    incidents?: number | null;
  } | null;
};

/**
 * Normaliza o payload do backend para a forma `TeamSummary`.
 * Usa defaults seguros quando `_count` não existe.
 *
 * @param raw Team como vem do backend.
 */
function mapTeam(raw: RawTeamFromApi): TeamSummary {
  return {
    id: raw.id,
    name: raw.name,
    membersCount: raw._count?.members ?? 0,
    incidentsCount: raw._count?.incidents ?? 0,
  };
}

/**
 * API client para endpoints de equipas.
 */
export const TeamsAPI = {
  /**
   * Lista todas as equipas (tipicamente para admin/gestão).
   *
   * @returns Lista de TeamSummary.
   */
  listAll: async (): Promise<TeamSummary[]> => {
    const raw = await api("/teams", { auth: true });
    const data = raw as RawTeamFromApi[];
    return data.map(mapTeam);
  },

  /**
   * Lista equipas onde o utilizador autenticado é membro.
   *
   * @returns Lista de TeamSummary.
   */
  listMine: async (): Promise<TeamSummary[]> => {
    const raw = await api("/teams/me", { auth: true });
    const data = raw as RawTeamFromApi[];
    return data.map(mapTeam);
  },

  /**
   * Cria uma nova equipa.
   *
   * @param name Nome da equipa.
   * @returns TeamSummary criada.
   */
  create: async (name: string): Promise<TeamSummary> => {
    const raw = await api("/teams", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ name }),
    });
    const team = raw as RawTeamFromApi;
    return mapTeam(team);
  },

  /**
   * Adiciona um membro a uma equipa.
   *
   * @param teamId ID da equipa.
   * @param userId ID do utilizador.
   */
  addMember: async (teamId: string, userId: string): Promise<void> => {
    await api(`/teams/${teamId}/members`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ userId }),
    });
  },

  /**
   * Remove um membro de uma equipa.
   *
   * @param teamId ID da equipa.
   * @param userId ID do utilizador.
   */
  removeMember: async (teamId: string, userId: string): Promise<void> => {
    await api(`/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
      auth: true,
    });
  },

  /**
   * Lista membros de uma equipa (útil para selects de owner/assignee).
   *
   * Usa o endpoint GET /teams/:id/members.
   *
   * @param teamId ID da equipa.
   * @returns Lista de utilizadores em formato UserSummary.
   */
  listMembers: async (teamId: string): Promise<UserSummary[]> => {
    const raw = await api(`/teams/${teamId}/members`, { auth: true });
    const data = raw as {
      id: string;
      email: string;
      name?: string | null;
    }[];

    return data.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name ?? null,
    }));
  },
};
