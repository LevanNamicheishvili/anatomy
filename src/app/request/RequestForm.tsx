"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Alert, Field, btn, input } from "@/components/portal/ui";
import { submitRequest, type RequestState } from "./actions";

export function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(submitRequest, {});
  if (state.sent)
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <CheckCircle2 className="size-10 text-[#0f8a74]" />
        <h2 className="text-xl font-semibold">განაცხადი მიღებულია</h2>
        <p className="text-[15px] leading-7 text-[#33413e]">
          განაცხადს განვიხილავთ და დადასტურების შემდეგ მითითებულ პირს გადავცემთ სკოლის ადმინისტრატორის ანგარიშის მონაცემებს.
        </p>
        <Link href="/login" className={btn.secondary}>
          შესვლის გვერდზე დაბრუნება
        </Link>
      </div>
    );

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold text-[#66736f]">სკოლა</legend>
        <Field label="სკოლის სრული სახელი">
          <input name="school_name" required placeholder="მაგ. თბილისის №1 საჯარო სკოლა" className={input} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ქალაქი / მუნიციპალიტეტი">
            <input name="city" required className={input} />
          </Field>
          <Field label="მისამართი" hint="არასავალდებულო">
            <input name="address" className={input} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold text-[#66736f]">საკონტაქტო პირი — მომავალი სკოლის ადმინისტრატორი</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="სახელი და გვარი">
            <input name="contact_name" required className={input} />
          </Field>
          <Field label="თანამდებობა">
            <input name="contact_position" required placeholder="მაგ. დირექტორი" className={input} />
          </Field>
          <Field label="ელ-ფოსტა">
            <input name="email" type="email" required className={input} />
          </Field>
          <Field label="ტელეფონი">
            <input name="phone" type="tel" required className={input} />
          </Field>
        </div>
        <Field label="დამატებითი ინფორმაცია" hint="არასავალდებულო — მაგ. მოსწავლეების სავარაუდო რაოდენობა">
          <textarea name="message" rows={3} className={`${input} h-auto py-2.5`} />
        </Field>
      </fieldset>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btn.primary} h-11`}>
          {pending ? "იგზავნება…" : "განაცხადის გაგზავნა"}
        </button>
        <Link href="/login" className={btn.ghost}>
          გაუქმება
        </Link>
      </div>
    </form>
  );
}
