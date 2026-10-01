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
    <div className="flex min-h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <header className="sticky top-0 z-20 border-b border-[#e2e7e5] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-semibold">{PORTAL_NAME}</span>
              <span className="block truncate text-xs text-[#66736f]">{user.school ? `${user.school.name} · ${user.school.city}` : "სისტემის მართვა"}</span>
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-3">
            <div className="hidden text-end leading-tight sm:block">
              <span className="block text-sm font-semibold">{user.fullName}</span>
              <span className="block text-xs text-[#66736f]">
                {ROLE_NAMES[user.role]}
                {user.classLabel ? ` · ${user.classLabel}` : ""}
              </span>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-[#e6f3ef] text-sm font-semibold text-[#0c7563]" aria-hidden>
              {initials(user.fullName)}
            </span>
            <form action={signOut}>
              <button type="submit" title="გასვლა" aria-label="გასვლა" className="flex size-9 items-center justify-center rounded-md text-[#33413e] hover:bg-[#eef2f0]">
                <LogOut className="size-[18px]" />
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="ნავიგაცია">
          {navFor(user).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={`relative px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                active === item.href ? "font-semibold text-[#111a18]" : "text-[#66736f] hover:text-[#111a18]"
              }`}
            >
              {item.label}
              {active === item.href && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[#0f8a74]" />}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-[#e2e7e5]">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs leading-5 text-[#66736f] sm:px-6">
          მხოლოდ საგანმანათლებლო დაწესებულებებისთვის · 3D მოდელები: BodyParts3D, © The Database Center for Life Science, CC BY 4.0
        </div>
      </footer>
    </div>
  );
}
