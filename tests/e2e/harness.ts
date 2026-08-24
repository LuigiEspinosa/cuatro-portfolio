import { expect, type Page } from '@playwright/test';

/**
 * The rendered-output harness (Story 1-10).
 *
 * Three capabilities, and nothing else:
 *
 *  1. `expectRouteScreenshot` renders a route at the configured viewport and compares it
 *     against a committed baseline at the tolerance set in `playwright.config.ts`.
 *  2. `computedStyleValue` reads the computed value of a named CSS property on a named
 *     selector against the running Hub.
 *  3. `rootCustomPropertyValue` reads the computed value of a custom property on `:root`.
 *
 * Stories 1.12, 1.17, 1.18 and 1.19 import this file. Two rules hold for every helper:
 * it names the route, selector or property it was asked for in any failure, and it never
 * returns a value that could compare equal to an expectation when the thing it was asked
 * for is absent. `getPropertyValue` answers an undeclared custom property with an empty
 * string, so a naive equality check against another empty string would pass vacuously.
 * These helpers throw instead.
 *
 * A note Story 1.18 inherits rather than rediscovers: the property to name at the
 * `--monument-bold` call sites is `font-family`, not `font-weight`. Three of the four call
 * sites (`WorkHero.scss:19`, `ProjectsHero.scss:19`, `error-page.scss:24`) set family alone,
 * so their computed `font-weight` is `400` both before and after an alias that silently
 * drops bold. The weight lives in the family name, declared by the `@font-face` block at
 * `app/scss/_fonts.scss:91-99`. Only `glitch-text.scss:7` sets `font-weight: 700` itself.
 */

interface ScreenshotOptions {
  /**
   * Selectors covered with a solid box before comparison. Use this for a region that cannot
   * render deterministically, such as the WebGL torus driven by `useFrame`. Masking is the
   * honest move: adding a test hook to the application to freeze the region would change the
   * thing being measured.
   */
  mask?: readonly string[];
}

/**
 * Navigate to `route` and compare the viewport against the committed baseline named
 * `snapshotName`.
 *
 * A missing baseline fails the run naming the file Playwright looked for, because
 * `updateSnapshots` is `none`. Writing one is the explicit `pnpm test:e2e:update` run,
 * performed inside the pinned container image.
 */
export async function expectRouteScreenshot(
  page: Page,
  route: string,
  snapshotName: string,
  options: ScreenshotOptions = {}
): Promise<void> {
  const response = await page.goto(route, { waitUntil: 'load' });

  if (response && !response.ok()) {
    throw new Error(
      `Rendered-output harness: route "${route}" answered HTTP ${response.status()}, ` +
        `so no screenshot was taken. A screenshot of an error page is not a baseline.`
    );
  }

  // Not `networkidle`. The Hub never reaches it: Lenis plus the GSAP ticker keep the page
  // busy indefinitely, so a wait for network idle times out rather than settling. What the
  // baseline actually needs is the web fonts resolved, because a fallback face rendered for
  // one frame is a different image. Everything after that is handled by `toHaveScreenshot`,
  // which retries until two consecutive captures agree.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await expect(page).toHaveScreenshot(snapshotName, {
    mask: (options.mask ?? []).map((selector) => page.locator(selector)),
  });
}

/**
 * The computed value of `property` on the first element matching `selector`.
 *
 * Throws naming the selector when nothing matches it, and naming the property when the
 * property does not resolve to a value.
 */
export async function computedStyleValue(
  page: Page,
  selector: string,
  property: string
): Promise<string> {
  const matches = await page.locator(selector).count();

  if (matches === 0) {
    throw new Error(
      `Rendered-output harness: no element matches selector "${selector}" on ` +
        `${page.url()}, so the computed value of "${property}" could not be read.`
    );
  }

  const value = await page
    .locator(selector)
    .first()
    .evaluate(
      (element, name) => window.getComputedStyle(element).getPropertyValue(name),
      property
    );

  const trimmed = value.trim();

  if (trimmed === '') {
    throw new Error(
      `Rendered-output harness: property "${property}" resolved to an empty string on ` +
        `selector "${selector}". An empty string is what an unknown property name yields, ` +
        `so it is reported as a failure rather than returned.`
    );
  }

  return trimmed;
}

/**
 * The computed value of the custom property `name` on `:root`.
 *
 * Throws naming the property when it is not declared. This is the case the empty-string
 * answer makes dangerous: an undeclared property and a property declared empty are
 * indistinguishable through `getPropertyValue`, and either would compare equal to an
 * expectation that was itself empty.
 */
export async function rootCustomPropertyValue(page: Page, name: string): Promise<string> {
  if (!name.startsWith('--')) {
    throw new Error(
      `Rendered-output harness: "${name}" is not a custom property name. ` +
        `Custom property names start with two hyphens.`
    );
  }

  const value = await page.evaluate(
    (property) =>
      window.getComputedStyle(document.documentElement).getPropertyValue(property),
    name
  );

  const trimmed = value.trim();

  if (trimmed === '') {
    throw new Error(
      `Rendered-output harness: custom property "${name}" is not declared on :root on ` +
        `${page.url()}. getPropertyValue answers an undeclared property with an empty ` +
        `string, so it is reported as a failure rather than returned.`
    );
  }

  return trimmed;
}
