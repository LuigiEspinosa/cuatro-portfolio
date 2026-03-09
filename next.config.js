/** @type {import('next').NextConfig} */
const pkg = require('./package.json');

const nextConfig = {
  output: 'standalone',
  env: {
    APP_VERSION: pkg.version,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  async redirects() {
    return [
      {
        source: '/recommendation',
        destination: '/pdf/recommendation-letter.pdf',
        permanent: true,
      },
      {
        source: '/cv',
        destination: '/pdf/cv.pdf',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
