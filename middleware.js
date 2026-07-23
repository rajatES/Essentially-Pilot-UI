import { NextResponse } from "next/server";

// Auth is a Bearer JWT in localStorage, invisible to edge middleware. Route
// gating happens client-side (/app redirects to /login without a token) and
// every API call is authenticated server-side. Intentional no-op.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
