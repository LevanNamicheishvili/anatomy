import type { Metadata } from "next";
import { SubjectPage } from "@/components/portal/SubjectPage";
import { requireUser } from "@/lib/auth";
import { SUBJECT_BY_SLUG } from "@/lib/subjects";

const subject = SUBJECT_BY_SLUG["geography"];
export const metadata: Metadata = { title: `${subject.name} — სასწავლო პორტალი` };

export default async function Page() {
  const user = await requireUser("/geography");
  return <SubjectPage user={user} subject={subject} />;
}
