/** @type {import('@lhci/cli').LhciConfig} */
module.exports = {
  ci: {
    collect: {
      // **Two of the three real pages the Hub serves.** `/projects` left this list with Story 2-14,
      // which redirects it: LHCI follows the redirect and would audit `/` a second time under the
      // label `/projects`, so the report would read as three surfaces while measuring two.
      //
      // **`/cv` is the third page and is deliberately not here yet.** Story 2-16 turned it from a
      // 308 into a document on 2026-09-10 and left this file alone: this job runs on push to `main`
      // only, and the Anchor merges per epic, so a URL added now first fires at the epic merge with
      // nothing measured behind it. That is the same risk this comment declined for `/projects`, and
      // putting an unaudited surface behind a blocking gate is a different story's to take.
      //
      // **Adding it is one commit and it needs a reading first.** Run `lhci autorun` against `/cv`
      // locally, confirm it clears the three thresholds below, then add the URL and file the
      // reading in the same change. Tracked as **DW-70** in
      // `_bmad-output/implementation-artifacts/deferred-work.md`, which names the owner and the
      // trigger. `ops/__tests__/hit-target-floor.test.ts` holds this array against
      // `next.config.js`'s redirects, so a URL added here that is redirected fails the unit run.
      url: ['http://localhost:3000', 'http://localhost:3000/work'],
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
