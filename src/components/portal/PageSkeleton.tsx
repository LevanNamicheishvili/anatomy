import { Logo } from "./ui";

const bar = "animate-pulse rounded-md bg-[#e6ebe9]";

/** Shown at once while a signed-in page loads its data, so navigation never feels stuck. */
export function PageSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f5]" aria-busy="true" aria-label="იტვირთება">
      <header className="sticky top-0 z-20 border-b border-[#e2e7e5] bg-white [view-transition-name:site-header]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          <span className={`${bar} h-4 w-40`} />
          <span className={`${bar} ms-auto size-9 rounded-full`} />
        </div>
        <div className="mx-auto flex h-[41px] max-w-6xl items-center gap-6 px-5 sm:px-7">
          <span className={`${bar} h-3 w-16`} />
          <span className={`${bar} h-3 w-24`} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <span className={`${bar} block h-8 w-64`} />
        <span className={`${bar} mt-3 block h-4 w-96 max-w-full`} />
        <div className="mt-8 flex flex-col gap-6">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="rounded-xl border border-[#e2e7e5] bg-white p-5">
              <span className={`${bar} block h-5 w-48`} />
              <span className={`${bar} mt-4 block h-4 w-full`} />
              <span className={`${bar} mt-2 block h-4 w-3/4`} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
