"use server";

import { randomUUID } from "node:crypto";
import { collections, dbConfigured } from "@/lib/db";

export interface RequestState {
  error?: string;
  sent?: boolean;
}

const text = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);

/** A school applies for access. Stored as "pending" until a super admin reviews it. */
export async function submitRequest(_: RequestState, form: FormData): Promise<RequestState> {
  // Bots fill every field, including this hidden one.
  if (text(form, "website")) return { sent: true };
  if (!dbConfigured) return { error: "სისტემა ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან." };
  const row = {
    school_name: text(form, "school_name"),
    city: text(form, "city", 80),
    address: text(form, "address") || null,
    contact_name: text(form, "contact_name", 120),
    contact_position: text(form, "contact_position", 120),
    email: text(form, "email", 160).toLowerCase(),
    phone: text(form, "phone", 40),
    message: text(form, "message", 1500) || null,
  };
  if (!row.school_name || !row.city || !row.contact_name || !row.contact_position || !row.email || !row.phone)
    return { error: "შეავსე ყველა სავალდებულო ველი." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return { error: "ელ-ფოსტის მისამართი არასწორია." };
  const { requests } = await collections();
  // One open application per e-mail is enough.
  if (await requests.findOne({ email: row.email, status: "pending" })) return { sent: true };
  try {
    await requests.insertOne({ _id: randomUUID(), ...row, status: "pending", school_id: null, created_at: new Date(), reviewed_at: null });
  } catch {
    return { error: "განაცხადი ვერ გაიგზავნა. სცადე მოგვიანებით." };
  }
  return { sent: true };
}
