import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { beads, curve, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";

/*
 * The Battle of Didgori (12 August 1121) on the real ground: elevation from AWS Terrain Tiles and a
 * Sentinel-2 picture (EOxCloudless 2024, modern town and reservoir painted out) for the area between
 * Manglisi, Didgori and Tbilisi, plus a map of Georgia for the campaign. The armies are figures in
 * regiments (≈ 1 figure per 100 soldiers on the Georgian side; the coalition's size is disputed and shown
 * schematically). Positions are a reconstruction from the sources' descriptions, not exact.
 */

const VERSION = "2026-10-08";

// ---- Battlefield grid ------------------------------------------------------------------------------------

interface FieldMeta {
  width: number;
  height: number;
  lon: [number, number];
  lat: [number, number];
}

const UNIT = 100; // metres per scene unit
const EXAG = 1.4; // vertical exaggeration

class Field {
  W: number;
  D: number;
  constructor(
    readonly meta: FieldMeta,
    readonly h: Int16Array,
  ) {
    const midLat = ((meta.lat[0] + meta.lat[1]) / 2) * (Math.PI / 180);
    this.W = ((meta.lon[1] - meta.lon[0]) * 111320 * Math.cos(midLat)) / UNIT;
    this.D = ((meta.lat[0] - meta.lat[1]) * 110570) / UNIT;
  }
  /** Scene x, z of a longitude/latitude (x east, z south). */
  xz(lon: number, lat: number) {
    const { lon: L, lat: A } = this.meta;
    return [((lon - L[0]) / (L[1] - L[0]) - 0.5) * this.W, ((A[0] - lat) / (A[0] - A[1]) - 0.5) * this.D] as const;
  }
  /** Ground height (scene units) at scene x, z, bilinear. */
  y(x: number, z: number) {
    const { width: GW, height: GH } = this.meta;
    const fx = THREE.MathUtils.clamp((x / this.W + 0.5) * (GW - 1), 0, GW - 1.001);
    const fz = THREE.MathUtils.clamp((z / this.D + 0.5) * (GH - 1), 0, GH - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const at = (a: number, b: number) => this.h[b * GW + a];
    const m = (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - tz) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * tz;
    return ((m - 1000) / UNIT) * EXAG;
  }
  p(lon: number, lat: number, lift = 0) {
    const [x, z] = this.xz(lon, lat);
    return v(x, this.y(x, z) + lift, z);
  }
}

async function loadField(k: Kit) {
  const [meta, buf, sat] = await Promise.all([
    fetch(`/history/didgori-terrain.json?v=${VERSION}`).then((r) => r.json() as Promise<FieldMeta>),
    fetch(`/history/didgori-terrain.bin.gz?v=${VERSION}`).then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
    new THREE.TextureLoader().loadAsync(`/history/didgori-satellite.jpg?v=${VERSION}`),
  ]);
  sat.colorSpace = THREE.SRGBColorSpace;
  sat.anisotropy = 8;
  k.track(sat);
  const field = new Field(meta, new Int16Array(buf));
  const geo = k.track(new THREE.PlaneGeometry(field.W, field.D, meta.width - 1, meta.height - 1).rotateX(-Math.PI / 2));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, ((field.h[i] - 1000) / UNIT) * EXAG);
  geo.computeVertexNormals();
  // A fine detail normal map on a second, tiled UV set.
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const uv1 = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    uv1[i * 2] = uv.getX(i) * 90;
    uv1[i * 2 + 1] = uv.getY(i) * 56;
  }
  geo.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
  const detail = k.normalMap("organic", [1, 1]);
  detail.channel = 1;
  const mesh = new THREE.Mesh(geo, k.material({ map: sat, roughness: 0.95, clearcoat: 0, normalMap: detail, normalScale: new THREE.Vector2(0.15, 0.15) }));
  mesh.receiveShadow = true;
  return { field, mesh };
}

// ---- Soldiers ---------------------------------------------------------------------------------------------

/** Parts merged into one geometry, each part with its own vertex colour. */
function merged(k: Kit, parts: { g: THREE.BufferGeometry; color: string }[]) {
  const list = parts.map(({ g, color }) => {
    const geo = g.index ? g : g;
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    geo.deleteAttribute("uv");
    return geo;
  });
  const m = mergeGeometries(list)!;
  for (const g of list) g.dispose();
  return k.track(m);
}

