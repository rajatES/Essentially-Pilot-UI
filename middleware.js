import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Refreshes the Supabase auth session cookie on every matched request and gates
// /app behind a logged-in seat. Single shared workspace — this only checks
// "is somebody logged in", not per-page permissions.
//
// Data no longer flows through this app's own API (it lives in the standalone
// NestJS backend, which validates the Supabase token itself), so this middleware
// only guards the two page routes below — it no longer forwards a verified-user
// header to any local API route.
export async function middleware(request) {
  let cookiesToApply = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToApply = cookiesToSet;
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  const response = NextResponse.next({ request });
  cookiesToApply.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"]
};
