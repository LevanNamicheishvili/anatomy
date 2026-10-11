"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { LabeledSlider, PillButton } from "@/components/portal/controls";
import { cn } from "@/lib/utils";

/*
 * Topic 10 — tides, simplified. Top view of the Earth with the Moon going round and the Sun far to the
 * left. The Moon's pull raises two bulges of water (one towards the Moon, one on the opposite side); the
 * Sun adds smaller ones. A coastal town turns with the Earth through both bulges: two high and two low
 * waters a day. When Sun and Moon line up (new and full moon) the tides are biggest.
 */

const D = Math.PI / 180;
const MONTH = 29.53;
const MOON = 1;
const SUN = 0.46;

/** Water height (relative, −1,5…1,5) at an angle on the Earth for a moon angle; the Sun is at 180°. */
const height = (phi: number, moon: number) => MOON * Math.cos(2 * (phi - moon) * D) + SUN * Math.cos(2 * (phi - 180) * D);
const moonAngle = (day: number) => 180 + (360 * day) / MONTH;
/** The town's angle: at hour 0 it faces away from the Sun (midnight). */
const townAngle = (hour: number) => (hour / 24) * 360;

const PHASES = [
  { name: "ახალმთვარე", day: 0 },
  { name: "პირველი მეოთხედი", day: 7.4 },
  { name: "სავსემთვარე", day: 14.8 },
  { name: "ბოლო მეოთხედი", day: 22.1 },
];

