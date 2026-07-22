import { NextResponse } from "next/server";

// Auth is a JWT kept in localStorage now (not a cookie), so edge middleware
// can't inspect it — the /app route gates itself client-side (redirects to
// /login when no token is present), and every backend call is Bearer-
// authenticated and 401s on its own. This middleware is therefore a no-op;
// it's kept as an explicit anchor so the gating decision is discoverable.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
