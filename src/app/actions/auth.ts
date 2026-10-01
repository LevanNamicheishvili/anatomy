"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { collections, dbConfigured } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, destroyUserSessions } from "@/lib/session";

export interface FormState {
  error?: string;
  /** Typed username, given back after a failed attempt so it doesn't have to be retyped. */
  username?: string;
}

/** Only same-site paths are followed after signing in. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && next !== "/" ? next : "/dashboard";
}

const MAX_FAILURES = 10;
const LOCK_MINUTES = 15;

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!dbConfigured) return { error: "სისტემა ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან.", username };
  if (!username || !password) return { error: "შეიყვანე მომხმარებლის სახელი და პაროლი.", username };

  const { users, schools, attempts } = await collections();
  // Too many wrong passwords for this username: wait before trying again.
  const failures = await attempts.findOne({ _id: username, reset_at: { $gt: new Date() } });
  if (failures && failures.count >= MAX_FAILURES)
    return { error: `ძალიან ბევრი წარუმატებელი მცდელობა. სცადე ${LOCK_MINUTES} წუთში.`, username };

  const user = await users.findOne({ username });
  // The same message for a wrong username and a wrong password, so accounts can't be probed.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await attempts.updateOne(
      { _id: username },
      { $inc: { count: 1 }, $setOnInsert: { reset_at: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } },
      { upsert: true },
    );
    return { error: "მომხმარებლის სახელი ან პაროლი არასწორია.", username };
  }
  if (user.school_id && !(await schools.findOne({ _id: user.school_id, active: true })))
    return { error: "სკოლა გათიშულია. მიმართე სკოლის ადმინისტრატორს.", username };

  await attempts.deleteOne({ _id: username });
  await createSession(user._id);
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  if (dbConfigured) await destroySession();
  redirect("/login");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const password = String(form.get("password") ?? "");
  const repeat = String(form.get("repeat") ?? "");
  if (password.length < 8) return { error: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს." };
  if (password !== repeat) return { error: "პაროლები ერთმანეთს არ ემთხვევა." };
  const { users } = await collections();
  await users.updateOne({ _id: user.id }, { $set: { password_hash: await hashPassword(password), must_change_password: false } });
  // Other browsers signed in with the old password are signed out; this one stays signed in.
  await destroyUserSessions(user.id);
  await createSession(user.id);
  redirect("/dashboard");
}
