"use client";

import { useEffect, useRef, useState } from "react";
import { ConeScene, type ConeId } from "./ConeScene";

/*
 * Topic 6 — close-up 3D model of a Georgian volcano (Kazbegi / Javakheti), shown in the Georgia box.
 */

export const CONE_NAMES: Record<ConeId, string> = { kazbegi: "ყაზბეგი", javakheti: "ჯავახეთი" };
const CAPTIONS: Record<ConeId, string> = {
  kazbegi: "ყაზბეგი (5047 მ) — „მძინარე“ სტრატოვულკანი; ბოლოს დაახლოებით 3 ათასი წლის წინ ამოიფრქვა.",
  javakheti: "ჯავახეთის ზეგანი ლავის ნაკადებითაა აგებული; აბული (3301 მ) და სამსარი ვულკანური მთებია.",
};

export function ConeView({ id }: { id: ConeId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState<{ id: ConeId; s: "loaded" | "failed" } | null>(null);
  const status = done?.id === id ? done.s : "loading";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new ConeScene(canvas, id);
    scene.onStatus = (s) => setDone({ id, s });
    return () => scene.dispose();
  }, [id]);

  return (
    <div className="mt-2">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-[#bcdcf0]">
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`ვულკანის 3D მოდელი: ${CONE_NAMES[id]}`} />
        <span className="pointer-events-none absolute top-2 left-2 rounded bg-card/90 px-1.5 py-0.5 text-[12px] font-semibold text-ink shadow-sm">{CONE_NAMES[id]}</span>
        {status === "loading" && <span className="pointer-events-none absolute right-2 bottom-2 text-[11px] text-faint">იტვირთება…</span>}
      </div>
      <p className="mt-2">{CAPTIONS[id]}</p>
      <p className="mt-1 text-[11px] leading-4 text-faint">{status === "loaded" ? "ინტერაქტიული 3D მოდელი" : "მოდელი სქემატურია: ფორმა მიახლოებით გადმოსცემს ადგილს, ზომები ზუსტი არ არის"}. შეგიძლია მოატრიალო და მიუახლოვდე.</p>
    </div>
  );
}
