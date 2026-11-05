"use client";

import { useEffect, useRef, useState } from "react";
import { GeorgiaScene } from "@/components/geography/GeorgiaScene";
import type { StageProps } from "./stage";

/*
 * Georgia in 3D, from real height data and satellite pictures: the whole country, then the camera goes from place
 * to place, its name on the screen.
 */

const TOUR: { name: string; lon: number; lat: number; span: number; depth: number }[] = [
  { name: "მთელი საქართველო", lon: 43.4, lat: 42.2, span: 5.1, depth: 2.9 },
  { name: "ყაზბეგი", lon: 44.52, lat: 42.66, span: 1.1, depth: 0.7 },
  { name: "სვანეთი", lon: 42.75, lat: 43.0, span: 1.3, depth: 0.8 },
  { name: "კოლხეთი და შავი ზღვა", lon: 41.9, lat: 42.1, span: 1.8, depth: 1.1 },
  { name: "თბილისი", lon: 44.79, lat: 41.72, span: 1.3, depth: 0.8 },
];
const EVERY = 6500;

export default function GeorgiaStage({ onReady }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  const [place, setPlace] = useState(-1);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timer = 0;
    const scene = new GeorgiaScene(canvas, {
      onReady: () => {
        readyRef.current();
        scene.setBackdrop("#070c16");
        scene.setLayer("satellite");
        let i = 0;
        setPlace(0);
        timer = window.setInterval(() => {
          i = (i + 1) % TOUR.length;
          const p = TOUR[i];
          scene.flyTo(p.lon, p.lat, p.span, p.depth);
          setPlace(i);
        }, EVERY);
      },
      onHover: () => {},
      onSelect: () => {},
    });
    return () => {
      window.clearInterval(timer);
      scene.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="საქართველო 3D-ში" />
      {place >= 0 && (
        <p key={place} className="present-rise pointer-events-none absolute top-[8%] right-[5%] rounded-xl bg-black/50 px-5 py-2.5 font-heading text-[clamp(1.25rem,2.4vw,2.5rem)] text-white backdrop-blur-sm">
          {TOUR[place].name}
        </p>
      )}
    </>
  );
}
