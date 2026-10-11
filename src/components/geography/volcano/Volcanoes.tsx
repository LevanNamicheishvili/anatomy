"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { LabeledSlider, PillButton } from "@/components/portal/controls";
import { cn } from "@/lib/utils";
import { VolcanoScene, type VolcanoAnchor, type VolcanoStep } from "./VolcanoScene";

/*
 * Topic 6 — volcanoes, earthquakes and tsunamis, step by step on one cross-section of a subduction zone.
 */

const STEPS: { id: VolcanoStep; name: string; how: string[] }[] = [
  {
    id: "plates",
    name: "1. ფილები",
    how: [
      "ლითოსფერო დაყოფილია ფილებად, რომლებიც მანტიის რბილ ფენაზე (ასთენოსფეროზე) წელიწადში რამდენიმე სანტიმეტრით მოძრაობენ — დაახლოებით ისე სწრაფად, როგორც ფრჩხილი იზრდება.",
      "აქ ორი ფილა ერთმანეთს ეჯახება. ოკეანური ფილა მძიმეა (ბაზალტი) და მსუბუქი კონტინენტური ფილის ქვეშ ეშვება — ამას სუბდუქცია ჰქვია. შეხების ადგილას ოკეანის ფსკერზე ღრმა ღარი ჩნდება.",
    ],
  },
  {
    id: "magma",
    name: "2. მაგმა",
    how: [
      "ჩაძირული ფილა ~100 კმ სიღრმეზე ცხელდება და მისგან წყალი გამოიდევნება. წყალი ზემოთ, მანტიაში ადის და ქანის დნობის ტემპერატურას ამცირებს — ისევე, როგორც მარილი ყინულს ადნობს. ქანი ნაწილობრივ დნება — ჩნდება მაგმა (700–1200°C).",
      "მაგმა გარშემო ქანებზე მსუბუქია, ამიტომ ნელა ადის ზემოთ და ქერქში, რამდენიმე კილომეტრის სიღრმეზე, მაგმის კერაში გროვდება. იქ აირები (წყლის ორთქლი, CO₂) იხსნება — როგორც გაზიან სასმელში.",
      "მაგმა სხვაგანაც წარმოიქმნება: სადაც ფილები ერთმანეთს შორდება (შუაოკეანური ქედები) — წნევის შემცირების გამო, და „ცხელ წერტილებზე“ (ჰავაის კუნძულები).",
    ],
  },
  {
    id: "eruption",
    name: "3. ამოფრქვევა",
    how: [
      "როცა კერაში წნევა ძალიან იმატებს, მაგმა ქანებს არღვევს და ვულკანის ყელით (არხით) ზემოთ მიიწევს. ზედაპირზე ამოსულ მაგმას ლავა ჰქვია.",
      "აირების სწრაფი გაფართოება მაგმას ნაწილაკებად ხლეჩს: ჰაერში ფრინდება ვულკანური ბომბები, ფერფლი კი კილომეტრების სიმაღლეზე ადის და ქარს შორს მიაქვს. ლავისა და ფერფლის ფენებით, ამოფრქვევიდან ამოფრქვევამდე, კონუსი იზრდება.",
    ],
  },
  {
    id: "quake",
    name: "4. მიწისძვრა",
    how: [
      "ფილები ერთმანეთს „ეჭიდება“ და ვერ სრიალებს. ქანებში დაძაბულობა წლობით გროვდება, ბოლოს კი ისინი უცებ წყდება და ინაცვლებს — ეს მიწისძვრაა.",
      "ადგილს სიღრმეში, სადაც ქანი გაწყდა, მიწისძვრის კერა (ჰიპოცენტრი) ჰქვია; მის ზემოთ, ზედაპირზე, არის ეპიცენტრი — იქ ყველაზე ძლიერად ზანზარებს. კერიდან ყველა მიმართულებით სეისმური ტალღები ვრცელდება (P-ტალღა ~6 კმ/წმ, S-ტალღა ~3,5 კმ/წმ). მიწისძვრის ძალას სეისმოგრაფი ზომავს, მაგნიტუდის სკალით.",
    ],
  },
  {
    id: "tsunami",
    name: "5. ცუნამი",
    how: [
      "თუ მიწისძვრა ზღვის ფსკერს უეცრად აწევს, ზემოთ მთელი წყლის სვეტი ამოიწევა და ტალღები ორივე მხარეს გაიქცევა — ეს ცუნამია.",
      "ღია ოკეანეში ცუნამი თითქმის შეუმჩნეველია (სიმაღლე ~1 მ-ზე ნაკლები), მაგრამ თვითმფრინავივით სწრაფად მოძრაობს. ნაპირთან, მეჩეჩზე, ნელდება, უკნიდან წამოსული წყალი კი მაღლა იწევს — 10–30 მეტრამდე. ნაპირიდან წყლის უეცარი უკან დახევა ცუნამის მოახლოების ნიშანია: მაშინვე მაღლობზე უნდა ახვიდე.",
    ],
  },
];

