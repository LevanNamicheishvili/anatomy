"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Pause, Play, Sun, Thermometer, Wind } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { breeze, LAPSE } from "./breeze-math";
import { CoastScene, type CoastAnchor } from "./CoastScene";

/*
 * Topic 8 — air temperature, pressure and wind, shown as the breeze on Georgia's Black Sea coast (Poti, the
 * Colchis lowland, the Caucasus). Move the clock: by day the land heats up faster than the sea, low pressure
 * forms over the land and the sea breeze blows ashore; at night it all turns round. On the mountain the air
 * gets ~6 °C colder per kilometre. Under the scene: how it happens step by step, and why land and sea differ.
 */

/** How the breeze comes about, step by step: by day, at night, and in the calm between. */
const STEPS = {
  sea: [
    ["მზე ათბობს", "მზე ერთნაირად ანათებს ხმელეთსაც და ზღვასაც, მაგრამ ხმელეთი ბევრად სწრაფად თბება: შუადღისთვის ის ზღვაზე 6–8 °C-ით თბილია."],
    ["თბილი ჰაერი ადის", "ხმელეთის თავზე ჰაერი თბება, ფართოვდება, მსუბუქდება და მაღლა ადის (ნარინჯისფერი ისარი). მიწასთან ჰაერი თხელდება — იქმნება დაბალი წნევის არე (დ)."],
    ["ზღვიდან გრილი ჰაერი მოდის", "ზღვის თავზე ჰაერი გრილი და მძიმეა — წნევა მაღალია (მ). ჰაერი ყოველთვის მაღალი წნევიდან დაბალი წნევისკენ მოძრაობს: მიწის პირას ზღვიდან ხმელეთისკენ უბერავს ზღვის ბრიზი."],
    ["წრე იკვრება", "მაღლა, დაახლოებით 1 კმ-ზე, ჰაერი უკან, ზღვისკენ მიედინება და ზღვის თავზე ეშვება (ცისფერი ისარი). ხმელეთის თავზე ამოსულ ჰაერში ორთქლი ცივდება — ჩნდება გროვა ღრუბლები."],
  ],
  land: [
    ["მზე ჩავიდა", "ღამით ხმელეთი სითბოს სწრაფად გამოასხივებს და ცივდება, ზღვა კი დღისით დაგროვილ სითბოს დიდხანს ინარჩუნებს."],
    ["ხმელეთზე ჰაერი მძიმდება", "გაცივებული ჰაერი იკუმშება და მძიმდება — ხმელეთზე წნევა იზრდება (მ)."],
    ["ზღვის თავზე ჰაერი ადის", "ზღვის თავზე ჰაერი ახლა შედარებით თბილია: ის მაღლა ადის და წნევა ეცემა (დ)."],
    ["ხმელეთის ბრიზი", "მიწის პირას ჰაერი ხმელეთიდან ზღვისკენ მიედინება. ღამის ბრიზი დღისაზე სუსტია — 1–3 მ/წმ, რადგან ტემპერატურების სხვაობაც ნაკლებია."],
  ],
  calm: [
    ["ტემპერატურები თანაბრდება", "დილით და საღამოს ხმელეთი და ზღვა თითქმის ერთნაირად თბილია."],
    ["წნევის სხვაობა ქრება", "როცა ტემპერატურა ერთნაირია, წნევაც თანაბრდება და ჰაერს მოძრაობის მიზეზი აღარ აქვს."],
    ["შტილი", "ქარი წყნარდება — ნავის აფრა და დროშა ჩამოშვებულია, კვამლი პირდაპირ მაღლა ადის."],
    ["ბრიზი მობრუნდება", "მალე ერთ-ერთი მხარე უფრო თბილი გახდება და ბრიზი საწინააღმდეგო მიმართულებით დაუბერავს."],
  ],
} as const;

const WHY = [
  "წყლის გასათბობად ბევრად მეტი სითბოა საჭირო: ერთნაირი მასის წყალს ნიადაგზე დაახლოებით 4-ჯერ მეტი სითბო სჭირდება, რომ 1 °C-ით გათბეს.",
  "მზის სხივი წყალში რამდენიმე მეტრზე აღწევს და სითბო დიდ მოცულობაზე ნაწილდება; ნიადაგში მხოლოდ ზედა რამდენიმე სანტიმეტრი თბება.",
  "ზღვა ირევა — ტალღები და დინებები თბილ ზედა ფენას ქვემოთ, ცივ წყალს ერევა.",
  "ზღვის ზედაპირიდან წყალი ორთქლდება, აორთქლება კი სითბოს ართმევს.",
];

