import { createBrowserSupabase } from "@/lib/supabaseBrowser";

// Central client for talking to the standalone NestJS backend. The backend
// lives on a different origin now, so every call must (1) target that origin
// and (2) carry the Supabase session token as a Bearer header (the backend
// validates it — there are no shared auth cookies across origins).
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

// One browser Supabase client, reused so we don't re-init on every request.
let _sb;
function sb() {
  if (!_sb) _sb = createBrowserSupabase();
  return _sb;
}

// Resolve an app path ("/api/...") to the backend origin. Absolute URLs and
// non-/api paths are returned untouched.
export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

// fetch() against the backend with the Bearer token attached. Returns the raw
// Response — use when you need status/headers or a non-JSON body.
export async function apiFetch(path, options = {}) {
  let token;
  try {
    const { data } = await sb().auth.getSession();
    token = data?.session?.access_token;
  } catch {
    /* not logged in yet — public routes (login/signup/bootstrap) still work */
  }
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...options, headers });
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
