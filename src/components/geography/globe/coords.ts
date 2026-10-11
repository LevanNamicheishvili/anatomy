import * as THREE from "three";

/*
 * Latitude/longitude ↔ 3D point on a globe. The mapping matches three.js SphereGeometry UVs, so an
 * equirectangular world image (longitude −180° at the left edge) lines up: 0° E points along +x,
 * 90° E along −z, the North Pole along +y.
 */

const D = Math.PI / 180;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Point at `lat`, `lon` (degrees) on a sphere of radius `r`. */
export function latLonToVec3(lat: number, lon: number, r = 1, out = new THREE.Vector3()) {
  const theta = (90 - lat) * D;
  const phi = (lon + 180) * D;
  return out.set(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

/** Latitude/longitude (degrees) of a point given in the globe's own coordinates. */
export function vec3ToLatLon(p: THREE.Vector3): LatLon {
  const r = p.length() || 1;
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(p.y / r, -1, 1)) / D;
  let lon = Math.atan2(p.z, -p.x) / D - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

/** 41.716 → "41°43′" */
export function dms(value: number) {
  const a = Math.abs(value);
  let deg = Math.floor(a);
  let min = Math.round((a - deg) * 60);
  if (min === 60) {
    deg += 1;
    min = 0;
  }
  return `${deg}°${String(min).padStart(2, "0")}′`;
}

/** Georgian textbook style: "41°43′ ჩ. გ." with the international letter (N/S) alongside. */
export function formatLat(lat: number) {
  if (Math.abs(lat) < 1 / 120) return { text: "0° (ეკვატორი)", letter: "" };
  return lat > 0 ? { text: `${dms(lat)} ჩ. გ.`, letter: "N" } : { text: `${dms(lat)} ს. გ.`, letter: "S" };
}

/** "44°47′ აღმ. გრ." (E) or "…დას. გრ." (W). */
export function formatLon(lon: number) {
  if (Math.abs(lon) < 1 / 120) return { text: "0° (გრინვიჩი)", letter: "" };
  if (Math.abs(Math.abs(lon) - 180) < 1 / 120) return { text: "180°", letter: "" };
  return lon > 0 ? { text: `${dms(lon)} აღმ. გრ.`, letter: "E" } : { text: `${dms(lon)} დას. გრ.`, letter: "W" };
}
