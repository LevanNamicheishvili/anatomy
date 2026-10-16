"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Clock, Globe2, MountainSnow, Moon, Orbit, Pause, Play, Snowflake, Sun, TreePalm } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { formatLat, latLonToVec3 } from "../globe/coords";
import { AXIAL_TILT, meridian, parallel, SPECIAL_LINES } from "../globe/graticule";
import { GlobeScene } from "../globe/GlobeScene";
import { MapButton } from "../globe/MapButton";
import { SceneInset } from "../lesson/SceneInset";
import { SunAngleCard } from "../lesson/SunAngle";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { OrbitScene, orientEarth, type OrbitAnchor, type OrbitView } from "./OrbitScene";
import { SEASONS_CUES, type SeasonsLit, type SeasonsShot, type SeasonsView } from "./seasons-cues";
import { snowShells } from "./snow";
import { CITIES, cityOffset, cityTemp, clock, dateLabel, dayLength, dayShift, declination, monthOf, noonAltitude, orbitAngle, SEASON_NAMES, seasonOf, TBILISI_UTC, TURNING_POINTS, utcLabel, type City } from "./sun-math";

/*
 * Topic 3 — seasons, equinoxes and solstices, day and night, time zones. Two views. The globe: the sun stays put on
 * the right, the Earth (axis tilted 23,44°) turns with the clock and its axis swings round with the date, as seen
 * from a spaceship riding along the orbit; a night shade marks the terminator, 15° bands show the time zones, cities
 * show their local time and the month's weather, and the snow lies where it is winter. The orbit: the Sun in the
 * middle and the Earth going round it, lit half and dark half, the axis leaning the same way all year.
 */

const D = Math.PI / 180;
/** Where the sun sits in the scene (rotation of the base +x direction round the vertical). */
const SUN_YAW = -20 * D;
const SUN_DIR = new THREE.Vector3(Math.cos(SUN_YAW), 0, -Math.sin(SUN_YAW)).normalize();
const Y = new THREE.Vector3(0, 1, 0);

/** Earth's orientation for a day of the year and a UTC time (hours), the sun fixed at SUN_DIR. */
function earthQuaternion(day: number, utc: number, out = new THREE.Quaternion()) {
  const a = SUN_YAW - orbitAngle(day) * D;
  const e = AXIAL_TILT * D;
  return orientEarth(new THREE.Vector3(Math.sin(e) * Math.cos(a), Math.cos(e), -Math.sin(e) * Math.sin(a)), SUN_DIR, utc, out);
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

/** A soft, pulsing halo round a line or the axis: what the narration is talking about lights up. */
function halo(color: string) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
}

function axisAndLines(radius: number) {
  const g = new THREE.Group();
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.008, radius * 0.008, radius * 2.7, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const glows = new Map<string, THREE.Mesh>();
  const axisGlow = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.03, radius * 0.03, radius * 2.7, 12), halo("#ffffff"));
  axisGlow.visible = false;
  g.add(axis, axisGlow);
  glows.set("axis", axisGlow);
  for (const l of SPECIAL_LINES) {
    if (l.kind !== "parallel") continue;
    g.add(parallel(radius * 1.004, l.value, radius * 0.0035, new THREE.MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0.85 })));
    const glow = parallel(radius * 1.006, l.value, radius * 0.024, halo(l.color));
    glow.visible = false;
    g.add(glow);
    glows.set(l.id, glow);
  }
  return { group: g, glows };
}

const ZONES = Array.from({ length: 24 }, (_, k) => k - 11); // −11 … +12
const fmtHours = (h: number) => `${Math.floor(h)} სთ ${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")} წთ`;
const shiftLabel = (s: number) => (s > 0 ? " (ხვალ)" : s < 0 ? " (გუშინ)" : "");
const ORBIT_VIEWS: Partial<Record<SeasonsView, OrbitView>> = { orbit: "overview", "orbit-top": "top", "orbit-near": "near" };
const ORBIT_BUTTONS: { view: OrbitView; name: string }[] = [
  { view: "overview", name: "მთელი ორბიტა" },
  { view: "top", name: "ზემოდან" },
  { view: "near", name: "დედამიწასთან" },
];

