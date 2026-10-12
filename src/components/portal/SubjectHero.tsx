import type { LucideIcon } from "lucide-react";
import type { Subject } from "@/lib/subjects";
import { Chip } from "./ui";
import { SUBJECT_ICONS } from "./TopicHeader";

/** Top of a hub page: icon, title, a short description and the counts that matter. */
export function PageHero({ title, description, color, icon: Icon, stats = [] }: { title: string; description: string; color: string; icon: LucideIcon; stats?: string[] }) {
  return (
    <section className="science-hero relative overflow-hidden rounded-3xl border border-line p-6 shadow-card sm:p-9">
      <span aria-hidden className="absolute inset-y-6 start-0 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: color }}>
          <Icon className="size-8" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl text-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-copy">{description}</p>
          {stats.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {stats.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** A subject's hero: its name, description (or an override) and counts. */
export function SubjectHero({ subject, description, stats }: { subject: Subject; description?: string; stats: string[] }) {
  return <PageHero title={subject.name} description={description ?? subject.description} color={subject.color} icon={SUBJECT_ICONS[subject.icon]} stats={stats} />;
}
