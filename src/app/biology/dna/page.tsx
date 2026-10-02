import type { Metadata } from "next";
import { DnaExplorer } from "@/components/dna/DnaExplorer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "დნმ და მემკვიდრეობა — ბიოლოგია 3D" };

export default async function DnaPage() {
  await requireUser("/biology/dna");
  return <DnaExplorer />;
}
