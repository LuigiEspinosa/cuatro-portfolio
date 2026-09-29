import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The image runs the traced standalone server (apps/finance/Dockerfile, AD-8).
  output: "standalone",
};

export default nextConfig;
