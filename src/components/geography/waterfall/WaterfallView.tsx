"use client";

import { useEffect, useRef } from "react";
import { PillButton } from "@/components/portal/controls";
import { cn } from "@/lib/utils";
import { WaterfallScene, type WaterfallAnchor } from "./WaterfallScene";
import { WATERFALLS, WATERFALL_IDS, type WaterfallId } from "./waterfall-data";

/*
 * Topic 11 — close-up 3D model of a waterfall, shown under the Georgia map in the landforms lesson.
 */

const NAMES: Record<WaterfallId, string> = { gveleti: "გველეთი", kinchkha: "კინჩხა", makhuntseti: "მახუნცეთი" };

const LABELS: { at: WaterfallAnchor; text: string; tone?: "rock" | "water" }[] = [
  { at: "upstream", text: "მდინარე ↓", tone: "water" },
  { at: "cap", text: "მაგარი ქანი — კარნიზი", tone: "rock" },
  { at: "soft", text: "რბილი ქანი — წყალი გამორეცხავს", tone: "rock" },
  { at: "pool", text: "ამოთხრილი ქვაბული", tone: "water" },
  { at: "mist", text: "შხეფები და წყლის მტვერი" },
  { at: "river", text: "დინება →", tone: "water" },
];
const TONES = { rock: "bg-[#3b3530]/85 text-white", water: "bg-[#0369a1] text-white" };

export function WaterfallView({ id, onPick }: { id: WaterfallId; onPick: (id: WaterfallId) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const preset = WATERFALLS[id];

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new WaterfallScene(canvas, WATERFALLS[id]);
    const els = [...layer.querySelectorAll<HTMLElement>("[data-at]")];
    scene.onFrame = (project, anchors) => {
      for (const el of els) {
        const p = project(anchors[el.dataset.at as WaterfallAnchor]);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = p.visible ? "1" : "0";
      }
    };
    return () => scene.dispose();
  }, [id]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="relative h-[50svh] min-h-72 w-full overflow-hidden rounded-lg bg-[#c4dcea] sm:h-auto sm:min-h-0 sm:aspect-[16/10] sm:max-h-[60svh]">
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`ჩანჩქერის 3D მოდელი: ${NAMES[id]}`} />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[12px] font-semibold whitespace-nowrap">
          {LABELS.map((l) => (
            <span key={l.at} data-at={l.at} className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 opacity-0 shadow-sm transition-opacity", l.tone ? TONES[l.tone] : "bg-white/90 text-[#111a18]")}>
              {l.text}
            </span>
          ))}
        </div>
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {WATERFALL_IDS.map((w) => (
            <PillButton key={w} onClick={() => onPick(w)} pressed={id === w} color="#0284c7" className="shadow-sm">
              {NAMES[w]}
            </PillButton>
          ))}
        </div>
      </div>
      <div className="text-[14px] leading-6 text-[#33413e]">
        <p className="text-sm font-semibold">
          {NAMES[id]} · {preset.rockName}
          {preset.tiers.length > 1 ? ` · ${preset.tiers.length} საფეხური` : ""}
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 ps-5">
          {preset.facts.map((f) => (
            <li key={f.slice(0, 24)}>{f}</li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-[#eef6fb] p-2.5 text-[13px] leading-5">
          წყალი კიდიდან ისე ვარდება, როგორც ნასროლი ქვა: წინ მიდის და თან სულ უფრო სწრაფად ეშვება — ამიტომ ნაკადი მრუდია. ძირში დარტყმისას წყალი ქვაბულს ამოთხრის, შხეფები კი ჰაერში წყლის მტვრად იფანტება.
        </p>
        <p className="mt-2 text-[11px] leading-4 text-[#97a29e]">მოდელი სქემატურია: ფორმა და ქანი მიახლოებით გადმოსცემს ადგილს, ზომები ზუსტი არ არის. შეგიძლია მოატრიალო და მიუახლოვდე.</p>
      </div>
    </div>
  );
}
