/**
 * Downloads AWS Terrain Tiles (terrarium PNGs, public dataset) covering Georgia, for
 * scripts/build-georgia-terrain.py.  Usage: node scripts/download-terrain-tiles.mjs <out dir> [zoom=9]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2];
const Z = Number(process.argv[3] ?? 9);
if (!OUT) throw new Error("usage: node scripts/download-terrain-tiles.mjs <out dir> [zoom]");
mkdirSync(OUT, { recursive: true });

const [LON0, LON1, LAT_N, LAT_S] = [39.9, 46.8, 43.7, 40.95];
const n = 2 ** Z;
const tx = (lon) => Math.floor(((lon + 180) / 360) * n);
const ty = (lat) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
};

const jobs = [];
for (let x = tx(LON0); x <= tx(LON1); x++) for (let y = ty(LAT_N); y <= ty(LAT_S); y++) jobs.push([x, y]);
let done = 0;
async function worker() {
  while (jobs.length) {
    const [x, y] = jobs.pop();
    const file = join(OUT, `${Z}_${x}_${y}.png`);
    if (!existsSync(file)) {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
      if (!res.ok) throw new Error(`${Z}/${x}/${y}: HTTP ${res.status}`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    done++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`${done} tiles in ${OUT}`);
