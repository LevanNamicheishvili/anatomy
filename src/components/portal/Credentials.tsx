"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { btn } from "./ui";

export interface Credential {
  fullName: string;
  username: string;
  password: string;
  roleName: string;
  classLabel?: string | null;
}

/**
 * New sign-in details, shown once. They can be copied or printed as slips to hand out; the password is
 * temporary and has to be changed on first sign-in.
 */
export function CredentialsCard({ items, siteUrl, onDone }: { items: Credential[]; siteUrl: string; onDone?: () => void }) {
  const [copied, setCopied] = useState(false);
  const asText = items
    .map((c) => `${c.fullName}${c.classLabel ? ` (${c.classLabel})` : ""}\nმომხმარებელი: ${c.username}\nდროებითი პაროლი: ${c.password}`)
    .join("\n\n");

  return (
    <div className="rounded-xl border-2 border-[#0f8a74] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e7e5] px-5 py-4 print:hidden">
        <div>
          <h3 className="text-base font-semibold">{items.length === 1 ? "ანგარიში შეიქმნა" : `შეიქმნა ${items.length} ანგარიში`}</h3>
          <p className="mt-0.5 text-sm text-[#66736f]">შეინახე ან დაბეჭდე ახლავე — პაროლი მეორედ აღარ გამოჩნდება.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(asText).then(() => setCopied(true));
            }}
            className={btn.secondary}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "დაკოპირდა" : "კოპირება"}
          </button>
          <button type="button" onClick={() => window.print()} className={btn.secondary}>
            <Printer className="size-4" />
            ბეჭდვა
          </button>
          {onDone && (
            <button type="button" onClick={onDone} className={btn.dark}>
              მზადაა
            </button>
          )}
        </div>
      </div>
      {/* Each slip is cut out and handed to its owner. */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 print:grid-cols-2 print:gap-0 print:p-0" data-print-area>
        {items.map((c) => (
          <div key={c.username} className="rounded-lg border border-dashed border-[#c3ccc9] p-4 print:break-inside-avoid print:rounded-none">
            <p className="text-xs font-semibold text-[#66736f]">{c.roleName}{c.classLabel ? ` · ${c.classLabel}` : ""}</p>
            <p className="mt-1 text-base font-semibold">{c.fullName}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-[#66736f]">მომხმარებელი</dt>
              <dd className="font-mono font-semibold">{c.username}</dd>
              <dt className="text-[#66736f]">დროებითი პაროლი</dt>
              <dd className="font-mono font-semibold">{c.password}</dd>
              <dt className="text-[#66736f]">მისამართი</dt>
              <dd className="font-mono">{siteUrl}</dd>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
