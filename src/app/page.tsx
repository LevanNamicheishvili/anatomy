import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  Check,
  GraduationCap,
  Globe2,
  HeartPulse,
  Landmark,
  ListChecks,
  Lock,
  Presentation,
  QrCode,
  ShieldCheck,
  UserRound,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Laptop, Phone } from "@/components/portal/Devices";
import { Logo, PORTAL_NAME } from "@/components/portal/ui";
import { getCurrentUser } from "@/lib/auth";
import { SUBJECTS, type SubjectIcon } from "@/lib/subjects";

export const metadata: Metadata = {
  title: `${PORTAL_NAME} — ინტერაქტიული მასალა ქართული სკოლებისთვის`,
  description: "დახურული სასწავლო პლატფორმა საგანმანათლებლო დაწესებულებებისთვის: ინტერაქტიული საგნები, სმარტ დაფის რეჟიმი, ქვიზები და სკოლის ანგარიშები.",
};

const SUBJECT_ICONS: Record<SubjectIcon, LucideIcon> = { biology: HeartPulse, geography: Globe2, history: Landmark };

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Boxes, title: "ინტერაქტიული მასალა", body: "3D მოდელები, ანიმაციები და სქემები, რომლებსაც მოსწავლე თავად ატრიალებს და იკვლევს." },
  { icon: Presentation, title: "სმარტ დაფის რეჟიმი", body: "დიდი შრიფტი, ნაბიჯ-ნაბიჯ თემები და ეკრანზე ხატვა — გაკვეთილის ჩასატარებლად." },
  { icon: ListChecks, title: "ქვიზები და ბარათები", body: "ცოდნის შემოწმება და დამახსოვრება — სკოლის საფეხურის მიხედვით." },
  { icon: QrCode, title: "QR კოდები წიგნისთვის", body: "სახელმძღვანელოში დაბეჭდილი კოდი პირდაპირ შესაბამის თემას ხსნის." },
  { icon: WifiOff, title: "სუსტ ინტერნეტზეც", body: "ერთხელ ჩატვირთვის შემდეგ მასალა ინტერნეტის გარეშეც მუშაობს." },
  { icon: Lock, title: "დახურული სივრცე", body: "მხოლოდ დადასტურებული სკოლები და მათი მასწავლებლები და მოსწავლეები." },
];

const ROLES: { icon: LucideIcon; title: string; points: string[] }[] = [
  {
    icon: Building2,
    title: "სკოლის ადმინისტრაცია",
    points: ["ქმნის მასწავლებლებისა და მოსწავლეების ანგარიშებს", "მთელ კლასს ერთად, დასაბეჭდი ბარათებით", "აღადგენს დავიწყებულ პაროლებს"],
  },
  {
    icon: Presentation,
    title: "მასწავლებელი",
    points: ["ატარებს გაკვეთილს სმარტ დაფაზე", "ამატებს მოსწავლეებს თავის კლასში", "ბეჭდავს QR კოდებს სახელმძღვანელოსთვის"],
  },
  {
    icon: GraduationCap,
    title: "მოსწავლე",
    points: ["სწავლობს საკუთარ ტემპში — სკოლაში და სახლში", "ამოწმებს ცოდნას ქვიზებითა და ბარათებით", "შედის მომხმარებლის სახელით, ელ-ფოსტის გარეშე"],
  },
];

const STEPS = [
  ["განაცხადი", "სკოლა აგზავნის მოკლე ფორმას — სახელი, ქალაქი, საკონტაქტო პირი."],
  ["დადასტურება", "ვამოწმებთ, რომ განაცხადი საგანმანათლებლო დაწესებულებისგანაა."],
  ["ჩართვა", "სკოლის ადმინისტრატორი იღებს ანგარიშს და თავად ამატებს მასწავლებლებსა და მოსწავლეებს."],
];

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="reveal max-w-2xl">
      <p className="text-[13px] font-semibold text-[#0f8a74]">{eyebrow}</p>
      <h2 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight sm:text-[34px]">{title}</h2>
      {body && <p className="mt-3 text-base leading-7 text-[#33413e]">{body}</p>}
    </div>
  );
}

