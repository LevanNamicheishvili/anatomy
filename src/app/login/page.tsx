import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChevronDown, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/config";
import { Alert, Logo, PORTAL_NAME } from "@/components/portal/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: `შესვლა — ${PORTAL_NAME}` };

const SUBJECTS = [
  { name: "ბიოლოგია", ready: true },
  { name: "გეოგრაფია", ready: false },
  { name: "ისტორია", ready: false },
];

const FORGOT = [
  ["მოსწავლე", "მიმართე მასწავლებელს ან სკოლის ადმინისტრატორს — ახალ დროებით პაროლს მოგცემენ."],
  ["მასწავლებელი", "მიმართე შენი სკოლის ადმინისტრატორს."],
  ["სკოლის ადმინისტრატორი", "დაგვიკავშირდი — პაროლს სისტემის ადმინისტრატორი აღადგენს."],
];

/** A laptop drawn in CSS around a real screenshot. */
function Laptop({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative">
      <div className="rounded-t-[14px] border border-[#2a3330] bg-[#151b19] p-[9px] pb-[11px] shadow-[0_40px_80px_-30px_rgba(17,26,24,0.55)]">
        <div className="mx-auto mb-[6px] size-[5px] rounded-full bg-[#2f3a37]" />
        <div className="relative aspect-[16/10] overflow-hidden rounded-[3px] bg-[#f4f6f5]">
          <Image src={src} alt={alt} fill priority sizes="640px" className="object-cover object-top" />
        </div>
      </div>
      {/* Base with the opening notch. */}
      <div className="relative -mx-[7%] h-[14px] rounded-b-[14px] bg-gradient-to-b from-[#d9dedc] to-[#b9c1be] shadow-[0_18px_30px_-12px_rgba(17,26,24,0.45)]">
        <div className="absolute top-0 left-1/2 h-[6px] w-[14%] -translate-x-1/2 rounded-b-md bg-[#aab3b0]" />
      </div>
    </div>
  );
}

/** A phone drawn in CSS around a real screenshot. */
function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-[34px] border border-[#2a3330] bg-[#151b19] p-[7px] shadow-[0_30px_60px_-20px_rgba(17,26,24,0.6)]">
      <div className="relative aspect-[390/844] overflow-hidden rounded-[27px] bg-[#f4f6f5]">
        <Image src={src} alt={alt} fill sizes="200px" className="object-cover object-top" />
        <div className="absolute top-[7px] left-1/2 h-[18px] w-[34%] -translate-x-1/2 rounded-full bg-[#151b19]" />
      </div>
    </div>
  );
}

