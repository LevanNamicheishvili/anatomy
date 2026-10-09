import * as THREE from "three";
import { DIDGORI_PLACE } from "./identity";
import { beads, curve } from "@/components/journeys/common";
import { v, type Kit } from "@/components/journeys/JourneyScene";

/*
 * Map of Georgia for the campaign before the battle and Tbilisi after it: the national relief model
 * (public/geo) with the coalition's road from the south and the Georgian army's from Mtskheta.
 */

interface GeoMeta {
  detail: [number, number];
  lon: [number, number];
  lat: [number, number];
}

export async function campaignMap(k: Kit) {
  const [meta, buf, sat, lines] = await Promise.all([
    fetch("/geo/georgia-terrain.json?v=2026-10-04").then((r) => r.json() as Promise<GeoMeta>),
    fetch("/geo/georgia-terrain.bin.gz?v=2026-10-04").then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
    new THREE.TextureLoader().loadAsync("/geo/georgia-satellite.jpg?v=2026-10-04"),
    fetch("/geo/georgia-lines.json").then((r) => r.json() as Promise<{ borders: Record<string, number[][][]> }>),
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

  // Modern administrative outlines orient the viewer; these are not borders of the 1121 kingdom.
  const borderMat = k.track(new THREE.LineBasicMaterial({ color: "#f0dcc0", transparent: true, opacity: 0.65 }));
  for (const rings of Object.values(lines.borders)) for (const ring of rings) {
    const points = ring.map(([lon, lat]) => at(lon, lat, 0.09));
    g.add(new THREE.Line(k.track(new THREE.BufferGeometry().setFromPoints(points)), borderMat));
  }
  const battleAt = at(DIDGORI_PLACE.lon, DIDGORI_PLACE.lat, 0.2);
  const beacon = new THREE.Group();
  beacon.position.copy(battleAt);
  const ring = new THREE.Mesh(k.track(new THREE.RingGeometry(0.24, 0.32, 64).rotateX(-Math.PI / 2)), k.track(new THREE.MeshBasicMaterial({ color: "#ffcc70", side: THREE.DoubleSide, depthTest: false })));
  beacon.add(ring);
  const pin = new THREE.Mesh(k.track(new THREE.SphereGeometry(0.13, 24, 12)), k.track(new THREE.MeshBasicMaterial({ color: "#ffdc8a", depthTest: false })));
  pin.position.y = 0.3;
  beacon.add(pin);
  g.add(beacon);

  const place = (lon: number, lat: number, text: string, stages: number[], kind: "label" | "tag" = "label") => {
    const a = new THREE.Object3D();
    a.position.copy(at(lon, lat, 0.8));
    g.add(a);
    k.label(a, text, { stages, kind });
  };
  place(42.7, 42.27, "ქუთაისი — სამეფო დედაქალაქი", [0]);
  place(44.72, 41.84, "მცხეთა", [0]);
  place(44.79, 41.72, "თბილისი — საამირო", [0]);
  place(DIDGORI_PLACE.lon, DIDGORI_PLACE.lat, "1121: დიდგორის ველი · დღეს: დიდგორის მემორიალი", [0, 7], "tag");
  place(44.15, 41.55, "თრიალეთი", [0]);
  place(46.0, 41.1, "განჯისკენ", [0]);
  place(44.0, 41.05, "სამხრეთიდან: ილღაზის კოალიცია", [0], "tag");
  place(44.79, 41.72, "1122 — თბილისი, საქართველოს დედაქალაქი", [7]);
  const routes = [
    beads(k, g, curve([at(44.0, 40.97, 0.6), at(44.1, 41.3, 0.6), at(44.25, 41.52, 0.6), at(DIDGORI_PLACE.lon, DIDGORI_PLACE.lat, 0.6)]), { n: 30, color: "#2b4a8a", size: 0.14, speed: 0.12, emissive: 0.6 }),
    beads(k, g, curve([at(44.72, 41.84, 0.6), at(44.62, 41.77, 0.6), at(DIDGORI_PLACE.lon, DIDGORI_PLACE.lat, 0.6)]), { n: 20, color: "#c0392b", size: 0.14, speed: 0.12, emissive: 0.6 }),
  ];
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(k.cylinder, k.material({ color: "#6a4a2a" }));
  pole.scale.set(0.04, 1.6, 0.04);
  pole.position.y = 0.8;
  const cloth = new THREE.Mesh(k.track(new THREE.PlaneGeometry(0.8, 0.5)), k.material({ color: "#c0392b", side: THREE.DoubleSide, emissive: "#c0392b", emissiveIntensity: 0.3 }));
  cloth.position.set(0.4, 1.35, 0);
  flag.add(pole, cloth);
  flag.position.copy(at(44.79, 41.72, 0.4));
  g.add(flag);
  return { group: g, at, routes, flag, cloth, battleAt, ring };
}
