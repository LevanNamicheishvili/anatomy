import type { Metadata } from "next";
import { PortalShell } from "@/components/portal/Shell";
import { Badge, Card, CardHeader, PageHeader, PORTAL_NAME } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddMembersForm, MemberActions } from "./MemberControls";

export const metadata: Metadata = { title: `სკოლის მართვა — ${PORTAL_NAME}` };

interface Member {
  id: string;
  full_name: string;
  username: string;
  role: string;
  class_label: string | null;
  must_change_password: boolean;
}

/** Georgian class labels sort by grade number first: 5ა, 9ა, 9ბ, 10ა. */
const byClass = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b, "ka");

export default async function SchoolPage() {
  const user = await requireRole(["school_admin", "teacher"], "/school");
  const isAdmin = user.role === "school_admin";
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, username, role, class_label, must_change_password")
    .eq("school_id", user.school?.id ?? "")
    .order("full_name");
  const members = (data ?? []) as Member[];
  const teachers = members.filter((m) => m.role === "teacher" || m.role === "school_admin");
  const classes = new Map<string, Member[]>();
  for (const m of members.filter((m) => m.role === "student")) {
    const key = m.class_label ?? "—";
    classes.set(key, [...(classes.get(key) ?? []), m]);
  }
  const url = await siteUrl();

  const row = (m: Member) => (
    <li key={m.id} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="font-medium">
          {m.full_name}
          {m.id === user.id && <span className="ms-2 text-xs font-normal text-[#66736f]">(შენ)</span>}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[#66736f]">
          <span className="font-mono">{m.username}</span>
          {m.role === "school_admin" && <Badge>ადმინისტრატორი</Badge>}
          {m.must_change_password && <Badge tone="warning">ჯერ არ შესულა</Badge>}
        </p>
      </div>
      {m.id !== user.id && m.role !== "school_admin" && (isAdmin || m.role === "student") && (
        <MemberActions id={m.id} canRemove={isAdmin} siteUrl={url} />
      )}
    </li>
  );

  return (
    <PortalShell user={user} active="/school">
      <PageHeader
        title={isAdmin ? "სკოლის მართვა" : "ჩემი სკოლა"}
        description={`${user.school?.name ?? ""} · ${teachers.length} მასწავლებელი · ${members.length - teachers.length} მოსწავლე`}
      />

      <Card className="mt-8">
        <CardHeader title="ანგარიშების დამატება" description="თითოეული ახალი ანგარიში დროებით პაროლს იღებს, რომელიც პირველი შესვლისას იცვლება." />
        <div className="p-5">
          <AddMembersForm canAddTeachers={isAdmin} siteUrl={url} />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader title="მასწავლებლები" description={`${teachers.length}`} />
          <ul className="divide-y divide-[#e2e7e5]">{teachers.map(row)}</ul>
        </Card>
        <Card className="h-fit">
          <CardHeader title="მოსწავლეები" description={classes.size ? `${classes.size} კლასი` : "ჯერ არ არის დამატებული"} />
          {[...classes.keys()].sort(byClass).map((label) => (
            <div key={label}>
              <h3 className="border-y border-[#e2e7e5] bg-[#f5f7f6] px-5 py-2 text-xs font-semibold text-[#66736f]">
                {label} კლასი · {classes.get(label)?.length}
              </h3>
              <ul className="divide-y divide-[#e2e7e5]">{classes.get(label)?.map(row)}</ul>
            </div>
          ))}
        </Card>
      </div>
    </PortalShell>
  );
}
