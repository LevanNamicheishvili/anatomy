import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Builds the site for the desktop application and puts it in desktop/build/site: the Next.js server (standalone), its
 * static files and everything in public/. No secret may go into an application that is handed out, so environment
 * files are left out, and the build stops if anything that looks like a key or a database address is found in it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const site = path.join(here, "build", "site");

// Next's build cache has served old styles after a change to globals.css: an application is always built clean.
rmSync(path.join(root, ".next", "cache"), { recursive: true, force: true });
execSync("node scripts/asset-manifest.mjs && npx next build", { cwd: root, stdio: "inherit", env: { ...process.env, ATLAS_DESKTOP: "1" } });

rmSync(site, { recursive: true, force: true });
const standalone = path.join(root, ".next", "standalone");
// Real files, not links: links point at this computer's folders and would be broken on any other.
cpSync(standalone, site, { recursive: true, dereference: true });
cpSync(path.join(root, ".next", "static"), path.join(site, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(site, "public"), {
  recursive: true,
  filter: (src) => !/\.DS_Store$|README\.md$/.test(src),
});

for (const name of readdirSync(site)) if (name.startsWith(".env")) rmSync(path.join(site, name));

const SECRET = /mongodb(\+srv)?:\/\/[^\s"'`<]*:[^\s"'`<]*@|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const TEXT = /\.(js|mjs|cjs|json|html|txt|map|env|rsc|meta|nft)$/;
let files = 0;
const scan = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (p !== path.join(site, "public")) scan(p);
    } else if (TEXT.test(name) || name.startsWith(".env")) {
      files++;
      if (SECRET.test(readFileSync(p, "utf8"))) throw new Error(`A secret in the application's files: ${path.relative(site, p)}`);
    }
  }
};
scan(site);
if (!existsSync(path.join(site, "server.js"))) throw new Error("No server.js in the built site");
console.log(`Site ready in ${path.relative(root, site)}: ${files} files checked, no secrets.`);
