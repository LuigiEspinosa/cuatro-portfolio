/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    appDir: true,
  },

  async redirects() {
    return [
      {
        source: '/blog/future-vizion',
        destination: 'https://future-vizion.cuatro.dev/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
