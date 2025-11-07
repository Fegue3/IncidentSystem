import { api } from "../services/api"; // ou "./api" se estiveres dentro de src/services/

export type Me = { id: string; email: string; name?: string };

export const UsersAPI = {
  me: () => api("/users/me", { auth: true }) as Promise<Me>,
  updateMe: (payload: unknown) =>
    api("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
      auth: true,
    }),
};