/** Cavalry facing +z: horse, rider, lance. `team` parts take the regiment's colour. */
function cavalryGeometry(k: Kit) {
  const neutral = merged(k, [
    { g: new THREE.CapsuleGeometry(0.16, 0.55, 4, 10).rotateX(Math.PI / 2).translate(0, 0.58, 0), color: "#6b4a32" },
    { g: new THREE.CapsuleGeometry(0.08, 0.3, 4, 8).rotateX(-0.6).translate(0, 0.8, 0.36), color: "#5e4029" },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ g: new THREE.BoxGeometry(0.06, 0.45, 0.06).translate(sx * 0.09, 0.24, sz * 0.22), color: "#3a2a1e" }))),
    { g: new THREE.SphereGeometry(0.075, 10, 8).translate(0, 1.3, 0), color: "#9a9ea4" },
    { g: new THREE.CylinderGeometry(0.014, 0.014, 1.5, 5).rotateX(1.25).translate(0.13, 1.05, 0.3), color: "#8a6a44" },
  ]);
  const team = merged(k, [
    { g: new THREE.CapsuleGeometry(0.1, 0.3, 4, 8).translate(0, 1.02, 0), color: "#ffffff" },
    { g: new THREE.BoxGeometry(0.04, 0.28, 0.22).translate(-0.14, 0.98, 0.04), color: "#e8e8e8" },
    { g: new THREE.BoxGeometry(0.34, 0.06, 0.5).translate(0, 0.72, -0.02), color: "#d8d8d8" },
  ]);
  return { neutral, team };
}

function infantryGeometry(k: Kit) {
  const neutral = merged(k, [
    { g: new THREE.BoxGeometry(0.18, 0.42, 0.1).translate(0, 0.21, 0), color: "#4a3a2a" },
    { g: new THREE.SphereGeometry(0.085, 10, 8).translate(0, 1.0, 0), color: "#9a9ea4" },
    { g: new THREE.CylinderGeometry(0.014, 0.014, 1.7, 5).translate(0.17, 0.85, 0.02), color: "#8a6a44" },
  ]);
  const team = merged(k, [
    { g: new THREE.CapsuleGeometry(0.12, 0.3, 4, 8).translate(0, 0.66, 0), color: "#ffffff" },
    { g: new THREE.BoxGeometry(0.05, 0.42, 0.3).translate(-0.17, 0.64, 0.06), color: "#e0e0e0" },
  ]);
  return { neutral, team };
}

type LonLat = [number, number];

interface Regiment {
  name: string;
  side: "g" | "c";
  kind: "cav" | "inf";
  color: string;
  count: number;
  /** Position at the end of stages 1..6 (index 0 = stage 1). Missing entries keep the previous one. */
  at: (LonLat | null)[];
  /** When in each stage it moves (0..1 of the stage). */
  when?: Record<number, [number, number]>;
  /** Stages in which it is broken (fleeing). */
  rout?: number[];
  label?: number[];
  size?: number;
}

