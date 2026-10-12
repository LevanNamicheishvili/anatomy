"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import type { BioTopic } from "@/lib/biology-topics";
import { cn } from "@/lib/utils";
import { FeaturedCard, ToolCard, TopicCard } from "./cards";
import { TOPIC_ICONS } from "./TopicHeader";
import { SectionTitle } from "./ui";

const COLOR = "#0f8a74";

interface Featured {
  label: string;
  sub: string;
  href: string;
  icon: keyof typeof TOPIC_ICONS;
  image?: string;
  grades?: string;
}

/** Biology's front page: search over every lesson, the 3D models and journeys up top, then the topics as cards. */
export function BiologyHome({ topics, featured }: { topics: BioTopic[]; featured: Featured[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = q
    ? topics.flatMap((t) => [
        ...t.tools.filter((x) => x.label.toLowerCase().includes(q)).map((x) => ({ topic: t, title: x.label, href: x.href, is3d: true })),
        ...t.lessons.filter((l) => [l.title, ...l.aka].some((x) => x.toLowerCase().includes(q))).map((l) => ({ topic: t, title: l.title, href: l.href, is3d: false })),
      ])
    : [];
  // The flagship experience (with a preview image) gets a wide card; the rest are compact.
  const flagship = featured.filter((f) => f.image);
  const compact = featured.filter((f) => !f.image);

  return (
    <>
      <label className="mt-8 flex h-14 items-center gap-3 rounded-xl border border-line-strong bg-white px-4 shadow-card transition-colors hover:border-faint focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <Search className="size-5 shrink-0 text-faint" aria-hidden />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="მოძებნე გაკვეთილი — მაგ. მიტოზი, გული, ფოტოსინთეზი"
          aria-label="გაკვეთილის ძიება"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="გასუფთავება" className="-me-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-mute hover:bg-chip">
            <X className="size-5" />
          </button>
        )}
      </label>

      {q ? (
        <section className="mt-6" aria-live="polite">
          <p className="text-sm text-mute">{hits.length ? `ნაპოვნია ${hits.length}` : "ვერაფერი მოიძებნა"}</p>
          <ul className="mt-3 overflow-hidden rounded-xl border border-line-strong bg-white">
            {hits.map(({ topic, title, href, is3d }, i) => (
              <li key={`${topic.slug}-${href}`}>
                <Link href={href} className={cn("group flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-subtle focus-visible:bg-subtle", i > 0 && "border-t border-chip")}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">{title}</span>
                    <span className="block text-xs text-mute">
                      {is3d ? "3D · " : ""}
                      {topic.title}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section className="mt-10">
            <SectionTitle>3D მოდელები და მოგზაურობები</SectionTitle>
            {flagship.length > 0 && (
              <div className="mt-3 grid gap-5">
                {flagship.map((f) => (
                  <FeaturedCard key={f.href} href={f.href} title={f.label} description={f.sub} icon={TOPIC_ICONS[f.icon]} color={COLOR} grades={f.grades} image={f.image} />
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {compact.map((f) => (
                <ToolCard key={f.href} href={f.href} title={f.label} sub={f.sub} icon={TOPIC_ICONS[f.icon]} />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <SectionTitle hint={`${topics.length} თემა`}>თემები</SectionTitle>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t, i) => (
                <TopicCard
                  key={t.slug}
                  href={`/biology/themes/${t.slug}`}
                  number={i + 1}
                  title={t.title}
                  description={t.description}
                  icon={TOPIC_ICONS[t.icon]}
                  color={COLOR}
                  meta={`${t.lessons.length} გაკვეთილი${t.tools.length > 0 ? ` · ${t.tools.length} 3D` : ""}`}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
