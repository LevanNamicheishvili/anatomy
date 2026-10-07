import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BiologyHome } from "@/components/portal/BiologyHome";
import { PortalShell } from "@/components/portal/Shell";
import { SUBJECT_ICONS } from "@/components/portal/TopicHeader";
import { requireUser } from "@/lib/auth";
import { BIO_TOPICS } from "@/lib/biology-topics";
import { SUBJECT_BY_SLUG } from "@/lib/subjects";

const subject = SUBJECT_BY_SLUG["biology"];
export const metadata: Metadata = { title: `${subject.name} — სასწავლო პორტალი` };

export default async function Page() {
  const user = await requireUser("/biology");
  const Icon = SUBJECT_ICONS[subject.icon];
  const featured = subject.topics
    .filter((t) => t.href && (!t.staffOnly || user.role !== "student"))
    .map((t) => ({ label: t.name, sub: t.description, href: t.href!, icon: t.icon }));
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
          <p className="mt-1 text-[15px] leading-7 text-[#33413e]">აირჩიე თემა ან მოძებნე გაკვეთილი.</p>
        </div>
      </div>
      <BiologyHome topics={BIO_TOPICS} featured={featured} />
    </PortalShell>
  );
}
