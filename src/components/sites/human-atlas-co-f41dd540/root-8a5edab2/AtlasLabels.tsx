"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Insets, LabelAnchor } from "./anatomy-viewer";
import { SYSTEM_BY_KEY, type AtlasPart, type SystemKey } from "./atlas-data";
import type { Channel } from "./channel";
import { georgianName } from "./georgian-names";

export interface LabelFrame {
  anchors: LabelAnchor[];
  free: Insets;
  w: number;
  h: number;
}

interface Placed {
  part: AtlasPart;
  name: string;
  system: SystemKey;
  ax: number;
  ay: number;
  /** Where the leader line meets the card. */
  cx: number;
  cy: number;
  side: "left" | "right";
}

const ROW = 38; // vertical spacing between cards (one-line cards are 30 px tall)
const MAX_LABELS = 12;
const MIN_SPACING = 56; // keep arrow tips apart so labels point at different structures

/**
 * Picks the largest clearly visible structures and lays them out in two columns beside the body, like
 * a labelled textbook figure, with no line crossing another card.
 */
function layout({ anchors, free, w, h }: LabelFrame): Placed[] {
  const top = free.top + 24;
  const bottom = h - free.bottom - 24;
  const left = free.left + 12;
  const right = w - free.right - 12;
  if (bottom - top < ROW * 2 || right - left < 320) return [];

  // One label per structure name; left/right pairs share a name, the bigger one wins.
  const byName = new Map<string, { a: LabelAnchor; name: string }>();
  let minX = Infinity;
  let maxX = -Infinity;
  for (const a of anchors) {
    minX = Math.min(minX, a.x);
    maxX = Math.max(maxX, a.x);
    const g = georgianName(a.part.name, a.part.system, a.part.bounds);
    if (!g.exact) continue;
    const name = g.name.replace(/^(მარცხენა|მარჯვენა) /, "");
    const prev = byName.get(name);
    if (!prev || prev.a.area < a.area) byName.set(name, { a, name });
  }
  const count = Math.min(MAX_LABELS, Math.floor((bottom - top) / ROW) * 2);
  const chosen: { a: LabelAnchor; name: string }[] = [];
  for (const c of [...byName.values()].sort((p, q) => q.a.area - p.a.area)) {
    if (chosen.length >= count) break;
    const { x, y } = c.a;
    if (x < left || x > right || y < top || y > bottom) continue;
    if (chosen.some((o) => Math.hypot(o.a.x - x, o.a.y - y) < MIN_SPACING)) continue;
    chosen.push(c);
  }
  if (!chosen.length) return [];

  const mid = (minX + maxX) / 2;
  const leftEdge = Math.max(left + 150, minX - 36);
  const rightEdge = Math.min(right - 150, maxX + 36);
  const placed: Placed[] = [];
  for (const side of ["left", "right"] as const) {
    const column = chosen.filter((c) => (side === "left" ? c.a.x < mid : c.a.x >= mid)).sort((p, q) => p.a.y - q.a.y);
    // Cards sit at their arrow tip's height, pushed apart where they would overlap, then kept on screen.
    const ys = column.map((c) => c.a.y);
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], top, i ? ys[i - 1] + ROW : top);
    for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i < ys.length - 1 ? ys[i + 1] - ROW : bottom);
    column.forEach((c, i) =>
      placed.push({
        part: c.a.part,
        name: c.name,
        system: c.a.part.system,
        ax: c.a.x,
        ay: c.a.y,
        cx: side === "left" ? leftEdge : rightEdge,
        cy: ys[i],
        side,
      }),
    );
  }
  return placed;
}

/** Labels that are always on screen: made for smart boards and touch screens, where nothing hovers. */
export function AtlasLabels({ channel, onPick }: { channel: Channel<LabelFrame>; onPick: (part: AtlasPart) => void }) {
  const frame = useSyncExternalStore(channel.subscribe, channel.get, () => null);
  const placed = useMemo(() => (frame ? layout(frame) : []), [frame]);
  if (!placed.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[40]">
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {placed.map((p) => {
          const dir = p.side === "left" ? -1 : 1;
          return (
            <g key={p.part.id}>
              <polyline
                points={`${p.ax},${p.ay} ${p.cx - dir * 14},${p.cy} ${p.cx},${p.cy}`}
                fill="none"
                stroke="#111a18"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
              <circle cx={p.ax} cy={p.ay} r="3.5" fill="#ffffff" stroke="#111a18" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
      {placed.map((p) => (
        <button
          key={p.part.id}
          type="button"
          onClick={() => onPick(p.part)}
          className="atlas-callout pointer-events-auto absolute flex items-center whitespace-nowrap gap-1.5 rounded-md border border-[#d5dcd9] bg-white px-2.5 py-1 text-left text-[13px] leading-5 font-semibold text-[#111a18] shadow-[0_3px_10px_rgba(17,26,24,0.10)] hover:border-[#0f8a74]"
          style={{
            top: p.cy,
            left: p.cx + (p.side === "left" ? -4 : 4),
            transform: `translate(${p.side === "left" ? "-100%" : "0"}, -50%)`,
          }}
        >
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SYSTEM_BY_KEY[p.system].dot }} />
          {p.name}
        </button>
      ))}
    </div>
  );
}
