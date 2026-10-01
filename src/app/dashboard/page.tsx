import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Globe2, HeartPulse, Landmark, QrCode, Users, type LucideIcon } from "lucide-react";
import { PortalShell } from "@/components/portal/Shell";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { collections } from "@/lib/db";
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
      className={size === "lg" ? "flex size-11 shrink-0 items-center justify-center rounded-lg text-white" : "flex size-9 shrink-0 items-center justify-center rounded-md text-white"}
      style={{ backgroundColor: subject.color }}
    >
      <Icon className={size === "lg" ? "size-6" : "size-5"} strokeWidth={2} />
    </span>
  );
}

/** A subject that is ready: large card with a preview of what opens. */
function FeaturedSubject({ subject, showTools }: { subject: Subject & { href: string }; showTools: boolean }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#d5dcd9] bg-white md:grid md:grid-cols-[1.15fr_1fr]">
      {subject.image && (
        <Link href={subject.href} className="relative block aspect-[22/15] border-b border-[#e2e7e5] bg-[#eef2f0] md:aspect-auto md:min-h-[340px] md:border-e md:border-b-0">
          <Image
            src={subject.image}
            alt={`${subject.name} — ატლასის ხედი`}
            fill
            priority
            sizes="(min-width: 768px) 55vw, 100vw"
            className="object-cover object-top"
          />
        </Link>
      )}
      <div className="flex flex-col p-6 md:p-8">
        <div className="flex items-center gap-3">
          <SubjectMark subject={subject} size="lg" />
          <h2 className="text-2xl font-semibold">{subject.name}</h2>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-[#33413e]">{subject.description}</p>
        {subject.facts && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {subject.facts.map((f) => (
              <li key={f} className="rounded-md border border-[#e2e7e5] bg-[#f5f7f6] px-2.5 py-1 text-[13px] text-[#33413e]">
                {f}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-7">
          <Link
            href={subject.href}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-semibold text-white transition-colors hover:brightness-95"
            style={{ backgroundColor: subject.color }}
          >
            გახსნა
            <ArrowRight className="size-[18px]" />
          </Link>
          {showTools && subject.tools?.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex items-center gap-3 rounded-md border border-[#d5dcd9] px-3 py-2.5 transition-colors hover:bg-[#f5f7f6]"
            >
              <QrCode className="size-5 shrink-0 text-[#33413e]" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#111a18]">{tool.name}</span>
                <span className="block text-[13px] text-[#66736f]">{tool.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

/** A subject still being prepared. */
function UpcomingSubject({ subject }: { subject: Subject }) {
  return (
    <article className="flex flex-col rounded-xl border border-[#e2e7e5] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SubjectMark subject={subject} />
          <h2 className="text-lg font-semibold">{subject.name}</h2>
        </div>
        <span className="rounded-full bg-[#eef2f0] px-2.5 py-0.5 text-xs font-medium text-[#66736f]">მალე</span>
      </div>
      <p className="mt-3 text-[15px] leading-7 text-[#66736f]">{subject.description}</p>
    </article>
  );
}

/** Management shortcut for administrators, with the numbers that matter to them. */
async function ManagementCard({ user }: { user: CurrentUser }) {
  const db = await collections();
  if (user.role === "super_admin") {
    const [pending, schools] = await Promise.all([db.requests.countDocuments({ status: "pending" }), db.schools.countDocuments()]);
    return (
      <Link href="/admin" className="group flex items-center gap-4 rounded-xl border border-[#d5dcd9] bg-white p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#0f8a74] hover:shadow-[0_14px_32px_-18px_rgba(17,26,24,0.25)]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#111a18] text-white">
          <ClipboardList className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">სკოლები და განაცხადები</span>
          <span className="block text-sm text-[#66736f]">
            {schools ?? 0} სკოლა · {pending ? `${pending} ახალი განაცხადი` : "ახალი განაცხადი არ არის"}
          </span>
        </span>
        <ArrowRight className="size-5 text-[#97a29e] transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-[#0f8a74]" />
      </Link>
    );
  }
  if (user.role !== "school_admin" && user.role !== "teacher") return null;
  const schoolId = user.school?.id ?? "";
  const [teachers, students] = await Promise.all([
    db.users.countDocuments({ school_id: schoolId, role: { $ne: "student" } }),
    db.users.countDocuments({ school_id: schoolId, role: "student" }),
  ]);
  return (
    <Link href="/school" className="group flex items-center gap-4 rounded-xl border border-[#d5dcd9] bg-white p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#0f8a74] hover:shadow-[0_14px_32px_-18px_rgba(17,26,24,0.25)]">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#111a18] text-white">
        {user.role === "school_admin" ? <Building2 className="size-6" /> : <Users className="size-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{user.role === "school_admin" ? "სკოლის მართვა" : "მოსწავლეების ანგარიშები"}</span>
        <span className="block text-sm text-[#66736f]">
          {teachers} მასწავლებელი · {students} მოსწავლე
        </span>
      </span>
      <ArrowRight className="size-5 text-[#97a29e] transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-[#0f8a74]" />
    </Link>
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
  const ready = SUBJECTS.filter((s): s is Subject & { href: string } => !!s.href);
  const upcoming = SUBJECTS.filter((s) => !s.href);
  const firstName = user.fullName.split(" ")[0];

  return (
    <PortalShell user={user} active="/dashboard">
      <h1 className="text-2xl font-semibold sm:text-3xl">გამარჯობა, {firstName}</h1>
      <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{GREETING[user.role]}</p>

      <div className="mt-6 empty:hidden">
        <ManagementCard user={user} />
      </div>

      <h2 className="mt-10 text-sm font-semibold text-[#66736f]">საგნები</h2>
      <div className="mt-3 flex flex-col gap-6">
        {ready.map((s) => (
          <FeaturedSubject key={s.slug} subject={s} showTools={user.role !== "student"} />
        ))}
        {upcoming.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {upcoming.map((s) => (
              <UpcomingSubject key={s.slug} subject={s} />
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
