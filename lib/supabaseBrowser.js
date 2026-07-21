import { createBrowserClient } from "@supabase/ssr";

// Auth-only browser client (sign in / sign out). All data access still goes
// through the Next.js API routes using the service-role key — this client
// never touches app tables directly.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
