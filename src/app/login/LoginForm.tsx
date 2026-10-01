"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, TriangleAlert, UserRound } from "lucide-react";
import { signIn, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/portal/ui";

const field =
  "peer h-12 w-full rounded-lg border border-[#d5dcd9] bg-white ps-11 pe-3 text-[15px] text-[#111a18] outline-none transition-[border-color,box-shadow] placeholder:text-[#97a29e] hover:border-[#c3ccc9] focus:border-[#0f8a74] focus:ring-4 focus:ring-[#0f8a74]/12";
const icon = "pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#97a29e] transition-colors peer-focus:text-[#0f8a74]";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const detectCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState("CapsLock"));

  return (
    <form action={action} className="flex flex-col gap-5" noValidate={false}>
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="text-[13px] font-semibold text-[#33413e]">
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
        <label htmlFor="password" className="text-[13px] font-semibold text-[#33413e]">
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
            className="absolute end-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-[#66736f] transition-colors hover:bg-[#eef2f0] hover:text-[#111a18]"
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
        {capsLock && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#8a6100]">
            <TriangleAlert className="size-3.5" />
            Caps Lock ჩართულია
          </p>
        )}
      </div>

      {state.error && <Alert>{state.error}</Alert>}

      <button
        type="submit"
        disabled={pending}
        className="group mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#111a18] px-5 text-[15px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_20px_-8px_rgba(17,26,24,0.45)] transition-colors outline-none hover:bg-[#1f2b28] focus-visible:ring-4 focus-visible:ring-[#0f8a74]/30 disabled:opacity-70"
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
