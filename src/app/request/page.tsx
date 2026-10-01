import type { Metadata } from "next";
import Link from "next/link";
import { Logo, PORTAL_NAME } from "@/components/portal/ui";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = { title: `სკოლის განაცხადი — ${PORTAL_NAME}` };

const STEPS = [
  ["განაცხადი", "სკოლა აგზავნის ამ ფორმას."],
  ["დადასტურება", "ვამოწმებთ, რომ განაცხადი ნამდვილად საგანმანათლებლო დაწესებულებისგანაა."],
  ["ანგარიშები", "სკოლის ადმინისტრატორი იღებს ანგარიშს და თავად ქმნის მასწავლებლებისა და მოსწავლეების ანგარიშებს."],
];

export default function RequestPage() {
  return (
    <div className="min-h-dvh bg-[#f4f6f5] font-sans text-[#111a18]">
      <header className="border-b border-[#e2e7e5] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
            <span className="text-[15px] font-heading">{PORTAL_NAME}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-[#e2e7e5] bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">სკოლის განაცხადი</h1>
          <p className="mt-2 text-[15px] leading-7 text-[#33413e]">პორტალი მხოლოდ საგანმანათლებლო დაწესებულებებისთვისაა. შეავსე ფორმა სკოლის სახელით.</p>
          <div className="mt-8">
            <RequestForm />
          </div>
        </section>
        <aside className="h-fit rounded-xl border border-[#e2e7e5] bg-white p-6">
          <h2 className="text-sm font-semibold text-[#66736f]">როგორ ხდება ჩართვა</h2>
          <ol className="mt-4 flex flex-col gap-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[28px_1fr] gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-[#111a18] text-xs font-semibold text-white">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm leading-6 text-[#66736f]">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  );
}
