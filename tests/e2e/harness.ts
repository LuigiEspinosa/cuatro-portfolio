import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import FINGERPRINT_ROWS from '../../ops/asset-budget-fingerprints.json';

/**
 * The viewport every rendered assertion is made at, and the one the committed baseline was
 * captured at. `playwright.config.ts` imports this rather than declaring its own numbers, and
 * `rendered-output.pw.ts` builds the snapshot name from it, so the viewport, the config and the
 * file name on disk cannot drift apart.
 *
 * 360 wide is AD-19's floor.
 */
export const RENDERED_VIEWPORT = { width: 360, height: 800 } as const;

/**
 * The rendered-output harness (Story 1-10).
 *
 * Three capabilities:
 *
 *  1. `expectRouteScreenshot` renders a route at the configured viewport and compares it
 *     against a committed baseline at the tolerance set in `playwright.config.ts`.
 *  2. `computedStyleValue` reads the computed value of a named CSS property on a named
 *     selector against the running Hub.
 *  3. `rootCustomPropertyValue` reads the computed value of a custom property on `:root`.
 *
 * **And, since Story 9-12, everything more than one spec needs**, so that no spec carries a copy:
 * `goTo` (the navigation guard, which `expectRouteScreenshot` uses too), `probeComputed`,
 * `plantStyle`, `durationMs`, `getWithRetry`, `hydrated`, `EDGE_SLACK`, `NOT_FOUND`, `SURFACES` and
 * `FINGERPRINTS`. Every `.pw.ts` under `tests/e2e` imports from here; a spec never imports another
 * spec, because a `.pw.ts` imported by another registers its tests twice. Two rules hold for every
 * helper:
 * it names the route, selector or property it was asked for in any failure, and it never
 * returns a value that could compare equal to an expectation when the thing it was asked
 * for is absent. `getPropertyValue` answers an undeclared custom property with an empty
 * string, so a naive equality check against another empty string would pass vacuously.
 * These helpers throw instead.
 *
 * A note Story 1.18 inherits rather than rediscovers: assert both `font-family` and
 * `font-weight` at the bold display alias's call sites, and set the weight before reading it.
 * Three of the four sites (`WorkHero.scss:19`, `ProjectsHero.scss:19`, `error-page.scss:24`)
 * set family alone at the time this was written, so their computed `font-weight` was `400`
 * both before and after an alias that silently drops bold. The weight lives in the family name,
 * declared by the `@font-face` block at `app/scss/_fonts.scss:91-99`; only `glitch-text.scss:7`
 * sets `font-weight: 700` itself. Story 1.18's own criteria fix that first, by setting the weight
 * by hand at all four sites in the same commit (`epics.md:1842-1843`) before asserting it
 * (`:1844`). Read without that step, the weight assertion is green and meaningless.
 *
 * **Three call sites since 2026-09-07, two since 2026-09-14, one since 2026-09-23, and none since
 * later that day.** Story 2-14 redirected `/projects` and deleted `ProjectsHero.scss` with the route it
 * styled; Story 2-27 deleted `glitch-text.scss` with the loop it carried, and `GlitchText.scss` names
 * the display roles directly; Story 2-30 deleted `error-page.scss`, and `Error404.scss` does the same;
 * Story 2-33 rebuilt `WorkHero.scss`, whose heading was the last, against the contract. The note above
 * is the 2026-08-24 reading and is kept as it was taken. Story 2-22 deleted the alias with the rest
 * of the layer, and `app/__tests__/anchor-contract.test.ts` holds the tree free of its name.
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
  // A screenshot of an error page is not a baseline, so the route must answer 200 and the faces
  // must have resolved before anything is captured; `goTo` refuses anything else. Everything after
  // that is handled by `toHaveScreenshot`, which retries until two consecutive captures agree.
  await goTo(page, route);

  // A mask selector that matches nothing masks nothing, silently. That is how a renamed class
  // reintroduces an animated region into a comparison that used to exclude it, and the symptom
  // is an intermittently red gate rather than an error naming the cause.
  for (const selector of options.mask ?? []) {
    if ((await page.locator(selector).count()) === 0) {
      throw new Error(
        `Rendered-output harness: mask selector "${selector}" matched no element on ` +
          `"${route}". A mask that matches nothing hides nothing, so it is reported rather ` +
          `than applied.`
      );
    }
  }

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
  const element = page.locator(selector).first();

  // Wait rather than count. A bare `count()` answers immediately, so an element that renders one
  // tick later would be reported as absent, and the caller would read "no element matches" when
  // the truth was "not yet".
  try {
    await element.waitFor({ state: 'attached', timeout: 5_000 });
  } catch {
    throw new Error(
      `Rendered-output harness: no element matches selector "${selector}" on ` +
        `${page.url()}, so the computed value of "${property}" could not be read.`
    );
  }

  const value = await element.evaluate(
    (node, name) => window.getComputedStyle(node).getPropertyValue(name),
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
 * Whether React has hydrated the hero's container on `/`.
 *
 * The signal is React's own mark. React attaches an own property named `__reactFiber$<key>` to
 * every host node it hydrates, and the server writes none, so its presence on `.home-container`
 * means React hydrated. The mark lands during React's render phase, before passive effects, so
 * this says "hydrated" and not "effects ran"; the cases that read it go on to read layout, which
 * does not depend on an effect having fired.
 *
 * **Until 2026-09-14 the signal was `GlitchText`'s inline opacity**, which its `useGsapContext`
 * callback wrote on mount on every path; Story 2-27 moved that entrance into CSS over
 * server-rendered spans, so nothing writes an inline style any more and the application has no
 * artifact of its own that says "hydrated". This is a library mark, stated as such, chosen over
 * adding an effect to the application whose only reader would be a test. Verified in the running
 * page on all four front doors on 2026-09-14: absent at `commit` and at `load`, present after
 * hydration, and never present with the client bundle blocked.
 */