const FACTS = [
  "ბათუმში, ფოთსა და სოხუმში ზაფხულის მოწმენდილ დღეებში ზღვის ბრიზი ჩვეულებრივ დილის 9–10 საათიდან იწყება და საღამომდე უბერავს — ის სიცხეს ამსუბუქებს.",
  "ზღვის ბრიზი ხმელეთზე ათეულ კილომეტრზე შედის, მისი ფენის სისქე კი რამდენიმე ასეული მეტრიდან 1 კმ-მდეა.",
  "იგივე მიზეზით უბერავს მთა-ხეობის ქარი: დღისით გამთბარი ფერდობებიდან ჰაერი მთისკენ ადის, ღამით გაცივებული — ხეობაში ეშვება.",
];

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
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
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
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="ზღვის სანაპიროს ჭრილი: ბრიზი" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[12px] font-semibold whitespace-nowrap">
          <span data-at="sea" className="absolute top-0 left-0 flex items-center gap-1 rounded bg-card/90 px-1.5 py-0.5 text-ink opacity-0 shadow-sm">
            <Thermometer className="size-3.5 text-[#2f6fb0]" />
            შავი ზღვა · {t1(b.sea)}
          </span>
          <span data-at="land" className="absolute top-0 left-0 flex items-center gap-1 rounded bg-card/90 px-1.5 py-0.5 text-ink opacity-0 shadow-sm">
            <Thermometer className="size-3.5 text-[#d64545]" />
            ხმელეთი · {t1(b.land)}
          </span>
          <span data-at="mountain" className="absolute top-0 left-0 rounded bg-card/85 px-1.5 py-0.5 text-ink opacity-0">
            კავკასიონი · ~4,5 კმ · {t1(b.land - LAPSE * 4.5)}
          </span>
          <span data-at="town" className="absolute top-0 left-0 rounded bg-black/45 px-1.5 py-0.5 text-[11px] text-white opacity-0">
            ფოთი
          </span>
          <span data-at="river" className="absolute top-0 left-0 rounded bg-black/45 px-1.5 py-0.5 text-[11px] text-white opacity-0">
            მდ. რიონი
          </span>
          <span data-at="lowland" className="absolute top-0 left-0 rounded bg-black/45 px-1.5 py-0.5 text-[11px] text-white opacity-0">
            კოლხეთის დაბლობი
          </span>
          {([1, 2, 3] as const).map((km) => (
            <span key={km} data-at={`km${km}`} className="absolute top-0 left-0 translate-x-2 rounded bg-card/80 px-1 text-[11px] text-copy opacity-0">
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
          <span data-at="wind" data-hidden={b.kind === "calm" ? "1" : "0"} className="absolute top-0 left-0 flex items-center gap-1 rounded bg-deep/80 px-1.5 py-0.5 text-white opacity-0">
            <Wind className="size-3.5" />
            {b.kind === "sea" ? "ზღვის ბრიზი →" : "← ხმელეთის ბრიზი"} · {b.speed.toFixed(0)} მ/წმ
          </span>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-lg bg-card/92 px-3 py-2 text-sm shadow-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            {day ? <Sun className="size-4 text-[#c08a00]" /> : <Moon className="size-4 text-[#5b6bb5]" />}
            {clock(hour)} · {b.kind === "sea" ? "დღის (ზღვის) ბრიზი" : b.kind === "land" ? "ღამის (ხმელეთის) ბრიზი" : "შტილი — ქარი ცვლის მიმართულებას"}
          </p>
          <p className="text-[13px] text-mute">
            ტემპერატურის სხვაობა ხმელეთსა და ზღვას შორის: <b className="text-ink tabular-nums">{b.diff > 0 ? "+" : ""}{b.diff.toFixed(1)}°C</b>
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-card/90 px-2.5 py-1.5 text-[12px] text-copy shadow-sm">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff7a2e]" />
            თბილი ჰაერი ადის
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#4fa8ff]" />
            გრილი ჰაერი ეშვება
          </span>
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-pressed={playing} title={playing ? "გაჩერება" : "დღე-ღამის სვლა"} className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", playing ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <FullscreenButton full={fsOn} onClick={fsToggle} />
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
                className={cn("h-9 rounded-full px-3 text-sm", Math.round(hour) === p.hour ? "bg-[#2f6fb0] font-semibold text-white" : "bg-[#f1f4f3] text-copy hover:bg-[#e6ecea]")}
              >
                {p.name} · {clock(p.hour)}
              </button>
            ))}
          </div>
          <LabeledSlider label="დღე-ღამის დრო" value={hour} display={clock(hour)} min={0} max={23.75} step={0.25} onChange={setHour} color="#2f6fb0" />
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={pressure} onChange={(e) => setPressure(e.target.checked)} className="size-4 shrink-0 accent-[#2f6fb0]" />
            წნევის არეები (მ — მაღალი, დ — დაბალი)
          </label>
          <p className="text-[15px] leading-7 text-copy">
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
            <div key={x.k} className="rounded-lg bg-subtle px-3 py-2.5">
              <dt className="text-[11px] leading-4 text-mute">{x.k}</dt>
              <dd className="mt-1 text-base leading-5 font-semibold tabular-nums [overflow-wrap:anywhere]">{x.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="grid gap-4 border-t border-line px-5 py-4 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h3 className="text-base font-semibold">{b.kind === "sea" ? "როგორ იბადება დღის ბრიზი" : b.kind === "land" ? "როგორ იბადება ღამის ბრიზი" : "რა ხდება შტილის დროს"}</h3>
          <ol className="mt-2 flex flex-col gap-2">
            {STEPS[b.kind].map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2f6fb0] text-[13px] font-semibold text-white">{i + 1}</span>
                <p className="text-[15px] leading-6 text-copy">
                  <b className="text-ink">{title}.</b> {text}
                </p>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-subtle p-3">
            <h3 className="text-sm font-semibold">რატომ თბება ხმელეთი ზღვაზე სწრაფად?</h3>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-[14px] leading-6 text-copy">
              {WHY.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-line p-3">
            <h3 className="text-sm font-semibold">საინტერესოა</h3>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-[14px] leading-6 text-copy">
              {FACTS.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">მოდელი გამარტივებულია: ზაფხულის მოწმენდილი დღე შავი ზღვის სანაპიროზე; რიცხვები სასწავლო მიახლოებაა. წნევა — ჰექტოპასკალებში (ჰპა); 1013 ჰპა ≈ 760 მმ ვერცხლისწყლის სვეტი.</p>
    </section>
  );
}
