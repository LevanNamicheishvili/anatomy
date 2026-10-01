"use server";

import { revalidatePath } from "next/cache";
import { createAccount, resetPassword, type NewAccount } from "@/lib/accounts";
import { requireRole, type CurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BATCH = 60;

export interface CreateState {
  error?: string;
  accounts?: NewAccount[];
}

/** School admins add teachers and students; teachers add students. One name per line. */
export async function createMembers(_: CreateState, form: FormData): Promise<CreateState> {
  const user = await requireRole(["school_admin", "teacher"]);
  const role = form.get("role") === "teacher" ? "teacher" : "student";
  if (role === "teacher" && user.role !== "school_admin") return { error: "მასწავლებლის დამატება მხოლოდ სკოლის ადმინისტრატორს შეუძლია." };
  const classLabel = String(form.get("class_label") ?? "").trim().slice(0, 20) || null;
  if (role === "student" && !classLabel) return { error: "მიუთითე კლასი, მაგ. 9ბ." };
  const names = String(form.get("names") ?? "")
    .split("\n")
    .map((n) => n.trim().replace(/\s+/g, " "))
    .filter((n) => n.length >= 2)
    .slice(0, MAX_BATCH + 1);
  if (!names.length) return { error: "ჩაწერე მინიმუმ ერთი სახელი და გვარი." };
  if (names.length > MAX_BATCH) return { error: `ერთ ჯერზე მაქსიმუმ ${MAX_BATCH} ანგარიშის შექმნაა შესაძლებელი.` };
  const accounts: NewAccount[] = [];
  for (const fullName of names) {
    try {
      accounts.push(await createAccount({ fullName: fullName.slice(0, 120), role, schoolId: (user.school as NonNullable<CurrentUser["school"]>).id, classLabel: role === "student" ? classLabel : null }));
    } catch {
      return { accounts, error: `„${fullName}“-ის ანგარიში ვერ შეიქმნა. ზემოთ ჩამოთვლილი ანგარიშები უკვე შექმნილია.` };
    }
  }
  revalidatePath("/school");
  return { accounts };
}

/** The member, if the caller may manage them: same school, and teachers only manage students. */
async function manageable(user: CurrentUser, id: string) {
  const { data } = await createAdminClient().from("profiles").select("id, full_name, username, role, class_label, school_id").eq("id", id).maybeSingle();
  if (!data || data.school_id !== user.school?.id || data.id === user.id) return null;
  if (user.role === "teacher" && data.role !== "student") return null;
  if (data.role === "school_admin" || data.role === "super_admin") return null;
  return data;
}

export interface ResetState {
  error?: string;
  account?: NewAccount;
}

export async function resetMemberPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const user = await requireRole(["school_admin", "teacher"]);
  const member = await manageable(user, String(form.get("id") ?? ""));
  if (!member) return { error: "ამ ანგარიშის მართვის უფლება არ გაქვს." };
  try {
    const password = await resetPassword(member.id);
    return { account: { fullName: member.full_name, username: member.username, password, role: member.role, classLabel: member.class_label } };
  } catch {
    return { error: "პაროლი ვერ განახლდა." };
  }
}

export async function removeMember(form: FormData) {
  const user = await requireRole(["school_admin"]);
  const member = await manageable(user, String(form.get("id") ?? ""));
  if (!member) return;
  // Deleting the sign-in account removes the profile with it.
  await createAdminClient().auth.admin.deleteUser(member.id);
  revalidatePath("/school");
}
