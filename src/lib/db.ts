import "server-only";
import { MongoClient, type Db } from "mongodb";
import type { Role } from "./roles";

/** MongoDB Atlas connection (MONGODB_URI in .env.local and in the Vercel project). */
const uri = process.env.MONGODB_URI ?? "";
export const dbConfigured = Boolean(uri);

export interface UserDoc {
  _id: string;
  username: string;
  password_hash: string;
  role: Role;
  school_id: string | null;
  full_name: string;
  class_label: string | null;
  /** Accounts start with a temporary password that must be changed on first sign-in. */
  must_change_password: boolean;
  created_at: Date;
}

export interface SchoolDoc {
  _id: string;
  name: string;
  city: string;
  address: string | null;
  active: boolean;
  created_at: Date;
}

export interface RequestDoc {
  _id: string;
  school_name: string;
  city: string;
  address: string | null;
  contact_name: string;
  contact_position: string;
  email: string;
  phone: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  school_id: string | null;
  created_at: Date;
  reviewed_at: Date | null;
}

/** A signed-in browser. The id is the SHA-256 of the cookie token, so the token itself is never stored. */
export interface SessionDoc {
  _id: string;
  user_id: string;
  expires_at: Date;
  created_at: Date;
}

/** Failed sign-ins per username, to slow down password guessing. */
export interface AttemptDoc {
  _id: string;
  count: number;
  reset_at: Date;
}

// One client per server process (kept across hot reloads in development).
const cache = globalThis as unknown as { _portalDb?: Promise<Db> };

async function connect(): Promise<Db> {
  const client = await new MongoClient(uri, { maxPoolSize: 10 }).connect();
  const db = client.db(process.env.MONGODB_DB || "school_portal");
  // Idempotent: created on first use, nothing to run by hand.
  await Promise.all([
    db.collection<UserDoc>("users").createIndex({ username: 1 }, { unique: true }),
    db.collection<UserDoc>("users").createIndex({ school_id: 1, role: 1 }),
    db.collection<SessionDoc>("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    db.collection<SessionDoc>("sessions").createIndex({ user_id: 1 }),
    db.collection<RequestDoc>("school_requests").createIndex({ status: 1, created_at: -1 }),
    db.collection<AttemptDoc>("login_attempts").createIndex({ reset_at: 1 }, { expireAfterSeconds: 0 }),
  ]);
  return db;
}

export async function collections() {
  if (!uri) throw new Error("MONGODB_URI is not set");
  cache._portalDb ??= connect().catch((e) => {
    cache._portalDb = undefined;
    throw e;
  });
  const db = await cache._portalDb;
  return {
    users: db.collection<UserDoc>("users"),
    schools: db.collection<SchoolDoc>("schools"),
    requests: db.collection<RequestDoc>("school_requests"),
    sessions: db.collection<SessionDoc>("sessions"),
    attempts: db.collection<AttemptDoc>("login_attempts"),
  };
}