// Positions (lon, lat): a reconstruction. Georgians on the heights in the east and in hidden side valleys;
// the coalition strung out westwards towards Manglisi.
const REGIMENTS: Regiment[] = [
  { name: "მძიმე ცხენოსნები", side: "g", kind: "cav", color: "#c0392b", count: 100, at: [[44.556, 41.698], null, [44.537, 41.692], [44.527, 41.69], [44.515, 41.688], [44.5, 41.686]], when: { 3: [0.15, 0.7], 4: [0, 0.8] }, label: [1, 3] },
  { name: "ფრანგი რაინდები", side: "g", kind: "cav", color: "#f4f1ea", count: 8, size: 1.3, at: [[44.552, 41.6945], null, [44.535, 41.6895], [44.525, 41.688], [44.513, 41.687], null], when: { 3: [0.15, 0.7] }, label: [1, 3] },
  { name: "მეფე დავითი", side: "g", kind: "cav", color: "#a01f2a", count: 100, at: [[44.532, 41.7125], null, null, [44.512, 41.6975], [44.5, 41.695], [44.488, 41.692]], when: { 4: [0.1, 0.75] }, label: [1, 4] },
  { name: "დემეტრე", side: "g", kind: "cav", color: "#b8402e", count: 80, at: [[44.538, 41.6715], null, null, [44.515, 41.6795], [44.5, 41.678], [44.488, 41.676]], when: { 4: [0.2, 0.85] }, label: [1, 4] },
  { name: "ქვეითები", side: "g", kind: "inf", color: "#9a2a2a", count: 70, at: [[44.566, 41.7], null, null, [44.541, 41.693], [44.53, 41.691], null], when: { 4: [0.1, 1] }, label: [1] },
  { name: "ყივჩაყები", side: "g", kind: "cav", color: "#c9a23a", count: 150, at: [[44.569, 41.6875], null, null, null, [44.53, 41.682], [44.37, 41.645]], when: { 5: [0.2, 1], 6: [0, 1] }, label: [1, 6] },
  { name: "200 მხედარი", side: "g", kind: "cav", color: "#e8c23a", count: 5, size: 1.5, at: [[44.552, 41.6875], [44.5285, 41.6865], [44.539, 41.6865], null, null, [44.38, 41.648]], when: { 2: [0.05, 0.6], 3: [0, 0.4], 6: [0, 1] }, label: [2] },
  { name: "ალანები", side: "g", kind: "cav", color: "#8a6a3a", count: 6, at: [[44.563, 41.6825], null, null, null, [44.528, 41.681], [44.39, 41.65]], when: { 5: [0.2, 1] } },
  { name: "მოწინავე რაზმი", side: "c", kind: "cav", color: "#2b3a6b", count: 250, at: [[44.527, 41.688], null, [44.522, 41.6875], null, [44.47, 41.675], [44.36, 41.63]], when: { 3: [0.3, 0.9], 5: [0.1, 1], 6: [0, 1] }, rout: [5, 6], label: [1, 3] },
  { name: "მარცხენა ფრთა", side: "c", kind: "cav", color: "#33417a", count: 300, at: [[44.511, 41.6985], null, null, [44.506, 41.6965], [44.45, 41.69], [44.33, 41.65]], when: { 4: [0.5, 1], 5: [0.05, 1], 6: [0, 1] }, rout: [5, 6], label: [1, 4] },
  { name: "მარჯვენა ფრთა", side: "c", kind: "cav", color: "#33417a", count: 300, at: [[44.511, 41.677], null, null, [44.506, 41.6795], [44.46, 41.665], [44.34, 41.625]], when: { 4: [0.5, 1], 5: [0.05, 1], 6: [0, 1] }, rout: [5, 6], label: [1, 4] },
  { name: "ილღაზის ცენტრი", side: "c", kind: "inf", color: "#1e2a52", count: 350, at: [[44.497, 41.6885], null, null, null, [44.45, 41.68], [44.33, 41.64]], when: { 5: [0, 1], 6: [0, 1] }, rout: [5, 6], label: [1, 5] },
  { name: "ბანაკები მანგლისამდე", side: "c", kind: "inf", color: "#4a5578", count: 300, size: 0.9, at: [[44.44, 41.6955], null, null, null, [44.4, 41.69], [44.3, 41.66]], when: { 5: [0.3, 1], 6: [0, 1] }, rout: [5, 6], label: [1] },
];

const COMMAND: LonLat = [44.518, 41.688];

interface Figure {
  reg: number;
  ox: number;
  oz: number;
  jx: number;
  jz: number;
  seed: number;
  /** In the pursuit, this figure is gone after this fraction of the stage. */
  fall: number;
}

