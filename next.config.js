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
  // The home document varies on a request header, so it says so (Story 2-13).
  //
  // `app/page.tsx` reads `Save-Data` and serves a different hero for it, and AD-26 puts Cloudflare
  // in front of this origin. A shared cache that stored one visitor's document and replayed it for
  // another would hand a data-saving visitor the 3D front door, or the reverse.
  //
  // **This declaration does not reach the wire today, and it is kept anyway.** Measured 2026-09-07
  // against `.next/standalone/server.js`: a custom header from this block is applied (a probe key
  // arrived), and then Next overwrites `Vary` with its own
  // `RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch,
  // Accept-Encoding` for every App Router response, so this value is replaced rather than merged.
  // What actually forbids the mis-serve today is the `Cache-Control: no-store, must-revalidate,
  // no-cache, max-age=0, private` Next sends for a dynamically rendered route, which no shared
  // cache may store at all. `tests/e2e/front-door.pw.ts` asserts the guarantee rather than the
  // header: `/` is either varying on `Save-Data` or unstorable by a shared cache, and the day
  // someone makes it cacheable without the first, that case fails. DW-51 records the gap and what
  // closing it costs.
  async headers() {
    return [
      {
        source: '/',
        headers: [{ key: 'Vary', value: 'Save-Data' }],
      },
    ];
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
