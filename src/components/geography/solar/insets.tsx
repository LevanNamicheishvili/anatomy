"use client";

import { SceneInset } from "../lesson/SceneInset";

/*
 * Pictures the narration puts over the solar plant for what the 3D scene cannot show: inside a photovoltaic cell,
 * direct current turned into alternating, the same beam spread over a bigger area when it falls slantwise, and the
 * longer way low sunlight takes through the air.
 */

export type SolarInset = "cell" | "dcac" | "spread" | "airmass";

const TITLES: Record<SolarInset, string> = {
  cell: "ფოტოელემენტი: სინათლე → დენი",
  dcac: "ინვერტორი: მუდმივი დენი → ცვლადი დენი",
  spread: "დახრილი სხივი უფრო დიდ ფართობზე ნაწილდება",
  airmass: "დაბალი მზე: ჰაერის უფრო სქელი ფენა",
};

export function SolarInsetCard({ inset }: { inset: SolarInset }) {
  return (
    <SceneInset title={TITLES[inset]}>
      <svg viewBox="0 0 240 140" className="block w-full rounded-lg bg-[#0d1726]" role="img" aria-label={TITLES[inset]}>
        {inset === "cell" && <Cell />}
        {inset === "dcac" && <DcAc />}
        {inset === "spread" && <Spread />}
        {inset === "airmass" && <AirMass />}
      </svg>
    </SceneInset>
  );
}

function Cell() {
  return (
    <g>
      <rect x={40} y={50} width={130} height={22} fill="#3a6fd8" />
      <rect x={40} y={72} width={130} height={30} fill="#c0392b" />
      <text x={176} y={65} fontSize={9} fill="#9cc2ff">
        n-ფენა
      </text>
      <text x={176} y={92} fontSize={9} fill="#ff9c8f">
        p-ფენა
      </text>
      <line x1={40} y1={72} x2={170} y2={72} stroke="#fff" strokeDasharray="3 2" opacity={0.7} />
      {/* The photon comes in and frees an electron at the junction. */}
      <path d="M70 0 L92 64" stroke="#ffd84d" strokeWidth={2.5} strokeDasharray="5 3">
        <animate attributeName="stroke-dashoffset" values="16;0" dur="0.5s" repeatCount="indefinite" />
      </path>
      <text x={40} y={14} fontSize={10} fill="#ffd84d" fontWeight={700}>
        ფოტონი
      </text>
      {/* The electron is pushed up, round the wire through the lamp and back. */}
      <path id="cell-loop" d="M95 70 L120 56 L120 40 L210 40 L210 120 L120 120 L120 102" fill="none" stroke="#9aa5b1" strokeWidth={2} />
      <circle cx={210} cy={80} r={9} fill="#ffe066">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite" />
      </circle>
      {[0, 0.6, 1.2, 1.8].map((b) => (
        <circle key={b} r={3.5} fill="#7fd1ff">
          <animateMotion dur="2.4s" begin={`${b}s`} repeatCount="indefinite">
            <mpath href="#cell-loop" />
          </animateMotion>
        </circle>
      ))}
      <text x={128} y={34} fontSize={9.5} fill="#7fd1ff" fontWeight={700}>
        ელექტრონები ერთი მიმართულებით → მუდმივი დენი
      </text>
    </g>
  );
}

function DcAc() {
  const sine = Array.from({ length: 61 }, (_, i) => `${i ? "L" : "M"}${140 + i * 1.5} ${76 - 26 * Math.sin((i / 60) * Math.PI * 4)}`).join(" ");
  return (
    <g>
      <line x1={10} y1={76} x2={95} y2={76} stroke="#334155" />
      <path d="M12 52 H92" stroke="#ffd84d" strokeWidth={3} />
      <text x={52} y={110} fontSize={10} fill="#fff" textAnchor="middle">
        მუდმივი (პანელები)
      </text>
      <rect x={100} y={56} width={32} height={40} rx={4} fill="#5b6b7c" />
      <text x={116} y={81} fontSize={14} fill="#fff" textAnchor="middle">
        ⚡
      </text>
      <line x1={138} y1={76} x2={232} y2={76} stroke="#334155" />
      <path d={sine} fill="none" stroke="#7fd1ff" strokeWidth={3} pathLength={100} strokeDasharray="100" strokeDashoffset="100">
        <animate attributeName="stroke-dashoffset" values="100;0" dur="1.6s" repeatCount="indefinite" />
      </path>
      <text x={186} y={122} fontSize={10} fill="#fff" textAnchor="middle">
        ცვლადი (ქსელი)
      </text>
    </g>
  );
}

function Spread() {
  // The same beam, 30 wide: straight down it lights 30 of the surface; at 45° it lights 30 / cos 45° ≈ 42.
  const slant = [0, 7.5, 15, 22.5, 30].map((d) => d / Math.cos(Math.PI / 4));
  return (
    <g>
      <rect x={35} y={20} width={30} height={80} fill="#ffd84d" opacity={0.3} />
      {[35, 42.5, 50, 57.5, 65].map((x) => (
        <line key={x} x1={x} y1={20} x2={x} y2={100} stroke="#ffd84d" strokeWidth={1.2} />
      ))}
      <rect x={20} y={100} width={60} height={6} fill="#3a6fd8" />
      <rect x={35} y={97} width={30} height={5} fill="#ffd84d" />
      <text x={50} y={124} fontSize={10} fill="#fff" textAnchor="middle">
        0° — 100%
      </text>
      <path d={`M120 40 L${120 + slant[4]} 40 L${180 + slant[4]} 100 L180 100 z`} fill="#ffd84d" opacity={0.3} />
      {slant.map((d) => (
        <line key={d} x1={120 + d} y1={40} x2={180 + d} y2={100} stroke="#ffd84d" strokeWidth={1.2} />
      ))}
      <rect x={160} y={100} width={76} height={6} fill="#3a6fd8" />
      <rect x={180} y={97} width={slant[4]} height={5} fill="#ffd84d">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="1.6s" repeatCount="indefinite" />
      </rect>
      <text x={196} y={124} fontSize={10} fill="#fff" textAnchor="middle">
        45° — cos 45° ≈ 71%
      </text>
    </g>
  );
}

function AirMass() {
  return (
    <g>
      <path d="M-20 160 A200 200 0 0 1 260 160" fill="#2f6b34" />
      <path d="M-40 160 A230 230 0 0 1 280 160" fill="none" stroke="#7fd1ff" strokeWidth={34} opacity={0.25} />
      <circle cx={120} cy={92} r={4} fill="#fff" />
      {/* High sun: a short way through the air. */}
      <line x1={120} y1={92} x2={128} y2={6} stroke="#ffd84d" strokeWidth={3} />
      <circle cx={128} cy={6} r={6} fill="#ffd84d" />
      <text x={136} y={22} fontSize={10} fill="#ffd84d" fontWeight={700}>
        ზაფხული — მოკლე გზა
      </text>
      {/* Low sun: a long way, more light scattered. */}
      <line x1={120} y1={92} x2={6} y2={60} stroke="#ff9f43" strokeWidth={3} strokeDasharray="6 3">
        <animate attributeName="stroke-dashoffset" values="18;0" dur="0.8s" repeatCount="indefinite" />
      </line>
      <circle cx={6} cy={60} r={6} fill="#ff9f43" />
      <text x={12} y={48} fontSize={10} fill="#ff9f43" fontWeight={700}>
        ზამთარი — გრძელი გზა
      </text>
      <text x={120} y={132} fontSize={9.5} fill="#fff" textAnchor="middle">
        ატმოსფერო
      </text>
    </g>
  );
}
