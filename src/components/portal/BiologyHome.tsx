"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Search, X } from "lucide-react";
import type { BioTopic } from "@/lib/biology-topics";
import { cn } from "@/lib/utils";
import { TOPIC_ICONS } from "./TopicHeader";

const COLOR = "#0f8a74";

/** Biology's front page: the topics as cards, the journeys up top, and a search over every lesson. */
export function BiologyHome({ topics, featured }: { topics: BioTopic[]; featured: { label: string; sub: string; href: string; icon: keyof typeof TOPIC_ICONS }[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = q
    ? topics.flatMap((t) => [
        ...t.tools.filter((x) => x.label.toLowerCase().includes(q)).map((x) => ({ topic: t, title: x.label, href: x.href, is3d: true })),
        ...t.lessons.filter((l) => [l.title, ...l.aka].some((x) => x.toLowerCase().includes(q))).map((l) => ({ topic: t, title: l.title, href: l.href, is3d: false })),
      ])
    : [];

  return (
    <>
      <label className="mt-7 flex h-14 items-center gap-3 rounded-xl border border-[#d5dcd9] bg-white px-4 focus-within:border-[#0f8a74] focus-within:ring-2 focus-within:ring-[#0f8a74]/20">
        <Search className="size-5 shrink-0 text-[#97a29e]" />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="მოძებნე გაკვეთილი — მაგ. მიტოზი, გული, ფოტოსინთეზი"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#97a29e]"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="გასუფთავება" className="flex size-9 items-center justify-center rounded-md text-[#66736f] hover:bg-[#f1f4f3]">
            <X className="size-5" />
          </button>
        )}
      </label>

      {q ? (
        <section className="mt-6">
          <p className="text-sm text-[#66736f]">{hits.length ? `ნაპოვნია ${hits.length}` : "ვერაფერი მოიძებნა"}</p>
          <ul className="mt-3 overflow-hidden rounded-xl border border-[#d5dcd9] bg-white">
            {hits.map(({ topic, title, href, is3d }, i) => (
              <li key={`${topic.slug}-${href}`}>
                <Link href={href} className={cn("group flex min-h-14 items-center gap-3 px-5 py-2.5 hover:bg-[#f5f8f7]", i > 0 && "border-t border-[#eef2f0]")}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{title}</span>
                    <span className="block text-xs text-[#66736f]">
                      {is3d ? "3D · " : ""}
                      {topic.title}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-[#97a29e] transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <h2 className="mt-9 text-lg">3D მოდელები და მოგზაურობები</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((f) => {
              const Icon = TOPIC_ICONS[f.icon];
              return (
                <Link key={f.href} href={f.href} className="group flex items-center gap-3 rounded-xl bg-[#111a18] p-4 text-white transition-colors hover:bg-[#25302d]">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{f.label}</span>
                    <span className="block truncate text-xs text-white/70">{f.sub}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>

          <h2 className="mt-10 text-lg">თემები</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => {
              const Icon = TOPIC_ICONS[t.icon];
              return (
                <Link key={t.slug} href={`/biology/themes/${t.slug}`} className="group flex gap-4 rounded-xl border border-[#d5dcd9] bg-white p-4 transition-colors hover:border-[#97a29e]">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `${COLOR}1a`, color: COLOR }}>
                    <Icon className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 font-semibold">
                      {t.title}
                      <ChevronRight className="size-4 text-[#97a29e] transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-[#66736f]">{t.description}</span>
                    <span className="mt-2 block text-xs font-semibold text-[#33413e]">
                      {t.lessons.length} გაკვეთილი{t.tools.length > 0 && ` · ${t.tools.length} 3D`}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
