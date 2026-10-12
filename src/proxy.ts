import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Pages open without signing in: the landing page, the login page and the school application form. */
const PUBLIC = ["/login", "/request"];
const PUBLIC_EXACT = ["/"];

/** Lesson data that must stay behind sign-in (still served by Next from /public once the cookie is present). */
const LESSON_ASSET = /\.(?:gz|bin|json|hdr|glb|gltf|ktx2|mp3|m4a|ogg|mp4|webm)$/i;

/**
 * Fast first check: visitors without a session cookie go to the login page. Whether the session is
 * real and what the user may do is checked on the server in every page and action (src/lib/auth.ts).
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_EXACT.includes(path) || PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  // Lesson data files (models, terrain, audio) are fetched by scripts: answer 401 instead of an HTML redirect.
  if (LESSON_ASSET.test(path)) return new NextResponse(null, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", path + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Images, fonts and the service worker skip the check; lesson data (json/bin/gz/glb/audio…) does not.
  matcher: ["/((?!_next/static|_next/image|sites/|images/|seo/|sw\\.js|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