function army(k: Kit, field: Field, parent: THREE.Object3D) {
  const r = rng(1121);
  const cav = cavalryGeometry(k);
  const inf = infantryGeometry(k);
  const figs: Figure[] = [];
  REGIMENTS.forEach((reg, ri) => {
    const sp = reg.kind === "cav" ? 1.35 : 0.95;
    const cols = Math.ceil(Math.sqrt(reg.count * (reg.kind === "cav" ? 2.2 : 3)));
    for (let i = 0; i < reg.count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      figs.push({ reg: ri, ox: (row - Math.floor(reg.count / cols) / 2) * sp, oz: (col - cols / 2) * sp, jx: (r() - 0.5) * 0.5, jz: (r() - 0.5) * 0.5, seed: r(), fall: 0.15 + r() * 1.6 });
    }
  });
  const byKind = (kind: "cav" | "inf") => figs.filter((f) => REGIMENTS[f.reg].kind === kind);
  const groups = (["cav", "inf"] as const).map((kind) => {
    const list = byKind(kind);
    const geo = kind === "cav" ? cav : inf;
    const neutralMat = k.material({ color: "#ffffff", vertexColors: true, roughness: 0.65, clearcoat: 0 });
    const teamMat = k.material({ color: "#ffffff", vertexColors: true, roughness: 0.6, clearcoat: 0.2 });
    const a = new THREE.InstancedMesh(geo.neutral, neutralMat, list.length);
    const b = new THREE.InstancedMesh(geo.team, teamMat, list.length);
    for (const m of [a, b]) {
      m.frustumCulled = false;
      m.castShadow = true;
      parent.add(m);
    }
    list.forEach((f, i) => b.setColorAt(i, new THREE.Color(REGIMENTS[f.reg].color)));
    return { list, a, b };
  });
  // Banners with the regiment's colour.
  const banners = REGIMENTS.map((reg) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(k.cylinder, k.material({ color: "#6a4a2a" }));
    pole.scale.set(0.05, 4, 0.05);
    pole.position.y = 2;
    const flag = new THREE.Mesh(k.track(new THREE.PlaneGeometry(1.6, 1)), k.material({ color: reg.color, side: THREE.DoubleSide, roughness: 0.8, emissive: reg.color, emissiveIntensity: 0.15 }));
    flag.position.set(0.8, 3.4, 0);
    g.add(pole, flag);
    parent.add(g);
    return { g, flag };
  });
  return { figs, groups, banners };
}

// ---- Map of Georgia for the campaign -------------------------------------------------------------------

interface GeoMeta {
  detail: [number, number];
  lon: [number, number];
  lat: [number, number];
}

async function georgiaMap(k: Kit) {
  const [meta, buf, sat] = await Promise.all([
    fetch("/geo/georgia-terrain.json?v=2026-10-04").then((r) => r.json() as Promise<GeoMeta>),
    fetch("/geo/georgia-terrain.bin.gz?v=2026-10-04").then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
    new THREE.TextureLoader().loadAsync("/geo/georgia-satellite.jpg?v=2026-10-04"),
  ]);
  sat.colorSpace = THREE.SRGBColorSpace;
  sat.anisotropy = 8;
  k.track(sat);
  const [DW, DH] = meta.detail;
  const coded = new Int16Array(buf, 0, DW * DH);
  const step = 6;
  const GW = Math.floor(DW / step);
  const GH = Math.floor(DH / step);
  const row = new Int16Array(DW);
  const h = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) {
    let val = 0;
    for (let i = 0; i < DW; i++) {
      const kk = j * step * DW + i;
      val = i === 0 ? coded[kk] : val + coded[kk];
      row[i] = val;
    }
    for (let i = 0; i < GW; i++) h[j * GW + i] = row[i * step];
  }
  const SIZE = 60;
  const aspect = DH / DW;
  const geo = k.track(new THREE.PlaneGeometry(SIZE, SIZE * aspect, GW - 1, GH - 1).rotateX(-Math.PI / 2));
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, h[i]) * 0.0009);
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, k.material({ map: sat, roughness: 0.95, clearcoat: 0 })));
  const sea = new THREE.Mesh(k.track(new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.4).rotateX(-Math.PI / 2)), k.material({ color: "#2f6f95", roughness: 0.1, clearcoat: 1 }));
  sea.position.y = 0.02;
  g.add(sea);
  const at = (lon: number, lat: number, lift = 0.5) => {
    const x = ((lon - meta.lon[0]) / (meta.lon[1] - meta.lon[0]) - 0.5) * SIZE;
    const z = ((lat - meta.lat[0]) / (meta.lat[1] - meta.lat[0]) - 0.5) * SIZE * aspect;
    const gi = THREE.MathUtils.clamp(Math.round((x / SIZE + 0.5) * (GW - 1)), 0, GW - 1);
    const gj = THREE.MathUtils.clamp(Math.round((z / (SIZE * aspect) + 0.5) * (GH - 1)), 0, GH - 1);
    return v(x, Math.max(0, h[gj * GW + gi]) * 0.0009 + lift, z);
  };
  return { g, at };
}

// ---- The simulation ------------------------------------------------------------------------------------------

