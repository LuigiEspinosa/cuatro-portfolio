/** @type {import('@lhci/cli').LhciConfig} */
module.exports = {
  ci: {
    collect: {
      // **The three real pages the Hub serves.** `/projects` left this list with Story 2-14,
      // which redirects it: LHCI follows the redirect and would audit `/` a second time under the
      // label `/projects`, so the report would read as three surfaces while measuring two.
      //
      // **`/cv` joined on 2026-09-13, on a local reading first.** Story 2-16 turned it from a 308
      // into a document on 2026-09-10 and deliberately left this file alone, because this job runs
      // on push to `main` only and the Anchor merges per epic, so a URL added blind would first fire
      // at the epic merge with nothing measured behind it (DW-70). Story 2-26 took that reading:
      // Lighthouse 12.6.1 under Chrome 152 against `pnpm build` plus `pnpm start`, three runs per
      // URL, `/cv` at accessibility 0.96, best practices 1.00 and SEO 1.00, which clears the three
      // thresholds below; `/` and `/work` at 1.00 on all three. The one failing audit on `/cv`,
      // `color-contrast` on the timeline highlights, was F-5 in `ops/hub-accessibility-pass.md`.
      // Story 2-31 closed it, and that story's reading on 2026-09-23 put `/cv` and `/work` at 1.00
      // and `/` at 0.96 (DW-113). `ops/__tests__/hit-target-floor.test.ts` holds this array against
      // `next.config.js`'s redirects, so a URL added here that is redirected fails the unit run.
      url: ['http://localhost:3000', 'http://localhost:3000/work', 'http://localhost:3000/cv'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        // 'categories:performance': ['error', { minScore: 0.9 }], TODO: Upgrade Peromance Score
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
