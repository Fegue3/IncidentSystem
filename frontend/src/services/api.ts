/**
 * @file api.ts
 * @module services/api
 *
 * @summary
 *  - Cliente HTTP central do frontend (fetch wrapper) com autenticação, refresh automático e helpers para JSON e downloads.
 *
 * @description
 *  - Este ficheiro é a “gateway” para falar com o backend REST.
 *  - Centraliza:
 *    - armazenamento/leitura de sessão (access/refresh tokens)
 *    - header Authorization (Bearer)
 *    - refresh automático em 401 (quando auth=true)
 *    - parsing de respostas JSON e mensagens de erro
 *    - downloads (CSV/PDF) via Blob
 *
 * @dependencies
 *  - `fetch` (Web API) para requests HTTP.
 *  - `localStorage` para persistência de sessão no browser.
 *  - `import.meta.env.VITE_API_URL` para configurar o base URL do backend.
 *
 * @security
 *  - Tokens são guardados em `localStorage` (ponto a considerar em threat model: XSS).
 *  - `auth: true` injeta `Authorization: Bearer <accessToken>`.
 *  - Em `401` com `auth:true`, tenta refresh com `/auth/refresh` e repete 1 vez (proteção `_retry`).
 *  - Se refresh falhar, faz `clearAuth()` para forçar re-login.
 *
 * @errors
 *  - Lança `Error` com mensagem extraída do backend (quando JSON) ou `HTTP <status>`.
 *  - Em downloads: tenta extrair mensagem por JSON ou texto.
 *
 * @performance
 *  - Refresh token é feito apenas quando necessário (401) e no máximo 1 retry por request.
 *  - `Content-Type` só é adicionado quando faz sentido (evita atrapalhar downloads e GETs).
 *
 * @example
 *  ```ts
 *  import { api, apiBlob } from "./api";
 *
 *  const data = await api("/incidents", { auth: true });
 *  const pdf = await apiBlob("/reports/export.pdf?from=2025-01-01", { auth: true });
 *  ```
 */

export type AuthBag = {
  /** Utilizador autenticado (null se não existir sessão). */
  user: { id: string; email: string; name?: string } | null;
  /** JWT de acesso (usado em Authorization header). */
  accessToken: string | null;
  /** Refresh token para obter novo access token quando expirado. */
  refreshToken: string | null;
};

/**
 * Resposta “normal” de autenticação do backend.
 * Ajusta este tipo se o backend devolver campos diferentes.
 */
export type AuthResponse = {
  user: AuthBag["user"];
  accessToken: string;
  refreshToken: string;
};

type RefreshResponse = Partial<AuthResponse>;

type ErrorBody = {
  message?: unknown;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const AUTH_KEY = "auth";

/**
 * Lê a sessão autenticada do `localStorage`.
 *
 * @returns AuthBag com user/tokens ou valores null quando não existe sessão guardada.
 */
export function getAuth(): AuthBag {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw
    ? (JSON.parse(raw) as AuthBag)
    : { user: null, accessToken: null, refreshToken: null };
}

/**
 * Guarda a sessão autenticada no `localStorage`.
 *
 * @param bag Estrutura com user + accessToken + refreshToken.
 */
export function setAuth(bag: AuthBag) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(bag));
}

/**
 * Remove a sessão autenticada do `localStorage`.
 */
export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

/**
 * Constrói o header `Authorization` baseado no access token atual.
 *
 * @returns Objeto de headers (vazio se não houver token).
 */
function authHeader(): Record<string, string> {
  const { accessToken } = getAuth();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/**
 * Headers aqui são sempre um objeto simples para permitir spread sem casts.
 * (Se precisares de Headers()/tuples, eu dou-te a versão “robusta” que converte.)
 */
export type FetchOptions = Omit<RequestInit, "headers"> & {
  /**
   * Se true, injeta Authorization header.
   * Se o backend devolver 401, tenta refresh automático (uma vez).
   */
  auth?: boolean;

  /**
   * Flag interna: evita loops de retry quando o refresh falha.
   * Não deve ser setada manualmente fora deste módulo.
   */
  _retry?: boolean;

  /** Headers adicionais (como objeto simples) para facilitar `...spread`. */
  headers?: Record<string, string>;
};

/**
 * Decide se deve adicionar `Content-Type: application/json` automaticamente.
 *
 * Regras:
 * - Não adiciona para GET/HEAD.
 * - Só adiciona quando existe body (ex.: POST/PATCH com JSON).
 *
 * @param options Opções do fetch.
 */
function shouldSetJsonContentType(options: FetchOptions) {
  const method = (options.method ?? "GET").toUpperCase();
  return method !== "GET" && method !== "HEAD" && options.body != null;
}

/**
 * Tenta renovar a sessão usando refresh token.
 *
 * @returns true se o refresh funcionou e os tokens foram atualizados; false caso contrário.
 *
 * @notes
 * - Este método não lança erro: falhas retornam `false` e deixam a decisão ao caller.
 * - Atualiza tokens no `localStorage`.
 */
async function tryRefreshToken(): Promise<boolean> {
  const { refreshToken } = getAuth();
  if (!refreshToken) return false;

  try {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshRes.ok) return false;

    const data = (await refreshRes.json()) as RefreshResponse;
    const current = getAuth();

    setAuth({
      user: data.user ?? current.user,
      accessToken: data.accessToken ?? current.accessToken,
      refreshToken: data.refreshToken ?? current.refreshToken,
    });

    return true;
  } catch (err) {
    console.error("Refresh token failed", err);
    return false;
  }
}

