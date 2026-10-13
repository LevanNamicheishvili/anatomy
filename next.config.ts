import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Small build tag shown in the atlas corner so QA knows which version is live.
  env: { NEXT_PUBLIC_BUILD: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || new Date().toISOString().slice(0, 16).replace("T", " ") },
  devIndicators: false,
  // The 3D models are large: browsers keep them, but check with the server (ETag) on each visit, so a
  // changed model is picked up at once (unchanged files answer 304 without downloading again).
  async headers() {
    return [
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
