"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, TriangleAlert, UserRound } from "lucide-react";
import { signIn, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/portal/ui";

const field =
  "peer h-12 w-full rounded-xl border border-line-strong bg-card ps-11 pe-3 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/12";
const icon = "pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-faint transition-colors peer-focus:text-brand";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const detectCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState("CapsLock"));

  return (
    <form action={action} className="flex flex-col gap-5" noValidate={false}>
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="text-sm font-semibold text-copy">
          მომხმარებლის სახელი
        </label>
        <div className="relative">
          <input
            id="username"
            name="username"
            key={state.username ?? ""}
            defaultValue={state.username}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus={!state.username}
            placeholder="მაგ. nino.beridze"
            className={field}
          />
          <UserRound className={icon} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-semibold text-copy">
          პაროლი
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            autoFocus={!!state.username}
            onKeyDown={detectCaps}
            onKeyUp={detectCaps}
            className={`${field} pe-12`}
          />
          <LockKeyhole className={icon} />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
            title={showPassword ? "დამალვა" : "ჩვენება"}
            className="absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-mute transition-colors hover:bg-chip hover:text-ink"
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
        {capsLock && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning" role="status">
            <TriangleAlert className="size-3.5 shrink-0" />
            Caps Lock ჩართულია
          </p>
        )}
      </div>

      {state.error && <Alert>{state.error}</Alert>}

      <button
        type="submit"
        disabled={pending}
        className="group mt-1 inline-flex min-h-12 py-3 items-center justify-center gap-2 rounded-xl bg-deep px-5 text-[15px] font-semibold text-white shadow-card transition-colors outline-none hover:bg-deep-hover focus-visible:ring-4 focus-visible:ring-brand/30 disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="size-[18px] animate-spin" />
            მოწმდება…
          </>
        ) : (
          <>
            შესვლა
            <ArrowRight className="size-[18px] transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}
