// frontend/src/services/teams.ts
import { api } from "./api";
import type { UserSummary } from "./users";

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

function mapTeam(raw: RawTeamFromApi): TeamSummary {
  return {
    id: raw.id,
    name: raw.name,
    membersCount: raw._count?.members ?? 0,
    incidentsCount: raw._count?.incidents ?? 0,
  };
}

export const TeamsAPI = {
  // todas as equipas (para o ecrã de admin / gestão)
  listAll: async (): Promise<TeamSummary[]> => {
    const raw = await api("/teams", { auth: true });
    const data = raw as RawTeamFromApi[];
    return data.map(mapTeam);
  },

  // equipas em que o utilizador autenticado é membro (se precisares)
  listMine: async (): Promise<TeamSummary[]> => {
    const raw = await api("/teams/me", { auth: true });
    const data = raw as RawTeamFromApi[];
    return data.map(mapTeam);
  },

  create: async (name: string): Promise<TeamSummary> => {
    const raw = await api("/teams", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ name }),
    });
    const team = raw as RawTeamFromApi;
    return mapTeam(team);
  },

  addMember: async (teamId: string, userId: string): Promise<void> => {
    await api(`/teams/${teamId}/members`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ userId }),
    });
  },

  removeMember: async (teamId: string, userId: string): Promise<void> => {
    await api(`/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
      auth: true,
    });
  },

  /**
   * NOVO: lista de membros de uma equipa (para escolher owner).
   * Usa o endpoint GET /teams/:id/members.
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
