// frontend/src/services/users.ts
import { api } from "../services/api";

export type Me = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  teamId?: string | null;
};

export const UsersAPI = {
  me: async () => {
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
    } as Me;
  },

  // este ainda não tem endpoint no backend, mas deixo preparado
  updateMe: (payload: unknown) =>
    api("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
      auth: true,
    }),
};
