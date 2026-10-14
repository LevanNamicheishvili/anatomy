"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";
import { HeroScene } from "./HeroScene";
import { HEROES, type HeroId } from "./heroes";

/*
 * A geography 3D model with its caption and credits. When the model cannot be shown (no WebGL, the file did
 * not load) the text describes the place instead.
 */

export function HeroView({ id }: { id: HeroId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState<{ id: HeroId; s: "loaded" | "failed" } | null>(null);
  const status = done?.id === id ? done.s : "loading";
  const hero = HEROES[id];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: HeroScene | null = null;
    try {
      scene = new HeroScene(canvas, hero);
      scene.onStatus = (s) => setDone({ id, s });
    } catch {
      // No WebGL on this computer.
      queueMicrotask(() => setDone({ id, s: "failed" }));
    }
    return () => scene?.dispose();
  }, [id, hero]);

  return (
    <div className="mt-2">
      <div className={status === "failed" ? "hidden" : "relative aspect-[16/10] w-full overflow-hidden rounded-lg"} style={{ backgroundColor: hero.sky }}>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D მოდელი: ${hero.name}`} />
        <span className="pointer-events-none absolute top-2 left-2 rounded bg-card/90 px-1.5 py-0.5 text-[12px] font-semibold text-ink shadow-sm">{hero.name}</span>
        {status === "loading" && <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-card/80 px-1.5 py-0.5 text-[11px] text-mute">მოდელი იტვირთება…</span>}
      </div>
      {status === "failed" && (
        <div className="rounded-lg border border-line bg-subtle p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-mute">
            <Box className="size-3.5" />
            {hero.name}: 3D მოდელი ამ კომპიუტერზე ვერ ჩაიტვირთა
          </p>
          <p className="mt-1.5 text-[14px] leading-6 text-copy">{hero.fallback}</p>
        </div>
      )}
      <p className="mt-2 text-[14px] leading-6 text-copy">{hero.caption}</p>
      <p className="mt-1 text-[11px] leading-4 text-faint">
        {status === "loaded" && "მოატრიალე და მიუახლოვდი. "}
        {hero.note}
      </p>
    </div>
  );
}
