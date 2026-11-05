"use client";

import { useEffect, useRef, useState } from "react";
import { AnatomyViewer } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/anatomy-viewer";
import { MODEL_BASE, MODEL_VERSION, type AtlasManifest, type SystemKey } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/atlas-data";
import { withFaceMuscles } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/face-muscles";
import type { StageProps } from "./stage";

/*
 * The whole human body, turning, layer after layer: the skeleton, then the muscles over it, the organs, the vessels,
 * the nerves. The same model and the same names a pupil uses in the atlas.
 */

const LAYERS: { name: string; systems: SystemKey[] }[] = [
  { name: "ჩონჩხი", systems: ["skeletal"] },
  { name: "კუნთები", systems: ["skeletal", "muscular"] },
  { name: "შინაგანი ორგანოები", systems: ["skeletal", "cardiac", "respiratory", "digestive", "urinary"] },
  { name: "გული და სისხლძარღვები", systems: ["skeletal", "cardiac", "arterial", "venous"] },
  { name: "ნერვული სისტემა", systems: ["skeletal", "nervous", "sensory"] },
];
const EVERY = 5200;

export default function AtlasStage({ onReady }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  const [layer, setLayer] = useState(-1);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewer = new AnatomyViewer(canvas, { onHover: () => {}, onPick: () => {}, onFocus: () => {}, onPhase: () => {}, onLabels: () => {} });
    viewer.presentationMode();
    let cancelled = false;
    let swap = 0;
    (async () => {
      const raw = (await (await fetch(`${MODEL_BASE}/atlas.json?v=${MODEL_VERSION}`)).json()) as AtlasManifest;
      const manifest = withFaceMuscles(raw);
      await viewer.load(manifest, () => {});
      if (cancelled) return;
      const idsOf = (systems: SystemKey[]) => new Set(manifest.parts.filter((p) => systems.includes(p.system)).map((p) => p.id));
      const show = (i: number) => {
        viewer.setVisible(idsOf(LAYERS[i].systems));
        setLayer(i);
      };
      show(0);
      viewer.zoom(0.93);
      readyRef.current();
      let i = 0;
      swap = window.setInterval(() => {
        i = (i + 1) % LAYERS.length;
        show(i);
      }, EVERY);
    })().catch(() => readyRef.current());
    return () => {
      cancelled = true;
      window.clearInterval(swap);
      viewer.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="ადამიანის სხეული" />
      {layer >= 0 && (
        <p key={layer} className="present-rise pointer-events-none absolute top-[8%] right-[5%] rounded-xl bg-black/45 px-5 py-2.5 font-heading text-[clamp(1.25rem,2.4vw,2.5rem)] text-white backdrop-blur-sm">
          {LAYERS[layer].name}
        </p>
      )}
    </>
  );
}
