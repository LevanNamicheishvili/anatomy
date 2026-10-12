"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Clock, Moon, Pause, Play, Sun } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { sceneFrame } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import { formatLat, latLonToVec3, vec3ToLatLon } from "../globe/coords";
import { AXIAL_TILT, meridian, parallel, SPECIAL_LINES } from "../globe/graticule";
import { GlobeScene } from "../globe/GlobeScene";
import { CITIES, cityOffset, clock, dateLabel, dayLength, dayShift, declination, noonAltitude, orbitAngle, TBILISI_UTC, TURNING_POINTS, utcLabel } from "./sun-math";

/*
 * Topic 3 — seasons, equinoxes and solstices, day and night, time zones. The sun stays put on the right;
 * the Earth (axis tilted 23,44°) turns with the clock and its axis swings round with the date, exactly as
 * it would look from a spaceship riding along the orbit. A night shade marks the terminator; 15° bands
 * show the time zones; four cities show their local time.
 */

const D = Math.PI / 180;
/** Where the sun sits in the scene (rotation of the base +x direction round the vertical). */
const SUN_YAW = -20 * D;
const SUN_DIR = new THREE.Vector3(Math.cos(SUN_YAW), 0, -Math.sin(SUN_YAW)).normalize();
const Y = new THREE.Vector3(0, 1, 0);

/** Earth's orientation for a day of the year and a UTC time (hours). */
function earthQuaternion(day: number, utc: number, out = new THREE.Quaternion()) {
  const a = SUN_YAW - orbitAngle(day) * D;
  const e = AXIAL_TILT * D;
  const axis = new THREE.Vector3(Math.sin(e) * Math.cos(a), Math.cos(e), -Math.sin(e) * Math.sin(a));
  const tilt = new THREE.Quaternion().setFromUnitVectors(Y, axis);
  const sunInTilted = SUN_DIR.clone().applyQuaternion(tilt.clone().invert());
  const target = -(utc - 12) * 15; // longitude where it is solar noon
  const spin = (vec3ToLatLon(sunInTilted).lon - target) * D;
  return out.copy(tilt).multiply(new THREE.Quaternion().setFromAxisAngle(Y, spin));
}

