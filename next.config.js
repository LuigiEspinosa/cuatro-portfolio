/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
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

export default nextConfig;
