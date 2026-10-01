import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Pages open without signing in: the landing page, the login page and the school application form. */
const PUBLIC = ["/login", "/request"];
const PUBLIC_EXACT = ["/"];

/**
 * Fast first check: visitors without a session cookie go to the login page. Whether the session is
 * real and what the user may do is checked on the server in every page and action (src/lib/auth.ts).
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_EXACT.includes(path) || PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", path + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Static files (3D models, images, the service worker) don't need the check.
  matcher: ["/((?!_next/static|_next/image|sites/|images/|seo/|sw\\.js|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|gz|bin|json)$).*)"],
};
