import type { Metadata } from "next";
import { BiologyHome } from "@/components/portal/BiologyHome";
import { PortalShell } from "@/components/portal/Shell";
import { SubjectHero } from "@/components/portal/SubjectHero";
import { Breadcrumbs } from "@/components/portal/ui";
import { requireUser } from "@/lib/auth";
import { BIO_TOPICS } from "@/lib/biology-topics";
import { SUBJECT_BY_SLUG } from "@/lib/subjects";

const subject = SUBJECT_BY_SLUG["biology"];
export const metadata: Metadata = { title: `${subject.name} — სასწავლო პორტალი` };

export default async function Page() {
  const user = await requireUser("/biology");
  const featured = subject.topics
    .filter((t) => t.href && (!t.staffOnly || user.role !== "student"))
    .map((t) => ({ label: t.name, sub: t.description, href: t.href!, icon: t.icon, image: t.image, grades: t.grades }));
  const lessons = BIO_TOPICS.reduce((n, t) => n + t.lessons.length, 0);
  return (
    <PortalShell user={user} active="/dashboard">
      <Breadcrumbs items={[{ label: "საგნები", href: "/dashboard" }, { label: subject.name }]} />
      <div className="mt-4">
        <SubjectHero subject={subject} description="აირჩიე თემა ან მოძებნე გაკვეთილი." stats={[`${BIO_TOPICS.length} თემა`, `${lessons} გაკვეთილი`, ...(subject.facts ?? [])]} />
      </div>
      <BiologyHome topics={BIO_TOPICS} featured={featured} />
    </PortalShell>
  );
}
