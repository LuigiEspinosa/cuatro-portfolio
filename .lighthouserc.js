/** @type {import('@lhci/cli').LhciConfig} */
module.exports = {
  ci: {
    collect: {
      // Two real pages. `/projects` left this list with Story 2-14, which redirects it: LHCI
      // follows the redirect and would audit `/` a second time under the label `/projects`, so the
      // report would read as three surfaces while measuring two. No replacement URL is added,
      // because putting an unaudited surface behind a blocking gate is a different story's risk.
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
