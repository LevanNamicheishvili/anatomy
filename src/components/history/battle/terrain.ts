import * as THREE from "three";
import type { Kit, V3 } from "@/components/journeys/JourneyScene";
import type { Ground } from "./sim";

/*
 * The ground of the battle: an 11 × 7.4 km window round the Didgori field at 15 m (AWS Terrain Tiles) under a
 * Sentinel-2 picture (EOxCloudless 2024, roads and villages painted out), with a photographed grass-and-rock
 * texture blended in near the camera; a coarser 100 m ring of the surrounding mountains out to the horizon;
 * and a sky with the morning sun. Scene units are metres: x east, z south, y = height above 1000 m.
 */

const VERSION = "2026-10-08c";

interface LocalMeta {
  width: number;
  height: number;
  lon: [number, number];
  lat: [number, number];
  metres: [number, number];
  trees: number;
}

interface WideMeta {
  width: number;
  height: number;
  lon: [number, number];
  lat: [number, number];
}

const gunzip = (r: Response) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();

export class LocalField implements Ground {
  readonly W: number;
  readonly D: number;
  /** Mesh grid (vertices across / down) and cell size in metres. */
  readonly gw: number;
  readonly gh: number;
  readonly cx: number;
  readonly cz: number;
  readonly h: Float32Array;

  constructor(
    readonly meta: LocalMeta,
    src: Int16Array,
    readonly step: number,
  ) {
    const { width: GW, height: GH, metres } = meta;
    this.gw = Math.floor((GW - 1) / step) + 1;
    this.gh = Math.floor((GH - 1) / step) + 1;
    this.cx = (metres[0] / (GW - 1)) * step;
    this.cz = (metres[1] / (GH - 1)) * step;
    this.W = (this.gw - 1) * this.cx;
    this.D = (this.gh - 1) * this.cz;
    this.h = new Float32Array(this.gw * this.gh);
    for (let j = 0; j < this.gh; j++) for (let i = 0; i < this.gw; i++) this.h[j * this.gw + i] = src[j * step * GW + i * step] - 1000;
  }

  /** Height (m above 1000) exactly on the drawn triangles at x, z. */
  y(x: number, z: number) {
    const fx = Math.min(this.gw - 1.0001, Math.max(0, x / this.cx));
    const fz = Math.min(this.gh - 1.0001, Math.max(0, z / this.cz));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const gw = this.gw;
    const h = this.h;
    // PlaneGeometry splits each cell along the diagonal from (i, j+1) to (i+1, j).
    const a = h[j * gw + i];
    const b = h[(j + 1) * gw + i];
    const c = h[(j + 1) * gw + i + 1];
    const d = h[j * gw + i + 1];
    return tx + tz <= 1 ? a + (d - a) * tx + (b - a) * tz : c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
  }

  /** Scene x, z of a longitude / latitude. */
  xz(lon: number, lat: number): [number, number] {
    const { lon: L, lat: A, metres } = this.meta;
    return [((lon - L[0]) / (L[1] - L[0])) * metres[0], ((A[0] - lat) / (A[0] - A[1])) * metres[1]];
  }

  p(x: number, z: number, lift = 0): V3 {
    return new THREE.Vector3(x, this.y(x, z) + lift, z);
  }
}

export const MAX_MARKS = 24;

/** Coloured footprints of regiments painted on the ground (centre, radii, facing, colour). */
export interface Marks {
  n: { value: number };
  pos: { value: THREE.Vector4[] };
  rot: { value: THREE.Vector2[] };
  col: { value: THREE.Vector4[] };
  overlay: { value: number };
}

