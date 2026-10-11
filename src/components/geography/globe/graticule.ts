import * as THREE from "three";

/*
 * The degree grid (graticule): parallels every `step` degrees, meridians every `step` degrees, and the
 * special lines a school atlas names — equator, tropics, polar circles, prime meridian and the 180th.
 * Lines are thin tori so they keep a visible width on every screen (WebGL lines are always 1 px).
 */

export interface SpecialLine {
  id: string;
  name: string;
  kind: "parallel" | "meridian";
  value: number;
  color: string;
  note: string;
}

/** Earth's axial tilt in degrees: the tropics and polar circles follow from it. */
export const AXIAL_TILT = 23.44;

export const SPECIAL_LINES: SpecialLine[] = [
  { id: "equator", name: "ეკვატორი", kind: "parallel", value: 0, color: "#ff5a4f", note: "0° განედი. დედამიწას ჩრდილოეთ და სამხრეთ ნახევარსფეროებად ყოფს; ყველაზე გრძელი პარალელია (≈40 000 კმ)." },
  { id: "tropic-n", name: "ჩრდილოეთის ტროპიკი", kind: "parallel", value: AXIAL_TILT, color: "#ffb703", note: "23°26′ ჩ. გ. 22 ივნისს შუადღისას მზე აქ ზენიტშია (თავზე დგას)." },
  { id: "tropic-s", name: "სამხრეთის ტროპიკი", kind: "parallel", value: -AXIAL_TILT, color: "#ffb703", note: "23°26′ ს. გ. 22 დეკემბერს შუადღისას მზე აქ ზენიტშია." },
  { id: "arctic", name: "ჩრდილოეთის პოლარული წრე", kind: "parallel", value: 90 - AXIAL_TILT, color: "#7dd3fc", note: "66°34′ ჩ. გ. ამის ჩრდილოეთით ზაფხულში არის პოლარული დღე, ზამთარში — პოლარული ღამე." },
  { id: "antarctic", name: "სამხრეთის პოლარული წრე", kind: "parallel", value: -(90 - AXIAL_TILT), color: "#7dd3fc", note: "66°34′ ს. გ. ანტარქტიდის თითქმის მთელი ტერიტორია ამ წრის სამხრეთითაა." },
  { id: "prime", name: "საწყისი (გრინვიჩის) მერიდიანი", kind: "meridian", value: 0, color: "#a3e635", note: "0° გრძედი. გადის ლონდონის გრინვიჩის ობსერვატორიაზე; აქედან ითვლება აღმოსავლეთის და დასავლეთის გრძედი." },
  { id: "antimeridian", name: "180-ე მერიდიანი", kind: "meridian", value: 180, color: "#c084fc", note: "180° გრძედი. მის გასწვრივ დაახლოებით გადის თარიღის საერთაშორისო ცვლის ხაზი." },
];

/** A parallel (circle of latitude) as a thin torus. */
export function parallel(radius: number, lat: number, tube: number, material: THREE.Material) {
  const r = radius * Math.cos(THREE.MathUtils.degToRad(lat));
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(Math.max(r, 1e-4), tube, 4, 160), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = radius * Math.sin(THREE.MathUtils.degToRad(lat));
  return mesh;
}

/** Half circle from pole to pole at longitude `lon`. */
export function meridian(radius: number, lon: number, tube: number, material: THREE.Material) {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 4, 96, Math.PI), material);
  arc.rotation.z = -Math.PI / 2;
  const g = new THREE.Group();
  g.rotation.y = THREE.MathUtils.degToRad(lon);
  g.add(arc);
  return g;
}

export function buildGraticule(radius: number, step = 15) {
  const group = new THREE.Group();
  group.name = "graticule";
  const r = radius * 1.002;
  const minor = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.32, depthWrite: false });
  for (let lat = -90 + step; lat < 90; lat += step) if (lat !== 0) group.add(parallel(r, lat, radius * 0.0018, minor));
  for (let lon = -180 + step; lon < 180; lon += step) if (lon !== 0) group.add(meridian(r, lon, radius * 0.0018, minor));
  for (const line of SPECIAL_LINES) {
    const m = new THREE.MeshBasicMaterial({ color: line.color });
    const obj = line.kind === "parallel" ? parallel(r * 1.001, line.value, radius * 0.0045, m) : meridian(r * 1.001, line.value, radius * 0.0045, m);
    obj.name = line.id;
    group.add(obj);
  }
  return group;
}

/** A highlighted parallel + meridian through one point (follows the cursor). Unit-sized, scaled by `place`. */
export function buildCrosshair(radius: number, color = "#ffe066") {
  const circle = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2), 0, Math.sin((i / 128) * Math.PI * 2))));
  const half = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(-Math.PI / 2 + (i / 64) * Math.PI), Math.sin(-Math.PI / 2 + (i / 64) * Math.PI), 0)));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
  const par = new THREE.Line(circle, mat);
  const mer = new THREE.Line(half, mat);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.014, 16, 12), new THREE.MeshBasicMaterial({ color }));
  const group = new THREE.Group();
  group.add(par, mer, dot);
  group.visible = false;
  const r = radius * 1.004;
  const place = (lat: number, lon: number, point: THREE.Vector3) => {
    const c = Math.cos(THREE.MathUtils.degToRad(lat)) * r;
    par.scale.set(c, 1, c);
    par.position.y = Math.sin(THREE.MathUtils.degToRad(lat)) * r;
    mer.scale.setScalar(r);
    mer.rotation.y = THREE.MathUtils.degToRad(lon);
    dot.position.copy(point).setLength(r);
    group.visible = true;
  };
  return { group, place, hide: () => (group.visible = false) };
}
