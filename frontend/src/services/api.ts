type AuthBag = {
  user: { id: string; email: string; name?: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const AUTH_KEY = "auth";

export function getAuth(): AuthBag {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : { user: null, accessToken: null, refreshToken: null };
}

export function setAuth(bag: AuthBag) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(bag));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function authHeader(): Record<string, string> {
  const { accessToken } = getAuth();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

type FetchOptions = RequestInit & { auth?: boolean; _retry?: boolean };

function shouldSetJsonContentType(options: FetchOptions) {
  const method = (options.method ?? "GET").toUpperCase();
  // só metemos JSON automaticamente quando faz sentido
  return method !== "GET" && method !== "HEAD" && options.body != null;
}

export async function api(path: string, options: FetchOptions = {}) {
  const baseHeaders: Record<string, string> = {
    ...(options.auth ? authHeader() : {}),
    ...(options.headers as any),
  };

  // ✅ NÃO forces JSON em GET (e evita mandar JSON content-type em download)
  const headers: Record<string, string> = {
    ...(shouldSetJsonContentType(options) ? { "Content-Type": "application/json" } : {}),
    ...baseHeaders,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // refresh automático
  if (res.status === 401 && options.auth && !options._retry) {
    const { refreshToken } = getAuth();

    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          const current = getAuth();

          setAuth({
            user: data.user ?? current.user,
            accessToken: data.accessToken ?? current.accessToken,
            refreshToken: data.refreshToken ?? current.refreshToken,
          });

          return api(path, { ...options, _retry: true });
        }
      } catch (err) {
        console.error("Refresh token failed", err);
      }
    }

    clearAuth();
  }

  // ✅ Se não for JSON, não forces res.json()
  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");

  const data = isJson ? await res.json().catch(() => ({} as unknown)) : null;

  if (!res.ok) {
    const body = (data ?? {}) as { message?: unknown };

    let msg: unknown = body.message;
    if (msg == null) msg = `HTTP ${res.status}`;

    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }

  return data;
}

// ✅ helper para downloads (CSV/PDF)
export async function apiBlob(path: string, options: FetchOptions = {}): Promise<Blob> {
  const baseHeaders: Record<string, string> = {
    ...(options.auth ? authHeader() : {}),
    ...(options.headers as any),
  };

  const headers: Record<string, string> = {
    ...baseHeaders,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // refresh automático também para blob
  if (res.status === 401 && options.auth && !options._retry) {
    const { refreshToken } = getAuth();

    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          const current = getAuth();

          setAuth({
            user: data.user ?? current.user,
            accessToken: data.accessToken ?? current.accessToken,
            refreshToken: data.refreshToken ?? current.refreshToken,
          });

          return apiBlob(path, { ...options, _retry: true });
        }
      } catch (err) {
        console.error("Refresh token failed", err);
      }
    }

    clearAuth();
  }

  if (!res.ok) {
    // tenta extrair msg do backend (json ou texto)
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = await res.json().catch(() => ({} as any));
      const msg = (j as any)?.message;
      throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg ?? `HTTP ${res.status}`));
    }
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }

  return await res.blob();
}

export const AuthAPI = {
  login: (email: string, password: string) =>
    api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    api("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }),
};
