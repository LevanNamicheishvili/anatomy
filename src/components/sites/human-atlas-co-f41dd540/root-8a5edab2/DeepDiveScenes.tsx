"use client";

import type { ReactNode } from "react";
import type { DiveLayer, DiveTemplate, LayerPattern, MicroScene } from "./deep-dive-data";

/* Original schematic illustrations for the deep-dive panel (viewBox 200×140). */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function PatternDefs({ prefix, layers }: { prefix: string; layers: DiveLayer[] }) {
  const pat = (id: string, p: LayerPattern, c: string): ReactNode => {
    const ink = "rgba(17,26,24,0.18)";
    switch (p) {
      case "porous":
        return (
          <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" fill={ink} />
            <circle cx="6" cy="6" r="1.1" fill={ink} />
          </pattern>
        );
      case "fibrous":
        return (
          <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={ink} strokeWidth="0.8" />
          </pattern>
        );
      case "wavy":
        return (
          <pattern id={id} width="12" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 3 Q3 0 6 3 T12 3" fill="none" stroke={ink} strokeWidth="0.8" />
          </pattern>
        );
      case "cells":
        return (
          <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="3.5" cy="3.5" r="2.6" fill="none" stroke={ink} strokeWidth="0.6" />
            <circle cx="3.5" cy="3.5" r="0.8" fill={ink} />
          </pattern>
        );
      case "striated":
        return (
          <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
            <line x1="1" y1="0" x2="1" y2="4" stroke={ink} strokeWidth="1" />
          </pattern>
        );
      case "liquid":
        return (
          <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
            <ellipse cx="3" cy="3" rx="2" ry="1.2" fill="rgba(255,255,255,0.28)" />
            <ellipse cx="8" cy="8" rx="1.6" ry="1" fill="rgba(255,255,255,0.2)" />
          </pattern>
        );
      default:
        return (
          <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill={c} />
          </pattern>
        );
    }
  };
  return <defs>{layers.map((l) => <g key={l.id}>{pat(`${prefix}-${l.id}`, l.pattern, l.color)}</g>)}</defs>;
}

function Badge({ x, y, n, active, onClick, label }: { x: number; y: number; n: number; active: boolean; onClick: () => void; label: string }) {
  return (
    <g role="button" aria-label={label} tabIndex={0} onClick={onClick} className="cursor-pointer" onKeyDown={(e) => e.key === "Enter" && onClick()}>
      <circle cx={x} cy={y} r="6.5" fill={active ? "#0f8a74" : "#ffffff"} stroke={active ? "#ffffff" : "#111a18"} strokeWidth="1.2" />
      <text x={x} y={y + 2.6} textAnchor="middle" fontSize="7.5" fontWeight="600" fill={active ? "#ffffff" : "#111a18"}>
        {n}
      </text>
    </g>
  );
}

