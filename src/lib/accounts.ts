import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { collections } from "./db";
import { hashPassword } from "./password";
import type { Role } from "./roles";
import { destroyUserSessions } from "./session";

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
  const { users } = await collections();
  const escaped = base.replace(/\./g, "\\.");
  const taken = new Set(
    (await users.find({ username: { $regex: `^${escaped}\\d*$` } }, { projection: { username: 1 } }).toArray()).map((u) => u.username),
  );
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

/** Creates an account with a temporary password; returns the details to hand over (shown once). */
export async function createAccount(input: {
  fullName: string;
  role: Role;
  schoolId: string | null;
  classLabel?: string | null;
}): Promise<NewAccount> {
  const { users } = await collections();
  const password = temporaryPassword();
  const password_hash = await hashPassword(password);
  // Two people can be named the same at the same moment: retry if the username was just taken.
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = await makeUsername(input.fullName);
    try {
      await users.insertOne({
        _id: randomUUID(),
        username,
        password_hash,
        role: input.role,
        school_id: input.schoolId,
        full_name: input.fullName,
        class_label: input.classLabel ?? null,
        must_change_password: true,
        created_at: new Date(),
      });
      return { fullName: input.fullName, username, password, role: input.role, classLabel: input.classLabel ?? null };
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }
  throw new Error("could not pick a free username");
}

/** New temporary password for an account; it must be changed again, and other sign-ins end. */
export async function resetPassword(userId: string): Promise<string> {
  const { users } = await collections();
  const password = temporaryPassword();
  await users.updateOne({ _id: userId }, { $set: { password_hash: await hashPassword(password), must_change_password: true } });
  await destroyUserSessions(userId);
  return password;
}
