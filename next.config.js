/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    appDir: true,
  },

  async redirects() {
    return [
      {
        source: '/blog/covidmap',
        destination: 'https://covidmap.cuatro.dev/',
        permanent: true,
      },
      {
        source: '/blog/future-vizion',
        destination: 'https://future-vizion.cuatro.dev/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