/** Sun's height above the horizon for a city (degrees). */
function sunAltitude(lat: number, lon: number, decl: number, utc: number) {
  const h = (utc + lon / 15 - 12) * 15 * D;
  return Math.asin(Math.sin(lat * D) * Math.sin(decl * D) + Math.cos(lat * D) * Math.cos(decl * D) * Math.cos(h)) / D;
}

/** The month's weather in a city, as a forecast shows it: snowflake when it is cold, sun when it is hot. */
function Weather({ c, day }: { c: City; day: number }) {
  const t = c.temps[monthOf(day)];
  return (
    <span className={cn("ml-0.5 flex items-center gap-0.5 rounded px-1 tabular-nums", t <= 5 ? "bg-[#cfe8ff] text-[#0b3a66]" : t >= 20 ? "bg-[#ffcf8a] text-[#6b2d00]" : "bg-white/20 text-white")}>
      {t <= 5 ? <Snowflake className="size-3" /> : t >= 20 ? <Sun className="size-3" /> : null}
      {cityTemp(c, day)}
    </span>
  );
}

export function SeasonsGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbitCanvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const orbitLabelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ globe: GlobeScene; zones: ReturnType<typeof timeZones>; glows: Map<string, THREE.Mesh>; side: THREE.Vector3; snowDay: (day: number) => void } | null>(null);
  const orbitRef = useRef<OrbitScene | null>(null);
  const [day, setDay] = useState(172);
  const [tbTime, setTbTime] = useState(16); // Tbilisi clock
  const [playing, setPlaying] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [map, setMap] = useState(true);
  /** The globe, or the Sun with the Earth's orbit. */
  const [mode, setMode] = useState<"globe" | "orbit">("globe");
  const [orbitView, setOrbitView] = useState<OrbitView>("overview");
  const utc = (((tbTime - TBILISI_UTC) % 24) + 24) % 24;
  const decl = declination(day);
  const tp = TURNING_POINTS.find((t) => Math.abs(t.day - day) < 1);
  const tbLen = dayLength(41.72, decl);
  const noonZone = ((Math.round(12 - utc) + 35) % 24) - 11; // zone where the clock shows 12:00 now (−11 … +12)
  const [lit, setLit] = useState<SeasonsLit | null>(null);
  const [yearRun, setYearRun] = useState(false);
  /** The teacher runs the year in the orbit view (the play button). */
  const [yearPlay, setYearPlay] = useState(false);
  const [extra, setExtra] = useState<Pick<SeasonsShot, "beams" | "card">>({ beams: null, card: null });

  // The narration drives the globe: the date and the clock glide to the cue's values (the axis is seen swinging
  // round the year, the Earth turning), the camera flies to the view, and the line or label talked about lights up.
  const now = useRef({ day, tbTime });
  useEffect(() => {
    now.current = { day, tbTime };
  }, [day, tbTime]);
  const glide = useRef(0);
  const glideTo = useCallback((toDay: number | undefined, toTime: number | undefined) => {
    cancelAnimationFrame(glide.current);
    const from = now.current;
    let dd = toDay === undefined ? 0 : (((toDay - from.day) % 365) + 365) % 365;
    if (dd > 182) dd -= 365;
    let dt = toTime === undefined ? 0 : (((toTime - from.tbTime) % 24) + 24) % 24;
    if (dt > 12) dt -= 24;
    const start = performance.now();
    const dur = Math.min(2200, 500 + Math.abs(dd) * 8 + Math.abs(dt) * 90);
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      if (dd) setDay(Math.round((((from.day - 1 + dd * e) % 365) + 365) % 365) + 1);
      if (dt) setTbTime(+((((from.tbTime + dt * e) % 24) + 24) % 24).toFixed(3));
      if (k < 1) glide.current = requestAnimationFrame(step);
    };
    step();
  }, []);
  useEffect(() => () => cancelAnimationFrame(glide.current), []);
  /** The orbit view the narration asked for before the orbit scene was made (it is made the first time it shows). */
  const pendingOrbit = useRef<OrbitView | null>(null);
  const direct = useCallback(
    (s: Partial<SeasonsShot>, jump: boolean) => {
      const sc = sceneRef.current;
      setPlaying(s.run === "day");
      setYearRun(s.run === "year");
      setYearPlay(false);
      if (s.run !== "year") glideTo(s.day, s.run === "day" ? undefined : s.time);
      if (s.zones !== undefined) setShowZones(s.zones);
      setLit(s.lit ?? null);
      setExtra({ beams: s.beams ?? null, card: s.card ?? null });
      const view = s.view ?? "side";
      const ov = ORBIT_VIEWS[view];
      if (ov) {
        setMode("orbit");
        setOrbitView(ov);
        if (orbitRef.current) orbitRef.current.view(ov, jump);
        else pendingOrbit.current = ov;
        return;
      }
      setMode("globe");
      if (!sc) return;
      for (const [id, m] of sc.glows) m.visible = id === s.lit;
      // Where the camera goes: sideways, sunward or over a pole (fixed in space), or onto a place on the Earth as it
      // will stand at the cue's date and time.
      const places: Partial<Record<SeasonsView, [number, number, number]>> = {
        tbilisi: [41.7, 44.8, 3.2],
        greenwich: [45, 0, 3.4],
        dateline: [12, 180, 3.4],
        australia: [-25, 134, 3.3],
        cities: [36, 62, 3.9],
      };
      const place = places[view];
      let to: THREE.Vector3;
      if (place) {
        const q = earthQuaternion(s.day ?? now.current.day, ((((s.time ?? now.current.tbTime) - TBILISI_UTC) % 24) + 24) % 24);
        to = latLonToVec3(place[0], place[1], 1).applyQuaternion(q).setLength(place[2]);
      } else {
        const side = sc.side;
        const dir =
          view === "day"
            ? side.clone().lerp(SUN_DIR, 0.55)
            : view === "north"
              ? new THREE.Vector3(0, 1, 0).addScaledVector(side, 0.35)
              : view === "south"
                ? new THREE.Vector3(0, -1, 0).addScaledVector(side, 0.35)
                : side.clone();
        to = dir.setLength(view === "north" || view === "south" ? 3.3 : 3.6);
      }
      sc.globe.flyTo(to);
    },
    [glideTo],
  );
  const narrated = useNarrationDirector(SEASONS_CUES, direct);
  // Round the sun: the date runs while the voice tells it, or while the teacher plays the year (40 days a second).
  const running = (yearRun && narrated) || yearPlay;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setDay((d) => (d % 365) + 2), 50);
    return () => window.clearInterval(id);
  }, [running]);
  const cityLit = (id: string) => lit === "cities" || (lit === "tbilisi" && id === "tbilisi") || (lit === "london" && id === "london");
  const glowCls = "ring-4 ring-[#ffd76a] scale-115 z-10";
  const named = narrated ? lit : null;
  const shown = narrated ? extra : { beams: null, card: null };
  const dayNight = named === "terminator" || named === "daynight";

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const globe = new GlobeScene(canvas, { sun: SUN_DIR.clone() });
    globe.setSun(SUN_DIR.clone());
    // The lesson labels these cities itself (with their clocks).
    globe.map.setHidden(CITIES.map((c) => c.name));
    globe.map.avoid(layer);
    const zones = timeZones(globe.radius);
    const lines = axisAndLines(globe.radius);
    const snow = snowShells()(globe.radius);
    globe.earth.add(snow.mesh, lines.group, zones.group);
    for (const c of CITIES) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: c.id === "tbilisi" ? "#ff3b30" : "#ffffff" }));
      latLonToVec3(c.lat, c.lon, globe.radius * 1.006, dot.position);
      globe.earth.add(dot);
    }
    const { sun, beams } = sunMesh();
    const terminator = terminatorRing(globe.radius);
    const termGlow = new THREE.Mesh(new THREE.TorusGeometry(globe.radius * 1.008, globe.radius * 0.016, 6, 180), halo("#ffcf66"));
    termGlow.quaternion.copy(terminator.quaternion);
    termGlow.visible = false;
    lines.glows.set("terminator", termGlow);
    globe.scene.add(nightShade(globe.radius), terminator, termGlow, sun, beams);
    // Start over the Caucasus and the Middle East, with the evening terminator in view on the right.
    earthQuaternion(172, 12, globe.earth.quaternion);
    globe.camera.position.copy(globe.position(28, 62)).setLength(3.6);
    sceneRef.current = { globe, zones, glows: lines.glows, side: globe.camera.position.clone().normalize(), snowDay: snow.setDay };

    const els = [...layer.querySelectorAll<HTMLElement>("[data-kind]")];
    const v = new THREE.Vector3();
    const cam = new THREE.Vector3();
    const up = Y.clone().addScaledVector(SUN_DIR, -Y.dot(SUN_DIR)).normalize();
    const toScreen = (p: THREE.Vector3) => {
      const q = p.clone().project(globe.camera);
      return { x: ((q.x + 1) / 2) * canvas.clientWidth, y: ((1 - q.y) / 2) * canvas.clientHeight };
    };
    globe.onFrame = (project) => {
      // The line the narration talks about pulses.
      const pulse = 0.55 + 0.3 * Math.sin(performance.now() / 260);
      for (const m of lines.glows.values()) if (m.visible) (m.material as THREE.MeshBasicMaterial).opacity = pulse;
      const view = globe.viewCenter();
      // The terminator seen from here: its point nearest the camera, moved up along the ring; day and night halves.
      cam.copy(globe.camera.position).normalize();
      const front = cam.clone().addScaledVector(SUN_DIR, -cam.dot(SUN_DIR));
      if (front.lengthSq() < 1e-4) front.copy(up);
      front.normalize();
      for (const el of els) {
        const kind = el.dataset.kind;
        if (kind === "term" || kind === "dayside" || kind === "nightside") {
          if (kind === "term") v.copy(front).add(up.clone().multiplyScalar(0.9)).normalize().multiplyScalar(globe.radius * 1.02);
          else {
            // A point on the ground of that half, as far past the border as the view still shows it.
            const sign = kind === "dayside" ? 1 : -1;
            for (let t = 40; t >= 4; t -= 4) {
              v.copy(front).multiplyScalar(Math.cos(t * D)).addScaledVector(SUN_DIR, sign * Math.sin(t * D));
              if (v.dot(cam) > 0.35) break;
            }
            v.multiplyScalar(globe.radius);
          }
          const p = toScreen(v);
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, ${kind === "term" ? "-120%" : "-50%"})`;
          el.style.opacity = el.dataset.hidden === "1" ? "0" : "1";
          continue;
        }
        let lat = Number(el.dataset.lat);
        const lon = Number(el.dataset.lon);
        if (kind === "zone") lat = Math.max(-50, Math.min(50, view.lat - 18));
        if (kind === "pole") {
          // North end of the axis, above the pole.
          v.set(0, globe.radius * 1.42, 0);
          globe.earth.localToWorld(v);
          const p = toScreen(v);
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
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

  // The orbit scene is made the first time it is shown; while one view shows, the other one does not draw.
  useEffect(() => {
    const canvas = orbitCanvasRef.current;
    const layer = orbitLabelsRef.current;
    if (mode !== "orbit" || orbitRef.current || !canvas || !layer) return;
    const orbit = new OrbitScene(canvas);
    orbitRef.current = orbit;
    orbit.setDate(now.current.day, (((now.current.tbTime - TBILISI_UTC) % 24) + 24) % 24);
    orbit.view(pendingOrbit.current ?? "overview", true);
    pendingOrbit.current = null;
    const els = [...layer.querySelectorAll<HTMLElement>("[data-o]")];
    orbit.onFrame = (project, anchors) => {
      for (const el of els) {
        const p = project(anchors[el.dataset.o as OrbitAnchor]);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = p.visible && el.dataset.hidden !== "1" ? "1" : "0";
      }
    };
  }, [mode]);
  useEffect(
    () => () => {
      orbitRef.current?.dispose();
      orbitRef.current = null;
    },
    [],
  );
  useEffect(() => {
    sceneRef.current?.globe.setPaused(mode === "orbit");
    orbitRef.current?.setPaused(mode !== "orbit");
  }, [mode]);
  useEffect(() => {
    orbitRef.current?.setLit({ daynight: named === "daynight" || orbitView === "near", terminator: named === "terminator", polaris: named === "polaris", distance: named === "distance", four: named === "four" });
  }, [named, orbitView, mode]);

  // Orientation of the Earth for the chosen date and time, and the season's snow.
  useEffect(() => {
    const s = sceneRef.current;
    orbitRef.current?.setDate(day, utc);
    if (!s) return;
    earthQuaternion(day, utc, s.globe.earth.quaternion);
    s.zones.setNoon(noonZone * 15);
    s.snowDay(day);
  }, [day, utc, noonZone, mode]);

  useEffect(() => {
    sceneRef.current?.globe.setMapVisible(map);
  }, [map]);

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
  const pickOrbit = (v: OrbitView) => {
    setMode("orbit");
    setOrbitView(v);
    if (orbitRef.current) orbitRef.current.view(v);
    else pendingOrbit.current = v;
  };
  const north = seasonOf(day);
  const south = seasonOf(day, true);
  const play = mode === "orbit" ? running : playing;
  const togglePlay = () => (mode === "orbit" ? setYearPlay(!play) : setPlaying((p) => !p));
  const near = orbitView === "near";

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className={cn("absolute inset-0 size-full touch-none", mode === "orbit" && "invisible")} aria-label="დედამიწა, მზე, დღე და ღამე" />
        <canvas ref={orbitCanvasRef} className={cn("absolute inset-0 size-full cursor-grab touch-none active:cursor-grabbing", mode !== "orbit" && "invisible")} aria-label="დედამიწა მზის გარშემო: ორბიტა და წელიწადის დროები" />
        <div ref={labelsRef} className={cn("pointer-events-none absolute inset-0 overflow-hidden", mode === "orbit" && "invisible")}>
          {ZONES.map((z) => (
            <span key={z} data-kind="zone" data-lat={0} data-lon={z * 15} className={cn("absolute top-0 left-0 rounded px-1 text-[10px] font-semibold whitespace-nowrap opacity-0", z === noonZone ? "bg-[#ffd84d] text-ink" : "text-[#ddd6fe] [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]", (lit === "zones" || (lit === "dateline" && Math.abs(z) >= 11)) && glowCls)}>
              {z === 0 ? "0" : `${z > 0 ? "+" : "−"}${Math.abs(z)}`}
            </span>
          ))}
          {CITIES.map((c) => {
            const off = cityOffset(c, day);
            const alt = sunAltitude(c.lat, c.lon, decl, utc);
            return (
              <span key={c.id} data-kind="city" data-lat={c.lat} data-lon={c.lon} className={cn("absolute top-0 left-0 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white opacity-0", cityLit(c.id) && glowCls)}>
                {alt > 0 ? <Sun className="size-3 text-[#ffd84d]" /> : <Moon className="size-3 text-[#c7d2fe]" />}
                {c.name} <span className="tabular-nums">{clock(utc + off)}</span>
                <Weather c={c} day={day} />
              </span>
            );
          })}
          <span data-kind="pole" className={cn("absolute top-0 left-0 rounded bg-card/90 px-1.5 py-0.5 text-[11px] font-semibold text-ink opacity-0", lit === "axis" && glowCls)}>
            ჩრდ. პოლუსი · ღერძი 23,44°
          </span>
          <span data-kind="sun" className="absolute top-0 left-0 rounded bg-[#ffd84d] px-1.5 py-0.5 text-[11px] font-semibold text-ink opacity-0">
            მზე
          </span>
          {/* The day/night border named in plain words, and the two halves. */}
          <span data-kind="term" data-hidden={named === "terminator" ? "0" : "1"} className="absolute top-0 left-0 max-w-56 rounded-lg bg-[#ffd166] px-2 py-1 text-center text-[13px] leading-4 font-semibold text-ink opacity-0 shadow-md ring-2 ring-white/70">
            ტერმინატორი = დღისა და ღამის საზღვარი
          </span>
          <span data-kind="dayside" data-hidden={dayNight ? "0" : "1"} className="absolute top-0 left-0 flex items-center gap-1 rounded-full bg-[#ffd84d]/90 px-2.5 py-1 text-[15px] font-bold text-ink opacity-0 shadow">
            <Sun className="size-4" /> დღე
          </span>
          <span data-kind="nightside" data-hidden={dayNight ? "0" : "1"} className="absolute top-0 left-0 flex items-center gap-1 rounded-full bg-[#1e2a4a]/90 px-2.5 py-1 text-[15px] font-bold text-white opacity-0 shadow ring-1 ring-white/30">
            <Moon className="size-4" /> ღამე
          </span>
        </div>
        <div ref={orbitLabelsRef} className={cn("pointer-events-none absolute inset-0 overflow-hidden text-[12px] font-semibold whitespace-nowrap", mode !== "orbit" && "invisible")}>
          <span data-o="sun" className="absolute top-0 left-0 rounded bg-[#ffd84d] px-2 py-0.5 text-[13px] text-ink opacity-0">
            მზე
          </span>
          <span data-o="earth" data-hidden={near ? "1" : "0"} className="absolute top-0 left-0 rounded bg-[#4ea1ff] px-1.5 py-0.5 text-white opacity-0">
            დედამიწა · {dateLabel(day)}
          </span>
          {TURNING_POINTS.map((t) => (
            <span key={t.id} data-o={t.id} data-hidden={near || Math.abs(orbitAngle(day) - t.angle) % 360 < 16 || Math.abs(orbitAngle(day) - t.angle) % 360 > 344 ? "1" : "0"} className={cn("absolute top-0 left-0 rounded bg-black/60 px-1.5 py-0.5 text-center leading-4 text-white opacity-0", named === "four" && "bg-card text-ink ring-2 ring-[#ffd76a]")}>
              {t.short}
              <span className="block text-[11px] font-normal">ჩრდილოეთში: {SEASON_NAMES[seasonOf(t.day)]}</span>
            </span>
          ))}
          <span data-o="day" data-hidden={near ? "0" : "1"} className="absolute top-0 left-0 flex items-center gap-1 rounded-full bg-[#ffd84d]/90 px-2.5 py-1 text-[15px] font-bold text-ink opacity-0 shadow">
            <Sun className="size-4" /> დღე
          </span>
          <span data-o="night" data-hidden={near ? "0" : "1"} className="absolute top-0 left-0 flex items-center gap-1 rounded-full bg-[#1e2a4a]/90 px-2.5 py-1 text-[15px] font-bold text-white opacity-0 shadow ring-1 ring-white/30">
            <Moon className="size-4" /> ღამე
          </span>
          <span data-o="terminator" data-hidden={named === "terminator" ? "0" : "1"} className="absolute top-0 left-0 rounded-lg bg-[#ffd166] px-2 py-1 text-[13px] text-ink opacity-0 shadow-md">
            ტერმინატორი = დღისა და ღამის საზღვარი
          </span>
          <span data-o="north" data-hidden={near ? "0" : "1"} className={cn("absolute top-0 left-0 flex items-center gap-1 rounded px-1.5 py-0.5 opacity-0", north === "summer" ? "bg-[#ffcf8a] text-[#6b2d00]" : north === "winter" ? "bg-[#cfe8ff] text-[#0b3a66]" : "bg-black/60 text-white")}>
            {north === "summer" ? <Sun className="size-3.5" /> : north === "winter" ? <Snowflake className="size-3.5" /> : null}
            ჩრდილოეთი: {SEASON_NAMES[north]}
          </span>
          <span data-o="south" data-hidden={near ? "0" : "1"} className={cn("absolute top-0 left-0 flex items-center gap-1 rounded px-1.5 py-0.5 opacity-0", south === "summer" ? "bg-[#ffcf8a] text-[#6b2d00]" : south === "winter" ? "bg-[#cfe8ff] text-[#0b3a66]" : "bg-black/60 text-white")}>
            {south === "summer" ? <Sun className="size-3.5" /> : south === "winter" ? <Snowflake className="size-3.5" /> : null}
            სამხრეთი: {SEASON_NAMES[south]}
          </span>
          <span data-o="polaris" data-hidden={named === "polaris" ? "0" : "1"} className="absolute top-0 left-0 rounded bg-[#ffd166] px-1.5 py-0.5 text-ink opacity-0">
            ღერძი ყოველთვის პოლარული ვარსკვლავისკენ ↑
          </span>
          <span data-o="near" data-hidden={named === "distance" ? "0" : "1"} className="absolute top-0 left-0 rounded bg-black/70 px-1.5 py-0.5 text-center leading-4 text-white opacity-0 ring-1 ring-[#ffd166]">
            3 იანვარი: 147 მლნ კმ
            <span className="block text-[11px] font-normal">ყველაზე ახლოს — ჩვენთან ზამთარია</span>
          </span>
          <span data-o="far" data-hidden={named === "distance" ? "0" : "1"} className="absolute top-0 left-0 rounded bg-black/70 px-1.5 py-0.5 text-center leading-4 text-white opacity-0 ring-1 ring-[#ffd166]">
            4 ივლისი: 152 მლნ კმ
            <span className="block text-[11px] font-normal">ყველაზე შორს — ჩვენთან ზაფხულია</span>
          </span>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-lg bg-card/92 px-3 py-2 text-sm shadow-sm">
          <p className="font-semibold">{tp ? tp.name : dateLabel(day)}</p>
          <p className="text-[13px] text-mute">
            მზე ზენიტშია: <b className="text-ink tabular-nums">{Math.abs(decl) < 0.05 ? "ეკვატორზე" : formatLat(decl).text}</b>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-mute">
            <span>
              ჩრდილოეთში: <b className="text-ink">{SEASON_NAMES[north]}</b>
            </span>
            <span>
              სამხრეთში: <b className="text-ink">{SEASON_NAMES[south]}</b>
            </span>
          </p>
        </div>

        {shown.beams && <SunAngleCard lit={shown.beams} />}
        {shown.card === "newyear" && (
          <SceneInset title="31 დეკემბერი: ახალი წელი">
            <ul className="flex flex-col gap-1.5 text-[13px] leading-5">
              <li className="flex items-start gap-2 rounded-lg bg-[#ffcf8a]/15 p-2">
                <TreePalm className="mt-0.5 size-5 shrink-0 text-[#ffcf8a]" />
                <span>
                  <b>სიდნეი (ავსტრალია): ზაფხული, ~+22°</b>
                  <span className="block text-white/85">ახალ წელს ოკეანის სანაპიროზე, მზეზე ხვდებიან.</span>
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-lg bg-[#cfe8ff]/15 p-2">
                <MountainSnow className="mt-0.5 size-5 shrink-0 text-[#cfe8ff]" />
                <span>
                  <b>თბილისი: ზამთარი, ~+3°</b>
                  <span className="block text-white/85">მთებში თოვლია — ახალ წელს თბილად ჩაცმულები ვხვდებით.</span>
                </span>
              </li>
            </ul>
          </SceneInset>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={togglePlay} aria-pressed={play} title={play ? "გაჩერება" : mode === "orbit" ? "წელიწადი: დედამიწა მზის გარშემო" : "ბრუნვა"} className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", play ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            {play ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => (mode === "orbit" ? setMode("globe") : pickOrbit(orbitView))}
            aria-pressed={mode === "orbit"}
            title={mode === "orbit" ? "დედამიწა ახლოდან" : "მზე და ორბიტა"}
            aria-label={mode === "orbit" ? "დედამიწა ახლოდან" : "მზე და ორბიტა"}
            className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", mode === "orbit" ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}
          >
            {mode === "orbit" ? <Globe2 className="size-5" /> : <Orbit className="size-5" />}
          </button>
          {mode === "globe" && (
            <>
              <button type="button" onClick={() => setShowZones((s) => !s)} aria-pressed={showZones} title="საათის სარტყლები" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", showZones ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
                <Clock className="size-5" />
              </button>
              <MapButton on={map} onClick={() => setMap((m) => !m)} />
            </>
          )}
          <FullscreenButton full={fsOn} onClick={fsToggle} />
        </div>
        {mode === "orbit" && (
          <div className="absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-1.5 px-3">
            {ORBIT_BUTTONS.map((b) => (
              <button key={b.view} type="button" onClick={() => pickOrbit(b.view)} aria-pressed={orbitView === b.view} className={cn("h-9 rounded-lg px-3 text-sm font-semibold shadow-sm", orbitView === b.view ? "bg-[#2f6fb0] text-white" : "bg-card/92 text-ink hover:bg-card")}>
                {b.name}
              </button>
            ))}
          </div>
        )}
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
                      {off !== c.utc ? " · ზაფხულის დრო" : ""} · {SEASON_NAMES[seasonOf(day, c.lat < 0)]}, {cityTemp(c, day)}
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
        მოდელი გამარტივებულია: სარტყლები ნაჩვენებია „იდეალური“ 15°-იანი ზოლებით (ნამდვილი საზღვრები ქვეყნების საზღვრებს მიჰყვება); თარიღები ზუსტია ±1 დღით; თოვლის საზღვარი და ტემპერატურა — თვის საშუალო. ორბიტის სურათზე დედამიწა და მზე მასშტაბის გარეშეა (დედამიწა ბევრჯერ გადიდებულია). დედამიწის სურათი: NASA Blue Marble, ღამის განათება: NASA Black Marble; საზღვრები და სახელები: Natural Earth, Wikidata.
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
