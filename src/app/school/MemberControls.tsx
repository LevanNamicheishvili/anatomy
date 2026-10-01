"use client";

import { useActionState, useState } from "react";
import { CredentialsCard } from "@/components/portal/Credentials";
import { Alert, Field, btn, input } from "@/components/portal/ui";
import { createMembers, removeMember, resetMemberPassword, type CreateState, type ResetState } from "./actions";

const ROLE_NAME = { teacher: "მასწავლებელი", student: "მოსწავლე", school_admin: "სკოლის ადმინისტრატორი", super_admin: "ადმინისტრატორი" } as const;

export function AddMembersForm({ canAddTeachers, siteUrl }: { canAddTeachers: boolean; siteUrl: string }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createMembers, {});
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [shown, setShown] = useState<CreateState | null>(null);
  const result = shown === state ? null : state;

  return (
    <div className="flex flex-col gap-5">
      {result?.accounts && result.accounts.length > 0 && (
        <CredentialsCard
          siteUrl={siteUrl}
          items={result.accounts.map((a) => ({ ...a, roleName: ROLE_NAME[a.role] }))}
          onDone={() => setShown(state)}
        />
      )}
      <form action={action} className="flex flex-col gap-4">
        {canAddTeachers && (
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#d5dcd9] sm:w-fit">
            {(["student", "teacher"] as const).map((r, i) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={`h-10 px-5 text-sm transition-colors ${i ? "border-s border-[#d5dcd9]" : ""} ${role === r ? "bg-[#111a18] font-semibold text-white" : "text-[#33413e] hover:bg-[#f5f7f6]"}`}
              >
                {r === "student" ? "მოსწავლეები" : "მასწავლებლები"}
              </button>
            ))}
          </div>
        )}
        <input type="hidden" name="role" value={role} />
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          {role === "student" ? (
            <Field label="კლასი">
              <input name="class_label" required placeholder="მაგ. 9ბ" className={input} />
            </Field>
          ) : (
            <div className="hidden md:block" />
          )}
          <Field label="სახელი და გვარი — თითო ხაზზე ერთი" hint="მთელი კლასის სია შეგიძლია ერთად ჩასვა (მაქსიმუმ 60).">
            <textarea name="names" required rows={5} placeholder={"ნინო ბერიძე\nგიორგი კაპანაძე"} className={`${input} h-auto py-2.5`} />
          </Field>
        </div>
        {result?.error && <Alert>{result.error}</Alert>}
        <div>
          <button type="submit" disabled={pending} className={btn.primary}>
            {pending ? "იქმნება…" : "ანგარიშების შექმნა"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function MemberActions({ id, canRemove, siteUrl }: { id: string; canRemove: boolean; siteUrl: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetMemberPassword, {});
  const [shown, setShown] = useState<ResetState | null>(null);
  const result = shown === state ? null : state;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1">
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={pending} className={btn.ghost}>
            პაროლის აღდგენა
          </button>
        </form>
        {canRemove && (
          <form
            action={removeMember}
            onSubmit={(e) => {
              if (!window.confirm("ანგარიში სამუდამოდ წაიშლება. გავაგრძელო?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={btn.danger}>
              წაშლა
            </button>
          </form>
        )}
      </div>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.account && (
        <div className="w-full min-w-[300px]">
          <CredentialsCard siteUrl={siteUrl} items={[{ ...result.account, roleName: ROLE_NAME[result.account.role] }]} onDone={() => setShown(state)} />
        </div>
      )}
    </div>
  );
}
