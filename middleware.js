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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const isAppRoute = request.nextUrl.pathname.startsWith("/app");

  // Without Supabase config createServerClient throws, which surfaces as an
  // opaque MIDDLEWARE_INVOCATION_FAILED 500 on every matched route. Degrade to
  // "logged out" instead so the app still renders and /login can explain itself.
  if (!url || !key) {
    console.error("[middleware] Supabase env vars are missing — treating the request as signed out.");
    return isAppRoute ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next();
  }

  let cookiesToApply = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToApply = cookiesToSet;
      }
    }
  });

  // A transient Supabase/network failure shouldn't 500 the whole site either.
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch (e) {
    console.error("[middleware] Supabase auth check failed:", e?.message);
    return isAppRoute ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next();
  }

  if (!user && isAppRoute) {
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
