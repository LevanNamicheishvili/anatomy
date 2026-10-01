"use server";

import { revalidatePath } from "next/cache";
import { createAccount, resetPassword, type NewAccount } from "@/lib/accounts";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ApproveState {
  error?: string;
  account?: NewAccount & { schoolName: string };
}

/** Approve a school's application: create the school and its administrator's account. */
export async function approveRequest(_: ApproveState, form: FormData): Promise<ApproveState> {
  await requireRole(["super_admin"]);
  const id = String(form.get("id") ?? "");
  const admin = createAdminClient();
  const { data: req } = await admin.from("school_requests").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (!req) return { error: "განაცხადი ვერ მოიძებნა ან უკვე განხილულია." };
  const { data: school, error } = await admin
    .from("schools")
    .insert({ name: req.school_name, city: req.city, address: req.address })
    .select("id, name")
    .single();
  if (error || !school) return { error: "სკოლა ვერ შეიქმნა." };
  try {
    const account = await createAccount({ fullName: req.contact_name, role: "school_admin", schoolId: school.id });
    await admin.from("school_requests").update({ status: "approved", reviewed_at: new Date().toISOString(), school_id: school.id }).eq("id", id);
    revalidatePath("/admin");
    return { account: { ...account, schoolName: school.name } };
  } catch {
    await admin.from("schools").delete().eq("id", school.id);
    return { error: "ადმინისტრატორის ანგარიში ვერ შეიქმნა." };
  }
}

export async function rejectRequest(form: FormData) {
  await requireRole(["super_admin"]);
  await createAdminClient()
    .from("school_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", String(form.get("id") ?? ""))
    .eq("status", "pending");
  revalidatePath("/admin");
}

/** Switch a school off (its accounts can no longer sign in) or back on. */
export async function setSchoolActive(form: FormData) {
  await requireRole(["super_admin"]);
  await createAdminClient()
    .from("schools")
    .update({ active: form.get("active") === "1" })
    .eq("id", String(form.get("id") ?? ""));
  revalidatePath("/admin");
}

export interface ResetState {
  error?: string;
  account?: { fullName: string; username: string; password: string };
}

/** New temporary password for a school's administrator (e.g. they forgot theirs). */
export async function resetSchoolAdmin(_: ResetState, form: FormData): Promise<ResetState> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, username")
    .eq("school_id", String(form.get("school_id") ?? ""))
    .eq("role", "school_admin")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!profile) return { error: "ადმინისტრატორი ვერ მოიძებნა." };
  try {
    const password = await resetPassword(profile.id);
    return { account: { fullName: profile.full_name, username: profile.username, password } };
  } catch {
    return { error: "პაროლი ვერ განახლდა." };
  }
}
