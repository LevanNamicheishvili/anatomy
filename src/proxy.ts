import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";

/** Pages open without signing in: the login page and the school application form. */
const PUBLIC = ["/login", "/request"];

/**
 * Refreshes the Supabase session cookie on every request and sends visitors without a session to the
 * login page. This is only the fast first check; every page and action checks the user again on the
 * server (src/lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
  if (!supabaseConfigured) {
    // Not connected yet: everything except the public pages shows the login page with a setup note.
    return isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const login = new URL("/login", request.url);
    if (path !== "/") login.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Static files (3D models, images, the service worker) don't need the check.
  matcher: ["/((?!_next/static|_next/image|sites/|images/|seo/|sw\\.js|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|gz|bin|json)$).*)"],
};
