"use client";

import { useActionState, useState } from "react";
import { CredentialsCard } from "@/components/portal/Credentials";
import { Alert, btn } from "@/components/portal/ui";
import { approveRequest, resetSchoolAdmin, type ApproveState, type ResetState } from "./actions";

export function ApproveButton({ id, siteUrl }: { id: string; siteUrl: string }) {
  const [state, action, pending] = useActionState<ApproveState, FormData>(approveRequest, {});
  const [hidden, setHidden] = useState(false);
  if (state.account && !hidden)
    return (
      <div className="col-span-full mt-3">
        <CredentialsCard
          siteUrl={siteUrl}
          items={[{ ...state.account, roleName: `სკოლის ადმინისტრატორი · ${state.account.schoolName}` }]}
          onDone={() => setHidden(true)}
        />
      </div>
    );
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending ? "მუშავდება…" : "დადასტურება"}
      </button>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

export function ResetAdminButton({ schoolId, siteUrl }: { schoolId: string; siteUrl: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetSchoolAdmin, {});
  const [hidden, setHidden] = useState(false);
  return (
    <>
      <form action={action}>
        <input type="hidden" name="school_id" value={schoolId} />
        <button type="submit" disabled={pending} className={btn.ghost}>
          ადმინის პაროლის აღდგენა
        </button>
      </form>
      {state.error && <Alert>{state.error}</Alert>}
      {state.account && !hidden && (
        <div className="col-span-full w-full">
          <CredentialsCard siteUrl={siteUrl} items={[{ ...state.account, roleName: "სკოლის ადმინისტრატორი" }]} onDone={() => setHidden(true)} />
        </div>
      )}
    </>
  );
}
