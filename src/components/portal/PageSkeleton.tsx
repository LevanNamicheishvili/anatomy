import { Logo } from "./ui";

const bar = "animate-pulse rounded-md bg-[#e6ebe9]";

/**
 * Shown at once while a signed-in page loads its data, so navigation never feels stuck.
 * `grid` mimics a hub (hero + card grid); the default is a stack of content cards.
 */
export function PageSkeleton({ cards = 2, grid = false }: { cards?: number; grid?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page" aria-busy="true" aria-live="polite" aria-label="იტვირთება">
      <header className="sticky top-0 z-20 border-b border-line bg-white [view-transition-name:site-header]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          <span className={`${bar} h-4 w-40`} />
          <span className={`${bar} ms-auto size-9 rounded-full`} />
        </div>
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <span className={`${bar} h-3 w-16`} />
          <span className={`${bar} h-3 w-24`} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {grid ? (
          <>
            <span className={`${bar} block h-4 w-40`} />
            <div className="mt-4 flex items-center gap-5 rounded-2xl border border-line bg-white p-6">
              <span className={`${bar} size-16 shrink-0 rounded-2xl`} />
              <div className="min-w-0 flex-1">
                <span className={`${bar} block h-8 w-56 max-w-full`} />
                <span className={`${bar} mt-3 block h-4 w-full max-w-md`} />
              </div>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: Math.max(cards, 3) }, (_, i) => (
                <div key={i} className="rounded-xl border border-line bg-white p-5">
                  <span className={`${bar} block size-11 rounded-xl`} />
                  <span className={`${bar} mt-4 block h-5 w-2/3`} />
                  <span className={`${bar} mt-3 block h-4 w-full`} />
                  <span className={`${bar} mt-2 block h-4 w-4/5`} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className={`${bar} block h-8 w-64 max-w-full`} />
            <span className={`${bar} mt-3 block h-4 w-96 max-w-full`} />
            <div className="mt-8 flex flex-col gap-6">
              {Array.from({ length: cards }, (_, i) => (
                <div key={i} className="rounded-xl border border-line bg-white p-5">
                  <span className={`${bar} block h-5 w-48`} />
                  <span className={`${bar} mt-4 block h-4 w-full`} />
                  <span className={`${bar} mt-2 block h-4 w-3/4`} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