/** Night side: a shell just above the ground, dark where the surface faces away from the sun. */
function nightShade(radius: number) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      varying vec3 vN;
      void main() {
        float d = dot(normalize(vN), uSun);
        float night = 1.0 - smoothstep(-0.06, 0.06, d);
        float dusk = (1.0 - smoothstep(0.0, 0.1, abs(d))) * 0.35;
        vec3 col = mix(vec3(1.0, 0.55, 0.2), vec3(0.02, 0.04, 0.12), night);
        gl_FragColor = vec4(col, night * 0.62 + dusk);
      }`,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.003, 96, 64), material);
}

/** The day/night border: a great circle facing the sun. */
function terminatorRing(radius: number) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.006, radius * 0.004, 4, 180), new THREE.MeshBasicMaterial({ color: "#ffcf66" }));
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), SUN_DIR);
  return ring;
}

function sunMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), new THREE.MeshBasicMaterial({ color: "#ffd84d" })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 16), new THREE.MeshBasicMaterial({ color: "#ffe9a3", transparent: true, opacity: 0.28, depthWrite: false })));
  g.position.copy(SUN_DIR).multiplyScalar(9);
  // Parallel sunbeams towards the Earth.
  const beams = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: "#ffd84d", transparent: true, opacity: 0.55 });
  const side = new THREE.Vector3().crossVectors(SUN_DIR, Y).normalize();
  for (const o of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const off = side.clone().multiplyScalar(o).addScaledVector(Y, o * 0.4);
    beams.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([SUN_DIR.clone().multiplyScalar(7.4).add(off), SUN_DIR.clone().multiplyScalar(1.6).add(off)]), mat));
  }
  return { sun: g, beams };
}

/** Time-zone bands every 15° (boundaries at ±7,5°) and the band where it is noon now. */
function timeZones(radius: number) {
  const group = new THREE.Group();
  const line = new THREE.MeshBasicMaterial({ color: "#c4b5fd", transparent: true, opacity: 0.7, depthWrite: false });
  for (let k = 0; k < 24; k++) group.add(meridian(radius * 1.004, -172.5 + k * 15, radius * 0.0022, line));
  const band = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.005, 6, 48, 0, 15 * D),
    new THREE.MeshBasicMaterial({ color: "#ffd84d", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  );
  group.add(band);
  /** Highlight the zone whose centre meridian is `lon`. */
  const setNoon = (lon: number) => {
    band.rotation.y = (lon - 7.5 + 180) * D; // SphereGeometry starts at −180°
  };
  return { group, setNoon };
}

function axisAndLines(radius: number) {
  const g = new THREE.Group();
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.008, radius * 0.008, radius * 2.7, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  g.add(axis);
  for (const l of SPECIAL_LINES) {
    if (l.kind !== "parallel") continue;
    g.add(parallel(radius * 1.004, l.value, radius * 0.0035, new THREE.MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0.85 })));
  }
  return g;
}

const ZONES = Array.from({ length: 24 }, (_, k) => k - 11); // −11 … +12
const fmtHours = (h: number) => `${Math.floor(h)} სთ ${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")} წთ`;
const shiftLabel = (s: number) => (s > 0 ? " (ხვალ)" : s < 0 ? " (გუშინ)" : "");

/** Sun's height above the horizon for a city (degrees). */
function sunAltitude(lat: number, lon: number, decl: number, utc: number) {
  const h = (utc + lon / 15 - 12) * 15 * D;
  return Math.asin(Math.sin(lat * D) * Math.sin(decl * D) + Math.cos(lat * D) * Math.cos(decl * D) * Math.cos(h)) / D;
}

export function SeasonsGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ globe: GlobeScene; zones: ReturnType<typeof timeZones> } | null>(null);
  const [day, setDay] = useState(172);
  const [tbTime, setTbTime] = useState(16); // Tbilisi clock
  const [playing, setPlaying] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const utc = (((tbTime - TBILISI_UTC) % 24) + 24) % 24;
  const decl = declination(day);
  const tp = TURNING_POINTS.find((t) => Math.abs(t.day - day) < 1);
  const tbLen = dayLength(41.72, decl);
  const noonZone = ((Math.round(12 - utc) + 35) % 24) - 11; // zone where the clock shows 12:00 now (−11 … +12)

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const globe = new GlobeScene(canvas, { sun: SUN_DIR.clone() });
    globe.setSun(SUN_DIR.clone());
    const zones = timeZones(globe.radius);
    globe.earth.add(axisAndLines(globe.radius), zones.group);
    for (const c of CITIES) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: c.id === "tbilisi" ? "#ff3b30" : "#ffffff" }));
      latLonToVec3(c.lat, c.lon, globe.radius * 1.006, dot.position);
      globe.earth.add(dot);
    }
    const { sun, beams } = sunMesh();
    globe.scene.add(nightShade(globe.radius), terminatorRing(globe.radius), sun, beams);
    sceneRef.current = { globe, zones };
    // Start over the Caucasus and the Middle East, with the evening terminator in view on the right.
    earthQuaternion(172, 12, globe.earth.quaternion);
    globe.camera.position.copy(globe.position(28, 62)).setLength(3.6);

    const els = [...layer.querySelectorAll<HTMLElement>("[data-kind]")];
    const v = new THREE.Vector3();
    globe.onFrame = (project) => {
      const view = globe.viewCenter();
      for (const el of els) {
        const kind = el.dataset.kind;
        let lat = Number(el.dataset.lat);
        const lon = Number(el.dataset.lon);
        if (kind === "zone") lat = Math.max(-50, Math.min(50, view.lat - 18));
        if (kind === "pole") {
          // North end of the axis, above the pole.
          v.set(0, globe.radius * 1.42, 0);
          globe.earth.localToWorld(v);
          const p = v.project(globe.camera);
          el.style.transform = `translate(${((p.x + 1) / 2) * canvas.clientWidth}px, ${((1 - p.y) / 2) * canvas.clientHeight}px) translate(-50%, -50%)`;
          el.style.opacity = "1";
          continue;
        }
        if (kind === "sun") {
          v.copy(SUN_DIR).multiplyScalar(9).add(new THREE.Vector3(0, 1.3, 0)).project(globe.camera);
          el.style.transform = `translate(${((v.x + 1) / 2) * canvas.clientWidth}px, ${((1 - v.y) / 2) * canvas.clientHeight}px) translate(-50%, -50%)`;
          el.style.opacity = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 ? "1" : "0";
          continue;
        }
        const p = project(lat, lon, kind === "city" ? 0.03 : 0.01);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(${kind === "city" ? "8px, -50%" : "-50%, -50%"})`;
        el.style.opacity = p.visible ? "1" : "0";
      }
    };
    return () => {
      globe.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Orientation of the Earth for the chosen date and time.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    earthQuaternion(day, utc, s.globe.earth.quaternion);
    s.zones.setNoon(noonZone * 15);
  }, [day, utc, noonZone]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.zones.group.visible = showZones;
    labelsRef.current?.querySelectorAll<HTMLElement>("[data-kind=zone]").forEach((el) => el.classList.toggle("invisible", !showZones));
  }, [showZones]);

  // Play: the Earth turns, two hours a second.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTbTime((t) => (t + 0.1) % 24), 50);
    return () => window.clearInterval(id);
  }, [playing]);

  const goTo = (d: number) => setDay(d);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]", sceneFrame)}>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="დედამიწა, მზე, დღე და ღამე" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden">
          {ZONES.map((z) => (
            <span key={z} data-kind="zone" data-lat={0} data-lon={z * 15} className={cn("absolute top-0 left-0 rounded px-1 text-[10px] font-semibold whitespace-nowrap opacity-0", z === noonZone ? "bg-[#ffd84d] text-ink" : "text-[#ddd6fe] [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]")}>
              {z === 0 ? "0" : `${z > 0 ? "+" : "−"}${Math.abs(z)}`}
            </span>
          ))}
          {CITIES.map((c) => {
            const off = cityOffset(c, day);
            const alt = sunAltitude(c.lat, c.lon, decl, utc);
            return (
              <span key={c.id} data-kind="city" data-lat={c.lat} data-lon={c.lon} className="absolute top-0 left-0 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white opacity-0">
                {alt > 0 ? <Sun className="size-3 text-[#ffd84d]" /> : <Moon className="size-3 text-[#c7d2fe]" />}
                {c.name} <span className="tabular-nums">{clock(utc + off)}</span>
              </span>
            );
          })}
          <span data-kind="pole" className="absolute top-0 left-0 rounded bg-card/90 px-1.5 py-0.5 text-[11px] font-semibold text-ink opacity-0">
            ჩრდ. პოლუსი · ღერძი 23,44°
          </span>
          <span data-kind="sun" className="absolute top-0 left-0 rounded bg-[#ffd84d] px-1.5 py-0.5 text-[11px] font-semibold text-ink opacity-0">
            მზე
          </span>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-lg bg-card/92 px-3 py-2 text-sm shadow-sm">
          <p className="font-semibold">{tp ? tp.name : dateLabel(day)}</p>
          <p className="text-[13px] text-mute">
            მზე ზენიტშია: <b className="text-ink tabular-nums">{Math.abs(decl) < 0.05 ? "ეკვატორზე" : formatLat(decl).text}</b>
          </p>
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-pressed={playing} title={playing ? "გაჩერება" : "ბრუნვა"} className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", playing ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button type="button" onClick={() => setShowZones((s) => !s)} aria-pressed={showZones} title="საათის სარტყლები" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", showZones ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            <Clock className="size-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold">ბუნიობა და მზედგომა</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TURNING_POINTS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => goTo(t.day)}
                  aria-pressed={day === t.day}
                  className={cn("h-9 rounded-full px-3 text-sm", day === t.day ? "bg-[#2f6fb0] font-semibold text-white" : "bg-[#f1f4f3] text-copy hover:bg-[#e6ecea]")}
                >
                  {t.short}
                </button>
              ))}
            </div>
            <p className="mt-2 min-h-12 text-[15px] leading-7 text-copy">{tp ? tp.note : "გადაათრიე თარიღი — ნახე, როგორ ინაცვლებს ზენიტური მზე ტროპიკებს შორის და როგორ იცვლება დღის სიგრძე."}</p>
          </div>
          <LabeledSlider label="თარიღი" value={day} display={dateLabel(day)} min={1} max={365} onChange={setDay} color="#2f6fb0" />
          <LabeledSlider label="დრო თბილისში" value={tbTime} display={`${clock(tbTime)} · გრინვიჩით (UTC) ${clock(utc)}`} min={0} max={23.75} step={0.25} onChange={setTbTime} color="#2f6fb0" />
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { k: "დღის სიგრძე თბილისში", v: fmtHours(tbLen) },
              { k: "შუადღის მზე თბილისში", v: `${Math.round(noonAltitude(41.72, decl))}°` },
              { k: "ახლა შუადღეა სარტყელში", v: utcLabel(noonZone) },
            ].map((x) => (
              <div key={x.k} className="rounded-lg bg-subtle px-3 py-2.5">
                <dt className="text-[11px] leading-4 text-mute [overflow-wrap:anywhere]">{x.k}</dt>
                <dd className="mt-1 text-base leading-5 font-semibold tabular-nums">{x.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-3">
          <OrbitInset day={day} onPick={goTo} />
          <ul className="flex flex-col divide-y divide-chip rounded-lg border border-line text-sm">
            {CITIES.map((c) => {
              const off = cityOffset(c, day);
              const alt = sunAltitude(c.lat, c.lon, decl, utc);
              return (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  {alt > 0 ? <Sun className="size-4 shrink-0 text-[#c08a00]" /> : <Moon className="size-4 shrink-0 text-[#5b6bb5]" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-[11px] text-mute">
                      {utcLabel(off)}
                      {off !== c.utc ? " · ზაფხულის დრო" : ""}
                    </span>
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {clock(utc + off)}
                    <span className="block text-[10px] font-normal text-mute">{shiftLabel(dayShift(utc, off) - dayShift(utc, TBILISI_UTC)).trim() || (alt > 0 ? "დღეა" : "ღამეა")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">
        მოდელი გამარტივებულია: სარტყლები ნაჩვენებია „იდეალური“ 15°-იანი ზოლებით (ნამდვილი საზღვრები ქვეყნების საზღვრებს მიჰყვება); თარიღები ზუსტია ±1 დღით. დედამიწის სურათი: NASA Blue Marble.
      </p>
    </section>
  );
}

/** Top view of the orbit: the Sun in the middle, the Earth at the chosen date, the axis always leaning the same way. */
function OrbitInset({ day, onPick }: { day: number; onPick: (day: number) => void }) {
  const R = 62;
  const pos = (angle: number) => ({ x: 90 - R * Math.cos(angle * D), y: 80 + R * Math.sin(angle * D) * 0.55 });
  const now = pos(orbitAngle(day));
  return (
    <svg viewBox="0 0 180 160" className="w-full rounded-lg bg-[#0b1426]" role="img" aria-label="დედამიწის ორბიტა ზემოდან">
      <ellipse cx={90} cy={80} rx={R} ry={R * 0.55} fill="none" stroke="#3b4d6e" strokeDasharray="3 3" />
      <circle cx={90} cy={80} r={9} fill="#ffd84d" />
      {TURNING_POINTS.map((t) => {
        const p = pos(t.angle);
        return (
          <g key={t.id} className="cursor-pointer" onClick={() => onPick(t.day)}>
            <circle cx={p.x} cy={p.y} r={4} fill="#3b6fb0" />
            <line x1={p.x - 3} y1={p.y + 6} x2={p.x + 3} y2={p.y - 6} stroke="#fff" strokeWidth={1} />
            <text x={p.x} y={p.y + (t.angle === 90 ? 16 : t.angle === 270 ? -9 : 17)} textAnchor="middle" fontSize={8.5} fill="#cbd5e1">
              {t.short}
            </text>
          </g>
        );
      })}
      <circle cx={now.x} cy={now.y} r={6} fill="#4ea1ff" stroke="#fff" strokeWidth={1.5} />
      <text x={90} y={146} textAnchor="middle" fontSize={8.5} fill="#94a3b8">
        ორბიტა ზემოდან
      </text>
      <text x={90} y={157} textAnchor="middle" fontSize={8.5} fill="#94a3b8">
        ღერძის დახრა არ იცვლება
      </text>
    </svg>
  );
}
