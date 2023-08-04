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
      {
        source: '/cv',
        destination: '/pdf/cv.pdf',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
