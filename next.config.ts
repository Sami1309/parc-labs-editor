import type { NextConfig } from "next";

// Enable standalone output so Render can run the built server with `next start`.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
