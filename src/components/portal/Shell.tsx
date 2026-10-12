import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { ROLE_NAMES, type CurrentUser } from "@/lib/auth";
import { Logo, PORTAL_NAME } from "./ui";

function navFor(user: CurrentUser) {
  const items = [{ href: "/dashboard", label: "მთავარი" }];
  if (user.role === "super_admin") items.push({ href: "/admin", label: "სკოლები და განაცხადები" });
  if (user.role === "school_admin" || user.role === "teacher") items.push({ href: "/school", label: user.role === "school_admin" ? "სკოლის მართვა" : "ჩემი სკოლა" });
  items.push({ href: "/account/password", label: "პაროლის შეცვლა" });
  return items;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

/** Signed-in portal page frame: top bar with navigation, school and user menu. */
export function PortalShell({ user, active, children }: { user: CurrentUser; active?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page font-sans text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        გადასვლა შინაარსზე
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-white [view-transition-name:site-header]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-lg">
            <Logo />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-heading">{PORTAL_NAME}</span>
              <span className="block truncate text-xs text-mute">{user.school ? `${user.school.name} · ${user.school.city}` : "სისტემის მართვა"}</span>
            </span>
          </Link>

          <div className="ms-auto flex min-w-0 items-center gap-3">
            <div className="hidden max-w-56 min-w-0 text-end leading-tight sm:block">
              <span className="block truncate text-sm font-semibold">{user.fullName}</span>
              <span className="block truncate text-xs text-mute">
                {ROLE_NAMES[user.role]}
                {user.classLabel ? ` · ${user.classLabel}` : ""}
              </span>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong" aria-hidden>
              {initials(user.fullName)}
            </span>
            <form action={signOut}>
              <button type="submit" title="გასვლა" aria-label="გასვლა" className="flex size-10 items-center justify-center rounded-lg text-copy transition-colors hover:bg-chip">
                <LogOut className="size-[18px]" />
              </button>
            </form>
          </div>
        </div>
        {/* px-1 / px-3 plus each item's px-3 puts the first label on the page's content edge (px-4 / px-6). */}
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden" aria-label="ნავიგაცია">
          {navFor(user).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={`relative flex min-h-11 items-center px-3 text-sm whitespace-nowrap transition-colors ${
                active === item.href ? "font-semibold text-ink" : "text-mute hover:text-ink"
              }`}
            >
              {item.label}
              {active === item.href && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs leading-5 text-mute sm:px-6">
          მხოლოდ საგანმანათლებლო დაწესებულებებისთვის · 3D მოდელები: BodyParts3D, © The Database Center for Life Science, CC BY 4.0 · ფილტვები: Z-Anatomy, CC BY-SA 4.0
        </div>
      </footer>
    </div>
  );
}
