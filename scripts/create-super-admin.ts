/**
 * Creates the first system administrator (run once: `npx tsx scripts/create-super-admin.ts "სახელი გვარი"`).
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local. Prints the username and
 * a temporary password, which has to be changed on first sign-in.
 */
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const fullName = process.argv[2]?.trim();
const username = (process.argv[3] ?? "admin").trim().toLowerCase();
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
if (!fullName) throw new Error('Usage: npx tsx scripts/create-super-admin.ts "სახელი გვარი" [username]');

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
const password = `${group()}-${group()}-${group()}`;

const admin = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.createUser({
  // Same internal address scheme as src/lib/accounts.ts.
  email: `${username}@accounts.portal.invalid`,
  password,
  email_confirm: true,
});
if (error || !data.user) throw new Error(error?.message ?? "user not created");
const { error: profileError } = await admin.from("profiles").insert({
  id: data.user.id,
  role: "super_admin",
  full_name: fullName,
  username,
  must_change_password: true,
});
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  throw new Error(profileError.message);
}
console.log(`\nსისტემის ადმინისტრატორი შეიქმნა:\n  მომხმარებელი: ${username}\n  დროებითი პაროლი: ${password}\n`);
