"use client";

import { cn } from "@/lib/utils";

/*
 * Diagrams for the narration of the river landforms lesson, over the map of Georgia: a river's course from the
 * mountains to the sea (erosion, transport, deposition), a valley cut as the mountains rise, a canyon in
 * limestone, and a waterfall eating back into its cliff.
 */

export type CourseZone = "upper" | "middle" | "lower" | null;
export type FallStage = "layers" | "pool" | "retreat";

const SKY = "#cfe6f7";
const WATER = "#3a8ee6";
const ROCK = "#8a6a4a";

function Frame({ title, children, viewBox = "0 0 440 240" }: { title: string; children: React.ReactNode; viewBox?: string }) {
  return (
    <div className="flex size-full flex-col bg-[#0d1726]">
      <p className="px-4 pt-3 pb-2 text-center text-[15px] font-semibold text-white">{title}</p>
      <svg viewBox={viewBox} className="min-h-0 w-full flex-1" role="img" aria-label={title}>
        {children}
      </svg>
    </div>
  );
}

/** The long profile: steep upper course, gentler middle, flat lower course to the sea. */
export function CourseDiagram({ zone }: { zone: CourseZone }) {
  const zones = [
    { id: "upper", x: 0, w: 150, title: "ზემო წელი", work: "ეროზია", note: "ჭრის და რეცხავს", color: "#c2410c" },
    { id: "middle", x: 150, w: 140, title: "შუა წელი", work: "ტრანსპორტი", note: "ქვები, ქვიშა, ლამი", color: "#b45309" },
    { id: "lower", x: 290, w: 150, title: "ქვემო წელი", work: "აკუმულაცია", note: "ნატანი ილექება", color: "#15803d" },
  ] as const;
  const bed = "M0 56 C60 80 110 120 150 140 C200 165 250 180 290 190 C340 200 390 204 440 206";
  return (
    <Frame title="მდინარის სამი საქმე">
      <rect x={0} y={0} width={440} height={240} fill={SKY} />
      <path d={`${bed} L440 240 L0 240 z`} fill={ROCK} />
      <rect x={400} y={204} width={40} height={36} fill={WATER} />
      {zones.map((z) => (
        <g key={z.id} className={cn("transition-opacity", zone && zone !== z.id && "opacity-30")}>
          <rect x={z.x} y={0} width={z.w} height={240} fill={z.color} opacity={zone === z.id ? 0.16 : 0.06} />
          <text x={z.x + z.w / 2} y={16} fontSize={11} fontWeight={700} fill="#0d1726" textAnchor="middle">
            {z.title}
          </text>
          <text x={z.x + z.w / 2} y={31} fontSize={12} fontWeight={700} fill={z.color} textAnchor="middle">
            {z.work}
          </text>
          <text x={z.x + z.w / 2} y={44} fontSize={9.5} fill="#0d1726" textAnchor="middle">
            {z.note}
          </text>
        </g>
      ))}
      <path d={bed} fill="none" stroke={WATER} strokeWidth={6} strokeLinecap="round" />
      <path d={bed} fill="none" stroke="#e8f8ff" strokeWidth={2} strokeDasharray="5 12">
        <animate attributeName="stroke-dashoffset" from="34" to="0" dur={zone === "lower" ? "2.4s" : "0.8s"} repeatCount="indefinite" />
      </path>
      {/* Pebbles rolling in the middle course, silt settling in the lower. */}
      {(zone === "middle" || zone === null) &&
        [0, 0.7, 1.4].map((b) => (
          <circle key={b} r={4} fill="#6b5a48">
            <animateMotion path="M150 136 C200 161 250 176 290 186" dur="2.1s" begin={`${b}s`} repeatCount="indefinite" />
          </circle>
        ))}
      {(zone === "lower" || zone === null) &&
        [320, 350, 380].map((x, i) => (
          <circle key={x} cx={x} r={2.5} fill="#c9b290">
            <animate attributeName="cy" values="190;204" dur="1.8s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
          </circle>
        ))}
      {(zone === "upper" || zone === null) && <path d="M60 78 L74 100 L88 78" fill="none" stroke="#fff" strokeWidth={2.5} />}
    </Frame>
  );
}

