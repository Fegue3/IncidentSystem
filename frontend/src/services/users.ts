import { api } from "../services/api";

export type Me = { id: string; email: string; name?: string };

export const UsersAPI = {
  me: async () => {
    const raw = await api("/auth/me", { auth: true });
    const data = raw as { userId?: string; id?: string; email: string; name?: string };

    return {
      id: data.userId ?? data.id ?? "",
      email: data.email,
      name: data.name,
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
