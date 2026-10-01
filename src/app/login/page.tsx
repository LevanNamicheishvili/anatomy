import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { Alert, Logo, PORTAL_NAME } from "@/components/portal/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: `შესვლა — ${PORTAL_NAME}` };

const FORGOT = [
  ["მოსწავლე", "მიმართე მასწავლებელს ან სკოლის ადმინისტრატორს — ახალ დროებით პაროლს მოგცემენ."],
  ["მასწავლებელი", "მიმართე შენი სკოლის ადმინისტრატორს."],
  ["სკოლის ადმინისტრატორი", "დაგვიკავშირდი — პაროლს სისტემის ადმინისტრატორი აღადგენს."],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") && next !== "/" ? next : "/dashboard";
  if (await getCurrentUser()) redirect(target);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[#33413e] transition-colors hover:bg-white hover:text-[#111a18]">
          <ArrowLeft className="size-4" />
          მთავარი გვერდი
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center text-center">
            <Logo className="size-12 rounded-xl [&>svg]:size-6" />
            <h1 className="mt-5 text-[28px] leading-snug font-semibold">შესვლა პორტალზე</h1>
            <p className="mt-2 text-[15px] leading-7 text-[#66736f]">გამოიყენე სკოლისგან მიღებული მომხმარებლის სახელი და პაროლი.</p>
          </div>

          <div className="mt-8 rounded-2xl border border-[#e2e7e5] bg-white p-6 shadow-[0_1px_2px_rgba(17,26,24,0.04),0_12px_32px_-12px_rgba(17,26,24,0.12)] sm:p-8">
            {!dbConfigured && (
              <div className="mb-6">
                <Alert tone="info">სისტემა ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან. დაყენების ინსტრუქცია: SETUP.md.</Alert>
              </div>
            )}
            <LoginForm next={target} />

            {/* Accounts are managed by schools, so "forgot password" is a person, not a link. */}
            <details className="group mt-6 border-t border-[#e2e7e5] pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[#33413e] [&::-webkit-details-marker]:hidden">
                დაგავიწყდა პაროლი?
                <ChevronDown className="size-4 text-[#97a29e] transition-transform group-open:rotate-180" />
              </summary>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                {FORGOT.map(([who, what]) => (
                  <div key={who}>
                    <dt className="font-semibold text-[#111a18]">{who}</dt>
                    <dd className="mt-0.5 leading-6 text-[#66736f]">{what}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>

          <p className="mt-6 text-center text-sm text-[#66736f]">
            შენი სკოლა ჯერ არ არის პორტალზე?{" "}
            <Link href="/request" className="font-semibold text-[#0f8a74] hover:underline">
              გაგზავნე განაცხადი
            </Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-[#e2e7e5] py-5 text-center text-xs text-[#97a29e]">{PORTAL_NAME} · მხოლოდ საგანმანათლებლო დაწესებულებებისთვის</footer>
    </div>
  );
}