const LABELS: { at: VolcanoAnchor; text: string; steps: VolcanoStep[]; tone?: "hot" | "dark" | "red" | "blue" }[] = [
  { at: "ocean", text: "ოკეანური ფილა →", steps: ["plates", "quake", "tsunami"], tone: "dark" },
  { at: "continent", text: "← კონტინენტური ფილა", steps: ["plates", "quake", "tsunami"], tone: "dark" },
  { at: "trench", text: "ღრმა ღარი", steps: ["plates"] },
  { at: "mantle", text: "მანტია (ასთენოსფერო)", steps: ["plates", "magma"] },
  { at: "sea", text: "ოკეანე", steps: ["plates", "magma", "eruption"], tone: "blue" },
  { at: "melt", text: "მაგმა წარმოიქმნება (~100 კმ)", steps: ["magma"], tone: "hot" },
  { at: "chamber", text: "მაგმის კერა", steps: ["magma", "eruption"], tone: "hot" },
  { at: "crater", text: "კრატერი", steps: ["magma", "eruption"] },
  { at: "ash", text: "ფერფლი და აირები", steps: ["eruption"], tone: "dark" },
  { at: "lava", text: "ლავა", steps: ["eruption"], tone: "hot" },
  { at: "focus", text: "კერა (ჰიპოცენტრი)", steps: ["quake", "tsunami"], tone: "red" },
  { at: "epicentre", text: "ეპიცენტრი", steps: ["quake", "tsunami"], tone: "red" },
  { at: "tsunamiL", text: "← ცუნამი", steps: ["tsunami"], tone: "blue" },
  { at: "tsunamiR", text: "ცუნამი →", steps: ["tsunami"], tone: "blue" },
  { at: "coast", text: "სანაპირო", steps: ["tsunami"] },
];
const TONES = { hot: "bg-[#ff6a00] text-white", dark: "bg-[#111a18]/80 text-white", red: "bg-[#d61f1f] text-white", blue: "bg-[#1d5f99] text-white" };