export function Tides() {
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(3);
  const [playing, setPlaying] = useState(false);
  const moon = moonAngle(day);
  const h = height(townAngle(hour), moon);
  const slope = height(townAngle(hour + 0.2), moon) - height(townAngle(hour - 0.2), moon);
  const state = Math.abs(slope) < 0.08 ? (h > 0 ? "მაღალი წყალი" : "დაბალი წყალი") : slope > 0 ? "მოქცევა — წყალი მატულობს" : "მიქცევა — წყალი იკლებს";
  const spring = Math.abs(Math.cos(2 * (moon - 180) * D)) > 0.7;
  const range = 2 * (MOON + SUN * Math.cos(2 * (moon - 180) * D));

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setHour((x) => (x + 0.08) % 24), 40);
    return () => window.clearInterval(id);
  }, [playing]);

  // Top view (y up on screen = 90°).
  const cx = 150;
  const cy = 130;
  const R = 46;
  const water = Array.from({ length: 121 }, (_, i) => {
    const a = i * 3;
    const r = R + 9 + 11 * height(a, moon);
    return `${(cx + r * Math.cos(a * D)).toFixed(1)},${(cy - r * Math.sin(a * D)).toFixed(1)}`;
  }).join(" ");
  const ta = townAngle(hour);
  const town = { x: cx + (R + 1) * Math.cos(ta * D), y: cy - (R + 1) * Math.sin(ta * D) };
  const mo = { x: cx + 105 * Math.cos(moon * D), y: cy - 105 * Math.sin(moon * D) };

  // Water level through the day at the town.
  const GW = 300;
  const GH = 120;
  const curve = Array.from({ length: 97 }, (_, i) => {
    const hh = i / 4;
    return `${(10 + (hh / 24) * (GW - 20)).toFixed(1)},${(GH / 2 - 30 * height(townAngle(hh), moon)).toFixed(1)}`;
  }).join(" ");

  return (
    <div className="px-5 py-4">
      <div className="grid gap-4 md:grid-cols-2">
        <svg viewBox="0 0 300 260" className="w-full rounded-lg bg-[#0b1426]" role="img" aria-label="დედამიწა, მთვარე და მიქცევა-მოქცევის ტალღები ზემოდან">
          <circle cx={cx} cy={cy} r={105} fill="none" stroke="#3b4d6e" strokeDasharray="3 4" />
          <circle cx={6} cy={cy} r={22} fill="#ffd84d" />
          <text x={8} y={cy + 38} fontSize={10} fill="#ffd84d">
            მზე
          </text>
          {[-30, 0, 30].map((o) => (
            <line key={o} x1={30} x2={80} y1={cy + o} y2={cy + o} stroke="#ffd84d" strokeOpacity={0.4} />
          ))}
          <polygon points={water} fill="#3b8fd0" opacity={0.85} />
          <circle cx={cx} cy={cy} r={R} fill="#3f7d4a" />
          {/* Night half (away from the Sun) */}
          <path d={`M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R} Z`} fill="#000" opacity={0.35} />
          <line x1={cx} y1={cy} x2={mo.x} y2={mo.y} stroke="#cbd5e1" strokeOpacity={0.35} strokeDasharray="2 3" />
          <circle cx={mo.x} cy={mo.y} r={10} fill="#e5e9f5" />
          <text x={mo.x} y={mo.y - 14} fontSize={10} textAnchor="middle" fill="#e5e9f5">
            მთვარე
          </text>
          <circle cx={town.x} cy={town.y} r={5} fill="#ff3b30" stroke="#fff" strokeWidth={1.5} />
          <text x={150} y={252} fontSize={10} textAnchor="middle" fill="#94a3b8">
            ზემოდან ხედი · ჩრდ. პოლუსიდან
          </text>
        </svg>

        <div className="flex flex-col gap-3">
          <svg viewBox={`0 0 ${GW} ${GH + 20}`} className="w-full rounded-lg bg-[#f5f7f6]" role="img" aria-label="წყლის დონე ნაპირზე დღის განმავლობაში">
            <line x1={10} x2={GW - 10} y1={GH / 2} y2={GH / 2} stroke="#c6d0cc" strokeDasharray="3 3" />
            <polyline points={curve} fill="none" stroke="#1f5f99" strokeWidth={2} />
            <line x1={10 + (hour / 24) * (GW - 20)} x2={10 + (hour / 24) * (GW - 20)} y1={4} y2={GH - 4} stroke="#ff3b30" />
            <circle cx={10 + (hour / 24) * (GW - 20)} cy={GH / 2 - 30 * h} r={4} fill="#ff3b30" />
            {[0, 6, 12, 18, 24].map((x) => (
              <text key={x} x={10 + (x / 24) * (GW - 20)} y={GH + 14} fontSize={9} textAnchor="middle" fill="#66736f">
                {x}:00
              </text>
            ))}
          </svg>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
              <p className="text-[11px] leading-4 text-[#66736f]">ახლა ნაპირზე (წითელი წერტილი)</p>
              <p className="mt-1 text-[15px] leading-5 font-semibold">{state}</p>
            </div>
            <div className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
              <p className="text-[11px] leading-4 text-[#66736f]">მოქცევის სიდიდე</p>
              <p className={cn("mt-1 text-[15px] leading-5 font-semibold", spring ? "text-[#b91c1c]" : "")}>
                {spring ? "დიდი (სიზიგიური)" : "მცირე (კვადრატურული)"} · ~{range.toFixed(1).replace(".", ",")} მ
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PHASES.map((p) => (
              <PillButton key={p.name} onClick={() => setDay(p.day)} pressed={Math.abs(day - p.day) < 0.3} color="#1f5f99">
                {p.name}
              </PillButton>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <LabeledSlider label="მთვარის ფაზა — დღე" value={day} display={`${day.toFixed(1).replace(".", ",")} / 29,5`} min={0} max={29.5} step={0.1} onChange={setDay} color="#1f5f99" />
        <div className="flex items-end gap-2">
          <LabeledSlider
            className="flex-1"
            label="დღე-ღამის საათი"
            value={hour}
            display={`${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.floor((hour % 1) * 60)).padStart(2, "0")}`}
            min={0}
            max={23.9}
            step={0.1}
            onChange={setHour}
            color="#1f5f99"
          />
          <PillButton onClick={() => setPlaying((p) => !p)} pressed={playing} color="#1f5f99" title={playing ? "გაჩერება" : "დედამიწის ბრუნვა"} aria-label={playing ? "გაჩერება" : "დედამიწის ბრუნვა"} icon={playing ? Pause : Play} className="mb-0.5" />
        </div>
      </div>
      <p className="mt-3 text-[15px] leading-7 text-[#33413e]">
        მთვარე წყალს თავისკენ „ექაჩება“ — ჩნდება ორი წყლის ამობურცულობა: მთვარისკენ და მის საპირისპიროდ. დედამიწა მათში ბრუნვისას გადის, ამიტომ დღე-ღამეში ორჯერ მოქცევაა (წყალი ნაპირზე ამოდის) და ორჯერ — მიქცევა (წყალი უკან იხევს), ~6 საათის ინტერვალით. შავ ზღვაში მოქცევა მხოლოდ რამდენიმე სანტიმეტრია, ფანდის ყურეში (კანადა) კი 16 მეტრს აღწევს.
      </p>
    </div>
  );
}
