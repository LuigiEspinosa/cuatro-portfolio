import { readdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  RENDERED_VIEWPORT,
  computedStyleValue,
  expectRouteScreenshot,
  rootCustomPropertyValue,
} from './harness';
import { DISPLAY_FAMILY, firstFamily } from './contract-values';

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
 * The snapshot name is built from the viewport rather than typed out, so a change to the
 * viewport cannot leave a file on disk still claiming the old numbers.
 */
const SNAPSHOT = `work-${RENDERED_VIEWPORT.width}x${RENDERED_VIEWPORT.height}.png`;

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
    await expectRouteScreenshot(page, ROUTE, SNAPSHOT, { mask: [CANVAS] });

    // The baseline is only comparable to a render taken at the size it was captured at, and
    // the mask is only honest if the region it covers is really there. Both are asserted here
    // rather than assumed from the config.
    expect(page.viewportSize()).toEqual({ ...RENDERED_VIEWPORT });

    const canvasBox = await page.locator(CANVAS).boundingBox();
    expect(canvasBox?.width ?? 0).toBeGreaterThan(0);
    expect(canvasBox?.height ?? 0).toBeGreaterThan(0);

    exercised.add('route-screenshot');
  });

  test('reads the computed value of a named property on a named selector', async ({ page }) => {
    await page.goto(ROUTE);

    const family = await computedStyleValue(page, HEADING, 'font-family');

    // `MonumentExtended-Bold` until Story 1-18, which aliased `--monument-bold` onto the
    // contract's `--f-display`. The expected value is **derived from `contracts/tokens.css`**
    // rather than restated, so a MINOR bump that changes which face the display role names moves
    // this assertion with it instead of failing it.
    //
    // The first family rather than the whole stack: a computed `font-family` carries every
    // fallback, and Chromium quotes only the members that need it, so an equality against the
    // whole string would pin a serialisation rather than the adoption. Which face is asked for
    // first is what the adoption turns on.
    expect(DISPLAY_FAMILY, 'contracts/tokens.css declares no --f-display, so this case measures nothing').not.toBe('');
    expect(firstFamily(family), `${HEADING} does not ask for the contract's display family first`).toBe(DISPLAY_FAMILY);
    expect(family, `${HEADING} still renders the retired local face`).not.toContain('MonumentExtended');
    exercised.add('computed-property');
  });

  test('reads the computed value of a custom property on :root', async ({ page }) => {
    await page.goto(ROUTE);

    const declared = await rootCustomPropertyValue(page, '--monument-bold');
    const role = await rootCustomPropertyValue(page, '--f-display');

    // `"MonumentExtended-Bold"` until Story 1-18. The alias layer redefined `--monument-bold` as
    // `var(--f-display)`, and the computed value of a custom property is its token stream
    // **after** substitution, so `:root` now answers with the display role's whole stack. The
    // expectation is that role's own computed value, read from the same `:root` in the same page,
    // which is what keeps this a derivation rather than a second copy of the contract.
    //
    // Two capabilities, two different shapes of the same name: the computed `font-family` above
    // is a resolved stack on an element, this is the custom property's token stream on `:root`.
    // Both are asserted because neither covers the other.
    expect(declared, '--monument-bold no longer resolves to the display role').toBe(role);
    expect(firstFamily(declared), '--monument-bold does not name the display family first').toBe(DISPLAY_FAMILY);
    expect(declared, '--monument-bold still carries the retired local face').not.toContain('MonumentExtended');
    exercised.add('root-custom-property');
  });

  test('fails when the render is shifted past the tolerance', async ({ page }, testInfo) => {
    // Under `pnpm test:e2e:update` Playwright writes a mismatching screenshot instead of
    // failing on it, so this test would overwrite the real baseline with its own shifted
    // render and then fail for the wrong reason. It has nothing to contribute to an update
    // run, so it stands aside from one.
    test.skip(
      testInfo.config.updateSnapshots !== 'none',
      'would overwrite the baseline with its deliberately shifted render'
    );

    await page.goto(ROUTE);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // The shift is injected into this page only, through the browser, and touches no file.
    // That is the difference between this test and the probe Story 1-10 applied once and
    // reverted: the probe edited `WorkHero.scss` to prove the gate could fail at all, and its
    // output is recorded in `ops/rendered-output-harness.md`. This test is the gate's own
    // regression test, green on every run, and it is what stops a later change to the
    // tolerance or to `updateSnapshots` from quietly turning the comparison into something
    // that cannot fail.
    await page.addStyleTag({ content: `${HEADING} { transform: translateX(1px); }` });

    const comparison = expect(page).toHaveScreenshot(SNAPSHOT, {
      mask: [page.locator(CANVAS)],
      // The comparison retries until it matches or this elapses, and it will never match, so
      // this is a deliberate spend rather than a timeout to be generous with.
      timeout: 10_000,
    });

    // Three shapes of the same verdict, because a loaded runner can time out before it gets
    // two stable captures and that message carries no pixel count. Matching only the pixel
    // line would turn a slow runner into a wrong-reason failure.
    await expect(comparison).rejects.toThrow(
      /are different|stable screenshots|Timed out .* waiting for expect/
    );
  });

  test('fails naming the baseline when none is committed', async ({ page }, testInfo) => {
    // In an update run this would write the missing baseline instead of rejecting, leaving a
    // stray PNG in the committed snapshot directory that permanently defeats this very check.
    test.skip(
      testInfo.config.updateSnapshots !== 'none',
      'would write the baseline it exists to prove is absent'
    );

    await page.goto(ROUTE);

    const absent = `work-${RENDERED_VIEWPORT.width}x${RENDERED_VIEWPORT.height}-absent-baseline.png`;

    const comparison = expect(page).toHaveScreenshot(absent, {
      mask: [page.locator(CANVAS)],
      timeout: 10_000,
    });

    await expect(comparison).rejects.toThrow(/absent-baseline/);
  });

  test('keeps exactly one committed baseline', async ({}, testInfo) => {
    // The failure this catches is a snapshot written as a side effect: an update run that
    // left a stray file, or a route added without its baseline being reviewed as a change.
    const expected = basename(testInfo.snapshotPath(SNAPSHOT));
    const directory = dirname(testInfo.snapshotPath(SNAPSHOT));

    expect(readdirSync(directory).sort()).toEqual([expected]);
  });

  test('fails naming the selector when nothing matches it', async ({ page }) => {
    await page.goto(ROUTE);

    await expect(
      computedStyleValue(page, '.work-hero__heading-that-does-not-exist', 'font-family')
    ).rejects.toThrow(/\.work-hero__heading-that-does-not-exist/);
  });

  test('fails naming the property when it resolves to an empty string', async ({ page }) => {
    await page.goto(ROUTE);

    // An undeclared custom property read off an element is the empty-string case in its most
    // ordinary form. Returning it would compare equal to any other empty expectation.
    await expect(computedStyleValue(page, HEADING, '--not-declared-anywhere')).rejects.toThrow(
      /--not-declared-anywhere/
    );
  });

  test('fails naming the custom property when it is not declared', async ({ page }) => {
    await page.goto(ROUTE);

    await expect(rootCustomPropertyValue(page, '--monument-undeclared')).rejects.toThrow(
      /--monument-undeclared/
    );
  });

  test('refuses a name that is not a custom property', async ({ page }) => {
    await page.goto(ROUTE);

    // `font-family` is a real property and resolves to a real value on `:root`, so without
    // this guard the mistake would return a plausible answer rather than a complaint.
    await expect(rootCustomPropertyValue(page, 'font-family')).rejects.toThrow(
      /not a custom property name/
    );
  });

  test('refuses to photograph a route that does not answer 2xx', async ({ page }) => {
    await expect(
      expectRouteScreenshot(page, '/a-route-that-does-not-exist', SNAPSHOT, { mask: [CANVAS] })
    ).rejects.toThrow(/answered HTTP 404/);
  });

  test('refuses a mask selector that matches nothing', async ({ page }) => {
    await expect(
      expectRouteScreenshot(page, ROUTE, SNAPSHOT, { mask: ['.no-such-region'] })
    ).rejects.toThrow(/\.no-such-region/);
  });

  test('exercised every capability it claims to cover', () => {
    expect([...exercised].sort()).toEqual([...CAPABILITIES].sort());
  });
});
