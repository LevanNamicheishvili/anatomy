"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-brand px-4 text-[13px] font-medium text-white hover:bg-brand/90 print:hidden"
    >
      <Printer className="size-[18px]" />
      {label}
    </button>
  );
}
