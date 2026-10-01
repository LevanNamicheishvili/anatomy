import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/config";
import { Alert, Logo, PORTAL_NAME } from "@/components/portal/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: `შესვლა — ${PORTAL_NAME}` };

const INCLUDED = [
  "ბიოლოგია: ადამიანის 3D ატლასი, ანიმაციები, ქვიზი და ბარათები",
  "გეოგრაფია და ისტორია — მალე",
  "მასწავლებლის რეჟიმი სმარტ დაფისთვის",
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

  return (
    <div className="grid min-h-dvh bg-white font-sans text-[#111a18] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#111a18] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="bg-white text-[#111a18]" />
          <span className="text-lg font-semibold">{PORTAL_NAME}</span>
        </div>
        <div className="max-w-md">
          <p className="text-[13px] font-semibold tracking-wide text-[#7fd1bd]">მხოლოდ საგანმანათლებლო დაწესებულებებისთვის</p>
          <h1 className="mt-4 text-4xl leading-tight font-semibold">ინტერაქტიული მასალა ქართული სკოლებისთვის</h1>
          <ul className="mt-8 flex flex-col gap-3 border-t border-white/15 pt-6">
            {INCLUDED.map((item) => (
              <li key={item} className="grid grid-cols-[8px_1fr] gap-3 text-[15px] leading-6 text-white/80">
                <span className="mt-[9px] size-2 rounded-full bg-[#0f8a74]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">ანგარიშებს სკოლის ადმინისტრაცია ქმნის.</p>
        {/* A quiet grid in the corner gives the panel some structure. */}
        <svg className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] text-white/[0.04]" viewBox="0 0 100 100" aria-hidden>
          {Array.from({ length: 11 }, (_, i) => (
            <g key={i} stroke="currentColor" strokeWidth="0.4">
              <line x1={i * 10} y1="0" x2={i * 10} y2="100" />
              <line x1="0" y1={i * 10} x2="100" y2={i * 10} />
            </g>
          ))}
        </svg>
      </aside>

      <main className="flex flex-col px-6 py-10 sm:px-12">
        <div className="flex items-center gap-3 lg:hidden">
          <Logo />
          <span className="text-[17px] font-semibold">{PORTAL_NAME}</span>
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h2 className="text-2xl font-semibold">შესვლა</h2>
          <p className="mt-2 text-[15px] leading-7 text-[#66736f]">გამოიყენე სკოლისგან მიღებული მომხმარებლის სახელი და პაროლი.</p>
          {!supabaseConfigured && (
            <div className="mt-6">
              <Alert tone="info">სისტემა ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან (Supabase). დაყენების ინსტრუქცია: SETUP.md.</Alert>
            </div>
          )}
          <div className="mt-8">
            <LoginForm next={next ?? "/"} />
          </div>
          <div className="mt-10 border-t border-[#e2e7e5] pt-6">
            <p className="text-sm text-[#66736f]">შენი სკოლა ჯერ არ არის პორტალზე?</p>
            <Link href="/request" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f8a74] hover:underline">
              სკოლის განაცხადის გაგზავნა
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