export async function loadTerrain(k: Kit) {
  const tl = new THREE.TextureLoader();
  const [meta, buf, sat, detail, detailNor, wmeta, wbuf, wsat] = await Promise.all([
    fetch(`/history/didgori-local.json?v=${VERSION}`).then((r) => r.json() as Promise<LocalMeta>),
    fetch(`/history/didgori-local.bin.gz?v=${VERSION}`).then(gunzip),
    tl.loadAsync(`/history/didgori-local.jpg?v=${VERSION}`),
    tl.loadAsync("/models/ground.webp"),
    tl.loadAsync("/models/ground_nor.webp"),
    fetch("/history/didgori-terrain.json?v=2026-10-08").then((r) => r.json() as Promise<WideMeta>),
    fetch("/history/didgori-terrain.bin.gz?v=2026-10-08").then(gunzip),
    tl.loadAsync("/history/didgori-satellite.jpg?v=2026-10-08"),
  ]);
  for (const t of [sat, detail, wsat]) t.colorSpace = THREE.SRGBColorSpace;
  for (const t of [sat, wsat]) t.anisotropy = 8;
  for (const t of [detail, detailNor]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  for (const t of [sat, detail, detailNor, wsat]) k.track(t);

  const field = new LocalField(meta, new Int16Array(buf), k.lowPower ? 2 : 1);
  const group = new THREE.Group();

  // ---- The close-up ground ----
  const geo = new THREE.PlaneGeometry(field.W, field.D, field.gw - 1, field.gh - 1).rotateX(-Math.PI / 2).translate(field.W / 2, 0, field.D / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, field.h[i]);
  geo.computeVertexNormals();
  // Second UV set in metres for the tiled detail texture.
  const uv1 = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv1[i * 2] = pos.getX(i) / 7;
    uv1[i * 2 + 1] = -pos.getZ(i) / 7;
  }
  geo.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
  detailNor.channel = 1;

  // Average colour of the detail photo (so it only adds texture, not a colour cast).
  const avg = new THREE.Color(0.2, 0.18, 0.1);
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(detail.image as CanvasImageSource, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    avg.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace);
  } catch {
    // keep the estimate
  }

  const marks: Marks = {
    n: { value: 0 },
    pos: { value: Array.from({ length: MAX_MARKS }, () => new THREE.Vector4()) },
    rot: { value: Array.from({ length: MAX_MARKS }, () => new THREE.Vector2(1, 0)) },
    col: { value: Array.from({ length: MAX_MARKS }, () => new THREE.Vector4()) },
    overlay: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ map: sat, normalMap: detailNor, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detail };
    sh.uniforms.uAvg = { value: new THREE.Vector3(avg.r, avg.g, avg.b) };
    sh.uniforms.uMarkN = marks.n;
    sh.uniforms.uMarkPos = marks.pos;
    sh.uniforms.uMarkRot = marks.rot;
    sh.uniforms.uMarkCol = marks.col;
    sh.uniforms.uOverlay = marks.overlay;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        uniform sampler2D uDetail;
        uniform vec3 uAvg;
        uniform int uMarkN;
        uniform vec4 uMarkPos[${MAX_MARKS}];
        uniform vec2 uMarkRot[${MAX_MARKS}];
        uniform vec4 uMarkCol[${MAX_MARKS}];
        uniform float uOverlay;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          // The mosaic is dark: lift it to a summer meadow, then add the photo's grain near the camera.
          vec3 c = diffuseColor.rgb * 1.6;
          float l = dot(c, vec3(0.3, 0.55, 0.15));
          c = mix(vec3(l), c, 1.25);
          float dist = length(vWPos - cameraPosition);
          vec3 d1 = texture2D(uDetail, vWPos.xz / 6.5).rgb;
          vec3 d2 = texture2D(uDetail, vWPos.xz / 47.0 + 0.37).rgb;
          float a = dot(uAvg, vec3(0.333));
          float near = 1.0 - smoothstep(40.0, 650.0, dist);
          c *= mix(1.0, dot(d1, vec3(0.333)) / a, 0.85 * near);
          c *= mix(1.0, dot(d2, vec3(0.333)) / a, 0.5 * (1.0 - smoothstep(600.0, 3500.0, dist)));
          // Close up, take some of the photo's own colour (grass blades, bare earth).
          c = mix(c, c * (d1 / max(uAvg, vec3(0.02))), 0.35 * near);
          // Regiments' footprints.
          for (int i = 0; i < ${MAX_MARKS}; i++) {
            if (i >= uMarkN) break;
            vec4 p = uMarkPos[i];
            vec2 r = uMarkRot[i];
            vec2 d = vWPos.xz - p.xy;
            vec2 q = vec2(d.x * r.x - d.y * r.y, d.x * r.y + d.y * r.x) / p.zw;
            float e = length(q);
            float fill = smoothstep(1.0, 0.9, e);
            float edge = fill * smoothstep(0.78, 0.97, e);
            c = mix(c, uMarkCol[i].rgb, (fill * 0.32 + edge * 0.55) * uMarkCol[i].a * uOverlay);
          }
          diffuseColor.rgb = c;
        }`,
      );
  };
  mat.customProgramCacheKey = () => "didgori-ground";
  k.track(mat);
  const mesh = new THREE.Mesh(k.track(geo), mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.noShadowFit = true;
  group.add(mesh);

  // ---- The mountains round about (100 m grid), with a hole where the close-up ground is ----
  {
    const GW = wmeta.width;
    const GH = wmeta.height;
    const hw = new Int16Array(wbuf);
    const L = meta.lon;
    const A = meta.lat;
    const toX = (lon: number) => ((lon - L[0]) / (L[1] - L[0])) * meta.metres[0];
    const toZ = (lat: number) => ((A[0] - lat) / (A[0] - A[1])) * meta.metres[1];
    const p = new Float32Array(GW * GH * 3);
    const uv = new Float32Array(GW * GH * 2);
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const lon = wmeta.lon[0] + ((wmeta.lon[1] - wmeta.lon[0]) * i) / (GW - 1);
        const lat = wmeta.lat[0] + ((wmeta.lat[1] - wmeta.lat[0]) * j) / (GH - 1);
        const x = toX(lon);
        const z = toZ(lat);
        const inside = x > 0 && x < field.W && z > 0 && z < field.D;
        const o = j * GW + i;
        p[o * 3] = x;
        p[o * 3 + 1] = hw[o] - 1000 - (inside ? 25 : 3);
        p[o * 3 + 2] = z;
        uv[o * 2] = i / (GW - 1);
        uv[o * 2 + 1] = 1 - j / (GH - 1);
      }
    const idx: number[] = [];
    const inner = (o: number) => p[o * 3] > 60 && p[o * 3] < field.W - 60 && p[o * 3 + 2] > 60 && p[o * 3 + 2] < field.D - 60;
    for (let j = 0; j < GH - 1; j++)
      for (let i = 0; i < GW - 1; i++) {
        const a = j * GW + i;
        const b = a + GW;
        const c = b + 1;
        const d = a + 1;
        if (inner(a) && inner(b) && inner(c) && inner(d)) continue;
        idx.push(a, b, d, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const wm = new THREE.MeshStandardMaterial({ map: wsat, roughness: 1, metalness: 0 });
    wm.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= 1.7;");
    };
    k.track(wm);
    const ring = new THREE.Mesh(k.track(g), wm);
    ring.receiveShadow = false;
    ring.castShadow = false;
    ring.userData.noShadowFit = true;
    group.add(ring);
  }

  return { field, group, marks };
}

/** Sky: deep blue overhead fading to haze at the horizon, with the sun. Follows the camera. */
export function skyDome(k: Kit, sun: V3, horizon: string) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun.clone().normalize() },
      uZenith: { value: new THREE.Color("#2a5fae") },
      uHorizon: { value: new THREE.Color(horizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w * 0.99999;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.86, 0.62) * (pow(s, 900.0) * 40.0 + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.12);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  k.track(mat);
  const mesh = new THREE.Mesh(k.track(new THREE.SphereGeometry(1000, 32, 16)), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.noShadowFit = true;
  return mesh;
}
