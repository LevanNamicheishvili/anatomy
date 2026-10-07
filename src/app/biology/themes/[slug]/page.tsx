import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Box, ChevronRight, Map as MapIcon, Route } from "lucide-react";
import { PortalShell } from "@/components/portal/Shell";
import { TOPIC_ICONS } from "@/components/portal/TopicHeader";
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
  const Icon = TOPIC_ICONS[topic.icon];
  return (
    <PortalShell user={user} active="/dashboard">
      <nav aria-label="გზა" className="flex items-center gap-1.5 text-sm text-[#66736f]">
        <Link href="/dashboard" className="hover:text-[#111a18]">
          საგნები
        </Link>
        <ChevronRight className="size-4 text-[#c3ccc9]" />
        <Link href="/biology" className="hover:text-[#111a18]">
          ბიოლოგია
        </Link>
        <ChevronRight className="size-4 text-[#c3ccc9]" />
        <span className="font-semibold text-[#111a18]">{topic.title}</span>
      </nav>
      <div className="mt-5 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: COLOR }}>
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl">{topic.title}</h1>
          <p className="mt-1 text-[15px] leading-7 text-[#33413e]">{topic.description}</p>
        </div>
      </div>

      {topic.tools.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {topic.tools.map((t) => {
            const K = KIND[t.kind];
            return (
              <Link key={t.href} href={t.href} className="group flex items-center gap-3 rounded-xl bg-[#111a18] p-4 text-white transition-colors hover:bg-[#25302d]">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <K.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-xs text-white/70">{K.name}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mt-10 text-lg">გაკვეთილები</h2>
      <ol className="mt-3 overflow-hidden rounded-xl border border-[#d5dcd9] bg-white">
        {topic.lessons.map((l, i) => (
          <li key={l.href}>
            <Link href={l.href} className={`group flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-[#f5f8f7] ${i > 0 ? "border-t border-[#eef2f0]" : ""}`}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f0] text-sm font-semibold text-[#33413e]">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] leading-6 font-semibold">{l.title}</span>
                {l.aka.length > 0 && <span className="block text-sm text-[#66736f]">{l.aka.join(" · ")}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: COLOR }}>
                გახსნა
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </PortalShell>
  );
}
