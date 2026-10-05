"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type PunnettMode = "mono" | "di" | "x";

const YELLOW = "#f2c230";
const GREEN = "#7cb342";

/** Gametes of a genotype written as pairs, e.g. "AaBb" → ["AB", "Ab", "aB", "ab"]. */
function gametes(genes: string[]) {
  let out = [""];
  for (const g of genes) {
    const alleles = [...new Set([g[0], g[1]])];
    out = out.flatMap((prefix) => alleles.map((a) => prefix + a));
  }
  return out;
}

/** Sort each gene's two letters so the dominant one comes first ("aA" → "Aa"). */
function zygote(a: string, b: string) {
  return [...a].map((ch, i) => [ch, b[i]].sort((x, y) => (x === x.toUpperCase() ? -1 : 1) - (y === y.toUpperCase() ? -1 : 1)).join("")).join("");
}

function Pea({ yellow, round = true, size = 28 }: { yellow: boolean; round?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {round ? (
        <circle cx="16" cy="16" r="12" fill={yellow ? YELLOW : GREEN} stroke="#00000033" />
      ) : (
        <path d="M16 4c5 0 8 3 9 5s4 4 2 8-1 7-5 9-6 2-9 1-6-3-7-7-2-6 0-9 5-7 10-7z" fill={yellow ? YELLOW : GREEN} stroke="#00000033" />
      )}
      {!round && <path d="M9 12c3 2 4 6 3 10M18 8c-1 4 0 8 4 12" stroke="#00000040" fill="none" strokeWidth="1.5" />}
    </svg>
  );
}

function Picker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#66736f]">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "h-10 min-w-14 rounded-md border px-3 font-mono text-[15px] font-semibold transition-colors",
              value === o ? "border-[#111a18] bg-[#111a18] text-white" : "border-[#d5dcd9] bg-white hover:bg-[#f5f7f6]",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Ratio({ items }: { items: { label: string; count: number; node?: React.ReactNode }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <ul className="flex flex-wrap gap-2">
      {items
        .filter((i) => i.count)
        .map((i) => (
          <li key={i.label} className="flex items-center gap-2 rounded-lg bg-[#f5f7f6] px-3 py-2 text-sm">
            {i.node}
            <span className="font-semibold">{i.label}</span>
            <span className="text-[#66736f] tabular-nums">
              {i.count}/{total}
            </span>
          </li>
        ))}
    </ul>
  );
}

