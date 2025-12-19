/**
 * @file users.ts
 * @module services/users
 *
 * @summary
 *  - API client para utilizadores: obter perfil (`me`), atualizar e listar utilizadores para dropdowns.
 *
 * @description
 *  - Centraliza chamadas relacionadas com utilizadores:
 *    - GET `/auth/me` para identificar utilizador autenticado
 *    - PATCH `/users/me` (preparado, depende do backend)
 *    - GET `/users` para listar utilizadores (owners/assignees)
 *
 * @dependencies
 *  - `api()` do módulo `./api`.
 *
 * @security
 *  - Todas as chamadas usam `auth:true`.
 *  - O backend deve validar permissões para listar utilizadores (ex.: admin).
 *
 * @errors
 *  - Qualquer erro HTTP lança `Error` via `api()`.
 *
 * @performance
 *  - `listAll()` devolve payload simples (id/email/name) para dropdowns.
 */

// frontend/src/services/users.ts
import { api } from "./api";

/**
 * Modelo do utilizador autenticado (perfil).
 *
 * @notes
 * - `role` é string porque pode variar (USER/ADMIN) e o frontend tolera extensões.
 * - `teamId` pode ser null.
 */
export type Me = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  teamId?: string | null;
};

/** Modelo leve de utilizador (para lists e dropdowns). */
export type UserSummary = {
  id: string;
  email: string;
  name?: string | null;
};

/**
 * API client para endpoints de utilizadores.
 */
export const UsersAPI = {
  /**
   * Obtém o utilizador autenticado.
   *
   * @returns Perfil normalizado (`Me`).
   *
   * @notes
   * - O backend pode devolver `userId` ou `id`. Aqui normalizamos para `id`.
   */
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

  /**
   * Atualiza dados do utilizador autenticado.
   *
   * @param payload Corpo de atualização (depende do contrato do backend).
   * @returns JSON do backend.
   *
   * @notes
   * - Comentário no código indica que ainda não existe endpoint no backend.
   * - Mantém-se preparado para quando o endpoint estiver disponível.
   */
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
   *
   * @returns Lista de UserSummary.
   *
   * @notes
   * - Ajustar endpoint se no backend for diferente.
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
