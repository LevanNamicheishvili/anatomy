import * as THREE from "three";
import { rng, type Kit, type V3 } from "@/components/journeys/JourneyScene";
import type { LocalField } from "./terrain";

/*
 * The beech and hornbeam woods of the Didgori ravines. Where the satellite picture shows forest
 * (didgori-trees.bin.gz: one record per 42 m cell) the record is filled with several trees; the trees are
 * grouped in 800 m tiles, each drawn as one instanced mesh, with simpler and fewer trees far from the camera.
 */

const TILE = 800;

/** A leafy crown seen from any side: clusters of leaves with soft edges (drawn once on a canvas). */
function crownTexture(k: Kit) {
  return k.canvasTexture(256, 256, (ctx) => {
    const r = rng(77);
    ctx.clearRect(0, 0, 256, 256);
    // A crown of several billowing clusters (beech, hornbeam), each lit from above and shaded beneath.
    const clusters = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + r() * 0.6;
      const d = i === 0 ? 0 : 45 + r() * 35;
      return { x: 128 + Math.cos(a) * d, y: 136 + Math.sin(a) * d * 0.8, r: 42 + r() * 26 };
    });
    for (let i = 0; i < 2600; i++) {
      const c = clusters[Math.floor(r() * clusters.length)];
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * c.r;
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d;
      if (Math.hypot(x - 128, y - 128) > 124) continue;
      // Light from above-left, dark in the hollows between clusters.
      const top = (c.y - y) / c.r;
      const shade = 0.45 + 0.35 * top + 0.25 * (1 - d / c.r) + (r() - 0.5) * 0.3;
      const g = Math.max(30, Math.min(255, Math.round(150 * shade + 30)));
      ctx.fillStyle = `rgb(${Math.round(g * 0.62)},${g},${Math.round(g * 0.4)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + r() * 5, 2.5 + r() * 3.5, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Crossed cards round a crown centre, with normals pointing out of the crown (soft, round light). */
function treeGeometry(k: Kit, detailed: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const crownC = new THREE.Vector3(0, 0.66, 0);
  const R = 0.3;
  const card = (rotY: number, tilt: number, y: number, size: number) => {
    const g = new THREE.PlaneGeometry(size, size * 0.92);
    g.rotateX(tilt).rotateY(rotY).translate(0, y, 0);
    parts.push(g);
  };
  const n = detailed ? 3 : 2;
  for (let i = 0; i < n; i++) card((i / n) * Math.PI, 0, crownC.y, R * 2.2);
  card(0, -Math.PI / 2, crownC.y + 0.05, R * 2.1);
  if (detailed) {
    card(0.6, -Math.PI / 2 + 0.5, crownC.y - 0.1, R * 1.7);
    card(2.2, -Math.PI / 2 - 0.5, crownC.y + 0.12, R * 1.5);
  }
  for (const g of parts) {
    const p = g.attributes.position as THREE.BufferAttribute;
    const nr = g.attributes.normal as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).sub(crownC);
      v.y *= 1.4;
      v.normalize();
      nr.setXYZ(i, v.x, v.y, v.z);
    }
  }
  const crown = mergeSimple(parts);
  let trunk: THREE.BufferGeometry | null = null;
  if (detailed) {
    trunk = new THREE.CylinderGeometry(0.012, 0.022, 0.6, 5, 1, true).translate(0, 0.3, 0);
    trunk.deleteAttribute("uv");
  }
  return { crown: k.track(crown), trunk: trunk ? k.track(trunk) : null };
}

function mergeSimple(list: THREE.BufferGeometry[]) {
  let n = 0;
  let ni = 0;
  for (const g of list) {
    n += g.attributes.position.count;
    ni += g.index!.count;
  }
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const idx = new Uint16Array(ni);
  let o = 0;
  let oi = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    uv.set(g.attributes.uv.array as Float32Array, o * 2);
    const gi = g.index!.array;
    for (let i = 0; i < gi.length; i++) idx[oi + i] = gi[i] + o;
    o += c;
    oi += gi.length;
    g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  m.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  m.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

interface Tile {
  cx: number;
  cz: number;
  crown: THREE.InstancedMesh;
  trunk: THREE.InstancedMesh | null;
  total: number;
}

export async function buildForest(k: Kit, field: LocalField, perRecord: number) {
  const raw = await fetch("/history/didgori-trees.bin.gz?v=2026-10-08c").then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  const dv = new DataView(raw);
  const count = Math.floor(raw.byteLength / 6);
  const [WM, DM] = field.meta.metres;
  const r = rng(4242);
  const tex = crownTexture(k);
  const hi = treeGeometry(k, true);
  const lo = treeGeometry(k, false);
  const crownMat = k.track(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 }));
  // Both faces of a card share the crown's outward normal.
  crownMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", THREE.ShaderChunk.normal_fragment_begin.replace(/normal \*= faceDirection;/g, ""));
  };
  crownMat.customProgramCacheKey = () => "crown";
  const crownDepth = k.track(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
  const trunkMat = k.track(new THREE.MeshStandardMaterial({ color: "#4a3f35", roughness: 0.95, metalness: 0 }));

  // Bin the trees into tiles.
  const nx = Math.ceil(WM / TILE);
  const nz = Math.ceil(DM / TILE);
  const bins: number[][] = Array.from({ length: nx * nz }, () => []);
  const cell = 42;
  for (let i = 0; i < count; i++) {
    const x0 = (dv.getUint16(i * 6, true) / 65535) * WM;
    const z0 = (dv.getUint16(i * 6 + 2, true) / 65535) * DM;
    const s0 = dv.getUint8(i * 6 + 4) / 100;
    const shade = dv.getUint8(i * 6 + 5) / 255;
    for (let t = 0; t < perRecord; t++) {
      const x = x0 + (r() - 0.5) * cell * 1.1;
      const z = z0 + (r() - 0.5) * cell * 1.1;
      if (x < 2 || z < 2 || x > field.W - 2 || z > field.D - 2) continue;
      const b = Math.floor(z / TILE) * nx + Math.floor(x / TILE);
      bins[b].push(x, z, s0 * (0.75 + r() * 0.5), shade * 0.6 + r() * 0.4);
    }
  }
  const group = new THREE.Group();
  const tiles: Tile[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  bins.forEach((list, b) => {
    const n = list.length / 4;
    if (!n) return;
    // Shuffle so that drawing only the first part of the list thins the wood evenly.
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      for (let c = 0; c < 4; c++) [list[i * 4 + c], list[j * 4 + c]] = [list[j * 4 + c], list[i * 4 + c]];
    }
    const crown = new THREE.InstancedMesh(hi.crown, crownMat, n);
    const trunk = hi.trunk ? new THREE.InstancedMesh(hi.trunk, trunkMat, n) : null;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = list[i * 4];
      const z = list[i * 4 + 1];
      const s = list[i * 4 + 2];
      const shade = list[i * 4 + 3];
      const H = 17 * s + 4;
      const y = field.y(x, z) - 0.6;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + H);
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      // Broad crowns, a little wider than tall.
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(H * (1.0 + r() * 0.35), H * (0.85 + r() * 0.2), H * (1.0 + r() * 0.35)));
      crown.setMatrixAt(i, m4);
      trunk?.setMatrixAt(i, m4);
      // Beech (fresh green), hornbeam and oak (darker) mixed.
      col.setHSL(0.22 + r() * 0.08, 0.32 + r() * 0.18, 0.2 + shade * 0.14);
      crown.setColorAt(i, col);
    }
    const tx = (b % nx) * TILE + TILE / 2;
    const tz = Math.floor(b / nx) * TILE + TILE / 2;
    const sphere = new THREE.Sphere(new THREE.Vector3(tx, (minY + maxY) / 2, tz), Math.hypot(TILE * 0.72, (maxY - minY) / 2 + 30));
    for (const m of [crown, trunk]) {
      if (!m) continue;
      m.boundingSphere = sphere;
      m.userData.noShadowFit = true;
      m.castShadow = false;
      m.receiveShadow = m === trunk;
      group.add(m);
    }
    crown.customDepthMaterial = crownDepth;
    tiles.push({ cx: tx, cz: tz, crown, trunk, total: n });
  });

  /** Level of detail by distance from the camera; shadows only near the sun's focus. */
  const update = (camera: THREE.Camera, focus: V3 | null, shadowR: number) => {
    const cp = camera.position;
    for (const t of tiles) {
      const d = Math.hypot(t.cx - cp.x, t.cz - cp.z);
      const near = d < 1500;
      const frac = near ? 1 : d < 3200 ? 0.6 : d < 6000 ? 0.4 : 0.25;
      t.crown.geometry = near ? hi.crown : lo.crown;
      t.crown.count = Math.max(1, Math.floor(t.total * frac));
      if (t.trunk) {
        t.trunk.visible = d < 1100;
        t.trunk.count = t.crown.count;
      }
      t.crown.castShadow = !!focus && Math.hypot(t.cx - focus.x, t.cz - focus.z) < shadowR + TILE * 0.75;
    }
  };
  return { group, update };
}