/** Interactive Punnett square: one gene, two genes, or an X-linked trait. */
export function PunnettSquare({ mode }: { mode: PunnettMode }) {
  const [p1, setP1] = useState(mode === "di" ? "AaBb" : mode === "x" ? "XᴴXʰ" : "Aa");
  const [p2, setP2] = useState(mode === "di" ? "AaBb" : mode === "x" ? "XᴴY" : "Aa");

  if (mode === "x") {
    const mother = p1 === "XᴴXᴴ" ? ["Xᴴ", "Xᴴ"] : p1 === "XᴴXʰ" ? ["Xᴴ", "Xʰ"] : ["Xʰ", "Xʰ"];
    const father = p2 === "XᴴY" ? ["Xᴴ", "Y"] : ["Xʰ", "Y"];
    const kids = father.flatMap((f) => mother.map((m) => ({ m, f, g: f === "Y" ? `${m}Y` : [m, f].sort((a, b) => (a === "Xᴴ" ? 0 : 1) - (b === "Xᴴ" ? 0 : 1)).join("") })));
    const state = (g: string) => (g.endsWith("Y") ? (g.startsWith("Xʰ") ? "ავადმყოფი ვაჟი" : "ჯანმრთელი ვაჟი") : g === "XʰXʰ" ? "ავადმყოფი ქალიშვილი" : g.includes("Xʰ") ? "მატარებელი ქალიშვილი" : "ჯანმრთელი ქალიშვილი");
    const color = (g: string) => (state(g).startsWith("ავადმყოფი") ? "#fdf3f2" : state(g).startsWith("მატარებელი") ? "#fdf8e6" : "#e6f3ef");
    const counts = ["ჯანმრთელი ქალიშვილი", "მატარებელი ქალიშვილი", "ავადმყოფი ქალიშვილი", "ჯანმრთელი ვაჟი", "ავადმყოფი ვაჟი"].map((label) => ({ label, count: kids.filter((k) => state(k.g) === label).length }));
    return (
      <Frame title="სქესთან შეჭიდული მემკვიდრეობა (Xʰ — ჰემოფილია ან დალტონიზმი)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Picker label="დედა" value={p1} options={["XᴴXᴴ", "XᴴXʰ", "XʰXʰ"]} onChange={setP1} />
          <Picker label="მამა" value={p2} options={["XᴴY", "XʰY"]} onChange={setP2} />
        </div>
        <Grid cols={mother} rows={father} cell={(r, c) => kids.find((k) => k.f === father[r] && k.m === mother[c])!.g} bg={color} sub={(g) => state(g)} />
        <Ratio items={counts} />
      </Frame>
    );
  }

  const genesOf = (g: string) => (mode === "di" ? [g.slice(0, 2), g.slice(2, 4)] : [g]);
  const g1 = gametes(genesOf(p1));
  const g2 = gametes(genesOf(p2));
  const cells = g2.map((b) => g1.map((a) => zygote(a, b)));
  const flat = cells.flat();
  const yellow = (z: string) => /A/.test(z);
  const round = (z: string) => mode !== "di" || /B/.test(z);
  const phen = (z: string) => (yellow(z) ? "ყვითელი" : "მწვანე") + (mode === "di" ? (round(z) ? " გლუვი" : " დანაოჭებული") : "");
  const genoCounts = [...new Set(flat)].sort().map((g) => ({ label: g, count: flat.filter((x) => x === g).length }));
  const phenOrder = mode === "di" ? ["ყვითელი გლუვი", "ყვითელი დანაოჭებული", "მწვანე გლუვი", "მწვანე დანაოჭებული"] : ["ყვითელი", "მწვანე"];
  const phenCounts = phenOrder.map((label) => {
    const sample = flat.find((z) => phen(z) === label);
    return { label, count: flat.filter((z) => phen(z) === label).length, node: sample ? <Pea yellow={yellow(sample)} round={round(sample)} size={22} /> : undefined };
  });
  const opts = mode === "di" ? ["AABB", "AaBb", "AaBB", "AABb", "aabb", "Aabb", "aaBb"] : ["AA", "Aa", "aa"];
  return (
    <Frame title={mode === "di" ? "დიჰიბრიდული შეჯვარება: A — ყვითელი, a — მწვანე; B — გლუვი, b — დანაოჭებული" : "მონოჰიბრიდული შეჯვარება: A — ყვითელი თესლი, a — მწვანე"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Picker label="მშობელი 1" value={p1} options={opts} onChange={setP1} />
        <Picker label="მშობელი 2" value={p2} options={opts} onChange={setP2} />
      </div>
      <Grid cols={g1} rows={g2} cell={(r, c) => cells[r][c]} node={(z) => <Pea yellow={yellow(z)} round={round(z)} size={mode === "di" ? 20 : 26} />} />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-[#66736f]">ფენოტიპი</p>
        <Ratio items={phenCounts} />
        <p className="mt-1 text-xs font-semibold text-[#66736f]">გენოტიპი</p>
        <Ratio items={genoCounts} />
      </div>
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 rounded-xl border-2 border-[#0f8a74]/40 bg-white p-5">
      <h2 className="text-lg">პანეტის ცხაური — სცადე თავად</h2>
      <p className="mt-1 text-sm text-[#66736f]">{title}</p>
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Grid({ cols, rows, cell, node, bg, sub }: { cols: string[]; rows: string[]; cell: (r: number, c: number) => string; node?: (z: string) => React.ReactNode; bg?: (z: string) => string; sub?: (z: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-collapse">
        <thead>
          <tr>
            <th className="size-12 text-xs text-[#97a29e]">♀ / ♂</th>
            {cols.map((c, i) => (
              <th key={i} className="h-12 min-w-16 border border-[#d5dcd9] bg-[#eef2f0] px-2 font-mono text-[15px]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <th className="w-14 border border-[#d5dcd9] bg-[#eef2f0] px-2 font-mono text-[15px]">{r}</th>
              {cols.map((_, ci) => {
                const z = cell(ri, ci);
                return (
                  <td key={ci} className="h-16 min-w-16 border border-[#d5dcd9] px-2 text-center" style={bg ? { background: bg(z) } : undefined}>
                    <div className="flex flex-col items-center gap-0.5">
                      {node?.(z)}
                      <span className="font-mono text-sm font-semibold">{z}</span>
                      {sub && <span className="max-w-24 text-[10.5px] leading-3 text-[#66736f]">{sub(z)}</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
