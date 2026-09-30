"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Insets, LabelAnchor } from "./anatomy-viewer";
import { SYSTEM_BY_KEY, type AtlasPart } from "./atlas-data";
import type { Channel } from "./channel";

export interface LabelFrame {
  anchors: LabelAnchor[];
  free: Insets;
  w: number;
  h: number;
}

interface Placed {
  id: string;
  ax: number;
  ay: number;
  /** Outer edge of the card, where the leader line meets it. */
  cx: number;
  cy: number;
  side: "left" | "right";
}

const ROW = 38; // vertical spacing between cards (one-line cards are 30 px tall)
const GAP = 48; // horizontal room between the body and the cards

/**
 * Two columns beside the body, like a labelled textbook figure. Cards never overlap each other and
 * never slide under the side panels: each is kept inside the free area using its measured width.
 */
function layout({ anchors, free, w, h }: LabelFrame, widths: Map<string, number>): Placed[] {
  const top = free.top + 24;
  const bottom = h - free.bottom - 24;
  const left = free.left + 12;
  const right = w - free.right - 12;
  if (bottom - top < ROW * 2 || right - left < 320) return [];
  const inside = anchors.filter((a) => a.x >= left && a.x <= right && a.y >= top && a.y <= bottom);
  if (!inside.length) return [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const a of inside) {
    minX = Math.min(minX, a.x);
    maxX = Math.max(maxX, a.x);
  }
  const mid = (minX + maxX) / 2;
  const placed: Placed[] = [];
  for (const side of ["left", "right"] as const) {
    const column = inside.filter((a) => (side === "left" ? a.x < mid : a.x >= mid)).sort((p, q) => p.y - q.y);
    const ys = column.map((a) => a.y);
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], top, i ? ys[i - 1] + ROW : top);
    for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i < ys.length - 1 ? ys[i + 1] - ROW : bottom);
    column.forEach((a, i) => {
      const width = (widths.get(a.part.id) ?? 180) + 4;
      const cx = side === "left" ? Math.max(left + width, minX - GAP) : Math.min(right - width, maxX + GAP);
      placed.push({ id: a.part.id, ax: a.x, ay: a.y, cx, cy: ys[i], side });
    });
  }
  return placed;
}

interface LabelItem {
  part: AtlasPart;
  name: string;
}

/**
 * Labels that are always on screen: made for smart boards and touch screens, where nothing hovers.
 * React renders only when the set of labels changes; every frame just moves the existing elements.
 */
export function AtlasLabels({ channel, onPick }: { channel: Channel<LabelFrame>; onPick: (part: AtlasPart) => void }) {
  const [items, setItems] = useState<LabelItem[]>([]);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const lines = useRef(new Map<string, SVGPolylineElement>());
  const dots = useRef(new Map<string, SVGCircleElement>());
  const widths = useRef(new Map<string, number>());
  const itemsKey = useRef("");

  const apply = useRef((frame: LabelFrame | null) => {
    const placed = frame ? layout(frame, widths.current) : [];
    const shown = new Set(placed.map((p) => p.id));
    for (const p of placed) {
      const dir = p.side === "left" ? -1 : 1;
      const card = cards.current.get(p.id);
      if (card) {
        const width = widths.current.get(p.id) ?? card.offsetWidth;
        card.style.visibility = "visible";
        card.style.transform = `translate(${p.cx + dir * 4 - (p.side === "left" ? width : 0)}px, ${p.cy - 15}px)`;
      }
      lines.current.get(p.id)?.setAttribute("points", `${p.ax},${p.ay} ${p.cx - dir * 14},${p.cy} ${p.cx},${p.cy}`);
      const dot = dots.current.get(p.id);
      if (dot) {
        dot.setAttribute("cx", String(p.ax));
        dot.setAttribute("cy", String(p.ay));
      }
    }
    for (const [id, card] of cards.current) if (!shown.has(id)) card.style.visibility = "hidden";
    for (const [id, line] of lines.current) line.style.visibility = shown.has(id) ? "visible" : "hidden";
    for (const [id, dot] of dots.current) dot.style.visibility = shown.has(id) ? "visible" : "hidden";
  });

  useEffect(
    () =>
      channel.subscribe(() => {
        const frame = channel.get();
        const next = frame?.anchors ?? [];
        const key = next.map((a) => a.part.id).join("|");
        if (key !== itemsKey.current) {
          itemsKey.current = key;
          setItems(next.map((a) => ({ part: a.part, name: a.name })));
          return; // positioned by the layout effect once the new elements exist
        }
        apply.current(frame);
      }),
    [channel],
  );

  // New cards: measure their widths once, then position everything.
  useLayoutEffect(() => {
    for (const [id, card] of cards.current) widths.current.set(id, card.offsetWidth);
    apply.current(channel.get());
  }, [items, channel]);

  if (!items.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[40]">
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {items.map(({ part }) => (
          <g key={part.id}>
            <polyline
              ref={(el) => {
                if (el) lines.current.set(part.id, el);
                else lines.current.delete(part.id);
              }}
              fill="none"
              stroke="#111a18"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
              visibility="hidden"
            />
            <circle
              ref={(el) => {
                if (el) dots.current.set(part.id, el);
                else dots.current.delete(part.id);
              }}
              r="3.5"
              fill="#ffffff"
              stroke="#111a18"
              strokeWidth="1.5"
              visibility="hidden"
            />
          </g>
        ))}
      </svg>
      {items.map(({ part, name }) => (
        <button
          key={part.id}
          ref={(el) => {
            if (el) cards.current.set(part.id, el);
            else {
              cards.current.delete(part.id);
              widths.current.delete(part.id);
            }
          }}
          type="button"
          onClick={() => onPick(part)}
          className="atlas-callout pointer-events-auto invisible absolute top-0 left-0 flex items-center gap-1.5 rounded-md border border-[#d5dcd9] bg-white px-2.5 py-1 text-left text-[13px] leading-5 font-semibold whitespace-nowrap text-[#111a18] shadow-[0_3px_10px_rgba(17,26,24,0.10)] will-change-transform hover:border-[#0f8a74]"
        >
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SYSTEM_BY_KEY[part.system].dot }} />
          {name}
        </button>
      ))}
    </div>
  );
}
