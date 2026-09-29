import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The image runs the traced standalone server (apps/tournament/Dockerfile, AD-8, Story 3-7).
  // The /auth/steam/* route handlers pin their own `runtime = 'nodejs'`.
  output: 'standalone',
};

export default nextConfig;
