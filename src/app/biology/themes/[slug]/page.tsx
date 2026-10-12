import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Box, Map as MapIcon, Route } from "lucide-react";
import { ToolCard } from "@/components/portal/cards";
import { PortalShell } from "@/components/portal/Shell";
import { PageHero } from "@/components/portal/SubjectHero";
import { TOPIC_ICONS } from "@/components/portal/TopicHeader";
import { Breadcrumbs, SectionTitle } from "@/components/portal/ui";
import { requireUser } from "@/lib/auth";
import { BIO_TOPIC_BY_SLUG } from "@/lib/biology-topics";

const COLOR = "#0f8a74";
const KIND = { "3d": { icon: Box, name: "3D მოდელი" }, journey: { icon: Route, name: "3D მოგზაურობა" }, atlas: { icon: MapIcon, name: "ატლასი" } };

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = BIO_TOPIC_BY_SLUG[(await params).slug];
  return t ? { title: `${t.title} — ბიოლოგია` } : {};
}

/** One biology topic: its 3D models and journeys, then its lessons from every grade, in teaching order. */
export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  const topic = BIO_TOPIC_BY_SLUG[slug];
  if (!topic) notFound();
  const user = await requireUser(`/biology/themes/${slug}`);
  const stats = [`${topic.lessons.length} გაკვეთილი`, ...(topic.tools.length > 0 ? [`${topic.tools.length} 3D`] : [])];
  return (
    <PortalShell user={user} active="/dashboard">
      <Breadcrumbs
        items={[
          { label: "საგნები", href: "/dashboard" },
          { label: "ბიოლოგია", href: "/biology" },
          { label: topic.title },
        ]}
      />
      <div className="mt-4">
        <PageHero title={topic.title} description={topic.description} color={COLOR} icon={TOPIC_ICONS[topic.icon]} stats={stats} />
      </div>

      {topic.tools.length > 0 && (
        <section className="mt-10">
          <SectionTitle>3D მოდელები და მოგზაურობები</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {topic.tools.map((t) => (
              <ToolCard key={t.href} href={t.href} title={t.label} sub={KIND[t.kind].name} icon={KIND[t.kind].icon} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <SectionTitle hint={`${topic.lessons.length} გაკვეთილი`}>გაკვეთილები</SectionTitle>
        <ol className="mt-3 overflow-hidden rounded-xl border border-line-strong bg-white shadow-card">
          {topic.lessons.map((l, i) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`group flex min-h-16 items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-5 ${i > 0 ? "border-t border-chip" : ""}`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chip text-sm font-semibold text-copy tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base leading-6 font-semibold [overflow-wrap:anywhere]">{l.title}</span>
                  {l.aka.length > 0 && <span className="block text-sm text-mute">{l.aka.join(" · ")}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-strong max-sm:sr-only">
                  გახსნა
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <ArrowRight className="size-4 shrink-0 text-faint sm:hidden" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </PortalShell>
  );
}
