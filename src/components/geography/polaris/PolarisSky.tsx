"use client";

import { useEffect, useRef, useState } from "react";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { Compass, MapPin, Pause, Play, Ruler, Star } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { bearing, compassName, horizonDir, LATITUDES, POLARIS, TARGETS, TBILISI } from "./sky-data";
import { POLARIS_CUES, type PolarisShot } from "./polaris-cues";
import { SkyScene, type SkyAnchor, type SkyLit } from "./SkyScene";
import { GamaAzimuthCard, GeorgiaAzimuthCard } from "./AzimuthMaps";
import { InstrumentsCard } from "../lesson/Instruments";

/*
 * Topic 5 — finding north by Polaris, and the azimuth. The sky turns round Polaris; its height above the
 * horizon equals the observer's latitude (Tbilisi ≈ 41,7°). Steps walk through Big Dipper → pointer stars →
 * Polaris → north; on the ground an azimuth arrow points from north, clockwise.
 */

const STEPS = [
  { title: "იპოვე დიდი დათვი", text: "ჩრდილოეთის ცაზე იპოვე 7 კაშკაშა ვარსკვლავი, რომლებიც ციცხვს ჰგავს — ეს დიდი დათვია (დიდი ციცხვი). ის წლის ნებისმიერ ღამეს ჩანს საქართველოდან." },
  { title: "მაჩვენებელი ვარსკვლავები", text: "ციცხვის კიდის ორ ვარსკვლავს — მერაკსა და დუბჰეს — გაავლე წარმოსახვითი ხაზი და გააგრძელე მათ შორის მანძილის დაახლოებით 5-ჯერ." },
  { title: "პოლარული ვარსკვლავი", text: "ხაზი მიგიყვანს არცთუ ძალიან კაშკაშა, მაგრამ მარტოსულ ვარსკვლავამდე — ეს პოლარულია, პატარა დათვის კუდის ბოლო. მთელი ცა მის გარშემო ბრუნავს, ის კი ადგილზე დგას." },
  { title: "ჩრდილოეთი ნაპოვნია", text: "დადექი პოლარული ვარსკვლავისკენ სახით: წინ ჩრდილოეთია (აზიმუტი 0°), ზურგს უკან — სამხრეთი (180°), მარჯვნივ — აღმოსავლეთი (90°), მარცხნივ — დასავლეთი (270°)." },
];

const LABELS: { at: SkyAnchor; text: string; cls: string }[] = [
  { at: "polaris", text: "პოლარული ვარსკვლავი", cls: "bg-[#ffd166] text-ink" },
  { at: "dubhe", text: "დუბჰე", cls: "text-[#bfe3ff]" },
  { at: "merak", text: "მერაკი", cls: "text-[#bfe3ff]" },
  { at: "uma", text: "დიდი დათვი", cls: "text-[#7cc4ff]" },
  { at: "umi", text: "პატარა დათვი", cls: "text-[#ffd166]" },
  { at: "cas", text: "კასიოპეა", cls: "text-[#c4b5fd]" },
  { at: "crux", text: "სამხრეთის ჯვარი", cls: "text-[#9ae6b4]" },
  { at: "pole", text: "ჩრდილოეთის ციური პოლუსი", cls: "text-[#ff8fa3]" },
  { at: "n", text: "ჩ · 0°", cls: "bg-[#ff5a4f] text-white" },
  { at: "e", text: "აღმ · 90°", cls: "bg-card/85 text-ink" },
  { at: "s", text: "ს · 180°", cls: "bg-card/85 text-ink" },
  { at: "w", text: "დას · 270°", cls: "bg-card/85 text-ink" },
];

