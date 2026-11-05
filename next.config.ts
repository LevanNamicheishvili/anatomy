import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Small build tag shown in the atlas corner so QA knows which version is live.
  env: { NEXT_PUBLIC_BUILD: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || new Date().toISOString().slice(0, 16).replace("T", " ") },
  devIndicators: false,
  // The desktop application is built on one computer for all systems: no image optimiser (a native module) in it.
  images: { unoptimized: process.env.ATLAS_DESKTOP === "1" },
  // The 3D models are large: browsers keep them, but check with the server (ETag) on each visit, so a
  // changed model is picked up at once (unchanged files answer 304 without downloading again).
  async headers() {
    return [
      // The desktop application's own copy of the models and recordings is read by pages of the real site.
      ...(process.env.ATLAS_DESKTOP === "1" ? [{ source: "/:dir(sites|geo|narration|journeys|heart|history|dna|models|env|draco|images|videos)/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }] : []),
      // The service worker must always be re-checked so new versions reach offline users.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
        source: "/sites/:site/shared/models/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
