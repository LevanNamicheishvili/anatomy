import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { collections } from "./db";
import { SESSION_COOKIE } from "./session-cookie";

const DAYS = 30;
const hash = (token: string) => createHash("sha256").update(token).digest("base64url");

/** Signs this browser in: a random token in an httpOnly cookie, only its hash in the database. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000);
  const { sessions } = await collections();
  await sessions.insertOne({ _id: hash(token), user_id: userId, expires_at: expires, created_at: new Date() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** The signed-in user's id, or null (expired sessions are also removed by a TTL index). */
export async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { sessions } = await collections();
  const session = await sessions.findOne({ _id: hash(token), expires_at: { $gt: new Date() } });
  return session?.user_id ?? null;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await (await collections()).sessions.deleteOne({ _id: hash(token) });
  store.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (password reset, account removal). */
export async function destroyUserSessions(userId: string) {
  await (await collections()).sessions.deleteMany({ user_id: userId });
}
