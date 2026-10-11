import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Globe2, HeartPulse, Landmark, Users, type LucideIcon } from "lucide-react";
import { PortalShell } from "@/components/portal/Shell";
import { Chip, SectionTitle, cardLink } from "@/components/portal/ui";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { collections } from "@/lib/db";
import { cn } from "@/lib/utils";
import { SUBJECTS, type Subject, type SubjectIcon } from "@/lib/subjects";

export const metadata: Metadata = { title: "მთავარი — სასწავლო პორტალი" };

const ICONS: Record<SubjectIcon, LucideIcon> = {
  biology: HeartPulse,
  geography: Globe2,
  history: Landmark,
};

function SubjectMark({ subject, size = "md" }: { subject: Subject; size?: "md" | "lg" }) {
  const Icon = ICONS[subject.icon];
  return (
    <span
      className={size === "lg" ? "flex size-14 shrink-0 items-center justify-center rounded-xl text-white" : "flex size-10 shrink-0 items-center justify-center rounded-lg text-white"}
      style={{ backgroundColor: subject.color }}
    >
      <Icon className={size === "lg" ? "size-7" : "size-5"} strokeWidth={2} aria-hidden />
    </span>
  );
}

/** One card per subject, all the same shape; ready subjects open their page. */
function SubjectCard({ subject }: { subject: Subject }) {
  const ready = !!subject.href;
  const topics = subject.topics.filter((t) => t.href && !t.staffOnly).length;
  const body = (
    <>
      {subject.image ? (
        <span className="relative block aspect-[16/9] border-b border-line bg-chip">
          <Image src={subject.image} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover object-top" />
        </span>
      ) : (
        <span className="flex aspect-[16/9] items-center justify-center border-b border-line" style={{ background: `linear-gradient(135deg, ${subject.color}14, ${subject.color}33)` }}>
          <SubjectMark subject={subject} size="lg" />
        </span>
      )}
      <span className="flex flex-1 flex-col p-5">
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <SubjectMark subject={subject} />
            <span className="truncate text-xl font-heading">{subject.name}</span>
          </span>
          {ready ? <Chip>{topics} თემა</Chip> : <Chip>მალე</Chip>}
        </span>
        <span className={`mt-3 line-clamp-3 text-[15px] leading-7 ${ready ? "text-copy" : "text-faint"}`}>{subject.description}</span>
        {ready && (
          <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold" style={{ color: subject.color }}>
            გახსნა
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        )}
      </span>
    </>
  );
  return ready ? (
    <Link href={subject.href!} className={`${cardLink} h-full`}>
      {body}
    </Link>
  ) : (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-line-strong bg-white/60">{body}</div>
  );
}

/** One management shortcut tile: icon, title and the numbers that matter to the person. */
function ManagementTile({ href, icon: Icon, title, meta }: { href: string; icon: LucideIcon; title: string; meta: string }) {
  return (
    <Link href={href} className={cn(cardLink, "flex-row items-center gap-4 p-5 hover:border-brand")}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="block text-sm text-mute">{meta}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
    </Link>
  );
}

/** Management shortcut for administrators, with the numbers that matter to them. */
async function ManagementCard({ user }: { user: CurrentUser }) {
  const db = await collections();
  if (user.role === "super_admin") {
    const [pending, schools] = await Promise.all([db.requests.countDocuments({ status: "pending" }), db.schools.countDocuments()]);
    return <ManagementTile href="/admin" icon={ClipboardList} title="სკოლები და განაცხადები" meta={`${schools ?? 0} სკოლა · ${pending ? `${pending} ახალი განაცხადი` : "ახალი განაცხადი არ არის"}`} />;
  }
  if (user.role !== "school_admin" && user.role !== "teacher") return null;
  const schoolId = user.school?.id ?? "";
  const [teachers, students] = await Promise.all([
    db.users.countDocuments({ school_id: schoolId, role: { $ne: "student" } }),
    db.users.countDocuments({ school_id: schoolId, role: "student" }),
  ]);
  return (
    <ManagementTile
      href="/school"
      icon={user.role === "school_admin" ? Building2 : Users}
      title={user.role === "school_admin" ? "სკოლის მართვა" : "მოსწავლეების ანგარიშები"}
      meta={`${teachers} მასწავლებელი · ${students} მოსწავლე`}
    />
  );
}

const GREETING: Record<CurrentUser["role"], string> = {
  super_admin: "სისტემის მართვა და სასწავლო მასალა.",
  school_admin: "სკოლის ანგარიშები და სასწავლო მასალა.",
  teacher: "მასალა გაკვეთილისთვის — სმარტ დაფაზე, კომპიუტერსა და ტელეფონზე.",
  student: "აირჩიე საგანი და დაიწყე.",
};

export default async function PortalPage() {
  const user = await requireUser("/dashboard");
  const firstName = user.fullName.split(" ")[0];

  return (
    <PortalShell user={user} active="/dashboard">
      <header>
        <h1 className="text-3xl sm:text-4xl">გამარჯობა, {firstName}</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-copy">{GREETING[user.role]}</p>
      </header>

      <div className="mt-6 max-w-xl empty:hidden">
        <ManagementCard user={user} />
      </div>

      <section className="mt-10">
        <SectionTitle>საგნები</SectionTitle>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map((s) => (
            <SubjectCard key={s.slug} subject={s} />
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
