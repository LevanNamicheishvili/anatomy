import type { CurrentUser } from "@/lib/auth";
import type { Subject } from "@/lib/subjects";
import { FeaturedCard, SoonCard, TopicCard } from "./cards";
import { PortalShell } from "./Shell";
import { SubjectHero } from "./SubjectHero";
import { TOPIC_ICONS } from "./TopicHeader";
import { Breadcrumbs, SectionTitle } from "./ui";

/** A subject's page: hero with counts, the big 3D experiences featured, then every topic as an equal card. */
export function SubjectPage({ user, subject }: { user: CurrentUser; subject: Subject }) {
  const visible = subject.topics.filter((t) => !t.staffOnly || user.role !== "student");
  const ready = visible.filter((t) => t.href);
  const soon = visible.filter((t) => !t.href);

  // The topics with a preview image are the flagship 3D experiences; a subject with only a couple of
  // topics and no previews (history) features them all.
  const withImage = ready.filter((t) => t.image);
  const featured = withImage.length > 0 ? withImage : ready.length <= 2 ? ready : [];
  const rest = ready.filter((t) => !featured.includes(t));

  const stats = [`${ready.length} თემა`, ...(soon.length ? [`${soon.length} მალე იხსნება`] : []), ...(subject.facts ?? [])];

  return (
    <PortalShell user={user} active="/dashboard">
      <Breadcrumbs items={[{ label: "საგნები", href: "/dashboard" }, { label: subject.name }]} />
      <div className="mt-4">
        <SubjectHero subject={subject} stats={stats} />
      </div>

      {featured.length > 0 && (
        <section className="mt-10">
          <SectionTitle>მთავარი 3D მოდელები</SectionTitle>
          <div className={`mt-5 grid gap-6 ${featured.length > 1 ? "xl:grid-cols-2" : ""}`}>
            {featured.map((t) => (
              <FeaturedCard key={t.slug} href={t.href!} title={t.name} description={t.description} icon={TOPIC_ICONS[t.icon]} color={subject.color} grades={t.grades} image={t.image} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-10">
          <SectionTitle hint={`${rest.length} თემა`}>{featured.length > 0 ? "სხვა თემები" : "თემები"}</SectionTitle>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((t, i) => (
              <TopicCard key={t.slug} href={t.href!} number={i + 1} title={t.name} description={t.description} icon={TOPIC_ICONS[t.icon]} color={subject.color} grades={t.grades} />
            ))}
          </div>
        </section>
      )}

      {soon.length > 0 && (
        <section className="mt-10">
          <SectionTitle>მალე იხსნება</SectionTitle>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((t) => (
              <SoonCard key={t.slug} title={t.name} description={t.description} icon={TOPIC_ICONS[t.icon]} />
            ))}
          </div>
        </section>
      )}
    </PortalShell>
  );
}