export function hydrated(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const container = document.querySelector('.home-container');
    return container !== null && Object.getOwnPropertyNames(container).some((name) => name.startsWith('__reactFiber$'));
  });
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

/**
 * Navigate to `route` and refuse to read anything off a page that did not answer `expected`, then
 * wait for the web fonts.
 *
 * The one navigation guard in `tests/e2e` (DW-22). An unchecked status is how an error page
 * becomes a measurement, and a fallback face rendered for one frame is a different layout, so both
 * are settled here rather than at each call site. Not `networkidle`: Story 1-10 found the Hub never
 * reached it while the GSAP ticker ran, and the wait stays off so a read does not depend on which
 * scripts a route runs.
 *
 * A null response is what a same-document navigation such as a bare hash on the current page
 * yields. There is then no status to check, which is a failure rather than a case to wave through.
 * A redirect is followed and the status checked is the one the browser lands on.
 */
export async function goTo(page: Page, route: string, expected = 200): Promise<void> {
  const response = await page.goto(route, { waitUntil: 'load' });

  if (!response) {
    throw new Error(
      `Rendered-output harness: navigating to "${route}" produced no response, so its HTTP ` +
        `status could not be checked. Pass a route that performs a real navigation.`
    );
  }

  if (response.status() !== expected) {
    throw new Error(
      `Rendered-output harness: route "${route}" answered HTTP ${response.status()}, not ` +
        `${expected}, so nothing was read off it.`
    );
  }

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * The computed value of `property` on a throwaway element declared with `declaration`.
 *
 * A custom property's computed value is its declared token stream, so `--z-sticky` read off
 * `:root` answers the string `200`, and comparing that against a computed `z-index` compares a
 * declaration against a resolution. This lays out a probe and reads what the reference resolves
 * to, the way an element does. Throws naming the property and the declaration when the read is
 * empty, which is what an unknown property or an unresolved custom property yields.
 */
export async function probeComputed(page: Page, declaration: string, property: string): Promise<string> {
  const value = await page.evaluate(
    ([css, name]) => {
      const probe = document.createElement('div');
      probe.setAttribute('style', `position:absolute;left:-99999px;top:0;width:1px;height:1px;${css}`);
      document.body.append(probe);
      const read = window.getComputedStyle(probe).getPropertyValue(name);
      probe.remove();
      return read;
    },
    [declaration, property] as const
  );

  if (value.trim() === '') {
    throw new Error(
      `Rendered-output harness: property "${property}" read an empty string off a probe declared ` +
        `"${declaration}", so it is reported as a failure rather than returned.`
    );
  }

  return value;
}

/**
 * Add a stylesheet to the running page, so a defect is planted without a fixture in the tree, and
 * hand back its removal.
 */
export async function plantStyle(page: Page, css: string): Promise<() => Promise<void>> {
  const style = await page.evaluateHandle((text) => {
    const node = document.createElement('style');
    node.textContent = text;
    document.head.append(node);
    return node;
  }, css);

  return async () => {
    await style.evaluate((node) => node.remove());
    await style.dispose();
  };
}

/**
 * A duration token's value in milliseconds, resolved through a probe rather than written down.
 *
 * A duration that governs the interface comes from the contract, and a hand-written millisecond
 * figure drifts from `--dur-major` the day it moves. `transition-duration` computes to seconds,
 * which is what the probe reads back. `NaN` when the role resolves to nothing, which compares
 * equal to no expectation.
 */
export function durationMs(page: Page, role: string): Promise<number> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.transitionDuration = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).transitionDuration;
    probe.remove();
    const seconds = Number.parseFloat(resolved);
    return Number.isFinite(seconds) ? seconds * 1000 : Number.NaN;
  }, role);
}

