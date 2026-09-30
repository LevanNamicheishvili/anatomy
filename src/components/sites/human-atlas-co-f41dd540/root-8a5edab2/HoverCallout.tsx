"use client";

import { SYSTEM_BY_KEY, type SystemKey } from "./atlas-data";
import type { Strings } from "./i18n";

export interface HoverInfo {
  name: string;
  system: SystemKey;
  /** Anchor on the structure, in canvas pixels. */
  x: number;
  y: number;
}

const RISE = 44; // how far the leader line climbs before turning
const RUN = 72; // horizontal length of the leader line

/**
 * Textbook-style label: a dot on the structure, a thin leader line with one bend, and a name card
 * placed on whichever side has more room.
 */
export function HoverCallout({ t, hover, width, height }: { t: Strings; hover: HoverInfo; width: number; height: number }) {
  const color = SYSTEM_BY_KEY[hover.system].dot;
  const right = hover.x < width / 2;
  const dir = right ? 1 : -1;
  const bendX = hover.x + dir * 24;
  const endX = hover.x + dir * RUN;
  // Keep the card on screen vertically; the line follows the card.
  const endY = Math.min(Math.max(hover.y - RISE, 28), height - 28);

  return (
    <div className="pointer-events-none absolute inset-0 z-[45]" key={`${hover.name}-${Math.round(hover.x / 40)}`}>
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <polyline
          points={`${hover.x},${hover.y} ${bendX},${endY} ${endX},${endY}`}
          fill="none"
          stroke="#111a18"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="atlas-leader"
        />
        <circle cx={hover.x} cy={hover.y} r="9" fill={color} opacity="0.25" className="atlas-anchor-ring" />
        <circle cx={hover.x} cy={hover.y} r="4" fill="#ffffff" stroke="#111a18" strokeWidth="1.5" />
      </svg>
      <div
        className="atlas-callout absolute flex max-w-[240px] flex-col rounded-md border border-[#d5dcd9] bg-white px-3 py-2 shadow-[0_6px_20px_rgba(17,26,24,0.14)]"
        style={{
          top: endY,
          left: endX + dir * 6,
          transform: `translate(${right ? "0" : "-100%"}, -50%)`,
        }}
      >
        <span className="flex items-center gap-1.5 text-[11px] leading-4 text-[#66736f]">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          {t.systemNames[hover.system]}
        </span>
        <span className="text-sm leading-5 font-semibold text-[#111a18]">{hover.name}</span>
      </div>
    </div>
  );
}
