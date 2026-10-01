import type { Metadata } from "next";
import { PortalShell } from "@/components/portal/Shell";
import { Badge, Card, CardHeader, PageHeader, PORTAL_NAME, btn } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { collections } from "@/lib/db";
import { rejectRequest, setSchoolActive } from "./actions";
import { ApproveButton, ResetAdminButton } from "./AdminControls";

export const metadata: Metadata = { title: `სკოლები და განაცხადები — ${PORTAL_NAME}` };

const date = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

export default async function AdminPage() {
  const user = await requireRole(["super_admin"], "/admin");
  const { requests, schools: schoolsCol, users } = await collections();
  const [pendingDocs, schoolDocs, counted] = await Promise.all([
    requests.find({ status: "pending" }).sort({ created_at: 1 }).toArray(),
    schoolsCol.find().sort({ created_at: -1 }).toArray(),
    users
      .aggregate<{ _id: { school: string | null; role: string }; n: number }>([
        { $match: { role: { $in: ["teacher", "student"] } } },
        { $group: { _id: { school: "$school_id", role: "$role" }, n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const pending = pendingDocs.map((r) => ({ ...r, id: r._id, created_at: r.created_at.toISOString() }));
  const schools = schoolDocs.map((s) => ({ ...s, id: s._id, created_at: s.created_at.toISOString() }));
  const counts = new Map<string, { teachers: number; students: number }>();
  for (const { _id, n } of counted) {
    if (!_id.school) continue;
    const c = counts.get(_id.school) ?? { teachers: 0, students: 0 };
    if (_id.role === "teacher") c.teachers = n;
    if (_id.role === "student") c.students = n;
    counts.set(_id.school, c);
  }
  const url = await siteUrl();

  return (
    <PortalShell user={user} active="/admin">
      <PageHeader title="სკოლები და განაცხადები" description="სკოლები პორტალზე მხოლოდ დადასტურების შემდეგ ერთვება." />

      <Card className="mt-8">
        <CardHeader
          title="ახალი განაცხადები"
          description={pending?.length ? `${pending.length} განაცხადი ელოდება განხილვას` : "ახალი განაცხადი არ არის"}
        />
        <ul className="divide-y divide-[#e2e7e5]">
          {(pending ?? []).map((r) => (
            <li key={r.id} className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="text-base font-semibold">{r.school_name}</p>
                <p className="mt-0.5 text-sm text-[#66736f]">
                  {r.city}
                  {r.address ? ` · ${r.address}` : ""} · {date(r.created_at)}
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-[#66736f]">საკონტაქტო პირი</dt>
                  <dd>
                    {r.contact_name}, {r.contact_position}
                  </dd>
                  <dt className="text-[#66736f]">კონტაქტი</dt>
                  <dd>
                    {r.email} · {r.phone}
                  </dd>
                  {r.message && (
                    <>
                      <dt className="text-[#66736f]">შენიშვნა</dt>
                      <dd className="whitespace-pre-line">{r.message}</dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="flex items-start gap-2 md:flex-col md:items-end">
                <ApproveButton id={r.id} siteUrl={url} />
                <form action={rejectRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={btn.danger}>
                    უარყოფა
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6">
        <CardHeader title="სკოლები" description={`სულ ${schools?.length ?? 0}`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#e2e7e5] text-left text-xs font-semibold text-[#66736f]">
                <th className="px-5 py-3">სკოლა</th>
                <th className="px-5 py-3">მასწავლებლები</th>
                <th className="px-5 py-3">მოსწავლეები</th>
                <th className="px-5 py-3">სტატუსი</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e7e5]">
              {(schools ?? []).map((s) => {
                const c = counts.get(s.id) ?? { teachers: 0, students: 0 };
                return (
                  <tr key={s.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-[#66736f]">
                        {s.city} · {date(s.created_at)}
                      </p>
                    </td>
                    <td className="px-5 py-4">{c.teachers}</td>
                    <td className="px-5 py-4">{c.students}</td>
                    <td className="px-5 py-4">{s.active ? <Badge tone="accent">აქტიური</Badge> : <Badge tone="danger">გათიშული</Badge>}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-1">
                        <ResetAdminButton schoolId={s.id} siteUrl={url} />
                        <form action={setSchoolActive}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="active" value={s.active ? "0" : "1"} />
                          <button type="submit" className={s.active ? btn.danger : btn.secondary}>
                            {s.active ? "გათიშვა" : "ჩართვა"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </PortalShell>
  );
}