/**
 * Sub-pixel slack on an edge comparison, never on a floor.
 *
 * Layout produces fractional positions, and a box ending a third of a pixel past an edge is a
 * rounding artifact rather than overflow. One figure for every spec (DW-232): two copies of a
 * tolerance drift, and the looser one reports clean a layout the other fails.
 */
export const EDGE_SLACK = 0.5;

/**
 * `request.get(url)`, tried up to `attempts` times while the request itself throws.
 *
 * A thrown request is a transport failure, such as the `socket hang up` that took the blocking
 * `rendered-output` gate red in run 34020245249 with nothing in the tree changed (DW-224). Any
 * response, a 404 included, is returned on its first answer and never retried, so the caller's
 * status assertion still sees a real failure; that is why this is not a `test.retry` on the case.
 * After the last attempt it throws naming the URL, the attempt count and the last error.
 */
export async function getWithRetry(
  request: Pick<APIRequestContext, 'get'>,
  url: string,
  attempts = 3
): Promise<APIResponse> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await request.get(url);
    } catch (error) {
      last = error;
    }
  }
  throw new Error(
    `Rendered-output harness: GET ${url} threw on all ${attempts} attempts. Last error: ` +
      `${last instanceof Error ? last.message : String(last)}`
  );
}

/** One row of the fingerprint table. */
export interface Fingerprint {
  readonly library: string;
  readonly mark: string;
  readonly webgl: boolean;
}

/**
 * The narrative fingerprint table `ops/asset-budget.mjs` classifies chunks with, loaded from the
 * same `ops/asset-budget-fingerprints.json` the tool loads (DW-40, DW-49).
 *
 * Until Story 9-12 three specs parsed the table out of the tool's source as text, because the tool
 * uses `import.meta` and Playwright loads a spec as CommonJS. A JSON file loads in both. This throws
 * at load on an empty table, a row of the wrong shape or an empty mark: a table that arrived empty
 * would make every payload case pass by finding nothing, and an empty mark matches every chunk.
 * Throwing here fails every importing file at collection, the only place a broken instrument stops
 * the measurements that use it.
 */
