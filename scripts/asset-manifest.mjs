/*
 * A list of every file in public/ with a short hash of its content: public/asset-manifest.json. The desktop application
 * carries its own copy of these files; it compares its list with the site's and takes from the disk every file that is
 * the same, so models and recordings open at once and a file changed on the site is never replaced by an old one.
 * Runs before every build. Holds no secrets: only file names and hashes (and it is open without signing in).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const OUT = "asset-manifest.json";
const list = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (name !== OUT && name !== ".DS_Store" && name !== "README.md") list[`/${path.relative(root, file).split(path.sep).join("/")}`] = createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 12);
  }
};
walk(root);
writeFileSync(path.join(root, OUT), JSON.stringify(list));
console.log(`${OUT}: ${Object.keys(list).length} files`);
