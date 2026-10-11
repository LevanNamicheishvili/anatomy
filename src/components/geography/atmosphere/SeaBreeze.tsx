"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Pause, Play, Sun, Thermometer, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { breeze, LAPSE } from "./breeze-math";
import { CoastScene, type CoastAnchor } from "./CoastScene";

/*
 * Topic 8 — air temperature, pressure and wind, shown as the breeze on Georgia's Black Sea coast. Move the
 * clock: by day the land heats up faster than the sea, low pressure forms over the land and the sea breeze
 * blows ashore; at night it all turns round. On the mountain the air gets ~6 °C colder per kilometre.
 */

const PRESETS = [
  { name: "დილა", hour: 8 },
  { name: "შუადღე", hour: 14 },
  { name: "საღამო", hour: 20 },
  { name: "ღამე", hour: 3 },
];

const t1 = (v: number) => `${Math.round(v)}°C`;
const clock = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;

export function SeaBreeze() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CoastScene | null>(null);
  const [hour, setHour] = useState(14);
  const [playing, setPlaying] = useState(false);
  const [pressure, setPressure] = useState(true);
  const b = breeze(hour);
  const day = hour >= 6 && hour < 18;

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new CoastScene(canvas);
    sceneRef.current = scene;
    const els = [...layer.querySelectorAll<HTMLElement>("[data-at]")];
    scene.onFrame = (project, anchors) => {
      for (const el of els) {
        const p = project(anchors[el.dataset.at as CoastAnchor]);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = p.visible && el.dataset.hidden !== "1" ? "1" : "0";
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.set(hour, breeze(hour));
  }, [hour]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setHour((h) => (h + 0.05) % 24), 50);
    return () => window.clearInterval(id);
  }, [playing]);

  const landLow = b.diff > 0;
  const cell = (low: boolean) => (low ? "bg-[#d64545] text-white" : "bg-[#2f6fb0] text-white");
  const showP = pressure && b.kind !== "calm" ? "0" : "1";

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-white shadow-card">
      <div className="relative h-[56dvh] min-h-80 w-full sm:h-auto sm:aspect-[16/10] sm:max-h-[72dvh]">
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="ზღვის სანაპიროს ჭრილი: ბრიზი" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[12px] font-semibold whitespace-nowrap">
          <span data-at="sea" className="absolute top-0 left-0 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[#111a18] opacity-0 shadow-sm">
            <Thermometer className="size-3.5 text-[#2f6fb0]" />
            შავი ზღვა · {t1(b.sea)}
          </span>
          <span data-at="land" className="absolute top-0 left-0 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[#111a18] opacity-0 shadow-sm">
            <Thermometer className="size-3.5 text-[#d64545]" />
            ხმელეთი · {t1(b.land)}
          </span>
          <span data-at="mountain" className="absolute top-0 left-0 rounded bg-white/85 px-1.5 py-0.5 text-[#111a18] opacity-0">
            მთის წვერი ~4,5 კმ · {t1(b.land - LAPSE * 4.5)}
          </span>
          {([1, 2, 3] as const).map((km) => (
            <span key={km} data-at={`km${km}`} className="absolute top-0 left-0 translate-x-2 rounded bg-white/80 px-1 text-[11px] text-[#33413e] opacity-0">
              {km} კმ · {t1(b.land - LAPSE * km)}
            </span>
          ))}
          <span data-at="landLow" data-hidden={showP} className={cn("absolute top-0 left-0 rounded-full px-2 py-0.5 opacity-0 shadow", cell(landLow))}>
            {landLow ? "დ · დაბალი წნევა" : "მ · მაღალი წნევა"} · {Math.round(b.pLand)} ჰპა
          </span>
          <span data-at="seaLow" data-hidden={showP} className={cn("absolute top-0 left-0 rounded-full px-2 py-0.5 opacity-0 shadow", cell(!landLow))}>
            {landLow ? "მ · მაღალი წნევა" : "დ · დაბალი წნევა"} · {Math.round(b.pSea)} ჰპა
          </span>
          <span data-at="landHigh" data-hidden={showP} className={cn("absolute top-0 left-0 rounded-full px-2 py-0.5 text-[11px] opacity-0", cell(!landLow))}>
            ზემოთ: {landLow ? "მ" : "დ"}
          </span>
          <span data-at="seaHigh" data-hidden={showP} className={cn("absolute top-0 left-0 rounded-full px-2 py-0.5 text-[11px] opacity-0", cell(landLow))}>
            ზემოთ: {landLow ? "დ" : "მ"}
          </span>
          <span data-at="wind" data-hidden={b.kind === "calm" ? "1" : "0"} className="absolute top-0 left-0 flex items-center gap-1 rounded bg-[#111a18]/80 px-1.5 py-0.5 text-white opacity-0">
            <Wind className="size-3.5" />
            {b.kind === "sea" ? "ზღვის ბრიზი →" : "← ხმელეთის ბრიზი"} · {b.speed.toFixed(0)} მ/წმ
          </span>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-white/92 px-3 py-2 text-sm shadow-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            {day ? <Sun className="size-4 text-[#c08a00]" /> : <Moon className="size-4 text-[#5b6bb5]" />}
            {clock(hour)} · {b.kind === "sea" ? "დღის (ზღვის) ბრიზი" : b.kind === "land" ? "ღამის (ხმელეთის) ბრიზი" : "შტილი — ქარი ცვლის მიმართულებას"}
          </p>
          <p className="text-[13px] text-[#66736f]">
            ტემპერატურის სხვაობა ხმელეთსა და ზღვას შორის: <b className="text-[#111a18] tabular-nums">{b.diff > 0 ? "+" : ""}{b.diff.toFixed(1)}°C</b>
          </p>
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-pressed={playing} title={playing ? "გაჩერება" : "დღე-ღამის სვლა"} className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", playing ? "bg-[#2f6fb0] text-white" : "bg-white/90 text-[#111a18]")}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setHour(p.hour)}
                aria-pressed={Math.round(hour) === p.hour}
                className={cn("h-9 rounded-full px-3 text-sm", Math.round(hour) === p.hour ? "bg-[#2f6fb0] font-semibold text-white" : "bg-[#f1f4f3] text-[#33413e] hover:bg-[#e6ecea]")}
              >
                {p.name} · {clock(p.hour)}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="flex justify-between text-sm">
              <span className="font-semibold">დღე-ღამის დრო</span>
              <span className="tabular-nums text-[#33413e]">{clock(hour)}</span>
            </span>
            <input type="range" min={0} max={23.75} step={0.25} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="mt-1 w-full accent-[#2f6fb0]" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pressure} onChange={(e) => setPressure(e.target.checked)} className="size-4 accent-[#2f6fb0]" />
            წნევის არეები (მ — მაღალი, დ — დაბალი)
          </label>
          <p className="text-[15px] leading-7 text-[#33413e]">
            {b.kind === "sea"
              ? "ხმელეთი მზეზე უფრო სწრაფად თბება, ვიდრე ზღვა. თბილი ჰაერი ფართოვდება, მსუბუქდება და მაღლა ადის — ხმელეთზე წნევა ეცემა. ზღვიდან გრილი ჰაერი მიწის პირას ხმელეთისკენ მიედინება: ეს ზღვის ბრიზია."
              : b.kind === "land"
                ? "ღამით ხმელეთი სწრაფად ცივდება, ზღვა კი დღისით დაგროვილ სითბოს ინარჩუნებს. ახლა წნევა ხმელეთზეა მაღალი და ჰაერი ხმელეთიდან ზღვისკენ მიედინება: ეს ხმელეთის ბრიზია."
                : "დილით და საღამოს ხმელეთისა და ზღვის ტემპერატურა თითქმის ტოლდება — წნევის სხვაობა ქრება და ქარი წყნარდება, შემდეგ კი მიმართულებას იცვლის."}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 self-start">
          {[
            { k: "ჰაერი ხმელეთზე", v: t1(b.land) },
            { k: "ჰაერი ზღვაზე", v: t1(b.sea) },
            { k: "წნევა ხმელეთზე", v: `${Math.round(b.pLand)} ჰპა` },
            { k: "წნევა ზღვაზე", v: `${Math.round(b.pSea)} ჰპა` },
            { k: "ქარი უბერავს", v: b.kind === "sea" ? "ზღვიდან ხმელეთზე" : b.kind === "land" ? "ხმელეთიდან ზღვაზე" : "თითქმის შტილია" },
            { k: "ყოველ 1 კმ სიმაღლეზე", v: `−${LAPSE}°C` },
          ].map((x) => (
            <div key={x.k} className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
              <dt className="text-[11px] leading-4 text-[#66736f]">{x.k}</dt>
              <dd className="mt-1 text-base leading-5 font-semibold tabular-nums">{x.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-[#97a29e]">მოდელი გამარტივებულია: ზაფხულის მოწმენდილი დღე შავი ზღვის სანაპიროზე; რიცხვები სასწავლო მიახლოებაა. წნევა — ჰექტოპასკალებში (ჰპა); 1013 ჰპა ≈ 760 მმ ვერცხლისწყლის სვეტი.</p>
    </section>
  );
}
