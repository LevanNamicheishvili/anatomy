"use client";

import { useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { CutawayScene } from "./CutawayScene";
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

/** 12345 → "12 345" (Georgian style: a space between thousands). */
const nf = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function fmtPressure(gpa: number) {
  if (gpa < 0.01) return "1 ატმოსფერო";
  const atm = gpa * 9869;
  return atm < 1_000_000 ? `~${nf(atm / 1000)} ათასი ატმ.` : `~${(atm / 1_000_000).toFixed(1).replace(".", ",")} მლნ ატმ.`;
}

export function EarthCutaway() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CutawayScene | null>(null);
  const [opening, setOpening] = useState(90);
  const [depth, setDepth] = useState(1500);
  const [selected, setSelected] = useState<LayerId | null>(null);
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
      const show = scene.faceVisible();
      for (const el of els) {
        const p = project(scene.facePoint(Number(el.dataset.r), Number(el.dataset.e)));
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = show && p.visible ? "1" : "0";
      }
      if (probe) {
        const r = Number(probe.dataset.probe);
        const p = project(scene.facePoint(r, -28));
        probe.style.transform = `translate(${p.x}px, ${p.y}px) translate(12px, -50%)`;
        probe.style.opacity = show && p.visible ? "1" : "0";
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setProbe(depth);
  }, [depth]);
  useEffect(() => {
    sceneRef.current?.select(selected);
  }, [selected]);

  const view = (deg: number) => {
    setOpening(deg);
    sceneRef.current?.animateTo(deg);
  };
  const pick = (id: LayerId) => {
    const l = LAYERS.find((x) => x.id === id)!;
    setSelected(id);
    setDepth(Math.round((l.top + l.bottom) / 2));
    if (opening === 0) view(90);
  };
  const probeR = drawnRadius(depth);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-white shadow-card">
      <div className="relative h-[56dvh] min-h-80 w-full sm:h-auto sm:aspect-[16/10] sm:max-h-[72dvh] bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]">
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="დედამიწა ჭრილში: ქერქი, მანტია, ბირთვი" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[11px] font-semibold whitespace-nowrap">
          {LAYERS.map((l) => (
            <span key={l.id} data-r={l.id === "inner-core" ? 0.09 : (l.rTop + l.rBottom) / 2} data-e={l.id === "crust" ? 52 : l.id === "upper-mantle" ? 40 : 28} className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 opacity-0 shadow", selected === l.id ? "bg-[#111a18] text-white" : "bg-white/90 text-[#111a18]")}>
              {l.name}
            </span>
          ))}
          <span data-probe={probeR} className="absolute top-0 left-0 rounded bg-[#111a18]/85 px-1.5 py-0.5 text-white opacity-0">
            {nf(depth)} კმ · {nf(tempAt(depth))}°C
          </span>
        </div>

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button key={v.deg} type="button" onClick={() => view(v.deg)} aria-pressed={opening === v.deg} className={cn("h-9 rounded-lg px-3 text-sm font-semibold shadow-sm", opening === v.deg ? "bg-[#2f6fb0] text-white" : "bg-white/92 text-[#111a18]")}>
              {v.name}
            </button>
          ))}
        </div>
        <p className="pointer-events-none absolute right-3 bottom-3 rounded bg-black/50 px-2 py-1 text-[11px] text-white/85">ქერქი ნახატზე გადიდებულია — სინამდვილეში ის ვაშლის კანივით თხელია</p>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-[1fr_17rem]">
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="flex justify-between text-sm">
              <span className="font-semibold">ჩავიდეთ სიღრმეში</span>
              <span className="tabular-nums text-[#33413e]">{nf(depth)} კმ</span>
            </span>
            <input type="range" min={0} max={EARTH_R_KM} step={5} value={depth} onChange={(e) => { setDepth(Number(e.target.value)); setSelected(null); if (opening === 0) view(90); }} className="mt-1 w-full accent-[#2f6fb0]" aria-label="სიღრმე, კმ" />
            <span className="relative mt-1 block h-3 w-full overflow-hidden rounded-full">
              {LAYERS.map((l) => (
                <span key={l.id} className="absolute top-0 h-full" style={{ left: `${(l.top / EARTH_R_KM) * 100}%`, width: `${((l.bottom - l.top) / EARTH_R_KM) * 100}%`, backgroundColor: l.color }} />
              ))}
            </span>
            <span className="mt-1 flex justify-between text-[10px] text-[#97a29e] tabular-nums">
              {BOUNDARIES.map((b) => (
                <span key={b}>{nf(b)}</span>
              ))}
            </span>
          </label>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: "ფენა", v: layer.name },
              { k: "ტემპერატურა", v: `~${nf(tempAt(depth))}°C` },
              { k: "წნევა", v: fmtPressure(pressureAt(depth)) },
              { k: "მდგომარეობა", v: layer.state.split(",")[0].split(" (")[0] },
            ].map((x) => (
              <div key={x.k} className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
                <dt className="text-[11px] leading-4 text-[#66736f]">{x.k}</dt>
                <dd className="mt-1 text-[15px] leading-5 font-semibold">{x.v}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-lg border border-[#e2e7e5] p-4">
            <h2 className="flex items-center gap-2 text-lg">
              <span className="size-3 rounded-full" style={{ backgroundColor: info.color }} />
              {info.name}
              <span className="text-sm font-normal text-[#66736f]">
                {nf(info.top)}–{nf(info.bottom)} კმ
              </span>
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{info.note}</p>
            <p className="mt-2 text-sm text-[#66736f]">
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
                <button type="button" onClick={() => pick(l.id)} aria-pressed={selected === l.id} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left", selected === l.id || (!selected && layer.id === l.id) ? "border-[#2f6fb0] bg-[#eef4fb]" : "border-[#e2e7e5] hover:border-[#97a29e]")}>
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{l.name}</span>
                    <span className="block text-[12px] text-[#66736f]">
                      {nf(l.top)}–{nf(l.bottom)} კმ · {l.state.split(",")[0].split(" (")[0]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-[#f5f7f6] px-3 py-2 text-[13px] leading-5 text-[#33413e]">
            ყველაზე ღრმა ჭაბურღილი (კოლის, რუსეთი) — 12,3 კმ: ეს დედამიწის რადიუსის მხოლოდ 0,2%-ია. სიღრმეში რა ხდება, მეცნიერები მიწისძვრის ტალღებით იგებენ.
          </p>
        </div>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-[#97a29e]">სიღრმეები და ტემპერატურები სასწავლო მიახლოებაა. დედამიწის სურათი: NASA Blue Marble. 1 გიგაპასკალი ≈ 10 000 ატმოსფერო.</p>
    </section>
  );
}
