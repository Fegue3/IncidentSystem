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

function authHeader() {
  const { accessToken } = getAuth();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

type FetchOptions = RequestInit & { auth?: boolean; _retry?: boolean };

export async function api(path: string, options: FetchOptions = {}) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.auth ? authHeader() : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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
      } catch {}
    }
    clearAuth();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message ?? `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }
  return data;
}

export const AuthAPI = {
  login: (email: string, password: string) =>
    api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    api("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
};