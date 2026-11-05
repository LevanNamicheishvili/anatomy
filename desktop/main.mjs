import { app, BrowserWindow, dialog, Menu, net, powerSaveBlocker, session, shell, utilityProcess } from "electron";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The desktop application. With internet it shows the real site: the same sign-in, accounts and schools, and every
 * update of the site is there at once. Without internet it falls back on the copy of the site that comes with it,
 * started on this computer only (127.0.0.1), for whoever has signed in here in the last 30 days and with their own
 * role. That memory is a convenience kept in a plain file, not protection of the lessons, which are on this disk anyway.
 * The presentation always runs from the copy: it must not depend on a hall's internet. Models, pictures and recordings
 * that are the same on the site as in the copy are read from the disk even with internet: they open at once.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = (process.env.ATLAS_SITE_URL || "https://anatomy-six-beta.vercel.app").replace(/\/$/, "");
const SITE_ORIGIN = new URL(SITE_URL).origin;
/** Always the same port if free: what a page keeps in the browser's storage belongs to its address. */
const PREFERRED_PORT = 47821;
const COPY = app.isPackaged ? path.join(process.resourcesPath, "site") : path.join(here, "build", "site");
const REMEMBER_DAYS = 30;

// Only this site runs here, and a school's old graphics card must not leave the 3D scenes blank: use the card even if
// it is on Chromium's list of doubtful ones, and draw in software where there is no usable card at all.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
// The lessons' voice starts when the teacher asks, without a further click.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let win = null;
let server = null;
/** Who the copy's server was started for. */
let serverUser = null;
let copyStarting = null;
let copyOrigin = "";
let online = false;
let quitting = false;
/** Files of the site that are the same in the copy on this disk. */
let sameFiles = new Set();

// ---- Who signed in on this computer --------------------------------------------------------------------------------

const identityFile = () => path.join(app.getPath("userData"), "identity.json");

function rememberedUser() {
  try {
    const { user, verifiedAt } = JSON.parse(readFileSync(identityFile(), "utf8"));
    return Date.now() - verifiedAt < REMEMBER_DAYS * 86400000 ? user : null;
  } catch {
    return null;
  }
}

let lastAsked = 0;
let askTimer = null;
/** Asks the site who is signed in, a moment after a page changed (at most every 5 seconds; at once on the sign-in page). */
function askWhoIsSignedIn(url) {
  clearTimeout(askTimer);
  const wait = new URL(url).pathname === "/login" ? 800 : Math.max(800, lastAsked + 5000 - Date.now());
  askTimer = setTimeout(async () => {
    lastAsked = Date.now();
    try {
      const res = await session.defaultSession.fetch(`${SITE_URL}/api/desktop/me`, { credentials: "include", redirect: "manual", cache: "no-store" });
      if (res.status === 200) writeFileSync(identityFile(), JSON.stringify({ user: await res.json(), verifiedAt: Date.now() }));
      // Signed out, or the account was closed: nobody is remembered any more.
      else if (res.status === 401 || (res.status >= 300 && res.status < 400)) rmSync(identityFile(), { force: true });
    } catch {
      // No answer says nothing about the person: what is remembered stays.
    }
  }, wait);
}

// ---- The copy of the site on this computer ---------------------------------------------------------------------------

const freePort = (port) =>
  new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(port === 0 ? 0 : freePort(0)));
    probe.listen(port, "127.0.0.1", () => {
      const { port: got } = probe.address();
      probe.close(() => resolve(got));
    });
  });

/** Starts the copy's server (once). `forUser`: it must know who signed in last, so it is started again if it does not. */
function startCopy({ forUser = false } = {}) {
  const user = JSON.stringify(rememberedUser());
  if (server && forUser && serverUser !== user) stopCopy();
  copyStarting ??= launchCopy(user).catch((error) => {
    copyStarting = null;
    throw error;
  });
  return copyStarting;
}

function stopCopy() {
  const old = server;
  server = null;
  copyStarting = null;
  copyOrigin = "";
  old?.removeAllListeners("exit");
  old?.kill();
}

async function launchCopy(user) {
  if (!existsSync(path.join(COPY, "server.js"))) throw new Error(`no site at ${COPY}`);
  const port = await freePort(PREFERRED_PORT);
  const origin = `http://127.0.0.1:${port}`;
  serverUser = user;
  server = utilityProcess.fork(path.join(COPY, "server.js"), [], {
    cwd: COPY,
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production", ATLAS_OFFLINE: "1", ATLAS_OFFLINE_USER: user === "null" ? "" : user, HOSTNAME: "127.0.0.1", PORT: String(port) },
  });
  server.once("exit", () => {
    server = null;
    copyStarting = null;
    copyOrigin = "";
    if (quitting || online) return;
    dialog.showErrorBox("სასწავლო პორტალი", "პროგრამა მოულოდნელად გაითიშა. გახსენით თავიდან.");
    app.quit();
  });
  for (let i = 0; i < 300; i++) {
    const ok = await net.fetch(`${origin}/dashboard`, { redirect: "manual" }).then((r) => r.status < 500, () => false);
    if (ok) {
      copyOrigin = origin;
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not start");
}

/** Which files are the same here and on the site (each side's list of content hashes). Nothing known: the site gives them. */
async function compareFiles() {
  try {
    const mine = JSON.parse(readFileSync(path.join(COPY, "public", "asset-manifest.json"), "utf8"));
    const res = await net.fetch(`${SITE_URL}/asset-manifest.json`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return;
    const theirs = await res.json();
    sameFiles = new Set(Object.keys(mine).filter((file) => mine[file] === theirs[file]));
  } catch {
    sameFiles = new Set();
  }
}

/** Requests for those files go to the copy on this computer. */
function readSameFilesFromDisk() {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, done) => {
    if (details.method !== "GET" || !copyOrigin || !sameFiles.size || !details.url.startsWith(`${SITE_ORIGIN}/`)) return done({});
    const { pathname, search } = new URL(details.url);
    done(sameFiles.has(pathname) ? { redirectURL: `${copyOrigin}${pathname}${search}` } : {});
  });
}

// ---- The window ------------------------------------------------------------------------------------------------------

const siteReachable = () =>
  net.fetch(`${SITE_URL}/login`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(6000) }).then((r) => r.status < 500, () => false);