export default async function LandingPage() {
  const user = await getCurrentUser();
  const cta = user ? { href: "/dashboard", label: "პორტალზე გადასვლა" } : { href: "/login", label: "შესვლა" };

  return (
    <div className="min-h-dvh bg-white font-sans text-[#111a18]">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-30 border-b border-[#e2e7e5] bg-white/90 backdrop-blur [view-transition-name:site-header]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="truncate text-[15px] font-semibold">{PORTAL_NAME}</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-[#33413e] md:flex" aria-label="გვერდის ნაწილები">
            {[
              ["#features", "შესაძლებლობები"],
              ["#subjects", "საგნები"],
              ["#roles", "ვისთვის"],
              ["#join", "ჩართვა"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-3 py-1.5 transition-colors hover:bg-[#f5f7f6] hover:text-[#111a18]">
                {label}
              </a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {!user && (
              <Link href="/request" className="hidden h-9 items-center rounded-md px-3 text-sm font-semibold text-[#33413e] transition-colors hover:bg-[#f5f7f6] sm:inline-flex">
                სკოლის განაცხადი
              </Link>
            )}
            <Link href={cta.href} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#111a18] px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#2a3532]">
              {cta.label}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden border-b border-[#e2e7e5] bg-[#f4f6f5]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: "radial-gradient(#cfd8d4 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "linear-gradient(to bottom, black, transparent 85%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pt-20 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#cfe3dc] bg-white px-3 py-1 text-xs font-semibold text-[#0c7563]">
              <ShieldCheck className="size-3.5" />
              მხოლოდ საგანმანათლებლო დაწესებულებებისთვის
            </p>
            <h1 className="mt-6 text-[38px] leading-[1.12] font-semibold tracking-tight sm:text-[48px]">ინტერაქტიული მასალა ქართული სკოლებისთვის</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#33413e]">
              ერთი დახურული პლატფორმა სკოლისთვის: გაკვეთილი სმარტ დაფაზე, დამოუკიდებელი სწავლა კომპიუტერსა და ტელეფონზე — სკოლის მიერ შექმნილი ანგარიშებით.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/request"} className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#0f8a74] px-6 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#0c7563] active:scale-[0.98]">
                {user ? "პორტალზე გადასვლა" : "სკოლის ჩართვა"}
                <ArrowRight className="size-[18px]" />
              </Link>
              {!user && (
                <Link href="/login" className="inline-flex h-12 items-center rounded-lg border border-[#d5dcd9] bg-white px-6 text-[15px] font-semibold transition-colors hover:bg-[#f5f7f6]">
                  შესვლა
                </Link>
              )}
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-[#dbe3e0] pt-6">
              {[
                ["3", "საგანი"],
                ["3", "საფეხური"],
                ["3", "როლი"],
              ].map(([n, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-semibold">{n}</dt>
                  <dd className="text-sm text-[#66736f]">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-[640px] pb-6">
            <div className="pe-[12%]">
              <Laptop src="/images/portal/atlas-laptop.jpg" alt="პლატფორმა ლეპტოპზე — ბიოლოგიის 3D ატლასი" priority />
            </div>
            <div className="absolute right-0 -bottom-2 w-[24%] min-w-[110px]">
              <Phone src="/images/portal/atlas-phone.jpg" alt="პლატფორმა ტელეფონზე" />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section id="features" className="scroll-mt-20 border-b border-[#e2e7e5]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="შესაძლებლობები" title="ყველაფერი, რაც გაკვეთილს სჭირდება" body="საერთო ინსტრუმენტები ყველა საგნისთვის — ახალი საგანი იმავე სივრცეში ემატება." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#e2e7e5] bg-[#e2e7e5] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="reveal bg-white p-7 transition-colors duration-200 hover:bg-[#fafcfb]">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[#e6f3ef] text-[#0c7563]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-[#66736f]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Subjects ---- */}
      <section id="subjects" className="scroll-mt-20 border-b border-[#e2e7e5] bg-[#f4f6f5]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="საგნები" title="იწყება ბიოლოგიით — ემატება სხვა საგნები" />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {SUBJECTS.map((s) => {
              const Icon = SUBJECT_ICONS[s.icon];
              const ready = !!s.href;
              return (
                <article key={s.slug} className="reveal flex flex-col rounded-2xl border border-[#e2e7e5] bg-white p-7 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#cfd8d4] hover:shadow-[0_14px_32px_-18px_rgba(17,26,24,0.25)]">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: s.color }}>
                      <Icon className="size-6" />
                    </span>
                    {ready ? (
                      <span className="rounded-full bg-[#e6f3ef] px-2.5 py-0.5 text-xs font-semibold text-[#0c7563]">ხელმისაწვდომია</span>
                    ) : (
                      <span className="rounded-full bg-[#eef2f0] px-2.5 py-0.5 text-xs font-semibold text-[#66736f]">მალე</span>
                    )}
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{s.name}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-[#66736f]">{s.description}</p>
                  {s.facts && (
                    <ul className="mt-5 flex flex-col gap-2 border-t border-[#e2e7e5] pt-5">
                      {s.facts.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-[#33413e]">
                          <Check className="size-4 text-[#0f8a74]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- Roles ---- */}
      <section id="roles" className="scroll-mt-20 border-b border-[#e2e7e5]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="ვისთვის" title="თითოეულს — თავისი ადგილი" body="ანგარიშებს სკოლა მართავს: ვინ რას ხედავს და რას აკეთებს, როლი განსაზღვრავს." />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {ROLES.map(({ icon: Icon, title, points }) => (
              <article key={title} className="reveal rounded-2xl border border-[#e2e7e5] bg-white p-7 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#cfd8d4] hover:shadow-[0_14px_32px_-18px_rgba(17,26,24,0.25)]">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#111a18] text-white">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {points.map((p) => (
                    <li key={p} className="grid grid-cols-[18px_1fr] gap-2 text-[15px] leading-6 text-[#33413e]">
                      <Check className="mt-1 size-4 text-[#0f8a74]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Join ---- */}
      <section id="join" className="scroll-mt-20 bg-[#111a18] text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[13px] font-semibold text-[#7fd1bd]">ჩართვა</p>
            <h2 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight sm:text-[34px]">როგორ ჩაერთვება სკოლა</h2>
            <p className="mt-3 text-base leading-7 text-white/65">საჯარო რეგისტრაცია არ არსებობს — სკოლა ერთვება განაცხადით და დადასტურებით.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/request" className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-[15px] font-semibold text-[#111a18] transition-colors hover:bg-[#e6f3ef]">
                განაცხადის გაგზავნა
                <ArrowRight className="size-[18px]" />
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/20 px-6 text-[15px] font-semibold transition-colors hover:bg-white/10">
                <UserRound className="size-[18px]" />
                უკვე მაქვს ანგარიში
              </Link>
            </div>
          </div>
          <ol className="reveal flex flex-col">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[44px_1fr] gap-4 border-t border-white/10 py-6 first:border-t-0 first:pt-0">
                <span className="flex size-11 items-center justify-center rounded-full border border-white/20 text-sm font-semibold">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-[15px] leading-7 text-white/65">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-[#e2e7e5]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-[#66736f] sm:px-6">
          <div className="flex items-center gap-3">
            <Logo className="size-8" />
            <span className="font-semibold text-[#111a18]">{PORTAL_NAME}</span>
          </div>
          <p className="text-xs leading-5">მხოლოდ საგანმანათლებლო დაწესებულებებისთვის · 3D მოდელები: BodyParts3D, © DBCLS, CC BY 4.0</p>
        </div>
      </footer>
    </div>
  );
}