export const didgori: Builder = async (k) => {
  const [{ field, mesh }, map] = await Promise.all([loadField(k), georgiaMap(k)]);
  const battle = new THREE.Group();
  k.root.add(battle);
  battle.add(mesh);
  // A skirt so the cut edges of the terrain read as a model.
  const skirtMat = k.material({ color: "#5a4a38", roughness: 1 });
  const base = new THREE.Mesh(k.track(new THREE.BoxGeometry(field.W, 4, field.D)), skirtMat);
  base.position.y = -8;
  battle.add(base);
  const A = army(k, field, battle);
  const tent = new THREE.Group();
  const tentMesh = new THREE.Mesh(k.track(new THREE.ConeGeometry(1.3, 1.6, 8)), k.material({ color: "#e8dcc0", roughness: 0.9 }));
  tentMesh.position.y = 0.8;
  tent.add(tentMesh);
  const tentPos = field.p(COMMAND[0], COMMAND[1]);
  tent.position.copy(tentPos);
  battle.add(tent);

  // Place names.
  const place = (lon: number, lat: number, text: string, stages: number[]) => k.label(k.anchor(battle, field.p(lon, lat, 2)), text, { stages });
  place(44.517, 41.683, "დიდგორი", [1, 4, 5]);
  place(44.38, 41.7, "მანგლისი", [1, 5, 6]);
  place(44.3, 41.62, "თრიალეთისკენ", [6]);
  place(44.79, 41.72, "თბილისი (საამირო)", [1]);
  k.label(k.anchor(tent, v(0, 2.5, 0)), "მეთაურთა კარავი", { kind: "tag", stages: [2] });

  // Regiment labels follow their banners.
  const regAnchors = REGIMENTS.map((reg, i) => {
    const a = k.anchor(battle, v(0, 0, 0));
    if (reg.label) k.label(a, `${reg.name}`, { kind: "tag", stages: reg.label });
    return { a, i };
  });

  // Arrows: the 200 at the commanders; coalition archers at the charging Georgians.
  const arrowGeo = k.track(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4).rotateZ(Math.PI / 2));
  const ruse = field.p(44.5285, 41.6865, 1.5);
  const volley = beads(k, battle, curve([ruse, ruse.clone().lerp(tentPos, 0.5).add(v(0, 4, 0)), tentPos.clone().add(v(0, 1, 0))]), { n: 24, color: "#2a2018", size: 1, speed: 0.6, spread: 0.6, geometry: arrowGeo, emissive: 0 });
  const vg = field.p(44.527, 41.688, 1.5);
  const gc = field.p(44.547, 41.695, 1.5);
  const counter = beads(k, battle, curve([vg, vg.clone().lerp(gc, 0.5).add(v(0, 6, 0)), gc]), { n: 40, color: "#2a2018", size: 1, speed: 0.5, spread: 2.5, geometry: arrowGeo, emissive: 0 });
  // Dust behind galloping horsemen.
  const dustMat = k.material({ color: "#a08a66", roughness: 1, transparent: true, opacity: 0.12, depthWrite: false });
  const dust = new THREE.InstancedMesh(k.sphere, dustMat, 160);
  dust.frustumCulled = false;
  battle.add(dust);
  const dayTag = k.label(k.anchor(battle, field.p(44.45, 41.66, 12)), "", { kind: "tag", stages: [6] });

  // Campaign map.
  map.g.visible = false;
  k.root.add(map.g);
  const M = map.at;
  const mapPlace = (lon: number, lat: number, text: string, stages: number[], kind: "label" | "tag" = "label") => k.label(k.anchor(map.g, M(lon, lat, 0.8)), text, { stages, kind });
  mapPlace(42.7, 42.27, "ქუთაისი — სამეფო დედაქალაქი", [0]);
  mapPlace(44.72, 41.84, "მცხეთა", [0]);
  mapPlace(44.79, 41.72, "თბილისი — საამირო", [0]);
  mapPlace(44.52, 41.69, "დიდგორი", [0, 7]);
  mapPlace(44.15, 41.55, "თრიალეთი", [0]);
  mapPlace(46.0, 41.1, "განჯისკენ", [0]);
  mapPlace(44.0, 41.05, "სამხრეთიდან: ილღაზის კოალიცია", [0], "tag");
  const coalitionRoute = curve([M(44.0, 40.97, 0.6), M(44.1, 41.3, 0.6), M(44.25, 41.52, 0.6), M(44.45, 41.66, 0.6)]);
  const georgianRoute = curve([M(44.72, 41.84, 0.6), M(44.62, 41.77, 0.6), M(44.55, 41.71, 0.6)]);
  const mapArrows = [beads(k, map.g, coalitionRoute, { n: 30, color: "#2f6a3a", size: 0.14, speed: 0.12, emissive: 0.6 }), beads(k, map.g, georgianRoute, { n: 20, color: "#c0392b", size: 0.14, speed: 0.12, emissive: 0.6 })];
  const flag = new THREE.Group();
  const fpole = new THREE.Mesh(k.cylinder, k.material({ color: "#6a4a2a" }));
  fpole.scale.set(0.04, 1.6, 0.04);
  fpole.position.y = 0.8;
  const fcloth = new THREE.Mesh(k.track(new THREE.PlaneGeometry(0.8, 0.5)), k.material({ color: "#c0392b", side: THREE.DoubleSide, emissive: "#c0392b", emissiveIntensity: 0.3 }));
  fcloth.position.set(0.4, 1.35, 0);
  flag.add(fpole, fcloth);
  flag.position.copy(M(44.79, 41.72, 0.4));
  map.g.add(flag);
  mapPlace(44.79, 41.72, "1122 — თბილისი, საქართველოს დედაქალაქი", [7]);

  // ---- Per-frame placement of the figures ----
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = v(0, 1, 0);
  const ZERO = v(0, 0, 0);
  const scl = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  /** Regiment centre during stage `s` at progress u, with heading. */
  const where = (reg: Regiment, s: number, u: number) => {
    const pick = (stage: number): LonLat => {
      for (let t = Math.min(stage, 6); t >= 1; t--) {
        const p = reg.at[t - 1];
        if (p) return p;
      }
      return reg.at[0]!;
    };
    const from = pick(s - 1 >= 1 ? s - 1 : 1);
    const to = pick(s);
    const w = reg.when?.[s] ?? [0, 1];
    const f = ease((u - w[0]) / Math.max(0.01, w[1] - w[0]));
    const [x0, z0] = field.xz(from[0], from[1]);
    const [x1, z1] = field.xz(to[0], to[1]);
    const moving = (x1 - x0) ** 2 + (z1 - z0) ** 2 > 0.01 && f > 0 && f < 1;
    return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, hx: x1 - x0, hz: z1 - z0, moving };
  };
  const facing = REGIMENTS.map((reg) => (reg.side === "g" ? Math.PI * 1.5 : Math.PI * 0.5));
  let dustI = 0;
  const place3 = (s: number, u: number, t: number) => {
    const centres = REGIMENTS.map((reg, i) => {
      const c = where(reg, s, u);
      if (c.moving) facing[i] = Math.atan2(c.hx, c.hz);
      else if (s <= 4) facing[i] = reg.side === "g" ? -Math.PI / 2 : Math.PI / 2;
      return c;
    });
    dustI = 0;
    for (const grp of A.groups) {
      grp.list.forEach((f, i) => {
        const reg = REGIMENTS[f.reg];
        const c = centres[f.reg];
        const routed = reg.rout?.includes(s) ?? false;
        const spread = routed ? 2.4 + (s === 6 ? 1.5 * u : u) : 1;
        const ang = facing[f.reg];
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const ox = (f.ox + f.jx * (routed ? 6 : 1)) * spread * (reg.size ?? 1);
        const oz = (f.oz + f.jz * (routed ? 6 : 1)) * spread * (reg.size ?? 1);
        const x = c.x + ox * sa + oz * ca;
        const z = c.z + ox * ca - oz * sa;
        // During the pursuit the broken army thins out.
        const gone = reg.side === "c" && s === 6 && u > f.fall;
        const bob = c.moving && reg.kind === "cav" ? Math.abs(Math.sin(t * 9 + f.seed * 20)) * 0.12 : 0;
        tmp.set(x, field.y(x, z) + bob, z);
        const turn = routed ? ang + Math.PI + (f.seed - 0.5) * 0.8 : ang;
        q.setFromAxisAngle(up, turn + (c.moving ? 0 : (f.seed - 0.5) * 0.15));
        m4.compose(tmp, q, gone ? ZERO : scl.setScalar(reg.size ?? 1));
        grp.a.setMatrixAt(i, m4);
        grp.b.setMatrixAt(i, m4);
        if (c.moving && reg.kind === "cav" && f.seed < 0.08 && dustI < 160) {
          tmp.set(x - Math.sin(ang) * 1.2, field.y(x, z) + 0.4, z - Math.cos(ang) * 1.2);
          m4.compose(tmp, q, scl.setScalar(0.35 + ((f.seed * 50 + t) % 0.3)));
          dust.setMatrixAt(dustI++, m4);
        }
      });
      grp.a.instanceMatrix.needsUpdate = true;
      grp.b.instanceMatrix.needsUpdate = true;
    }
    dust.count = dustI;
    dust.instanceMatrix.needsUpdate = true;
    A.banners.forEach((b, i) => {
      const c = centres[i];
      const routed = REGIMENTS[i].rout?.includes(s) ?? false;
      b.g.visible = !routed && s >= 1 && s <= 6;
      b.g.position.set(c.x, field.y(c.x, c.z), c.z);
      b.flag.rotation.y = Math.sin(t * 2 + i) * 0.3;
      regAnchors[i].a.position.set(c.x, field.y(c.x, c.z) + 5, c.z);
    });
  };

  const focus = (lon: number, lat: number) => field.p(lon, lat);
  const show = (battleOn: boolean) => {
    battle.visible = battleOn;
    map.g.visible = !battleOn;
    k.mood("#c8d4da", battleOn ? 350 : 80, battleOn ? 1500 : 300, true);
  };
  const mapShot = (s: number, toward: V3, d: number): Shot => orbit(toward, d, s, { start: 0.15, speed: 0.01, height: 0.7 });
  const shot = (at: V3, d: number, s: number, start: number, height: number, speed = 0.015): Shot => orbit(at, d, s, { start, speed, height });

  return {
    stages: [
      {
        duration: 18,
        cut: true,
        enter: () => show(false),
        update: (u, s, t) => {
          mapArrows.forEach((b) => b.update(t));
          flag.visible = false;
          return mapShot(s, M(44.3, 41.6, 0), 34 - 10 * ease(u));
        },
      },
      {
        duration: 18,
        cut: true,
        enter: () => show(true),
        update: (u, s, t) => {
          place3(1, u, t);
          volley.update(t, 0);
          counter.update(t, 0);
          return shot(focus(44.52, 41.69), 170 - 40 * ease(u), s, 0.9, 0.55);
        },
      },
      {
        duration: 16,
        update: (u, s, t) => {
          place3(2, u, t);
          volley.update(t, u > 0.62 ? 1 : 0);
          counter.update(t, 0);
          tentMesh.rotation.z = u > 0.8 ? Math.min(1.2, (u - 0.8) * 6) : 0;
          return shot(focus(44.535, 41.687), 48, s, 2.2, 0.38, 0.02);
        },
      },
      {
        duration: 16,
        update: (u, s, t) => {
          place3(3, u, t);
          volley.update(t, 0);
          counter.update(t, u < 0.5 ? 1 : 0);
          return shot(focus(44.532, 41.69), 70, s, 2.4, 0.42);
        },
      },
      {
        duration: 17,
        update: (u, s, t) => {
          place3(4, u, t);
          counter.update(t, 0);
          return shot(focus(44.515, 41.689), 105, s, 2.0, 0.6);
        },
      },
      {
        duration: 16,
        update: (u, s, t) => {
          place3(5, u, t);
          return shot(focus(44.49, 41.685), 120, s, 1.6, 0.55);
        },
      },
      {
        duration: 18,
        update: (u, s, t) => {
          place3(6, u, t);
          (dayTag.querySelector(".blood-label-text") ?? dayTag).textContent = `დევნა: დღე ${Math.min(3, 1 + Math.floor(u * 3))}`;
          const at = focus(44.5 - 0.13 * ease(u), 41.67);
          return shot(at, 165, s, 1.3, 0.6);
        },
      },
      {
        duration: 18,
        cut: true,
        enter: () => show(false),
        update: (u, s, t) => {
          mapArrows.forEach((b) => b.update(t, 0));
          flag.visible = true;
          flag.position.y = M(44.79, 41.72, 0.4).y + 0.0 * u;
          fcloth.rotation.y = Math.sin(t * 2) * 0.3;
          return mapShot(s, M(44.65, 41.72, 0), 16);
        },
      },
    ],
  };
};
