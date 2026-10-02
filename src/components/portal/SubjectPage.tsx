import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import type { Subject } from "@/lib/subjects";
import { PortalShell } from "./Shell";
import { SUBJECT_ICONS, TOPIC_ICONS } from "./TopicHeader";

/** A subject's page: what it covers and all its topics, ready ones first. */
export function SubjectPage({ user, subject }: { user: CurrentUser; subject: Subject }) {
  const Icon = SUBJECT_ICONS[subject.icon];
  const visible = subject.topics.filter((t) => !t.staffOnly || user.role !== "student");
  const ready = visible.filter((t) => t.href);
  const soon = visible.filter((t) => !t.href);

  return (
    <PortalShell user={user} active="/dashboard">
      <nav aria-label="გზა" className="flex items-center gap-1.5 text-sm text-[#66736f]">
        <Link href="/dashboard" className="hover:text-[#111a18]">
          საგნები
        </Link>
        <ChevronRight className="size-4 text-[#c3ccc9]" />
        <span className="font-semibold text-[#111a18]">{subject.name}</span>
      </nav>

      <div className="mt-5 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: subject.color }}>
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl">{subject.name}</h1>
          <p className="mt-1 max-w-2xl text-[15px] leading-7 text-[#33413e]">{subject.description}</p>
        </div>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-[#66736f]">თემები</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ready.map((t) => {
          const TIcon = TOPIC_ICONS[t.icon];
          return (
            <Link
              key={t.slug}
              href={t.href!}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#d5dcd9] bg-white transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-18px_rgba(17,26,24,0.25)]"
              style={{ ["--accent" as string]: subject.color }}
            >
              {t.image ? (
                <span className="relative block aspect-[16/9] border-b border-[#e2e7e5] bg-[#eef2f0]">
                  <Image src={t.image} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover object-top" />
                </span>
              ) : (
                <span className="flex aspect-[16/9] items-center justify-center border-b border-[#e2e7e5]" style={{ background: `linear-gradient(135deg, ${subject.color}14, ${subject.color}33)` }}>
                  <TIcon className="size-14" style={{ color: subject.color }} strokeWidth={1.5} />
                </span>
              )}
              <span className="flex flex-1 flex-col p-5">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-lg font-semibold">{t.name}</span>
                  {t.grades && <span className="shrink-0 rounded-full bg-[#eef2f0] px-2 py-0.5 text-xs font-medium text-[#33413e]">{t.grades}</span>}
                </span>
                <span className="mt-2 text-sm leading-6 text-[#66736f]">{t.description}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold" style={{ color: subject.color }}>
                  გახსნა
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          );
        })}
        {soon.map((t) => {
          const TIcon = TOPIC_ICONS[t.icon];
          return (
            <div key={t.slug} className="flex flex-col rounded-xl border border-dashed border-[#d5dcd9] bg-white/60 p-5">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-base font-semibold text-[#33413e]">
                  <TIcon className="size-5 text-[#97a29e]" />
                  {t.name}
                </span>
                <span className="shrink-0 rounded-full bg-[#eef2f0] px-2 py-0.5 text-xs font-medium text-[#66736f]">მალე</span>
              </span>
              <span className="mt-2 text-sm leading-6 text-[#97a29e]">{t.description}</span>
            </div>
          );
        })}
      </div>
    </PortalShell>
  );
}
