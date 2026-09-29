// Downloads BodyParts3D-derived model chunks (CC BY 4.0, © DBCLS) and the favicon
// used by the human-atlas.co clone into its namespaced public folder.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ORIGIN = "https://human-atlas.co";
const OUT = "public/sites/human-atlas-co-f41dd540/shared";

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log("saved", dest);
}

await mkdir(join(OUT, "models"), { recursive: true });
await mkdir(join(OUT, "seo"), { recursive: true });

const atlas = await fetch(`${ORIGIN}/models/atlas.json`).then((r) => r.json());
await writeFile(join(OUT, "models/atlas.json"), JSON.stringify(atlas));

const jobs = [
  [`${ORIGIN}/favicon.svg`, join(OUT, "seo/favicon.svg")],
  ...atlas.chunks.map((c) => [`${ORIGIN}${c.gzip}`, join(OUT, "models", c.gzip.split("/").pop())]),
];
for (let i = 0; i < jobs.length; i += 4) {
  await Promise.all(jobs.slice(i, i + 4).map(([u, d]) => download(u, d)));
}
