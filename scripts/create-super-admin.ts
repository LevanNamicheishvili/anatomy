/**
 * Creates the first system administrator (run once: `npx tsx scripts/create-super-admin.ts "სახელი გვარი" [username]`).
 * Needs MONGODB_URI in .env.local. Prints the username and a temporary password, which has to be
 * changed on first sign-in.
 */
import { randomInt, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { hashPassword } from "../src/lib/password";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const uri = process.env.MONGODB_URI;
const fullName = process.argv[2]?.trim();
const username = (process.argv[3] ?? "admin").trim().toLowerCase();
if (!uri) throw new Error("Set MONGODB_URI in .env.local");
if (!fullName) throw new Error('Usage: npx tsx scripts/create-super-admin.ts "სახელი გვარი" [username]');

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
const password = `${group()}-${group()}-${group()}`;

async function main(uri: string, fullName: string) {
  const client = await new MongoClient(uri).connect();
  try {
    const users = client.db(process.env.MONGODB_DB || "school_portal").collection("users");
    await users.createIndex({ username: 1 }, { unique: true });
    await users.insertOne({
      _id: randomUUID() as never,
      username,
      password_hash: await hashPassword(password),
      role: "super_admin",
      school_id: null,
      full_name: fullName,
      class_label: null,
      must_change_password: true,
      created_at: new Date(),
    });
    console.log(`\nსისტემის ადმინისტრატორი შეიქმნა:\n  მომხმარებელი: ${username}\n  დროებითი პაროლი: ${password}\n`);
  } finally {
    await client.close();
  }
}

void main(uri, fullName);