const fmtDeg = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("ka-GE")}°`;
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
/** Labels the narration lights up for each thing it names. */
const LIT_LABELS: Record<SkyLit, SkyAnchor[]> = { uma: ["uma"], umi: ["umi"], cas: ["cas"], crux: ["crux"], pointers: ["dubhe", "merak"], polaris: ["polaris"], n: ["n"], e: ["e"], s: ["s"], w: ["w"] };

export function PolarisSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SkyScene | null>(null);
  const [lat, setLat] = useState(41.7);
  const [time, setTime] = useState(18);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [az, setAz] = useState(0);
  /** The pupil's own pictures: Georgia's map with the azimuth to a town, the astrolabe and the sextant. */
  const [mapPlace, setMapPlace] = useState<string | null>(null);
  const [tools, setTools] = useState(false);
  const turnTo = (a: number) => {
    setAz(a);
    setMapPlace(null);
  };
  /** Set by the narration. */
  const [shot, setShot] = useState<Partial<PolarisShot> | null>(null);
  const glides = useRef({ lat: 0, time: 0, az: 0 });
  const now = useRef({ lat, time, az });
  useEffect(() => {
    now.current = { lat, time, az };
  }, [lat, time, az]);
  const polAlt = (() => {
    const d = horizonDir(POLARIS.ra, POLARIS.dec, lat, time * 15, { x: 0, y: 0, z: 0 });
    return (Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI;
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new SkyScene(canvas);
    sceneRef.current = scene;
    const els = [...layer.querySelectorAll<HTMLElement>("[data-at]")];
    scene.onFrame = (project, anchors) => {
      for (const el of els) {
        const p = project(anchors[el.dataset.at as SkyAnchor]);
        const hidden = el.dataset.hidden === "1";
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, ${el.dataset.at === "polaris" ? "-160%" : el.dataset.at === "pole" ? "90%" : el.dataset.at === "crux" ? "160%" : "-50%"})`;
        el.style.opacity = p.visible && !hidden ? "1" : "0";
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => sceneRef.current?.setLatitude(lat), [lat]);
  useEffect(() => sceneRef.current?.setTime(time), [time]);
  useEffect(() => sceneRef.current?.setAzimuth(az), [az]);

  /** Glide a value to a target in step with the voice (`wrap`: an angle, the shorter way round). */
  const glide = (key: "lat" | "time" | "az", from: number, to: number, set: (v: number) => void, wrap = 0, perUnit = 25) => {
    cancelAnimationFrame(glides.current[key]);
    let delta = to - from;
    if (wrap) {
      delta = (((delta % wrap) + wrap) % wrap) as number;
      if (delta > wrap / 2) delta -= wrap;
    }
    const start = performance.now();
    const dur = Math.min(2600, 300 + Math.abs(delta) * perUnit);
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / dur);
      const v = from + delta * ease(k);
      set(wrap ? (((v % wrap) + wrap) % wrap) : v);
      if (k < 1) glides.current[key] = requestAnimationFrame(step);
    };
    step();
  };
  useEffect(() => {
    const g = glides.current;
    return () => {
      cancelAnimationFrame(g.lat);
      cancelAnimationFrame(g.time);
      cancelAnimationFrame(g.az);
    };
  }, []);
  const last = useRef<Partial<PolarisShot>>({});
  const direct = (s: Partial<PolarisShot>, jump: boolean) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const before = last.current;
    last.current = s;
    const cur = now.current;
    const lat = s.lat ?? cur.lat;
    const time = s.time ?? cur.time;
    const changed = <K extends keyof PolarisShot>(k: K) => s[k] !== undefined && (jump || JSON.stringify(s[k]) !== JSON.stringify(before[k]));
    if (changed("lat")) {
      if (jump) setLat(lat);
      else glide("lat", cur.lat, lat, (v) => setLat(Math.round(v * 10) / 10), 0, 22);
    }
    // The sky turned by itself since the last cue: its time is no longer the cue's.
    if ((changed("time") || (before.turning && !jump)) && !s.turning) {
      if (jump) setTime(time);
      else glide("time", cur.time, time, setTime, 24, 110);
    }
    if (changed("az") && s.az !== null && s.az !== undefined) {
      const [from, to] = typeof s.az === "number" ? [cur.az, s.az] : s.az;
      if (jump) setAz(to);
      else glide("az", from, to, setAz, typeof s.az === "number" ? 360 : 0, typeof s.az === "number" ? 7 : 7.5);
    }
    if (s.view && (jump || changed("view") || changed("lat") || changed("time") || before.turning)) scene.view(s.view, lat, time, jump);
    scene.narrate({ lit: s.lit ?? [], pointer: s.pointer ?? "off", arc: !!s.arc, azimuth: s.az !== null && s.az !== undefined, azArc: !!s.azArc, trails: !!s.trails, axis: !!s.axis });
    setShot(s);
  };
  const driving = useNarrationDirector(POLARIS_CUES, direct);
  const narr = driving ? shot : null;
  // When the voice stops, the how-to steps are the pupil's again.
  useEffect(() => {
    if (!driving) sceneRef.current?.setStep(step);
  }, [step, driving]);
  const turning = narr ? !!narr.turning : playing;
  useEffect(() => {
    if (!turning) return;
    const id = window.setInterval(() => setTime((t) => (t + 0.05) % 24), 50);
    return () => window.clearInterval(id);
  }, [turning]);

  const hideArc = (narr ? !narr.arc : !(step === 0 || step === 3)) || polAlt <= 0;
  const hideAz = narr ? narr.az === null || narr.az === undefined : !(step === 0 || step === 4);
  const lit = new Set((narr?.lit ?? []).flatMap((k) => LIT_LABELS[k]));
  const inset = narr ? (narr.inset ?? null) : mapPlace ? "georgia" : tools ? "instruments" : null;

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[#070d1f]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full cursor-grab touch-none active:cursor-grabbing" aria-label="ღამის ცა და პოლარული ვარსკვლავი" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[11px] font-semibold whitespace-nowrap">
          {LABELS.map((l) => (
            <span key={l.at} data-at={l.at} data-hidden={(l.at === "crux" && lat > 0) || (l.at === "pole" && !narr?.axis) ? "1" : "0"} className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 opacity-0 transition-[box-shadow,font-size] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]", l.cls, lit.has(l.at) && "text-[13px] ring-2 ring-[#ffd76a]")}>
              {l.text}
            </span>
          ))}
          <span data-at="arc" data-hidden={hideArc ? "1" : "0"} className="absolute top-0 left-0 rounded bg-[#ffd166] px-1.5 py-0.5 text-ink opacity-0">
            სიმაღლე {fmtDeg(polAlt)} ≈ განედი
          </span>
          <span data-at="azimuth" data-hidden={hideAz ? "1" : "0"} className="absolute top-0 left-0 rounded bg-deep/85 px-1.5 py-0.5 text-[#ffd166] opacity-0">
            აზიმუტი {Math.round(az)}°{narr?.place ? ` · ${narr.place}` : ""}
          </span>
        </div>

        {inset === "instruments" && <InstrumentsCard kind="star-height" />}
        {inset === "compass" && <InstrumentsCard kind="azimuth" />}
        {inset === "georgia" && <GeorgiaAzimuthCard place={narr ? (narr.place ?? null) : mapPlace} />}
        {inset === "gama" && <GamaAzimuthCard />}

        <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-lg bg-card/92 px-3 py-2 text-sm shadow-sm">
          <p className="font-semibold">განედი: {lat === 0 ? "0° (ეკვატორი)" : `${fmtDeg(Math.abs(lat))} ${lat > 0 ? "ჩ. გ." : "ს. გ."}`}</p>
          <p className="text-[13px] text-mute">
            პოლარულის სიმაღლე: <b className="text-ink tabular-nums">{polAlt > 0 ? fmtDeg(polAlt) : "ჰორიზონტს ქვემოთ"}</b>
          </p>
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-pressed={turning} title={playing ? "გაჩერება" : "ცის ბრუნვა"} className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", turning ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            {turning ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <FullscreenButton full={fsOn} onClick={fsToggle} />
        </div>

        <div className="absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-1.5 px-3">
          {LATITUDES.map((l) => (
            <button
              key={l.name}
              type="button"
              onClick={() => setLat(l.lat)}
              aria-pressed={lat === l.lat}
              className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm", lat === l.lat ? "bg-[#2f6fb0] text-white" : "bg-card/92 text-ink hover:bg-card")}
            >
              {l.name} · {l.lat}°
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <Star className="size-4 text-[#c08a00]" />
            როგორ ვიპოვოთ ჩრდილოეთი ვარსკვლავებით
          </h2>
          <ol className="mt-2 flex flex-col gap-1.5">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => setStep(step === i + 1 ? 0 : i + 1)}
                  aria-pressed={step === i + 1}
                  className={cn("w-full rounded-lg px-3 py-2 text-left text-sm transition-colors", step === i + 1 ? "bg-deep text-white" : "bg-[#f1f4f3] text-copy hover:bg-[#e6ecea]")}
                >
                  <span className="font-semibold">
                    {i + 1}. {s.title}
                  </span>
                  {step === i + 1 && <span className="mt-1 block leading-6 text-white/90">{s.text}</span>}
                </button>
              </li>
            ))}
          </ol>
          <LabeledSlider label="შენი განედი" value={lat} display={fmtDeg(lat)} min={-30} max={90} step={0.1} onChange={setLat} color="#2f6fb0" className="mt-4" />
          <button
            type="button"
            onClick={() => {
              setTools(!tools);
              setMapPlace(null);
            }}
            aria-pressed={tools}
            className={cn("mt-3 flex h-9 items-center gap-1.5 rounded-full px-3 text-sm", tools ? "bg-deep font-semibold text-white" : "bg-[#f1f4f3] text-copy hover:bg-[#e6ecea]")}
          >
            <Ruler className="size-4" />
            რით ზომავდნენ: ასტროლაბია და სექსტანტი
          </button>
          <LabeledSlider label="ცის ბრუნვა (ღამის საათები)" value={time} display={`${Math.round(time * 15)}°`} min={0} max={23.95} step={0.05} onChange={setTime} color="#2f6fb0" className="mt-3" />
          <p className="mt-2 text-[13px] leading-5 text-mute">
            {lat < 0
              ? "სამხრეთ ნახევარსფეროში პოლარული ვარსკვლავი არ ჩანს — იქ სამხრეთს სამხრეთის ჯვრით პოულობენ."
              : "ცა საათში 15°-ით ბრუნავს, პოლარული კი თითქმის უძრავია — ამიტომ მასზე ორიენტირება მთელი ღამე შეიძლება."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-line p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Compass className="size-4 text-[#2f6fb0]" />
              აზიმუტი
            </p>
            <p className="mt-1 text-[13px] leading-5 text-mute">კუთხე ჩრდილოეთის მიმართულებიდან საგნის მიმართულებამდე, საათის ისრის მოძრაობით (0°–360°).</p>
            <LabeledSlider label={compassName(az)} value={Math.round(az)} display={`${Math.round(az)}°`} min={0} max={359} onChange={turnTo} color="#2f6fb0" className="mt-2" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[0, 90, 180, 270].map((a) => (
                <button key={a} type="button" onClick={() => turnTo(a)} className={cn("h-8 rounded-full px-3 text-sm", Math.round(az) === a ? "bg-[#2f6fb0] font-semibold text-white" : "bg-[#f1f4f3] text-copy hover:bg-[#e6ecea]")}>
                  {a}°
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <MapPin className="size-4 text-[#ff3b30]" />
              თბილისიდან — რა აზიმუტით?
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TARGETS.map((t) => {
                const b = bearing(TBILISI, t);
                const on = Math.round(az) === Math.round(b);
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      setAz(b);
                      setStep(0);
                      setMapPlace(t.name);
                      setTools(false);
                    }}
                    className={cn("h-8 rounded-full px-3 text-sm", on ? "bg-deep font-semibold text-white" : "bg-[#f1f4f3] text-copy hover:bg-[#e6ecea]")}
                  >
                    {t.name}
                    {on ? ` · ${Math.round(b)}°` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">ვარსკვლავების მდებარეობა: ნამდვილი კოორდინატები (J2000). პოლარული ციური პოლუსიდან ~0,7°-ითაა დაშორებული, ამიტომ მისი სიმაღლე განედს თითქმის ზუსტად უდრის.</p>
    </section>
  );
}
