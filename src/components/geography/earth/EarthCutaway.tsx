"use client";

import { useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { cn } from "@/lib/utils";
import { CutawayScene, type CutBand, type CutFx } from "./CutawayScene";
import { EARTH_CUES, type EarthShot } from "./earth-cues";
import { drawnRadius, EARTH_R_KM, LAYERS, layerAt, pressureAt, tempAt, type LayerId } from "./layers";

/*
 * Topic 1 — the structure of the Earth. The planet is cut open (whole → quarter → half); the cut faces show
 * crust, upper and lower mantle, outer and inner core. A depth probe reads off temperature, pressure and
 * the state of matter on the way to the centre.
 */

const VIEWS = [
  { name: "მთლიანი", deg: 0 },
  { name: "მეოთხედი ჭრილი", deg: 90 },
  { name: "ნახევარი", deg: 180 },
];
const BOUNDARIES = [0, 35, 660, 2900, 5150, EARTH_R_KM];
/** What the narration shows besides the layers, named in a key over the scene. */
const KEY: Record<CutFx | CutBand, { text: string; dot: string }> = {
  waves: { text: "მიწისძვრის ტალღები", dot: "#ffd873" },
  convection: { text: "ცხელი ადის · გაცივებული ეშვება", dot: "linear-gradient(90deg,#ff8a26 50%,#6fa6ff 50%)" },
  core: { text: "თხევადი რკინა მოძრაობს", dot: "#ffd27a" },
  magma: { text: "მაგმა", dot: "#ff8a2a" },
  field: { text: "მაგნიტური ველი", dot: "#7cc7ff" },
  plates: { text: "ლითოსფერული ფილების საზღვრები", dot: "#ff6a3d" },
  compass: { text: "კომპასი საქართველოში — ისარი ჩრდილოეთისკენ", dot: "#e0322b" },
  lithosphere: { text: "ლითოსფერო (0–100 კმ)", dot: "#fff3b0" },
  asthenosphere: { text: "ასთენოსფერო (100–250 კმ)", dot: "#fff3b0" },
};

/** 12345 → "12 345" (Georgian style: a space between thousands). */
const nf = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function fmtPressure(gpa: number) {
  if (gpa < 0.01) return "1 ატმოსფერო";
  const atm = gpa * 9869;
  return atm < 1_000_000 ? `~${nf(atm / 1000)} ათასი ატმ.` : `~${(atm / 1_000_000).toFixed(1).replace(".", ",")} მლნ ატმ.`;
}

export function EarthCutaway() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CutawayScene | null>(null);
  const [opening, setOpening] = useState(90);
  const [depth, setDepth] = useState(1500);
  const [selected, setSelected] = useState<LayerId | null>(null);
  /** Set by the narration: the layers lit, where the probe stands, what else is shown. */
  const [lit, setLit] = useState<LayerId[] | null>(null);
  /** Where the probe stands on the cut face (null: hidden while the voice speaks of other things). */
  const [probeAt, setProbeAt] = useState<number | null>(-28);
  const [shown, setShown] = useState<(CutFx | CutBand)[]>([]);
  const glide = useRef(0);
  const depthRef = useRef(depth);
  const layer = layerAt(depth);
  const info = LAYERS.find((l) => l.id === (selected ?? layer.id))!;

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new CutawayScene(canvas);
    sceneRef.current = scene;
    const els = [...layer.querySelectorAll<HTMLElement>("[data-r]")];
    const probe = layer.querySelector<HTMLElement>("[data-probe]");
    scene.onFrame = (project) => {
      const show = scene.labelsReadable();
      for (const el of els) {
        const p = project(scene.facePoint(Number(el.dataset.r), Number(el.dataset.e)));
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = show && p.visible ? "1" : "0";
      }
      if (probe) {
        const r = Number(probe.dataset.probe);
        const p = project(scene.facePoint(r, Number(probe.dataset.e)));
        probe.style.transform = `translate(${p.x}px, ${p.y}px) translate(12px, -50%)`;
        probe.style.opacity = show && p.visible && probe.dataset.on ? "1" : "0";
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(glide.current), []);

  const view = (deg: number) => {
    setOpening(deg);
    sceneRef.current?.animateTo(deg);
  };
  /** The probe goes down (or up) to a depth in step with the voice. */
  const glideDepth = (from: number, to: number) => {
    cancelAnimationFrame(glide.current);
    const start = performance.now();
    const dur = Math.min(2600, 700 + Math.abs(to - from) * 0.35);
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setDepth(Math.round(from + (to - from) * e));
      if (k < 1) glide.current = requestAnimationFrame(step);
    };
    step();
  };
  const last = useRef<Partial<EarthShot>>({});
  const direct = (s: Partial<EarthShot>, jump: boolean) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const before = last.current;
    last.current = s;
    if (s.opening !== undefined && (jump || s.opening !== before.opening)) {
      setOpening(s.opening);
      if (jump) scene.setOpening(s.opening);
      else scene.animateTo(s.opening);
    }
    if (s.view && (jump || s.view !== before.view)) scene.view(s.view, jump);
    setLit(s.lit ?? []);
    setSelected(null);
    if (s.probeAt !== undefined) setProbeAt(s.probeAt);
    const d = s.depth;
    if (d !== undefined && (jump || JSON.stringify(d) !== JSON.stringify(before.depth))) {
      const [from, to] = typeof d === "number" ? [depthRef.current, d] : d;
      if (jump) {
        cancelAnimationFrame(glide.current);
        setDepth(to);
      } else glideDepth(from, to);
    }
    scene.show(s.fx ?? [], s.band ?? null);
    setShown([...(s.fx ?? []), ...(s.band ? [s.band] : [])]);
  };
  const driving = useNarrationDirector(EARTH_CUES, direct);
  // When the voice stops, the scene is the pupil's again: no extras, the probe back in its place.
  const litNow = driving ? lit : null;
  const probeNow = driving ? probeAt : -28;
  const shownNow = driving ? shown : [];
  useEffect(() => {
    if (!driving) sceneRef.current?.show([], null);
  }, [driving]);
  useEffect(() => {
    depthRef.current = depth;
    sceneRef.current?.setProbe(depth, probeNow ?? -28);
    sceneRef.current?.showProbe(probeNow !== null);
  }, [depth, probeNow]);
  useEffect(() => {
    sceneRef.current?.select(litNow ?? selected);
  }, [selected, litNow]);
  const pick = (id: LayerId) => {
    const l = LAYERS.find((x) => x.id === id)!;
    cancelAnimationFrame(glide.current);
    setLit(null);
    setProbeAt(-28);
    setSelected(id);
    setDepth(Math.round((l.top + l.bottom) / 2));
    if (opening === 0) view(90);
  };
  const probeR = drawnRadius(depth);

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="დედამიწა ჭრილში: ქერქი, მანტია, ბირთვი" />
        <FullscreenButton full={fsOn} onClick={fsToggle} className="absolute top-3 right-3" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[11px] font-semibold whitespace-nowrap">
          {LAYERS.map((l) => (
            <span key={l.id} data-r={l.id === "inner-core" ? 0.09 : (l.rTop + l.rBottom) / 2} data-e={l.id === "crust" ? 52 : l.id === "upper-mantle" ? 40 : 28} className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 opacity-0 shadow transition-colors", (litNow ?? [selected]).includes(l.id) ? "bg-deep text-white ring-2 ring-[#ffd76a]" : "bg-card/90 text-ink")}>
              {l.name}
            </span>
          ))}
          <span data-probe={probeR} data-e={probeNow ?? -28} data-on={probeNow !== null ? "1" : undefined} className="absolute top-0 left-0 rounded bg-deep/85 px-1.5 py-0.5 text-white opacity-0">
            {nf(depth)} კმ · {nf(tempAt(depth))}°C
          </span>
        </div>

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button key={v.deg} type="button" onClick={() => view(v.deg)} aria-pressed={opening === v.deg} className={cn("h-9 rounded-lg px-3 text-sm font-semibold shadow-sm", opening === v.deg ? "bg-[#2f6fb0] text-white" : "bg-card/92 text-ink")}>
              {v.name}
            </button>
          ))}
        </div>
        {shownNow.length > 0 && (
          <ul className="pointer-events-none absolute top-14 left-3 flex flex-col gap-1">
            {shownNow.map((k) => (
              <li key={k} className="flex w-fit items-center gap-2 rounded-lg bg-black/60 px-2.5 py-1 text-[13px] font-semibold text-white">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: KEY[k].dot }} />
                {KEY[k].text}
              </li>
            ))}
          </ul>
        )}
        <p className="pointer-events-none absolute right-3 bottom-3 rounded bg-black/50 px-2 py-1 text-[11px] text-white/85">ქერქი ნახატზე გადიდებულია — სინამდვილეში ის ვაშლის კანივით თხელია</p>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-4">
          <div>
            <LabeledSlider
              label="ჩავიდეთ სიღრმეში"
              value={depth}
              display={`${nf(depth)} კმ`}
              min={0}
              max={EARTH_R_KM}
              step={5}
              onChange={(v) => {
                cancelAnimationFrame(glide.current);
                setDepth(v);
                setSelected(null);
                setLit(null);
                setProbeAt(-28);
                if (opening === 0) view(90);
              }}
              color="#2f6fb0"
            />
            <span className="relative mt-1 block h-3 w-full overflow-hidden rounded-full" aria-hidden>
              {LAYERS.map((l) => (
                <span key={l.id} className="absolute top-0 h-full" style={{ left: `${(l.top / EARTH_R_KM) * 100}%`, width: `${((l.bottom - l.top) / EARTH_R_KM) * 100}%`, backgroundColor: l.color }} />
              ))}
            </span>
            <span className="mt-1 flex justify-between text-[10px] text-faint tabular-nums" aria-hidden>
              {BOUNDARIES.map((b) => (
                <span key={b}>{nf(b)}</span>
              ))}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: "ფენა", v: layer.name },
              { k: "ტემპერატურა", v: `~${nf(tempAt(depth))}°C` },
              { k: "წნევა", v: fmtPressure(pressureAt(depth)) },
              { k: "მდგომარეობა", v: layer.state.split(",")[0].split(" (")[0] },
            ].map((x) => (
              <div key={x.k} className="rounded-lg bg-subtle px-3 py-2.5">
                <dt className="text-[11px] leading-4 text-mute">{x.k}</dt>
                <dd className="mt-1 text-[15px] leading-5 font-semibold [overflow-wrap:anywhere]">{x.v}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-lg border border-line p-4">
            <h2 className="flex flex-wrap items-center gap-x-2 text-lg">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: info.color }} />
              {info.name}
              <span className="text-sm font-normal whitespace-nowrap text-mute">
                {nf(info.top)}–{nf(info.bottom)} კმ
              </span>
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-copy">{info.note}</p>
            <p className="mt-2 text-sm text-mute">
              შედგენილობა: {info.matter} · {info.temp} · სიმკვრივე {info.density}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="size-4" />
            ფენები ზემოდან ქვემოთ
          </p>
          <ul className="flex flex-col gap-1.5">
            {LAYERS.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => pick(l.id)} aria-pressed={selected === l.id} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left", selected === l.id || (!selected && layer.id === l.id) ? "border-[#2f6fb0] bg-[#eef4fb]" : "border-line hover:border-faint")}>
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{l.name}</span>
                    <span className="block text-[12px] text-mute">
                      {nf(l.top)}–{nf(l.bottom)} კმ · {l.state.split(",")[0].split(" (")[0]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-subtle px-3 py-2 text-[13px] leading-5 text-copy">
            ყველაზე ღრმა ჭაბურღილი (კოლის, რუსეთი) — 12,3 კმ: ეს დედამიწის რადიუსის მხოლოდ 0,2%-ია. სიღრმეში რა ხდება, მეცნიერები მიწისძვრის ტალღებით იგებენ.
          </p>
        </div>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">სიღრმეები და ტემპერატურები სასწავლო მიახლოებაა. დედამიწის სურათი: NASA Blue Marble. 1 გიგაპასკალი ≈ 10 000 ატმოსფერო.</p>
    </section>
  );
}
