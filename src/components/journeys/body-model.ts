import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/*
 * Loads the journeys' body (public/journeys, built by scripts/build-journeys.mjs from BodyParts3D):
 * positions are 16-bit over the body's box, normals 8-bit, indices 16-bit. The brain is a separate file
 * that only the nerve-impulse journey asks for. Coordinates are metres; +x is the body's left, +z its front.
 */

const VERSION = "2026-10-07c";

export type BodyGroup = "skin" | "skeleton" | "humerus" | "radius" | "ulna" | "femur" | "brain" | "heart" | "lungs" | "arteries" | "veins" | "biceps" | "triceps" | "endocrine" | "gonads" | "urinary" | "digestive" | "airways" | "spleen" | "diaphragm" | "discs";

export interface BodyPart {
  id: string;
  name: string;
  group: BodyGroup;
  file: "core" | "brain" | "organs";
  vertexCount: number;
  indexCount: number;
  positions: number;
  normals: number;
  indices: number;
  centre: [number, number, number];
}

export interface BodyData {
  source: string;
  box: { min: [number, number, number]; size: [number, number, number] };
  parts: BodyPart[];
  spine: [number, number, number][];
  elbow: [number, number, number];
  elbowAxis: [number, number, number];
}

let meta: Promise<BodyData> | null = null;
const bins = new Map<string, Promise<ArrayBuffer>>();

const gunzip = (url: string) => fetch(url).then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());

export class Body {
  constructor(
    readonly data: BodyData,
    private files: Record<string, ArrayBuffer>,
  ) {}

  parts(filter: (p: BodyPart) => boolean) {
    return this.data.parts.filter(filter);
  }

  /** One part as a geometry with float positions (so it can be bent or merged freely). */
  geometry(p: BodyPart) {
    const buf = this.files[p.file];
    const q = new Uint16Array(buf, p.positions, p.vertexCount * 3);
    const { min, size } = this.data.box;
    const pos = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) pos[i] = min[i % 3] + (q[i] / 65535) * size[i % 3];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(Array.from(new Int8Array(buf, p.normals, p.vertexCount * 3), (n) => n / 127)), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, p.indices, p.indexCount).slice(), 1));
    g.computeBoundingSphere();
    return g;
  }

  /** Several parts merged into one geometry (one draw call). */
  merged(filter: (p: BodyPart) => boolean) {
    const list = this.parts(filter).map((p) => this.geometry(p));
    if (!list.length) return new THREE.BufferGeometry();
    const g = mergeGeometries(list)!;
    for (const x of list) x.dispose();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** The body; `brain` and `organs` (glands, kidneys, gut, airways) are extra downloads, asked for only where shown. */
export async function loadBody(extra: boolean | { brain?: boolean; organs?: boolean }) {
  meta ??= fetch(`/journeys/body.json?v=${VERSION}`).then((r) => r.json() as Promise<BodyData>);
  const o = typeof extra === "boolean" ? { brain: extra } : extra;
  const names = ["core", ...(o.brain ? ["brain"] : []), ...(o.organs ? ["organs"] : [])];
  for (const n of names) if (!bins.has(n)) bins.set(n, gunzip(`/journeys/${n}.bin.gz?v=${VERSION}`));
  const [data, ...buffers] = await Promise.all([meta, ...names.map((n) => bins.get(n)!)]);
  return new Body(data, Object.fromEntries(names.map((n, i) => [n, buffers[i]])));
}
