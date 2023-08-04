/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    appDir: true,
  },

  async redirects() {
    return [
      {
        source: '/recommendation',
        destination: '/pdf/recommendation-letter.pdf',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
