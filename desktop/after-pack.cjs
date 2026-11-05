/* eslint-disable @typescript-eslint/no-require-imports -- electron-builder loads this hook as CommonJS. */
const { cpSync, readdirSync, rmSync } = require("node:fs");
const path = require("node:path");

/*
 * electron-builder leaves node_modules and folders starting with a dot out of extra resources, and the site's server
 * needs both (node_modules, .next): the built site is copied into the package here, whole.
 */
exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context;
  const app = electronPlatformName === "darwin" ? readdirSync(appOutDir).find((name) => name.endsWith(".app")) : null;
  const resources = app ? path.join(appOutDir, app, "Contents", "Resources") : path.join(appOutDir, "resources");
  const site = path.join(resources, "site");
  rmSync(site, { recursive: true, force: true });
  cpSync(path.join(__dirname, "build", "site"), site, { recursive: true, dereference: true });
};
