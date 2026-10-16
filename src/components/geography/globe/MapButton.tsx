"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAP_PRESETS, setMapLayers, useMapLayers, type MapLayers } from "./mapLayers";

/*
 * The map on the globe: on or off (GlobeScene.setMapVisible), and under it the menu where the teacher picks what
 * it shows — the countries, the continents in colour, or everything — and can add or take away each layer. The
 * setting is the same on every globe of the page.
 */

const PRESETS: { id: keyof typeof MAP_PRESETS; name: string }[] = [
  { id: "countries", name: "ქვეყნები" },
  { id: "continents", name: "კონტინენტები" },
  { id: "all", name: "ყველაფერი" },
];

const LAYERS: { key: keyof MapLayers; name: string }[] = [
  { key: "borders", name: "ქვეყნების საზღვრები" },
  { key: "countries", name: "ქვეყნების სახელები" },
  { key: "continents", name: "კონტინენტები (ფერებით)" },
  { key: "oceans", name: "ოკეანეები და ზღვები" },
  { key: "capitals", name: "დედაქალაქები" },
  { key: "cities", name: "ქალაქები" },
  { key: "lakes", name: "ტბები" },
];

const same = (a: MapLayers, b: MapLayers) => (Object.keys(a) as (keyof MapLayers)[]).every((k) => a[k] === b[k]);

export function MapButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  const layers = useMapLayers();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // A tap outside the menu, or Escape, closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={onClick} aria-pressed={on} title="რუკა" aria-label="რუკა: საზღვრები და სახელები" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", on ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
        <MapIcon className="size-5" />
      </button>
      {on && (
        <div ref={boxRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="true"
            title="რა ჩანს რუკაზე"
            aria-label="რა ჩანს რუკაზე"
            className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", open ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}
          >
            <Layers className="size-5" />
          </button>
          {open && (
            <div role="group" aria-label="რა ჩანს რუკაზე" className="absolute top-0 right-full z-30 mr-2 w-80 max-w-[calc(100vw-5rem)] rounded-xl bg-card p-3 text-ink shadow-xl ring-1 ring-black/10">
              <p className="text-sm font-semibold">რა ჩანს რუკაზე</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMapLayers(MAP_PRESETS[p.id])}
                    aria-pressed={same(layers, MAP_PRESETS[p.id])}
                    className={cn("h-10 flex-auto rounded-lg px-2.5 text-[13px] font-semibold whitespace-nowrap", same(layers, MAP_PRESETS[p.id]) ? "bg-[#2f6fb0] text-white" : "bg-subtle text-ink hover:bg-chip")}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <ul className="mt-3 flex flex-col">
                {LAYERS.map((l) => (
                  <li key={l.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={layers[l.key]}
                      onClick={() => setMapLayers({ ...layers, [l.key]: !layers[l.key] })}
                      className="flex min-h-10 w-full items-center gap-3 rounded-lg px-1.5 text-left text-[14px] hover:bg-subtle"
                    >
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", layers[l.key] ? "border-[#2f6fb0] bg-[#2f6fb0] text-white" : "border-line-strong bg-card")}>
                        {layers[l.key] && <Check className="size-3.5" />}
                      </span>
                      {l.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