/** The mountains rise while the river cuts down: a V-shaped valley deepens. */
export function UpliftDiagram() {
  return (
    <Frame title="მთა მაღლდება, მდინარე კი ქვემოთ ჭრის">
      <rect x={0} y={0} width={440} height={240} fill={SKY} />
      <path fill={ROCK}>
        <animate attributeName="d" dur="4s" repeatCount="indefinite" values="M0 140 L180 150 L210 175 L230 175 L260 150 L440 140 L440 240 L0 240 z;M0 70 L180 80 L212 200 L228 200 L260 80 L440 70 L440 240 L0 240 z" />
      </path>
      <rect x={210} width={20} height={10} fill={WATER}>
        <animate attributeName="y" dur="4s" repeatCount="indefinite" values="166;192" />
      </rect>
      <path d="M60 60 V30 M52 38 L60 30 L68 38" stroke="#0d1726" strokeWidth={2.5} fill="none" />
      <text x={74} y={44} fontSize={12} fontWeight={700} fill="#0d1726">
        აზევება
      </text>
      <path d="M220 120 V150 M212 142 L220 150 L228 142" stroke="#1d4ed8" strokeWidth={2.5} fill="none" />
      <text x={234} y={136} fontSize={12} fontWeight={700} fill="#1d4ed8">
        მდინარე ჭრის
      </text>
    </Frame>
  );
}

/** Limestone: water dissolves the rock along a crack and a narrow canyon with vertical walls opens. */
export function CanyonDiagram() {
  return (
    <Frame title="კირქვის კანიონი: წყალი ქანს ხსნის">
      <rect x={0} y={0} width={440} height={240} fill={SKY} />
      {[60, 100, 140, 180].map((y, i) => (
        <rect key={y} x={0} y={y} width={440} height={40} fill={i % 2 ? "#d8cfb8" : "#cbbf9f"} />
      ))}
      <rect x={204} y={60} width={32} height={160} fill={SKY}>
        <animate attributeName="height" values="20;160" dur="4s" repeatCount="indefinite" />
      </rect>
      <rect x={208} width={24} height={8} fill={WATER}>
        <animate attributeName="y" values="72;212" dur="4s" repeatCount="indefinite" />
      </rect>
      <text x={250} y={110} fontSize={12} fontWeight={700} fill="#0d1726">
        ვერტიკალური კედლები
      </text>
      <text x={20} y={50} fontSize={12} fontWeight={700} fill="#0d1726">
        კირქვა
      </text>
    </Frame>
  );
}

/** A waterfall: hard rock over soft, the plunge pool, the overhang falls and the fall steps back upstream. */
export function WaterfallDiagram({ stage }: { stage: FallStage }) {
  const back = stage === "retreat";
  return (
    <Frame title={stage === "layers" ? "ჩანჩქერი: მაგარი ქანი რბილზე" : stage === "pool" ? "ძირში წყალი ქვაბულს თხრის" : "კარნიზი ინგრევა — ჩანჩქერი უკან იხევს"}>
      <rect x={0} y={0} width={440} height={240} fill={SKY} />
      <g>
        {back && <animateTransform attributeName="transform" type="translate" values="0 0; -60 0" dur="5s" repeatCount="indefinite" />}
        {/* Hard cap rock and the soft rock under it, cut back under the overhang. */}
        <path d="M-80 80 H240 V108 H-80 z" fill="#5b5048" />
        <path d={`M-80 108 H${stage === "layers" ? 238 : 214} L${stage === "layers" ? 238 : 210} 210 H-80 z`} fill="#b59a72" />
        <path d="M-80 70 H240 V82 H-80 z" fill={WATER} />
        <path d="M240 76 C252 110 258 160 262 200" fill="none" stroke={WATER} strokeWidth={10} />
        <path d="M240 76 C252 110 258 160 262 200" fill="none" stroke="#e8f8ff" strokeWidth={3} strokeDasharray="6 10">
          <animate attributeName="stroke-dashoffset" from="32" to="0" dur="0.5s" repeatCount="indefinite" />
        </path>
      </g>
      <path d="M200 210 H520 V240 H200 z" fill="#b59a72" />
      <path d={`M${back ? 196 : 230} 210 Q${back ? 236 : 262} ${stage === "layers" ? 214 : 238} ${back ? 290 : 300} 210 H520 V200 H200 z`} fill={WATER} opacity={0.85} />
      {stage !== "layers" && (
        <text x={300} y={232} fontSize={12} fontWeight={700} fill="#0d1726">
          ქვაბული
        </text>
      )}
      <text x={20} y={100} fontSize={12} fontWeight={700} fill="#fff">
        მაგარი ქანი
      </text>
      <text x={20} y={160} fontSize={12} fontWeight={700} fill="#3b2a1a">
        რბილი ქანი
      </text>
      {back && (
        <g>
          <path d="M150 40 H90 M98 32 L90 40 L98 48" stroke="#b91c1c" strokeWidth={3} fill="none" />
          <text x={160} y={45} fontSize={12} fontWeight={700} fill="#b91c1c">
            დინების საწინააღმდეგოდ
          </text>
        </g>
      )}
    </Frame>
  );
}
