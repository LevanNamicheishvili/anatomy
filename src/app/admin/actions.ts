"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAccount, resetPassword, type NewAccount } from "@/lib/accounts";
import { requireRole } from "@/lib/auth";
import { collections } from "@/lib/db";

export interface ApproveState {
  error?: string;
  account?: NewAccount & { schoolName: string };
}

/** Approve a school's application: create the school and its administrator's account. */
export async function approveRequest(_: ApproveState, form: FormData): Promise<ApproveState> {
  await requireRole(["super_admin"]);
  const id = String(form.get("id") ?? "");
  const { requests, schools } = await collections();
  const req = await requests.findOne({ _id: id, status: "pending" });
  if (!req) return { error: "განაცხადი ვერ მოიძებნა ან უკვე განხილულია." };
  const schoolId = randomUUID();
  await schools.insertOne({ _id: schoolId, name: req.school_name, city: req.city, address: req.address, active: true, created_at: new Date() });
  try {
    const account = await createAccount({ fullName: req.contact_name, role: "school_admin", schoolId });
    await requests.updateOne({ _id: id }, { $set: { status: "approved", reviewed_at: new Date(), school_id: schoolId } });
    // No revalidatePath here: refreshing now would drop this request's row, and with it the one-time
    // credentials card. The page refreshes once the admin has seen them (ApproveButton → onDone).
    return { account: { ...account, schoolName: req.school_name } };
  } catch {
    await schools.deleteOne({ _id: schoolId });
    return { error: "ადმინისტრატორის ანგარიში ვერ შეიქმნა." };
  }
}

export async function rejectRequest(form: FormData) {
  await requireRole(["super_admin"]);
  const { requests } = await collections();
  await requests.updateOne({ _id: String(form.get("id") ?? ""), status: "pending" }, { $set: { status: "rejected", reviewed_at: new Date() } });
  revalidatePath("/admin");
}

/** Switch a school off (its accounts can no longer sign in) or back on. */
export async function setSchoolActive(form: FormData) {
  await requireRole(["super_admin"]);
  const { schools } = await collections();
  await schools.updateOne({ _id: String(form.get("id") ?? "") }, { $set: { active: form.get("active") === "1" } });
  revalidatePath("/admin");
}

export interface ResetState {
  error?: string;
  account?: { fullName: string; username: string; password: string };
}

/** New temporary password for a school's administrator (e.g. they forgot theirs). */
export async function resetSchoolAdmin(_: ResetState, form: FormData): Promise<ResetState> {
  await requireRole(["super_admin"]);
  const { users } = await collections();
  const admin = await users.findOne(
    { school_id: String(form.get("school_id") ?? ""), role: "school_admin" },
    { sort: { created_at: 1 } },
  );
  if (!admin) return { error: "ადმინისტრატორი ვერ მოიძებნა." };
  try {
    const password = await resetPassword(admin._id);
    return { account: { fullName: admin.full_name, username: admin.username, password } };
  } catch {
    return { error: "პაროლი ვერ განახლდა." };
  }
}
