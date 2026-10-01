"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/app/actions/auth";
import { Alert, Field, btn, input } from "@/components/portal/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="მომხმარებლის სახელი">
        <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required placeholder="მაგ. nino.beridze" className={input} />
      </Field>
      <Field label="პაროლი">
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <button type="submit" disabled={pending} className={`${btn.primary} mt-1 h-11`}>
        {pending ? "შესვლა…" : "შესვლა"}
      </button>
    </form>
  );
}
