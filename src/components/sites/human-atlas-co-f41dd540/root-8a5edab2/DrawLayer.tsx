"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { floating, iconBtn } from "./primitives";

const COLORS = ["#e03131", "#1c7ed6", "#f59f00", "#111a18"];

type Stroke = { color: string; width: number; points: [number, number][] };

/**
 * A transparent sheet over the 3D view for circling and pointing on a smart board. While it is on,
 * touches draw instead of turning the model.
 */
export function DrawLayer({ board, onClose }: { board: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [count, setCount] = useState(0);
  const width = board ? 6 : 4;

  const redraw = () => {
    const c = canvasRef.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      g.strokeStyle = s.color;
      g.lineWidth = s.width;
      g.beginPath();
      s.points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (s.points.length === 1) g.lineTo(s.points[0][0] + 0.1, s.points[0][1]);
      g.stroke();
    }
  };

  // Keep the drawing surface matched to its size on screen.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="ხატვის ფენა"
        className="absolute inset-0 z-[42] size-full cursor-crosshair touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = { color, width, points: [point(e)] };
          redraw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          current.current.points.push(point(e));
          redraw();
        }}
        onPointerUp={() => {
          if (!current.current) return;
          strokes.current.push(current.current);
          current.current = null;
          setCount(strokes.current.length);
          redraw();
        }}
      />
      <div className={cn(floating, "absolute top-3 left-1/2 z-[43] flex -translate-x-1/2 items-center gap-1 p-1")}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label="ფერი"
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className={cn("flex size-9 items-center justify-center rounded-md max-md:size-11", color === c && "bg-[#eef2f0]")}
          >
            <span className={cn("size-5 rounded-full", color === c && "ring-2 ring-offset-2 ring-[#97a29e]")} style={{ backgroundColor: c }} />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-[#e2e7e5]" />
        <button
          type="button"
          aria-label="ბოლოს დახატულის წაშლა"
          title="უკან"
          disabled={!count}
          onClick={() => {
            strokes.current.pop();
            setCount(strokes.current.length);
            redraw();
          }}
          className={cn(iconBtn, "disabled:opacity-40")}
        >
          <Undo2 className="size-[18px]" />
        </button>
        <button
          type="button"
          aria-label="ყველაფრის წაშლა"
          title="გასუფთავება"
          disabled={!count}
          onClick={() => {
            strokes.current = [];
            setCount(0);
            redraw();
          }}
          className={cn(iconBtn, "disabled:opacity-40")}
        >
          <Eraser className="size-[18px]" />
        </button>
        <button type="button" aria-label="ხატვის დასრულება" title="დასრულება" onClick={onClose} className={iconBtn}>
          <X className="size-[18px]" />
        </button>
      </div>
    </>
  );
}
