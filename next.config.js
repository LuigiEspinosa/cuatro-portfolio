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
      // **`statusCode: 301` rather than `permanent: true`, deliberately, and this row is meant to
      // differ in shape from the two below it (Story 2-14).**
      //
      // Next's `permanent: true` emits **308**, which is what `/cv` and `/recommendation` answer
      // and what `tests/e2e/narrative.pw.ts` records for them. Story 2-14's acceptance criterion
      // says 301, on the Operator ruling of 2026-09-07, so the status is written out. Next refuses
      // `permanent` alongside `statusCode`, which is why this row carries one key where the others
      // carry the other. It is not an inconsistency to tidy up.
      //
      // `/projects` used to render a second `<SuiteDirectory />` over the same Registry, which is
      // two renderings of one dataset (NFR-9). The page is gone and the URL is not: it is live at
      // v2.5.3 and NFR-2 forbids answering 404 to a link, a bookmark or a search result that still
      // points at it. The fragment is the Directory heading's own id on `/`
      // (`SuiteDirectory.tsx:137`), and the browser resolves it without ever sending it here.
      {
        source: '/projects',
        destination: '/#suite',
        statusCode: 301,
      },
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