/** The presentation, from the copy on this computer. */
async function openPresentation() {
  await startCopy();
  await win.loadURL(`${copyOrigin}/presentation`);
}

/** No internet: the copy, for someone who has signed in here; nobody yet: say what is needed. */
async function openWithoutInternet() {
  online = false;
  sameFiles = new Set();
  if (!rememberedUser()) {
    await win.loadFile(path.join(here, "no-internet.html"));
    return;
  }
  await startCopy({ forUser: true });
  await win.loadURL(`${copyOrigin}/dashboard`);
}

async function open() {
  await win.loadFile(path.join(here, "splash.html"));
  online = await siteReachable();
  if (!online) return openWithoutInternet();
  // With internet too the copy starts, in the background: models come from it, and the presentation runs on it.
  startCopy().catch(() => {});
  void compareFiles();
  await win.loadURL(`${SITE_URL}/dashboard`).catch(() => {});
}

function makeWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: "#0c1c2e",
    autoHideMenuBar: true,
    title: "სასწავლო პორტალი",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once("ready-to-show", () => win.show());
  const web = win.webContents;

  // There is no menu on Windows and no address bar anywhere: the keys a browser would have.
  web.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    const history = web.navigationHistory;
    if (input.key === "F11") win.setFullScreen(!win.isFullScreen());
    else if (input.key === "F5") web.reload();
    else if ((input.alt && input.key === "ArrowLeft") || (input.meta && input.key === "[")) {
      if (history.canGoBack()) history.goBack();
    } else if ((input.alt && input.key === "ArrowRight") || (input.meta && input.key === "]")) {
      if (history.canGoForward()) history.goForward();
    } else return;
    e.preventDefault();
  });

  const mine = (url) => url.startsWith(`${SITE_ORIGIN}/`) || url === SITE_ORIGIN || (copyOrigin && url.startsWith(copyOrigin));
  web.setWindowOpenHandler(({ url }) => {
    // Printing pages and the like open in this window's place; links to outside in the computer's browser.
    if (/^https?:/.test(url) && !mine(url)) void shell.openExternal(url);
    else if (mine(url)) void web.loadURL(url);
    return { action: "deny" };
  });
  web.on("will-navigate", (e, url) => {
    if (url.startsWith("file:")) {
      // "Try again" on the page that says internet is needed.
      if (url.endsWith("/retry.html")) {
        e.preventDefault();
        void open();
      }
      return;
    }
    const to = new URL(url);
    if (to.origin === SITE_ORIGIN && to.pathname === "/presentation") {
      e.preventDefault();
      void openPresentation();
    } else if (online && copyOrigin && to.origin === copyOrigin && to.pathname !== "/presentation") {
      // Leaving the presentation, with internet: back to the real site.
      e.preventDefault();
      void web.loadURL(`${SITE_URL}${to.pathname}${to.search}`);
    } else if (!mine(url)) {
      e.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });

  // The internet went away while a page was being opened.
  web.on("did-fail-load", (_e, code, _text, url, isMain) => {
    if (isMain && code !== -3 && url.startsWith(SITE_ORIGIN)) void openWithoutInternet();
  });
  const pageChanged = (_e, url) => {
    if (url.startsWith(SITE_ORIGIN)) askWhoIsSignedIn(url);
  };
  web.on("did-navigate", pageChanged);
  web.on("did-navigate-in-page", pageChanged);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on("before-quit", () => {
    quitting = true;
    server?.kill();
  });
  app.on("window-all-closed", () => app.quit());

  app.whenReady().then(async () => {
    if (process.platform !== "darwin") Menu.setApplicationMenu(null);
    // How the site knows it is in the application (it keeps no offline files of its own then).
    session.defaultSession.setUserAgent(`${session.defaultSession.getUserAgent()} SaswavloDesktop`);
    readSameFilesFromDisk();
    // Pages may only go full screen; no camera, microphone, location or notifications.
    session.defaultSession.setPermissionRequestHandler((_, permission, done) => done(permission === "fullscreen"));
    // The screen must not go dark in the middle of a lesson or a presentation.
    powerSaveBlocker.start("prevent-display-sleep");
    makeWindow();
    try {
      await open();
    } catch (error) {
      dialog.showErrorBox("სასწავლო პორტალი", `პროგრამა ვერ გაიხსნა.\n\n${error instanceof Error ? error.message : error}`);
      app.quit();
    }
  });
}