const G = 9.81;
/** 12345 → "12 345" (Georgian style: a space between thousands). */
const nf = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export function Volcanoes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VolcanoScene | null>(null);
  const [step, setStep] = useState<VolcanoStep>("plates");
  const [depth, setDepth] = useState(4000);
  const [distance, setDistance] = useState(600);
  const info = STEPS.find((s) => s.id === step)!;
  const v = Math.sqrt(G * depth); // m/s
  const kmh = v * 3.6;
  const minutes = (distance * 1000) / v / 60;

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new VolcanoScene(canvas);
    sceneRef.current = scene;
    const els = [...layer.querySelectorAll<HTMLElement>("[data-at]")];
    scene.onFrame = (project, anchors, state) => {
      for (const el of els) {
        const at = el.dataset.at as VolcanoAnchor;
        const p = project(anchors[at]);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        let on = el.dataset.on === "1" && p.visible;
        if ((at === "tsunamiL" || at === "tsunamiR") && state.tsunami < 1) on = false;
        el.style.opacity = on ? "1" : "0";
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const choose = (s: VolcanoStep) => {
    setStep(s);
    sceneRef.current?.setStep(s);
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-white shadow-card">
      <div className="relative h-[56dvh] min-h-80 w-full sm:h-auto sm:aspect-[16/10] sm:max-h-[72dvh] bg-[#a9d4f0]">
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="ფილების საზღვრის ჭრილი: ვულკანი, მიწისძვრა, ცუნამი" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[12px] font-semibold whitespace-nowrap">
          {LABELS.map((l) => (
            <span key={l.at} data-at={l.at} data-on={l.steps.includes(step) ? "1" : "0"} className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 opacity-0 shadow-sm transition-opacity", l.tone ? TONES[l.tone] : "bg-white/90 text-[#111a18]")}>
              {l.text}
            </span>
          ))}
        </div>
        <div className="absolute top-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5">
          {STEPS.map((s) => (
            <PillButton key={s.id} onClick={() => choose(s.id)} pressed={step === s.id} color="#c2410c" className="shadow-sm">
              {s.name}
            </PillButton>
          ))}
        </div>
        {(step === "eruption" || step === "quake" || step === "tsunami") && (
          <PillButton onClick={() => sceneRef.current?.restart()} title="თავიდან" aria-label="თავიდან" icon={RotateCcw} className="absolute top-3 right-3 shadow-sm" />
        )}
      </div>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1fr_18rem]">
        <div>
          <h2 className="text-lg">{info.name.slice(3)}: რა ხდება</h2>
          {info.how.map((h) => (
            <p key={h.slice(0, 24)} className="mt-2 text-[15px] leading-7 text-[#33413e]">
              {h}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {step === "tsunami" || step === "quake" ? (
            <div className="rounded-lg border border-[#e2e7e5] p-3">
              <p className="text-sm font-semibold">ცუნამის სიჩქარე: v = √(g · h)</p>
              <LabeledSlider className="mt-2" label="ოკეანის სიღრმე" value={depth} display={`${nf(depth)} მ`} min={10} max={7000} step={10} onChange={setDepth} color="#1d5f99" />
              <LabeledSlider className="mt-1" label="მანძილი ნაპირამდე" value={distance} display={`${nf(distance)} კმ`} min={10} max={3000} step={10} onChange={setDistance} color="#1d5f99" />
              <p className="mt-2 text-[14px] leading-6 text-[#33413e] tabular-nums">
                v = √(9,8 × {nf(depth)}) ≈ <b>{nf(v)} მ/წმ</b> ≈ <b>{nf(kmh)} კმ/სთ</b>
                <br />
                ნაპირამდე მივა ~<b>{minutes < 90 ? `${nf(minutes)} წუთში` : `${(minutes / 60).toFixed(1).replace(".", ",")} საათში`}</b>
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#e2e7e5] p-3 text-[14px] leading-6 text-[#33413e]">
              <p className="text-sm font-semibold">ვულკანის ნაწილები</p>
              <p className="mt-1">მაგმის კერა → ყელი (არხი) → კრატერი → კონუსი. ამოფრქვევის პროდუქტები: ლავა, ფერფლი, ვულკანური ბომბები, აირები.</p>
            </div>
          )}
          <div className="rounded-lg bg-[#fdf3e8] p-3 text-[14px] leading-6 text-[#33413e]">
            <p className="text-sm font-semibold text-[#9a3412]">საქართველოში</p>
            <p className="mt-1">
              <b>ყაზბეგი</b> (5047 მ) — „მძინარე“ ვულკანი; ბოლოს დაახლოებით 3 ათასი წლის წინ ამოიფრქვა. <b>ჯავახეთის ზეგანი</b> ლავის ნაკადებითაა აგებული; <b>აბული</b> (3301 მ) და <b>სამსარი</b> ვულკანური მთებია. საქართველო სეისმურად აქტიურია: <b>რაჭის მიწისძვრა</b> (1991, მაგნიტუდა 7,0) ერთ-ერთი უძლიერესი იყო კავკასიაში.
            </p>
          </div>
        </div>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-[#97a29e]">ჭრილი სქემატურია: სიმაღლე გადიდებულია, ფენების სისქე — მიახლოებითი. ცუნამის სიჩქარის ფორმულა მართებულია, როცა ტალღის სიგრძე სიღრმეზე ბევრად დიდია.</p>
    </section>
  );
}
