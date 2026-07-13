import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Pages reachable without a session. /reset-password stays reachable either
// way: the recovery flow arrives with a session, and the page itself handles
// the no-session case.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
]);

/**
 * Session refresh + optimistic gating only. This is NOT the security
 * boundary: it never touches the DB, and Server Actions on excluded paths
 * bypass it entirely. Authoritative checks live in the DAL (lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/forgot-password")) {
    // The DAL routes them onward (onboarding / pending / dashboard).
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization, metadata files,
    // and the OAuth callback (it must run its code exchange untouched).
    "/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
