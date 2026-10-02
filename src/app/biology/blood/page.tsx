import type { Metadata } from "next";
import { BloodExplorer } from "@/components/blood/BloodExplorer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "სისხლი — ბიოლოგია 3D" };

export default async function BloodPage() {
  await requireUser("/biology/blood");
  return <BloodExplorer />;
}
