import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
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
