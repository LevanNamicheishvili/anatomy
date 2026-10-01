import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { supabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";

export type Role = "super_admin" | "school_admin" | "teacher" | "student";

export const ROLE_NAMES: Record<Role, string> = {
  super_admin: "სისტემის ადმინისტრატორი",
  school_admin: "სკოლის ადმინისტრატორი",
  teacher: "მასწავლებელი",
  student: "მოსწავლე",
};

export interface CurrentUser {
  id: string;
  role: Role;
  fullName: string;
  username: string;
  classLabel: string | null;
  mustChangePassword: boolean;
  school: { id: string; name: string; city: string } | null;
}

/**
 * The signed-in user with their profile and school, or null. Verified with the auth server on every
 * request (memoised per render), so it is safe to base access decisions on.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Who is signed in is only known per request: never prerender a page that depends on it.
  await connection();
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, username, class_label, must_change_password, school_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  let school: CurrentUser["school"] = null;
  if (profile.school_id) {
    const { data } = await supabase.from("schools").select("id, name, city, active").eq("id", profile.school_id).maybeSingle();
    // A deactivated school locks its accounts out.
    if (!data?.active) return null;
    school = { id: data.id, name: data.name, city: data.city };
  }
  return {
    id: user.id,
    role: profile.role as Role,
    fullName: profile.full_name,
    username: profile.username,
    classLabel: profile.class_label,
    mustChangePassword: profile.must_change_password,
    school,
  };
});

/** For pages and actions: the signed-in user, or a redirect to the login page. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (user.mustChangePassword) redirect("/account/password?first=1");
  return user;
}

/** The signed-in user if they have one of the roles; anyone else is sent to the home page. */
export async function requireRole(roles: Role[], next?: string): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
