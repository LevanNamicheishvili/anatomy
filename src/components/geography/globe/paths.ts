import * as THREE from "three";
import { latLonToVec3, type LatLon } from "./coords";

/*
 * Lines on the globe (voyages, ocean currents): the waypoints are joined along great circles and lifted a
 * little above the surface, then turned into a tube. `stopAt[i]` is how far along the path (0…1, by length)
 * waypoint i lies, so a ship can be placed and the drawn part trimmed by progress.
 */

export interface GlobePath {
  curve: THREE.CatmullRomCurve3;
  stopAt: number[];
  /** Length in kilometres (along the surface). */
  km: number;
}

const EARTH_KM = 6371;

export function globePath(points: LatLon[], radius: number, lift = 0.006, stepDeg = 1.5): GlobePath {
  const r = radius * (1 + lift);
  const dense: THREE.Vector3[] = [];
  const stopAt: number[] = [0];
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = latLonToVec3(points[i].lat, points[i].lon, 1);
    const b = latLonToVec3(points[i + 1].lat, points[i + 1].lon, 1);
    const angle = a.angleTo(b);
    const n = Math.max(2, Math.ceil(THREE.MathUtils.radToDeg(angle) / stepDeg));
    const q = new THREE.Quaternion().setFromUnitVectors(a, b);
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const p = a.clone().applyQuaternion(new THREE.Quaternion().slerp(q, k / n));
      dense.push(p.multiplyScalar(r));
    }
    total += angle;
    lens.push(total);
  }
  for (const l of lens) stopAt.push(total ? l / total : 0);
  const curve = new THREE.CatmullRomCurve3(dense, false, "centripetal");
  // Legs are cut into steps of different sizes; a fine length table keeps the speed along the path even.
  curve.arcLengthDivisions = Math.max(200, dense.length * 4);
  // Arc-length parametrisation of the dense curve matches the summed great-circle angles closely enough.
  return { curve, stopAt, km: total * EARTH_KM };
}

/** A tube along the path; `trim(k)` shows only the first k (0…1) of it. */
export function pathTube(path: GlobePath, width: number, material: THREE.Material) {
  const segments = Math.max(16, path.curve.points.length * 3);
  const radial = 6;
  const geo = new THREE.TubeGeometry(path.curve, segments, width, radial, false);
  const mesh = new THREE.Mesh(geo, material);
  const full = geo.index ? geo.index.count : 0;
  const trim = (k: number) => geo.setDrawRange(0, Math.round(THREE.MathUtils.clamp(k, 0, 1) * segments) * radial * 6 || (k > 0 ? radial * 6 : 0));
  return { mesh, trim, full };
}