/** Left panel: the portal shown on the devices it is used on. */
function Showcase() {
  return (
    <aside className="relative hidden overflow-hidden border-e border-[#e2e7e5] bg-[#eef2f0] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
      {/* Soft dot texture and a light accent wash. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "radial-gradient(#c9d3cf 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
      <div aria-hidden className="absolute -right-32 bottom-[-20%] size-[560px] rounded-full bg-[#0f8a74] opacity-[0.10] blur-[110px]" />

      <div className="relative flex items-center gap-3 px-12 pt-10">
        <Logo />
        <span className="text-[17px] font-semibold tracking-tight text-[#111a18]">{PORTAL_NAME}</span>
      </div>

      <div className="relative px-12 pt-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#cfe3dc] bg-white px-3 py-1 text-xs font-semibold text-[#0c7563]">
          <ShieldCheck className="size-3.5" />
          მხოლოდ საგანმანათლებლო დაწესებულებებისთვის
        </p>
        <h1 className="mt-5 max-w-[520px] text-[34px] leading-[1.2] font-semibold tracking-tight text-[#111a18]">
          ერთი პორტალი — <span className="text-[#0f8a74]">დაფაზე, კომპიუტერსა და ტელეფონზე</span>
        </h1>
      </div>

      {/* Laptop with the phone in front of it, bottom right. */}
      <div className="relative flex flex-1 items-center px-12 pb-6">
        <div className="relative w-full max-w-[600px]">
          <div className="pe-[12%]">
            <Laptop src="/images/portal/atlas-laptop.jpg" alt="ადამიანის 3D ატლასი ლეპტოპზე" />
          </div>
          <div className="absolute -bottom-6 right-0 w-[24%] min-w-[120px]">
            <Phone src="/images/portal/atlas-phone.jpg" alt="ადამიანის 3D ატლასი ტელეფონზე" />
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-4 border-t border-[#dbe3e0] bg-white/60 px-12 py-5 backdrop-blur">
        <ul className="flex gap-2">
          {SUBJECTS.map((s) => (
            <li
              key={s.name}
              className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${s.ready ? "bg-[#111a18] text-white" : "border border-[#d5dcd9] bg-white text-[#66736f]"}`}
            >
              {s.name}
              {!s.ready && <span className="font-normal"> · მალე</span>}
            </li>
          ))}
        </ul>
        <p className="text-xs whitespace-nowrap text-[#66736f] max-xl:hidden">
          <span className="font-semibold text-[#111a18]">2 239</span> სტრუქტურა · <span className="font-semibold text-[#111a18]">12</span> თემა
        </p>
      </div>
    </aside>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await getCurrentUser()) redirect(target);

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-white font-sans text-[#111a18] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <Showcase />

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="flex h-20 items-center justify-between gap-4 px-6 sm:px-10">
          <div className="flex min-w-0 items-center gap-3 lg:invisible">
            <Logo />
            <span className="truncate text-[15px] font-semibold">{PORTAL_NAME}</span>
          </div>
          <Link
            href="/request"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-[#33413e] transition-colors hover:bg-[#f5f7f6] hover:text-[#111a18]"
          >
            <span className="max-sm:hidden">სკოლის </span>განაცხადი
            <ArrowUpRight className="size-4" />
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 pb-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <p className="text-[13px] font-semibold text-[#0f8a74]">ავტორიზაცია</p>
            <h2 className="mt-2 text-[30px] leading-tight font-semibold tracking-tight">კეთილი იყოს შენი მობრძანება</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#66736f]">შედი სკოლისგან მიღებული მომხმარებლის სახელით და პაროლით.</p>

            {!supabaseConfigured && (
              <div className="mt-6">
                <Alert tone="info">სისტემა ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან. დაყენების ინსტრუქცია: SETUP.md.</Alert>
              </div>
            )}

            <div className="mt-8">
              <LoginForm next={target} />
            </div>

            {/* Accounts are managed by schools, so "forgot password" is a person, not a link. */}
            <details className="group mt-6 rounded-lg border border-[#e2e7e5] bg-[#fafbfb] open:bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[#33413e] [&::-webkit-details-marker]:hidden">
                დაგავიწყდა პაროლი?
                <ChevronDown className="size-4 text-[#97a29e] transition-transform group-open:rotate-180" />
              </summary>
              <dl className="flex flex-col gap-3 border-t border-[#e2e7e5] px-4 py-4 text-sm">
                {FORGOT.map(([who, what]) => (
                  <div key={who}>
                    <dt className="font-semibold text-[#111a18]">{who}</dt>
                    <dd className="mt-0.5 leading-6 text-[#66736f]">{what}</dd>
                  </div>
                ))}
              </dl>
            </details>

            <div className="mt-8 flex items-center gap-4 text-sm">
              <span className="h-px flex-1 bg-[#e2e7e5]" />
              <span className="text-[#97a29e]">ან</span>
              <span className="h-px flex-1 bg-[#e2e7e5]" />
            </div>
            <p className="mt-6 text-center text-sm text-[#66736f]">
              შენი სკოლა ჯერ არ არის პორტალზე?{" "}
              <Link href="/request" className="font-semibold text-[#0f8a74] hover:underline">
                გაგზავნე განაცხადი
              </Link>
            </p>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e7e5] px-6 py-5 text-xs text-[#97a29e] sm:px-10">
          <span>მხოლოდ საგანმანათლებლო დაწესებულებებისთვის</span>
          <span>3D მოდელები: BodyParts3D · CC BY 4.0</span>
        </footer>
      </div>
    </div>
  );
}
