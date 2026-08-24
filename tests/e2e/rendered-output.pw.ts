import { expect, test } from '@playwright/test';
import { computedStyleValue, expectRouteScreenshot, rootCustomPropertyValue } from './harness';

/**
 * One test per harness capability, against `/work` (Story 1-10).
 *
 * `/work` is the chosen route because it is the only one that combines a `--monument-bold`
 * call site (`.work-hero__heading`), the `body#work` background rule keyed off
 * `<body id={route}>`, and server-rendered content whose entrance tweens sit behind
 * `if (!reduceMotion)`. Its `TorusCanvas` is WebGL driven by `useFrame` and can never be
 * stable, so it is masked.
 */

const ROUTE = '/work';
const HEADING = '.work-hero__heading';
const CANVAS = '.work-hero__canvas-wrap';

/**
 * The vacuous-pass guard's ledger. Each capability test records itself, and the last test
 * asserts the run exercised all three. A capability that was filtered out, skipped or
 * renamed into oblivion fails the run rather than leaving it green over nothing.
 *
 * `fullyParallel` is false and `workers` is 1, so the tests below run in declaration order
 * in one worker process and share this module scope.
 *
 * One behaviour to know before reading a failure: Playwright restarts the worker after a
 * failing test, which reloads this module and empties the ledger. So on a run where a
 * capability test already failed, this guard fails as well. That is redundant noise on a run
 * that is failing anyway, and it is not a hole: the guard can only pass when all three
 * capability tests ran and passed with no restart in between.
 */
const CAPABILITIES = ['route-screenshot', 'computed-property', 'root-custom-property'] as const;
const exercised = new Set<string>();

test.describe('rendered-output harness', () => {
  test('captures /work at 360x800 and matches the committed baseline', async ({ page }) => {
    await expectRouteScreenshot(page, ROUTE, 'work-360x800.png', { mask: [CANVAS] });
    exercised.add('route-screenshot');
  });

  test('reads the computed value of a named property on a named selector', async ({ page }) => {
    await page.goto(ROUTE);

    const family = await computedStyleValue(page, HEADING, 'font-family');

    expect(family).toBe('MonumentExtended-Bold');
    exercised.add('computed-property');
  });

  test('reads the computed value of a custom property on :root', async ({ page }) => {
    await page.goto(ROUTE);

    const declared = await rootCustomPropertyValue(page, '--monument-bold');

    // Double quotes, not the single quotes `app/app.scss:29` is written with: Sass
    // normalises a quoted string to double quotes on the way out, and a custom property
    // carries its declared token stream through to the computed value untouched. The
    // computed `font-family` above loses the quotes entirely, because Chromium serialises a
    // family name that is a valid identifier sequence without them. Two capabilities, two
    // different shapes of the same name, which is why both are asserted rather than one.
    expect(declared).toBe('"MonumentExtended-Bold"');
    exercised.add('root-custom-property');
  });

  test('fails when the render is shifted past the tolerance', async ({ page }) => {
    await page.goto(ROUTE);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // The shift is injected into this page only, through the browser, and touches no file.
    // That is the difference between this test and the probe Story 1-10 applied once and
    // reverted: the probe edited `WorkHero.scss` to prove the gate could fail at all, and its
    // output is recorded in `ops/rendered-output-harness.md`. This test is the gate's own
    // regression test, green on every run, and it is what stops a later change to the
    // tolerance, to `updateSnapshots`, or to the mask from quietly turning the comparison into
    // something that cannot fail.
    await page.addStyleTag({ content: `${HEADING} { transform: translateX(1px); }` });

    const comparison = expect(page).toHaveScreenshot('work-360x800.png', {
      mask: [page.locator(CANVAS)],
      // The comparison retries until it matches or this elapses, and it will never match, so
      // this is a deliberate spend rather than a timeout to be generous with.
      timeout: 5_000,
    });

    await expect(comparison).rejects.toThrow(/are different/);
  });

  test('fails naming the baseline when none is committed', async ({ page }) => {
    await page.goto(ROUTE);

    const comparison = expect(page).toHaveScreenshot('work-360x800-absent-baseline.png', {
      mask: [page.locator(CANVAS)],
      timeout: 5_000,
    });

    await expect(comparison).rejects.toThrow(/work-360x800-absent-baseline/);
  });

  test('fails naming the selector when nothing matches it', async ({ page }) => {
    await page.goto(ROUTE);

    await expect(
      computedStyleValue(page, '.work-hero__heading-that-does-not-exist', 'font-family')
    ).rejects.toThrow(/\.work-hero__heading-that-does-not-exist/);
  });

  test('fails naming the custom property when it is not declared', async ({ page }) => {
    await page.goto(ROUTE);

    await expect(rootCustomPropertyValue(page, '--monument-undeclared')).rejects.toThrow(
      /--monument-undeclared/
    );
  });

  test('exercised every capability it claims to cover', () => {
    expect([...exercised].sort()).toEqual([...CAPABILITIES].sort());
  });
});