/** Layered cross-section: concentric rings (tubes, round organs) or stacked strata (walls, skin). */
export function CrossSection({
  template,
  active,
  onSelect,
}: {
  template: DiveTemplate;
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const prefix = `cs-${template.key}`;
  const total = template.layers.reduce((s, l) => s + l.thickness, 0);
  const dim = (id: string) => (active && active !== id ? 0.45 : 1);

  if (template.shape === "rings") {
    const R = 62;
    // Cumulative thickness before each layer (outermost first).
    const before = template.layers.map((_, i) => template.layers.slice(0, i).reduce((s, l) => s + l.thickness, 0));
    const rings = template.layers.map((l, i) => {
      const outer = R - (before[i] / total) * R;
      const inner = i === template.layers.length - 1 ? 0 : R - ((before[i] + l.thickness) / total) * R;
      return { l, outer, inner };
    });
    return (
      <svg viewBox="0 0 200 140" className="w-full" role="img" aria-label={template.title}>
        <PatternDefs prefix={prefix} layers={template.layers} />
        {rings.map(({ l, outer }) => (
          <g key={l.id} onClick={() => onSelect(l.id)} className="cursor-pointer" opacity={dim(l.id)}>
            <circle cx="70" cy="70" r={outer} fill={l.color} stroke="#ffffff" strokeWidth="0.8" />
            {l.pattern !== "solid" && <circle cx="70" cy="70" r={outer} fill={`url(#${prefix}-${l.id})`} />}
            {active === l.id && <circle cx="70" cy="70" r={outer - 0.6} fill="none" stroke="#0f8a74" strokeWidth="1.4" />}
          </g>
        ))}
        {rings.map(({ l, outer, inner }, i) => {
          const r = (outer + inner) / 2;
          const a = (-35 + i * 18) * (Math.PI / 180);
          const x = 70 + r * Math.cos(a);
          const y = 70 + r * Math.sin(a);
          return (
            <g key={`${l.id}-label`}>
              <line x1={x} y1={y} x2="146" y2={20 + i * 22} stroke="#97a29e" strokeWidth="0.5" />
              <Badge x={146} y={20 + i * 22} n={i + 1} active={active === l.id} onClick={() => onSelect(l.id)} label={l.name} />
              <text x="156" y={22.5 + i * 22} fontSize="7" fill="#33413e">
                {l.name.length > 18 ? `${l.name.slice(0, 17)}…` : l.name}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const bands = template.layers.map((l, i) => {
    const before = template.layers.slice(0, i).reduce((s, x) => s + x.thickness, 0);
    return { l, y: 10 + (before / total) * 120, h: (l.thickness / total) * 120 };
  });
  return (
    <svg viewBox="0 0 200 140" className="w-full" role="img" aria-label={template.title}>
      <PatternDefs prefix={prefix} layers={template.layers} />
      {bands.map(({ l, y: by, h }) => (
        <g key={l.id} onClick={() => onSelect(l.id)} className="cursor-pointer" opacity={dim(l.id)}>
          <rect x="10" y={by} width="130" height={h} fill={l.color} />
          {l.pattern !== "solid" && <rect x="10" y={by} width="130" height={h} fill={`url(#${prefix}-${l.id})`} />}
          {active === l.id && <rect x="10.7" y={by + 0.7} width="128.6" height={h - 1.4} fill="none" stroke="#0f8a74" strokeWidth="1.4" />}
        </g>
      ))}
      {bands.map(({ l, y: by, h }, i) => (
        <g key={`${l.id}-label`}>
          <line x1="140" y1={by + h / 2} x2="146" y2={by + h / 2} stroke="#97a29e" strokeWidth="0.5" />
          <Badge x={152} y={by + h / 2} n={i + 1} active={active === l.id} onClick={() => onSelect(l.id)} label={l.name} />
          <text x="161" y={by + h / 2 + 2.5} fontSize="6.5" fill="#33413e">
            {l.name.length > 14 ? `${l.name.slice(0, 13)}…` : l.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---- Micro-anatomy drawings ------------------------------------------------------------------------

const HOTSPOTS: Record<MicroScene, Record<string, [number, number]>> = {
  osteon: { canal: [100, 70], lamellae: [100, 38], osteocyte: [127, 56], canaliculi: [72, 96], volkmann: [178, 70] },
  muscle: { zline: [100, 96], actin: [32, 72], myosin: [60, 96], mito: [150, 26], nucleus: [42, 14] },
  cardiac: { cardiomyocyte: [55, 38], disc: [100, 38], nucleus: [148, 38], capillary: [100, 72] },
  artery: { endothelium: [60, 89], elastic: [130, 36], smooth: [85, 62], rbc: [110, 118] },
  vein: { valve: [100, 70], wall: [40, 16], flow: [168, 70] },
  nerve: { axon: [65, 70], myelin: [35, 70], node: [125, 70], schwann: [95, 52] },
  gastric: { pit: [100, 36], mucous: [40, 56], parietal: [100, 88], chief: [160, 120] },
  villi: { villus: [47, 30], enterocyte: [66, 62], goblet: [103, 72], lacteal: [157, 60], crypt: [112, 126] },
  lobule: { central: [100, 70], hepatocyte: [126, 52], sinusoid: [76, 56], triad: [158, 70] },
  alveoli: { alveolus: [70, 60], capillary: [118, 42], type1: [150, 88], type2: [96, 104], macrophage: [52, 102] },
  airway: { cilia: [60, 16], goblet: [100, 62], basal: [140, 98], cartilage: [100, 126] },
  nephron: { glomerulus: [40, 40], bowman: [22, 58], proximal: [100, 26], henle: [120, 120], collecting: [182, 76] },
  bladder: { umbrella: [100, 24], intermediate: [70, 66], basal: [130, 100] },
  skin: { follicle: [60, 70], sebaceous: [82, 58], sweat: [150, 112], capillary: [120, 36], melanocyte: [36, 30] },
  neuron: { soma: [70, 62], dendrite: [28, 36], axon: [125, 62], synapse: [178, 86], astrocyte: [150, 22] },
  retina: { rod: [60, 96], cone: [118, 102], bipolar: [90, 58], ganglion: [130, 28], pigment: [100, 128] },
  tooth: { prism: [50, 70], tubules: [140, 70], odontoblast: [188, 40] },
  cartilage: { chondrocyte: [68, 50], lacuna: [132, 92], matrix: [100, 20] },
  ligament: { collagen: [60, 40], fibroblast: [130, 86] },
  gland: { unit: [60, 50], secretory: [132, 44], capillary: [100, 104] },
};

function Drawing({ scene }: { scene: MicroScene }) {
  switch (scene) {
    case "osteon": {
      const osteon = (cx: number, cy: number, n: number) => (
        <g>
          {range(n).map((i) => (
            <circle key={i} cx={cx} cy={cy} r={12 + i * 6} fill="none" stroke="#c9b27f" strokeWidth="1.1" />
          ))}
          <circle cx={cx} cy={cy} r="8" fill="#c0504a" />
          <circle cx={cx} cy={cy} r="3" fill="#7a2622" />
          {range(n * 4).map((i) => {
            const r = 15 + (i % n) * 6;
            const a = i * 1.9;
            const x = cx + r * Math.cos(a);
            const y = cy + r * Math.sin(a);
            return (
              <g key={`l${i}`}>
                <ellipse cx={x} cy={y} rx="2.2" ry="1.2" fill="#8a6a3a" transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} />
                <line x1={x} y1={y} x2={cx + (r + 3) * Math.cos(a + 0.12)} y2={cy + (r + 3) * Math.sin(a + 0.12)} stroke="#8a6a3a" strokeWidth="0.3" />
              </g>
            );
          })}
        </g>
      );
      return (
        <>
          <rect width="200" height="140" fill="#f1e6cc" />
          {osteon(18, 18, 4)}
          {osteon(190, 130, 4)}
          {osteon(100, 70, 7)}
          <rect x="146" y="66" width="54" height="8" fill="#c98b7f" />
        </>
      );
    }
    case "muscle":
      return (
        <>
          <rect width="200" height="140" fill="#fbeeee" />
          <rect x="0" y="4" width="200" height="40" rx="8" fill="#c85a50" />
          {range(40).map((i) => (
            <line key={i} x1={i * 5} y1="6" x2={i * 5} y2="42" stroke={i % 2 ? "#a4433b" : "#e08b80"} strokeWidth="1.6" />
          ))}
          {[20, 70, 130, 180].map((x) => (
            <ellipse key={x} cx={x + 22} cy="8" rx="7" ry="2.6" fill="#5b2a57" />
          ))}
          {[150, 60].map((x) => (
            <ellipse key={x} cx={x} cy="26" rx="8" ry="3.5" fill="#e9b7a0" stroke="#8a3c2d" strokeWidth="0.6" />
          ))}
          {[20, 100, 180].map((x) => (
            <rect key={x} x={x - 1.5} y="58" width="3" height="76" fill="#3f1d1a" />
          ))}
          {range(6).map((r) => (
            <g key={r}>
              {[20, 100, 180].map((x) => (
                <g key={x}>
                  <line x1={x} y1={64 + r * 12} x2={x + 42} y2={64 + r * 12} stroke="#e07a6c" strokeWidth="1.2" />
                  <line x1={x} y1={64 + r * 12} x2={x - 42} y2={64 + r * 12} stroke="#e07a6c" strokeWidth="1.2" />
                </g>
              ))}
              {r < 5 && [60, 140].map((x) => <rect key={x} x={x - 22} y={67 + r * 12} width="44" height="5" rx="2.5" fill="#7d2f5a" />)}
            </g>
          ))}
        </>
      );
    case "cardiac":
      return (
        <>
          <rect width="200" height="140" fill="#fbeeee" />
          {[20, 104].map((y) => (
            <g key={y}>
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <rect x={8 + i * 48} y={y} width="44" height="36" rx="10" fill="#b8453d" />
                  {range(8).map((k) => (
                    <line key={k} x1={14 + i * 48 + k * 5} y1={y + 4} x2={14 + i * 48 + k * 5} y2={y + 32} stroke="#9a3530" strokeWidth="1" />
                  ))}
                  <ellipse cx={30 + i * 48} cy={y + 18} rx="6" ry="3.4" fill="#5b2a57" />
                  <path d={`M${52 + i * 48} ${y + 4} l3 5 l-3 5 l3 5 l-3 5 l3 5 l-3 5`} stroke="#2b0f0e" strokeWidth="1.6" fill="none" />
                </g>
              ))}
              <path d={`M ${56} ${y + 36} q 10 12 22 ${y === 20 ? 12 : -12}`} stroke="#b8453d" strokeWidth="10" fill="none" />
            </g>
          ))}
          <path d="M0 72 C40 62 80 82 120 70 S180 66 200 74" stroke="#d1343a" strokeWidth="7" fill="none" />
          {range(9).map((i) => (
            <ellipse key={i} cx={12 + i * 22} cy={71 + Math.sin(i) * 3} rx="3.2" ry="2" fill="#f07c7c" />
          ))}
        </>
      );
    case "artery":
      return (
        <>
          <rect width="200" height="36" fill="#ecd8b8" />
          {range(20).map((i) => (
            <path key={i} d={`M${i * 11} 4 q 6 14 0 28`} stroke="#c9ad83" strokeWidth="0.9" fill="none" />
          ))}
          <rect y="36" width="200" height="50" fill="#d4736b" />
          {range(4).map((r) => (
            <path key={r} d={`M0 ${44 + r * 11} ${range(20).map(() => "q 5 -4 10 0").join(" ")}`} stroke="#f3d7a8" strokeWidth="1.1" fill="none" />
          ))}
          {range(18).map((i) => (
            <ellipse key={`s${i}`} cx={8 + i * 11} cy={50 + (i % 3) * 11} rx="5.5" ry="1.8" fill="#a8453f" />
          ))}
          <rect y="86" width="200" height="6" fill="#f0c4bf" />
          {range(14).map((i) => (
            <ellipse key={`e${i}`} cx={8 + i * 14.5} cy="89" rx="6" ry="1.6" fill="#d98f88" />
          ))}
          <rect y="92" width="200" height="48" fill="#f5d8d4" />
          {range(9).map((i) => (
            <g key={`r${i}`}>
              <ellipse cx={12 + i * 22} cy={108 + (i % 2) * 14} rx="8" ry="5" fill="#c8202a" />
              <ellipse cx={12 + i * 22} cy={108 + (i % 2) * 14} rx="3.2" ry="2" fill="#9c1820" />
            </g>
          ))}
        </>
      );
    case "vein":
      return (
        <>
          <rect width="200" height="140" fill="#f3eef6" />
          <rect y="8" width="200" height="16" fill="#a58fb4" />
          <rect y="116" width="200" height="16" fill="#a58fb4" />
          <rect y="24" width="200" height="92" fill="#8e3a4a" />
          <path d="M70 24 Q112 44 104 68" stroke="#e4d9ee" strokeWidth="4" fill="none" />
          <path d="M70 116 Q112 96 104 72" stroke="#e4d9ee" strokeWidth="4" fill="none" />
          {[150, 172].map((x) => (
            <path key={x} d={`M${x - 12} 70 h24 m-7 -6 l7 6 l-7 6`} stroke="#ffffff" strokeWidth="2" fill="none" />
          ))}
        </>
      );
    case "nerve":
      return (
        <>
          <rect width="200" height="140" fill="#fbf6ea" />
          <rect x="0" y="66" width="200" height="8" fill="#9a8f84" />
          {[10, 70, 130].map((x) => (
            <g key={x}>
              <rect x={x} y="54" width="50" height="32" rx="14" fill="#f4ecd2" stroke="#d8c690" strokeWidth="1" />
              {range(4).map((i) => (
                <rect key={i} x={x + 4 + i * 2} y={58 + i * 2} width={42 - i * 4} height={24 - i * 4} rx={11 - i * 2} fill="none" stroke="#e1d3a2" strokeWidth="0.6" />
              ))}
            </g>
          ))}
          <ellipse cx="95" cy="54" rx="9" ry="4" fill="#8f7fb0" />
        </>
      );
    case "gastric":
      return (
        <>
          <rect width="200" height="140" fill="#f6e1d8" />
          <path d="M0 20 H30 Q40 60 50 20 H90 Q100 60 110 20 H150 Q160 60 170 20 H200" stroke="#e59a82" strokeWidth="8" fill="none" />
          {[40, 100, 160].map((x) => (
            <g key={x}>
              <rect x={x - 7} y="56" width="14" height="80" rx="7" fill="#f3cbbd" />
              {range(3).map((i) => <circle key={`m${i}`} cx={x + (i % 2 ? 6 : -6)} cy={58 + i * 5} r="3" fill="#fbf4f0" stroke="#d9a18f" strokeWidth="0.5" />)}
              {range(4).map((i) => <circle key={`p${i}`} cx={x + (i % 2 ? 7 : -7)} cy={74 + i * 8} r="4.5" fill="#f07c9a" />)}
              {range(3).map((i) => <circle key={`c${i}`} cx={x + (i % 2 ? 6 : -6)} cy={110 + i * 8} r="3.6" fill="#8e5bb5" />)}
            </g>
          ))}
        </>
      );
    case "villi":
      return (
        <>
          <rect width="200" height="140" fill="#fbeee6" />
          <rect y="120" width="200" height="20" fill="#f2d6bb" />
          {[30, 85, 140].map((x) => (
            <g key={x}>
              <rect x={x} y="18" width="34" height="104" rx="17" fill="#eaa18c" />
              <rect x={x + 3} y="21" width="28" height="98" rx="14" fill="#f6cbbd" />
              {range(6).map((i) => (
                <path key={i} d={`M${x + 8} ${34 + i * 14} q9 -6 18 0`} stroke="#d1343a" strokeWidth="0.9" fill="none" />
              ))}
              <rect x={x + 15} y="30" width="4" height="86" rx="2" fill="#fffaf2" />
              {[46, 76, 100].map((y) => <ellipse key={y} cx={x + 2} cy={y} rx="2.4" ry="4" fill="#ffffff" stroke="#d9a18f" strokeWidth="0.5" />)}
            </g>
          ))}
          {[72, 127].map((x) => <path key={x} d={`M${x - 6} 120 q6 16 12 0`} stroke="#eaa18c" strokeWidth="3" fill="none" />)}
        </>
      );
    case "lobule": {
      const hex = range(6).map((i) => {
        const a = (Math.PI / 3) * i;
        return [100 + 62 * Math.cos(a), 70 + 62 * Math.sin(a)] as const;
      });
      return (
        <>
          <rect width="200" height="140" fill="#f5e4dc" />
          <polygon points={hex.map((p) => p.join(",")).join(" ")} fill="#a4503f" stroke="#e8d6cf" strokeWidth="2" />
          {range(18).map((i) => {
            const a = (Math.PI / 9) * i;
            return (
              <g key={i}>
                <line x1={100 + 10 * Math.cos(a)} y1={70 + 10 * Math.sin(a)} x2={100 + 56 * Math.cos(a)} y2={70 + 56 * Math.sin(a)} stroke="#7a3328" strokeWidth="3.4" />
                <line x1={100 + 10 * Math.cos(a + 0.17)} y1={70 + 10 * Math.sin(a + 0.17)} x2={100 + 55 * Math.cos(a + 0.17)} y2={70 + 55 * Math.sin(a + 0.17)} stroke="#e0717a" strokeWidth="0.8" />
              </g>
            );
          })}
          <circle cx="100" cy="70" r="9" fill="#4a5f9e" />
          {hex.map(([x, y], i) => (
            <g key={`t${i}`}>
              <circle cx={x - 3} cy={y} r="3.4" fill="#3b5bab" />
              <circle cx={x + 3} cy={y - 2} r="2" fill="#d1343a" />
              <circle cx={x + 2} cy={y + 3} r="1.8" fill="#4d9a52" />
            </g>
          ))}
        </>
      );
    }
    case "alveoli":
      return (
        <>
          <rect width="200" height="140" fill="#fbf1f1" />
          <path d="M0 62 H40" stroke="#e7a9ab" strokeWidth="12" />
          {[
            [70, 60],
            [100, 40],
            [118, 72],
            [92, 100],
            [140, 44],
            [150, 92],
            [60, 100],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="20" fill="#fff7f6" stroke="#e7a9ab" strokeWidth="2.4" />
              <path d={`M${x - 20} ${y} q10 -12 20 -20 q10 8 20 20`} stroke={i % 2 ? "#d1343a" : "#4a6fb0"} strokeWidth="1" fill="none" />
            </g>
          ))}
          {[
            [96, 104],
            [118, 92],
            [72, 42],
          ].map(([x, y], i) => (
            <rect key={i} x={x - 3} y={y - 3} width="6" height="6" rx="1" fill="#c96e8a" />
          ))}
          <path d="M44 100 q6 -8 12 -2 q6 8 -2 12 q-8 4 -10 -10" fill="#9a7a5a" />
        </>
      );
    case "airway":
      return (
        <>
          <rect width="200" height="140" fill="#fbf2ef" />
          {range(20).map((i) => (
            <g key={i}>
              <rect x={i * 10 + 1} y="26" width="8" height="70" rx="3" fill={i % 5 === 2 ? "#ffffff" : "#eab3aa"} stroke="#d7948a" strokeWidth="0.5" />
              <ellipse cx={i * 10 + 5} cy="72" rx="2.6" ry="3.6" fill="#6b3b6e" />
              {i % 5 !== 2 && range(4).map((k) => <line key={k} x1={i * 10 + 2 + k * 2} y1="26" x2={i * 10 + 3 + k * 2} y2="14" stroke="#b8726a" strokeWidth="0.6" />)}
            </g>
          ))}
          {range(20).map((i) => <circle key={`b${i}`} cx={i * 10 + 5} cy="98" r="2.4" fill="#9a5d8e" />)}
          <rect y="112" width="200" height="28" fill="#d9e6ea" />
          {range(8).map((i) => <ellipse key={`c${i}`} cx={14 + i * 25} cy={124 + (i % 2) * 6} rx="4" ry="3" fill="#8fb4c2" />)}
        </>
      );
    case "nephron":
      return (
        <>
          <rect width="200" height="140" fill="#fbefec" />
          <path d="M22 40 a20 20 0 1 0 36 -10" stroke="#e8c9b8" strokeWidth="6" fill="none" />
          {range(6).map((i) => <circle key={i} cx={36 + (i % 3) * 5} cy={34 + Math.floor(i / 3) * 7} r="5" fill="none" stroke="#d1343a" strokeWidth="1.6" />)}
          <path d="M58 28 C70 10 84 40 96 22 S120 36 130 24 S150 36 150 50 V124 Q140 136 130 124 V70 Q128 56 150 56 L166 58" stroke="#e59a82" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M182 10 V134" stroke="#c9a08e" strokeWidth="9" strokeLinecap="round" />
          <path d="M166 58 H178" stroke="#e59a82" strokeWidth="6" />
        </>
      );
    case "bladder":
      return (
        <>
          <rect width="200" height="140" fill="#fbefec" />
          {range(7).map((i) => (
            <g key={i}>
              <path d={`M${i * 30} 40 Q${i * 30 + 15} 6 ${i * 30 + 30} 40 Z`} fill="#ecb5a8" stroke="#d48f80" strokeWidth="0.8" />
              <ellipse cx={i * 30 + 10} cy="28" rx="3" ry="2.4" fill="#6b3b6e" />
              <ellipse cx={i * 30 + 20} cy="28" rx="3" ry="2.4" fill="#6b3b6e" />
            </g>
          ))}
          {range(3).map((r) =>
            range(10).map((i) => (
              <g key={`${r}-${i}`}>
                <rect x={i * 20 + (r % 2) * 10 - 5} y={42 + r * 16} width="19" height="15" rx="4" fill="#f3cabe" stroke="#d9a18f" strokeWidth="0.5" />
                <circle cx={i * 20 + (r % 2) * 10 + 4} cy={49 + r * 16} r="2.4" fill="#6b3b6e" />
              </g>
            )),
          )}
          {range(20).map((i) => <circle key={`b${i}`} cx={i * 10 + 5} cy="98" r="3.4" fill="#9a5d8e" />)}
          <rect y="104" width="200" height="36" fill="#f1d6c3" />
        </>
      );
    case "skin":
      return (
        <>
          <rect width="200" height="140" fill="#f3d5c8" />
          <path d="M0 10 H200 V30 Q180 38 160 30 T120 30 T80 30 T40 30 T0 30 Z" fill="#f0c7a6" />
          <rect width="200" height="4" y="10" fill="#e3b48f" />
          <rect y="100" width="200" height="40" fill="#f6e1a3" />
          {range(12).map((i) => <circle key={i} cx={10 + i * 17} cy={112 + (i % 2) * 12} r="8" fill="#f9eab7" stroke="#e8cc7e" strokeWidth="0.6" />)}
          <path d="M44 10 L64 96" stroke="#c78f6b" strokeWidth="10" strokeLinecap="round" />
          <path d="M44 0 L64 96" stroke="#3a2a22" strokeWidth="2.4" />
          <ellipse cx="80" cy="60" rx="9" ry="6" fill="#f6d27a" stroke="#d8ae4e" strokeWidth="0.6" />
          <path d="M150 12 V96 m0 0 c-10 4 -10 12 0 14 c10 2 10 10 0 12 c-10 2 -8 10 2 10" stroke="#8fb4c2" strokeWidth="3" fill="none" />
          {[100, 124, 176].map((x) => <path key={x} d={`M${x - 8} 48 q8 -26 16 0`} stroke="#d1343a" strokeWidth="1.4" fill="none" />)}
          <path d="M36 30 l-4 -4 m4 4 l4 -5 m-4 5 l-5 2 m5 -2 l5 2" stroke="#5a3a33" strokeWidth="1.2" />
        </>
      );
    case "neuron":
      return (
        <>
          <rect width="200" height="140" fill="#f5f0ec" />
          {[
            "M62 56 L30 36 L18 22",
            "M30 36 L14 40",
            "M60 66 L26 76 L12 92",
            "M26 76 L18 70",
            "M70 52 L64 20 L54 8",
            "M64 20 L76 10",
          ].map((d, i) => (
            <path key={i} d={d} stroke="#c9a79d" strokeWidth={i % 2 ? 1.8 : 3} fill="none" strokeLinecap="round" />
          ))}
          <path d="M56 50 L84 58 L66 78 Z" fill="#c9a79d" stroke="#a88478" strokeWidth="1" />
          <circle cx="68" cy="62" r="5" fill="#6b3b6e" />
          <path d="M84 62 H172" stroke="#b39085" strokeWidth="2.6" />
          {[96, 124, 152].map((x) => <rect key={x} x={x} y="56" width="22" height="12" rx="6" fill="#efe6da" stroke="#d6c8b4" strokeWidth="0.8" />)}
          <path d="M172 62 L176 80 M172 62 L184 76" stroke="#b39085" strokeWidth="2" />
          <circle cx="177" cy="84" r="4" fill="#b39085" />
          <circle cx="186" cy="80" r="4" fill="#b39085" />
          <path d="M170 100 Q182 90 196 98" stroke="#c9a79d" strokeWidth="3" fill="none" />
          <g transform="translate(150 22)">
            {range(8).map((i) => (
              <line key={i} x1="0" y1="0" x2={14 * Math.cos((i * Math.PI) / 4)} y2={14 * Math.sin((i * Math.PI) / 4)} stroke="#8fa6b8" strokeWidth="1.6" />
            ))}
            <circle r="4" fill="#8fa6b8" />
          </g>
        </>
      );
    case "retina":
      return (
        <>
          <rect width="200" height="140" fill="#fbf3ee" />
          <path d="M100 0 V14 m-5 -6 l5 6 l5 -6" stroke="#e1b43a" strokeWidth="2" fill="none" />
          {range(9).map((i) => <circle key={`g${i}`} cx={14 + i * 22} cy="28" r="6" fill="#d9a88c" stroke="#b98468" strokeWidth="0.6" />)}
          {range(12).map((i) => (
            <g key={`b${i}`}>
              <ellipse cx={10 + i * 16} cy="58" rx="4" ry="6" fill="#e3b8a0" />
              <line x1={10 + i * 16} y1="52" x2={10 + i * 16} y2="34" stroke="#c99a82" strokeWidth="0.8" />
              <line x1={10 + i * 16} y1="64" x2={10 + i * 16} y2="76" stroke="#c99a82" strokeWidth="0.8" />
            </g>
          ))}
          {range(24).map((i) =>
            i % 4 === 2 ? (
              <path key={`c${i}`} d={`M${6 + i * 8} 118 V96 L${10 + i * 8} 86 L${14 + i * 8} 96 V118 Z`} fill="#e9a55f" />
            ) : (
              <rect key={`r${i}`} x={7 + i * 8} y="78" width="6" height="40" rx="2" fill="#c97a6a" />
            ),
          )}
          <rect y="120" width="200" height="20" fill="#4f332c" />
        </>
      );
    case "tooth":
      return (
        <>
          <rect width="100" height="140" fill="#f7f8f4" />
          {range(10).map((r) =>
            range(7).map((c) => (
              <path
                key={`${r}-${c}`}
                d={`M${6 + c * 13 + (r % 2) * 6} ${8 + r * 13} q6 -6 12 0 v8 h-12 z`}
                fill="#eef0ea"
                stroke="#c9ccc2"
                strokeWidth="0.7"
              />
            )),
          )}
          <rect x="100" width="100" height="140" fill="#efe0b4" />
          {range(12).map((i) => (
            <path key={i} d={`M102 ${8 + i * 11} C130 ${2 + i * 11} 160 ${14 + i * 11} 180 ${8 + i * 11}`} stroke="#c9b27f" strokeWidth="1" fill="none" />
          ))}
          <rect x="180" width="20" height="140" fill="#d77d74" />
          {range(10).map((i) => <ellipse key={i} cx="186" cy={10 + i * 13} rx="4" ry="5.5" fill="#f0b2a8" stroke="#b9645c" strokeWidth="0.5" />)}
        </>
      );
    case "cartilage":
      return (
        <>
          <rect width="200" height="140" fill="#d7e7ea" />
          {[
            [40, 40, 2],
            [68, 50, 2],
            [120, 36, 4],
            [160, 60, 2],
            [60, 100, 4],
            [132, 92, 2],
            [176, 116, 2],
            [22, 118, 1],
          ].map(([x, y, n], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={n > 2 ? 14 : 11} ry="9" fill="#f5fafb" stroke="#a9c6cf" strokeWidth="0.8" />
              {range(n).map((k) => (
                <g key={k}>
                  <circle cx={x + (k % 2 ? 4 : -4)} cy={y + (k > 1 ? 3 : n > 2 ? -3 : 0)} r="3.4" fill="#b7d0d8" />
                  <circle cx={x + (k % 2 ? 4 : -4)} cy={y + (k > 1 ? 3 : n > 2 ? -3 : 0)} r="1.3" fill="#5a6f9e" />
                </g>
              ))}
            </g>
          ))}
        </>
      );
    case "ligament":
      return (
        <>
          <rect width="200" height="140" fill="#efece4" />
          {range(16).map((i) => (
            <path key={i} d={`M0 ${8 + i * 8} ${range(10).map(() => "q10 -3 20 0").join(" ")}`} stroke="#d8d2bb" strokeWidth="3" fill="none" />
          ))}
          {range(4).map((r) =>
            range(6).map((c) => <ellipse key={`${r}-${c}`} cx={16 + c * 34 + (r % 2) * 17} cy={24 + r * 32} rx="9" ry="1.8" fill="#6b5a86" />),
          )}
        </>
      );
    case "gland":
      return (
        <>
          <rect width="200" height="140" fill="#f6e4dd" />
          {[
            [60, 50, 26],
            [132, 44, 22],
            [40, 108, 18],
            [104, 104, 20],
            [168, 104, 20],
          ].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#f4b3b8" />
              {range(14).map((k) => {
                const a = (k / 14) * Math.PI * 2;
                return <circle key={k} cx={x + (r - 3) * Math.cos(a)} cy={y + (r - 3) * Math.sin(a)} r="3.6" fill="#d99b85" stroke="#b97660" strokeWidth="0.4" />;
              })}
              <circle cx={x} cy={y} r={r - 8} fill="#f7c6ca" />
            </g>
          ))}
          <path d="M0 80 C50 70 150 90 200 76" stroke="#d1343a" strokeWidth="2.6" fill="none" />
        </>
      );
  }
}

export function MicroView({
  template,
  active,
  onSelect,
}: {
  template: DiveTemplate;
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const spots = HOTSPOTS[template.key];
  return (
    <svg viewBox="0 0 200 140" className="w-full overflow-hidden rounded-md" role="img" aria-label={template.microTitle}>
      <Drawing scene={template.key} />
      {template.micro.map((m, i) => {
        const p = spots[m.id];
        if (!p) return null;
        return <Badge key={m.id} x={p[0]} y={p[1]} n={i + 1} active={active === m.id} onClick={() => onSelect(m.id)} label={m.name} />;
      })}
    </svg>
  );
}
