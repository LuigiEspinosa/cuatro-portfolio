import { defineConfig } from '@playwright/test';

/**
 * The rendered-output harness (Story 1-10).
 *
 * Everything a rendered assertion depends on is pinned here: the browser, the viewport,
 * the device scale factor and the motion preference. The CI job runs inside
 * `mcr.microsoft.com/playwright:v1.62.1-noble` and the committed baseline PNG is generated
 * inside that same image, because glyph rasterization is not portable across platforms and
 * `--font-mono` falls back to a different face on Linux than on Windows.
 *
 * See `ops/rendered-output-harness.md` for the tolerance and its reasoning.
 */

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * The screenshot viewport. Exported so a spec cannot drift from the baseline it compares
 * against by re-declaring the numbers.
 */
export const RENDERED_VIEWPORT = { width: 360, height: 800 } as const;

/**
 * Share of differing pixels tolerated before a screenshot comparison fails.
 *
 * Chosen so the one-pixel heading translation probe exceeds it by more than five times.
 * The measured probe ratio and the resulting margin are recorded in
 * `ops/rendered-output-harness.md`. Playwright's per-pixel `threshold` is left at its
 * default, so this ratio is the only knob and it is written down.
 */
const MAX_DIFF_PIXEL_RATIO = 0.001;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.pw.ts',

  // Tests in a file run in declaration order in one worker, which the vacuous-pass guard in
  // `rendered-output.pw.ts` relies on.
  fullyParallel: false,
  workers: 1,

  // A flaky render is a defect to fix, not a retry to hide.
  retries: 0,
  forbidOnly: !!process.env.CI,

  // The screenshot comparison retries until two consecutive captures agree, and the Hub's
  // fonts plus its GSAP entrance settle inside a few seconds. Sixty is room for that on a
  // loaded runner without being room for a hang to pass unnoticed.
  timeout: 60_000,

  // A missing baseline fails the run and is never written as a side effect. Regenerating is
  // the explicit `test:e2e:update` run, whose `--update-snapshots` flag overrides this.
  updateSnapshots: 'none',

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    },
  },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { ...RENDERED_VIEWPORT },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        // As of Playwright 1.62 `reducedMotion` is a context option rather than a top-level
        // test option. The Hub's GSAP entrance tweens sit behind `if (!reduceMotion)` and the
        // ScanlineOverlay grain animation behind a `prefers-reduced-motion` query, so this is
        // what stops both at source rather than waiting them out.
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],

  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
