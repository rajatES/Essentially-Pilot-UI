# Essentially PostingPilot — Frontend (Next.js)

The UI for PostingPilot. This is now a **pure frontend** — it renders the app and
talks to the standalone NestJS backend over HTTP. There are no `app/api` routes
here anymore.

## How it talks to the backend

All data access goes through `lib/apiClient.js`:

- `apiFetch(path, options)` / `apiJson(path, options)` resolve `path` against
  `NEXT_PUBLIC_API_URL` and attach the Supabase session token as a Bearer header.
- `apiUrl(path)` builds a backend URL for full-page navigations (OAuth "connect"
  links).

Supabase is used **only** for browser auth (sign in / sign out and reading the
session token). No app tables are touched directly from the browser.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL + Supabase public keys
npm run dev                  # http://localhost:3000
```

Make sure the backend is running (default `http://localhost:4000`) and its
`CORS_ORIGINS` includes this app's origin.

## Environment

See `.env.example`:

- `NEXT_PUBLIC_API_URL` — backend origin (no trailing slash)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — browser auth
- `NEXT_PUBLIC_FACEBOOK_APP_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY`,
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — client-side integrations

## Note on "Connect account" permissions

The old `/api/auth/facebook/start` route enforced admin/Group-Head access using
the server session cookie. With Bearer-only auth there is no session on a
top-level browser navigation, so **that gate now lives in the UI** — hide/disable
the connect controls for non-admins. The backend callbacks still write to the
single shared workspace.
