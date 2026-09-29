import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // App Router is the default in Next 16. Nothing custom needed for Story 2.1;
  // the /auth/steam/* route handlers pin their own `runtime = 'nodejs'`.
};

export default nextConfig;
