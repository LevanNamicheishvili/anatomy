import type { Metadata } from "next";
import { CellExplorer } from "@/components/cell/CellExplorer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "უჯრედი — ბიოლოგია 3D" };

export default async function CellPage() {
  await requireUser("/biology/cell");
  return <CellExplorer />;
}
