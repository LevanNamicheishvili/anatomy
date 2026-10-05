import type { Metadata } from "next";
import { CurriculumPage } from "@/components/portal/CurriculumPage";
import { requireUser } from "@/lib/auth";
import { BIOLOGY_GRADES, gradeFromClass } from "@/lib/curriculum";
import { SUBJECT_BY_SLUG } from "@/lib/subjects";

const subject = SUBJECT_BY_SLUG["biology"];
export const metadata: Metadata = { title: `${subject.name} — სასწავლო პორტალი` };

export default async function Page({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const user = await requireUser("/biology");
  const own = gradeFromClass(user.classLabel);
  const asked = Number((await searchParams).grade);
  const grade = BIOLOGY_GRADES.find((g) => g.grade === asked) ?? BIOLOGY_GRADES.find((g) => g.grade === own) ?? BIOLOGY_GRADES[0];
  return <CurriculumPage user={user} subject={subject} grades={BIOLOGY_GRADES} grade={grade} ownGrade={own} />;
}