/**
 * Extrai uma mensagem de erro “human friendly” a partir do body do backend.
 *
 * @param body Corpo do erro (JSON) ou null.
 * @param status HTTP status code.
 * @returns Mensagem final para lançar em `Error`.
 */
function extractErrorMessage(body: ErrorBody | null, status: number): string {
  const msg = body?.message ?? `HTTP ${status}`;
  return Array.isArray(msg) ? msg.join(", ") : String(msg);
}

/**
 * Cliente HTTP base para respostas JSON.
 *
 * @param path Caminho relativo (ex.: "/incidents").
 * @param options Opções do fetch. Se `auth:true`, injeta token e tenta refresh em 401.
 * @returns Body JSON já parseado e tipado.
 *
 * @throws Error quando `res.ok` é false.
 *
 * @notes
 * - Se o content-type não for JSON, retorna `null` (não faz parse).
 * - Não força `Content-Type: application/json` em GET/HEAD.
 */
export async function api<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const baseHeaders: Record<string, string> = {
    ...(options.auth ? authHeader() : {}),
    ...(options.headers ?? {}),
  };

  const headers: Record<string, string> = {
    ...(shouldSetJsonContentType(options)
      ? { "Content-Type": "application/json" }
      : {}),
    ...baseHeaders,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // refresh automático
  if (res.status === 401 && options.auth && !options._retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return api<T>(path, { ...options, _retry: true });
    clearAuth();
  }

  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");

  const data: unknown = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    const body = (data && typeof data === "object" ? (data as ErrorBody) : null);
    throw new Error(extractErrorMessage(body, res.status));
  }

  return data as T;
}

/**
 * Helper para downloads (CSV/PDF) ou endpoints que devolvem binário.
 *
 * @param path Caminho relativo (ex.: "/reports/export.pdf?from=...").
 * @param options Opções do fetch. Se `auth:true`, injeta token e tenta refresh em 401.
 * @returns Blob pronto a ser transformado em URL e descarregado.
 *
 * @throws Error quando `res.ok` é false (tenta extrair mensagem em JSON ou texto).
 */
export async function apiBlob(
  path: string,
  options: FetchOptions = {},
): Promise<Blob> {
  const baseHeaders: Record<string, string> = {
    ...(options.auth ? authHeader() : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: baseHeaders,
  });

  // refresh automático também para blob
  if (res.status === 401 && options.auth && !options._retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return apiBlob(path, { ...options, _retry: true });
    clearAuth();
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";

    if (ct.includes("application/json")) {
      const j: unknown = await res.json().catch(() => ({}));
      const body = (j && typeof j === "object" ? (j as ErrorBody) : null);
      throw new Error(extractErrorMessage(body, res.status));
    }

    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }

  return await res.blob();
}

/**
 * Conjunto de chamadas de autenticação.
 *
 * @notes
 * - `login` e `register` não usam `auth:true` (ainda não há token).
 * - As Pages/Context devem chamar `setAuth()` com a resposta do backend.
 */
export const AuthAPI = {
  /**
   * Efetua login e obtém tokens.
   *
   * @param email Email do utilizador.
   * @param password Password.
   * @returns Resposta do backend (tipicamente { user, accessToken, refreshToken }).
   */
  login: (email: string, password: string) =>
    api<AuthResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  /**
   * Regista um utilizador e obtém tokens (dependendo do backend).
   *
   * @param name Nome.
   * @param email Email do utilizador.
   * @param password Password.
   * @returns Resposta do backend.
   */
  register: (name: string, email: string, password: string) =>
    api<AuthResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }),
};
