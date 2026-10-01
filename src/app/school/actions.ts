"use server";

import { revalidatePath } from "next/cache";
import { createAccount, resetPassword, type NewAccount } from "@/lib/accounts";
import { requireRole, type CurrentUser } from "@/lib/auth";
import { collections } from "@/lib/db";
import { destroyUserSessions } from "@/lib/session";

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
  const schoolId = (user.school as NonNullable<CurrentUser["school"]>).id;
  const accounts: NewAccount[] = [];
  for (const fullName of names) {
    try {
      accounts.push(await createAccount({ fullName: fullName.slice(0, 120), role, schoolId, classLabel: role === "student" ? classLabel : null }));
    } catch {
      return { accounts, error: `„${fullName}“-ის ანგარიში ვერ შეიქმნა. ზემოთ ჩამოთვლილი ანგარიშები უკვე შექმნილია.` };
    }
  }
  revalidatePath("/school");
  return { accounts };
}

/** The member, if the caller may manage them: same school, and teachers only manage students. */
async function manageable(user: CurrentUser, id: string) {
  const { users } = await collections();
  const member = await users.findOne({ _id: id });
  if (!member || member.school_id !== user.school?.id || member._id === user.id) return null;
  if (user.role === "teacher" && member.role !== "student") return null;
  if (member.role === "school_admin" || member.role === "super_admin") return null;
  return member;
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
    const password = await resetPassword(member._id);
    return { account: { fullName: member.full_name, username: member.username, password, role: member.role, classLabel: member.class_label } };
  } catch {
    return { error: "პაროლი ვერ განახლდა." };
  }
}

export async function removeMember(form: FormData) {
  const user = await requireRole(["school_admin"]);
  const member = await manageable(user, String(form.get("id") ?? ""));
  if (!member) return;
  await destroyUserSessions(member._id);
  await (await collections()).users.deleteOne({ _id: member._id });
  revalidatePath("/school");
}
