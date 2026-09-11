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
      // **`statusCode: 301` rather than `permanent: true`, deliberately (Story 2-14).**
      //
      // Next's `permanent: true` emits **308**. Story 2-14's acceptance criterion says 301, on the
      // Operator ruling of 2026-09-07, so the status is written out. Next refuses `permanent`
      // alongside `statusCode`, which is why this row carries the one key and not the other. The
      // contrast is still measurable on this build: `/cv/` answers 308 to `/cv` from Next's own
      // trailing-slash row (`node_modules/next/dist/lib/load-custom-routes.js`, `permanent: true`),
      // installed because this file sets neither `trailingSlash` nor `skipTrailingSlashRedirect`,
      // and `tests/e2e/projects-redirect.pw.ts` reads both statuses through one reader.
      //
      // **No `permanent: true` row of this file's own since 2026-09-11.** The 301 below is permanent
      // too, by status; what is gone is the key and the 308 it emits. Two rows used to sit below
      // this one, each `permanent: true` and each standing in for a page that had never rendered.
      // Story 2-16 built `/cv` on 2026-09-10 and removed its row. Story 2-17 retired
      // `/recommendation` outright on 2026-09-11, on the Operator ruling of the same day: the route
      // was never a page, its stub had never rendered behind the redirect, and nothing linked it,
      // so it answers 404 now rather than keeping a placeholder on disk. Neither file is moved or
      // renamed: `public/pdf/cv.pdf` and `public/pdf/recommendation-letter.pdf` are still served at
      // their own URLs, because people hold those URLs and NFR-2 forbids breaking one.
      //
      // **The cost of a permanent redirect, stated rather than left to be discovered.** A 301 is
      // cacheable by default and browsers cache it aggressively and for a long time, with no
      // expiry the origin gets to set from here. Once a visitor has followed this row, deleting or
      // repointing it does not reach that visitor: their browser goes on resolving `/projects` to
      // `/#suite` locally without asking. So this row is effectively one-way for anyone who has
      // used it, and a later story that wants `/projects` back has to assume a population that
      // never sees the change. That is the real argument for choosing it deliberately, and it
      // applies to `permanent: true` and its 308 in exactly the same way; what differs between 301
      // and 308 is only whether a non-GET method may be rewritten to GET, which no client does to
      // this route.
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
    ];
  },
};

module.exports = nextConfig;
