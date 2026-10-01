"use server";

import { redirect } from "next/navigation";
import { loginEmail } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
}

/** Only same-site paths are followed after signing in. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: "სისტემა ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან." };
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "შეიყვანე მომხმარებლის სახელი და პაროლი." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(username), password });
  if (error) return { error: "მომხმარებლის სახელი ან პაროლი არასწორია." };
  if (!(await getCurrentUser())) {
    await supabase.auth.signOut();
    return { error: "ანგარიში ან სკოლა გათიშულია. მიმართე სკოლის ადმინისტრატორს." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const password = String(form.get("password") ?? "");
  const repeat = String(form.get("repeat") ?? "");
  if (password.length < 8) return { error: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს." };
  if (password !== repeat) return { error: "პაროლები ერთმანეთს არ ემთხვევა." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "პაროლი ვერ შეიცვალა. სცადე სხვა პაროლი." };
  await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
  redirect("/");
}
