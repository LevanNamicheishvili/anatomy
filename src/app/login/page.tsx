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
    <div className="science-hero flex min-h-dvh flex-col bg-page font-sans text-ink">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="-ms-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-copy transition-colors hover:bg-card hover:text-ink">
          <ArrowLeft className="size-4" />
          მთავარი გვერდი
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pt-2 pb-12 sm:pb-16">
        <div className="w-full max-w-[480px]">
          <div className="flex flex-col items-center text-center">
            <Logo className="size-14 rounded-2xl [&>svg]:size-6" />
            <h1 className="mt-5 text-[1.75rem] leading-snug">შესვლა პორტალზე</h1>
            <p className="mt-2 text-[15px] leading-7 text-mute">გამოიყენე სკოლისგან მიღებული მომხმარებლის სახელი და პაროლი.</p>
          </div>

          <div className="mt-8 rounded-3xl border border-line bg-card p-6 shadow-panel sm:p-9">
            {!dbConfigured && (
              <div className="mb-6">
                <Alert tone="info">სისტემა ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან. დაყენების ინსტრუქცია: SETUP.md.</Alert>
              </div>
            )}
            <LoginForm next={target} />

            {/* Accounts are managed by schools, so "forgot password" is a person, not a link. */}
            <details className="group mt-6 border-t border-line pt-4">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-medium text-copy [&::-webkit-details-marker]:hidden">
                დაგავიწყდა პაროლი?
                <ChevronDown className="size-4 text-faint transition-transform group-open:rotate-180" />
              </summary>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                {FORGOT.map(([who, what]) => (
                  <div key={who}>
                    <dt className="font-semibold text-ink">{who}</dt>
                    <dd className="mt-0.5 leading-6 text-mute">{what}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>

          <p className="mt-6 text-center text-sm text-mute">
            შენი სკოლა ჯერ არ არის პორტალზე?{" "}
            <Link href="/request" className="font-semibold text-brand hover:underline">
              გაგზავნე განაცხადი
            </Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-line px-4 py-5 text-center text-xs leading-5 text-mute">{PORTAL_NAME} · მხოლოდ საგანმანათლებლო დაწესებულებებისთვის</footer>
    </div>
  );
}
