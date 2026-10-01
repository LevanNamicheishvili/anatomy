"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions/auth";
import { Alert, Field, btn, input } from "@/components/portal/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="ახალი პაროლი" hint="მინიმუმ 8 სიმბოლო">
        <input name="password" type="password" autoComplete="new-password" minLength={8} required className={input} />
      </Field>
      <Field label="გაიმეორე პაროლი">
        <input name="repeat" type="password" autoComplete="new-password" minLength={8} required className={input} />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <button type="submit" disabled={pending} className={`${btn.primary} mt-1 h-11`}>
        {pending ? "ინახება…" : "პაროლის შენახვა"}
      </button>
    </form>
  );
}