export const FINGERPRINTS: readonly Fingerprint[] = ((rows: unknown): readonly Fingerprint[] => {
  const where = 'ops/asset-budget-fingerprints.json';
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Rendered-output harness: ${where} holds no fingerprint, so every scan would classify nothing`);
  }
  for (const row of rows as Partial<Fingerprint>[]) {
    if (typeof row?.library !== 'string' || typeof row.mark !== 'string' || typeof row.webgl !== 'boolean') {
      throw new Error(`Rendered-output harness: ${where} holds a row that is not { library, mark, webgl }: ${JSON.stringify(row)}`);
    }
    if (row.mark.length === 0) {
      throw new Error(`Rendered-output harness: ${where} gives ${row.library} an empty mark, which matches every chunk`);
    }
  }
  return Object.freeze(rows as Fingerprint[]);
})(FINGERPRINT_ROWS);


/**
 * A path the Hub does not route, which renders `app/not-found.tsx` through the root layout.
 *
 * It stands in for that file in the derived route set below: `not-found.tsx` has no URL of its
 * own, and any unrouted path reaches it.
 */
export const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * **Moved here from `tests/e2e/hit-target-floor.pw.ts` by Story 9-12**, with its history below, so
 * `tests/e2e/projects-redirect.pw.ts` derives its NFR-9 sweep from it rather than from a hand copy
 * (DW-61). "Below", "this sweep" and "this file" in that history mean `hit-target-floor.pw.ts`,
 * which still owns the counts; `ops/__tests__/hit-target-floor.test.ts` reads the literal here.
 *
 * Every surface that renders Hub markup, what each is expected to yield, and whether it carries
 * an animated entrance the measurement has to settle.
 *
 * **The three counts are pinned rather than bounded**, and they are the same numbers
 * `ops/hit-target-floor.md` publishes under "The surfaces swept"; the two are held equal by
 * `ops/__tests__/hit-target-floor.test.ts`. A bounded "at least one" guard would let a third
 * chrome link, or a control that stopped rendering, pass without a number moving. A story that
 * changes what a surface renders moves the number here, in the record, and nowhere else.
 *
 * `measured: 0` on `/celeste` is a measurement rather than an omission: `celeste.scss:8-10` sets
 * `display: none` on the header, so all four of its candidates are removed by the visibility
 * rule and none is left to measure.
 *
 * **`/` moved from 16 to 17 with Story 2-13, and only by one.** That story adds two controls and
 * this sweep can see exactly one of them. The A-6 skip-link renders on every path, positioned
 * above the viewport rather than clipped, so it is a real box this floor measures and passes. The
 * skip control renders on the default path only, and this project runs `reducedMotion: 'reduce'`
 * (`playwright.config.ts:79`), which is the non-3D path where it does not render at all:
 * `tests/e2e/front-door.pw.ts` measures that one, on a `no-preference` context, because nothing
 * here can.
 *
 * **`/projects` left this table with Story 2-14 and belongs in neither list.** That story replaced
 * the page with a 301 to `/#suite`, so `app/projects/page.tsx` is off disk and the walk below
 * would report the route as `phantom` if it were left here. It is not a `NON_HUB_ROUTE` either:
 * that list is for routes that answer something other than Hub markup, and this one lands on `/`,
 * which the case at the end of this file would reject for answering `text/html`. Playwright
 * follows redirects, so a row left in `SURFACES` would have gone green while measuring `/` twice.
 * The redirect itself is asserted in `tests/e2e/projects-redirect.pw.ts`.
 *
 * **The three surfaces that carry chrome each fell by four with Story 2-15**, on 2026-09-08. That
 * story replaced the header's five inline links plus a `mailto:`, six anchors in all, with two, so
 * `/work` went from 11 to 7,
 * `/celeste` from 7 to 3 and the 404 from 8 to 4. `/` did not move: `Header.tsx:48` renders no
 * header there, and the homepage panel's second link was repointed rather than removed.
 *
 * **`/cv` became a surface on 2026-09-10.** Story 2-16 removed the 308 that answered it and built
 * the page, so the route left `NON_HUB_ROUTES` below and arrived here. It carries `/work`'s seven,
 * the same chrome and the same four accordion triggers, plus the intro block's two links, which is
 * nine. `PlateMark` adds none: nothing in it is interactive, by its own docblock.
 *
 * **`/` and the 404 each moved by one with Story 2-17**, on 2026-09-11. The footer gained its one
 * link, to `/celeste`, so `/` went from 17 to 18; the 404's single back link became the header's
 * two destinations, so that surface went from 4 to 5. Both readings were taken off this sweep's
 * own failure output in the pinned container before the pins were moved. `/celeste` did not move:
 * it renders no footer and gained no exit, which `tests/e2e/secondary-surfaces.pw.ts` asserts.
 *
 * **Every surface with a header moved by one on 2026-09-24** (Operator ruling, DW-43). The skip link
 * moved into `Header` as the band's first child, so `/work` went from 7 to 8, `/cv` from 9 to 10 and
 * the 404 from 5 to 6, each new element parked above the viewport with a real box this floor measures
 * and passes; `/celeste` from 3 found and 3 skipped to 4 and 4, the link hidden with its band. `/` did
 * not move: it renders the same one link, from `Header` now rather than from `app/page.tsx`. Read off
 * this sweep's own failure output in the pinned container before the pins were moved.
 *
 * **`/` moved by four on 2026-09-26** (Operator ruling 2026-09-25). Registry 1.5.0 listed `covidmap`
 * and `future-vizion` as `Live`, two more rows each drawing a live link and a Source link, so `/` went
 * from 17 to 21. Read off this sweep's own failure output in the pinned container before the pin
 * moved; the other four surfaces did not move.
 */
export const SURFACES = [
  { route: '/', status: 200, entrance: true, found: 22, skipped: 0, measured: 22 },
  { route: '/work', status: 200, entrance: false, found: 8, skipped: 0, measured: 8 },
  { route: '/cv', status: 200, entrance: false, found: 10, skipped: 0, measured: 10 },
  { route: '/celeste', status: 200, entrance: false, found: 4, skipped: 4, measured: 0 },
  { route: NOT_FOUND, status: 404, entrance: false, found: 6, skipped: 0, measured: 6 },
] as const;
