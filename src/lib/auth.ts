import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { collections, dbConfigured } from "./db";
import type { Role } from "./roles";
import { sessionUserId } from "./session";

export type { Role } from "./roles";
export { ROLE_NAMES } from "./roles";

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
 * The signed-in user with their school, or null. Checked against the database on every request
 * (memoised per render), so it is safe to base access decisions on.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Who is signed in is only known per request: never prerender a page that depends on it.
  await connection();
  if (!dbConfigured) return null;
  const userId = await sessionUserId();
  if (!userId) return null;
  const { users, schools } = await collections();
  const user = await users.findOne({ _id: userId });
  if (!user) return null;
  let school: CurrentUser["school"] = null;
  if (user.school_id) {
    const s = await schools.findOne({ _id: user.school_id });
    // A deactivated school locks its accounts out.
    if (!s?.active) return null;
    school = { id: s._id, name: s.name, city: s.city };
  }
  return {
    id: user._id,
    role: user.role,
    fullName: user.full_name,
    username: user.username,
    classLabel: user.class_label,
    mustChangePassword: user.must_change_password,
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

/** The signed-in user if they have one of the roles; anyone else is sent to their home page. */
export async function requireRole(roles: Role[], next?: string): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
