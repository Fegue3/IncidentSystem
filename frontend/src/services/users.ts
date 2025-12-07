// frontend/src/services/users.ts
import { api } from "./api";

export type Me = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  teamId?: string | null;
};

export type UserSummary = {
  id: string;
  email: string;
  name?: string | null;
};

export const UsersAPI = {
  async me(): Promise<Me> {
    const raw = await api("/auth/me", { auth: true });

    const data = raw as {
      userId?: string;
      id?: string;
      email: string;
      name?: string;
      role?: string;
      teamId?: string | null;
    };

    return {
      id: data.userId ?? data.id ?? "",
      email: data.email,
      name: data.name,
      role: data.role,
      teamId: data.teamId ?? null,
    };
  },

  // ainda não tens endpoint no backend, fica só preparado
  updateMe: (payload: unknown) =>
    api("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
    }),

  /**
   * Lista simples de utilizadores para dropdowns / owner, etc.
   * Ajusta o endpoint se no backend for diferente.
   */
  async listAll(): Promise<UserSummary[]> {
    const raw = await api("/users", {
      auth: true,
    });

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
