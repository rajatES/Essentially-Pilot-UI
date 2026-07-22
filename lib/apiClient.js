// Central client for talking to the standalone NestJS backend. The backend
// lives on a different origin, so every call must (1) target that origin and
// (2) carry our JWT as a Bearer header (there are no shared auth cookies across
// origins). The token is issued by POST /api/auth/login and kept in
// localStorage.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

const TOKEN_KEY = "pp_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}
export function clearToken() {
  setToken(null);
}

// Resolve an app path ("/api/...") to the backend origin. Absolute URLs and
// non-/api paths are returned untouched.
export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

// fetch() against the backend with the Bearer token attached. Returns the raw
// Response — use when you need status/headers or a non-JSON body. A 401 clears
// the stored token so the app falls back to the login screen.
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") clearToken();
  return res;
}

// JSON convenience wrapper: sets Content-Type (unless sending FormData), parses
// the response, and throws Error(payload.error) on a non-2xx — the same contract
// the old in-page `api()` / `jsonFetch()` helpers had.
export async function apiJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await apiFetch(path, { ...options, headers });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}
