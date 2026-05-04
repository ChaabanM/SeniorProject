import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookieName, verifySession } from "./lib/auth";

const PUBLIC_PATHS = new Set<string>(["/login", "/access-denied"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get(getSessionCookieName())?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(url);
  }

  // Authenticated API calls should never be blocked by role page routing rules.
  // Chart pages fetch JSON from /api/*; returning HTML redirects breaks charts ("Unexpected token '<'").
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (session.role === "PROCUREMENT_RISK_MANAGER") {
    const allowed =
      pathname === "/procurement" ||
      pathname.startsWith("/modules/risk/disruption-impact") ||
      pathname.startsWith("/modules/vendor/kpis") ||
      pathname.startsWith("/risk-management") ||
      pathname.startsWith("/vendor-management");

    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = "/access-denied";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

