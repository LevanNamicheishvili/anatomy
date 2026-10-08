import type { Metadata } from "next";
import { BattleExplorer } from "@/components/history/BattleExplorer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "დიდგორის ბრძოლა, 1121 — ისტორია 3D" };

export default async function Page() {
  await requireUser("/history/didgori");
  return <BattleExplorer />;
}
