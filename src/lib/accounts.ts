import "server-only";
import { randomInt } from "node:crypto";
import type { Role } from "./auth";
import { createAdminClient } from "./supabase/admin";

/**
 * Everyone signs in with a username, so students never need an e-mail address. Behind the scenes each
 * account has an internal address on the reserved ".invalid" domain, which can never receive mail.
 */
const ACCOUNT_DOMAIN = "accounts.portal.invalid";
export const loginEmail = (username: string) => `${username.trim().toLowerCase()}@${ACCOUNT_DOMAIN}`;

// Georgian → Latin (national transliteration system).
const LATIN: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i", კ: "k", ლ: "l", მ: "m",
  ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s", ტ: "t", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q",
  შ: "sh", ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};

function transliterate(name: string) {
  return [...name.toLowerCase()].map((c) => LATIN[c] ?? c).join("");
}

/** "ნინო ბერიძე" → "nino.beridze" (with a number added if that name is taken). */
export async function makeUsername(fullName: string): Promise<string> {
  const base =
    transliterate(fullName)
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 30) || "user";
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("username").like("username", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.username as string));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}

/** Temporary password, easy to read aloud and type: "k7m2-qp9x-a3fd" (no 0/o, 1/l/i). */
export function temporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export interface NewAccount {
  fullName: string;
  username: string;
  password: string;
  role: Role;
  classLabel: string | null;
}

/** Creates the sign-in account and its profile; returns the credentials to hand over (shown once). */
export async function createAccount(input: {
  fullName: string;
  role: Role;
  schoolId: string | null;
  classLabel?: string | null;
}): Promise<NewAccount> {
  const admin = createAdminClient();
  const username = await makeUsername(input.fullName);
  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: loginEmail(username),
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "account not created");
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    school_id: input.schoolId,
    role: input.role,
    full_name: input.fullName,
    username,
    class_label: input.classLabel ?? null,
    must_change_password: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(profileError.message);
  }
  return { fullName: input.fullName, username, password, role: input.role, classLabel: input.classLabel ?? null };
}

/** New temporary password for an existing account (it must be changed again on next sign-in). */
export async function resetPassword(userId: string): Promise<string> {
  const admin = createAdminClient();
  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  return password;
}
