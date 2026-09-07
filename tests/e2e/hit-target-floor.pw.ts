import { test, expect, type Locator, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, rootCustomPropertyValue } from './harness';

/**
 * The AD-19 hit-target floor, measured in a real browser (Story 2-8).
 *
 * `ops/rendered-output-harness.md` recorded this floor as deliberately unasserted and owned by
 * this story. Nothing in the repository measured a hit target: `--tap` shipped in the contract
 * with zero consumers, and the shipped Hub is under the floor on every route that carries chrome.
 * `EXPERIENCE.md:763` books it as **A-4**, and `:764` books no-horizontal-scroll-at-360 as **A-5**;
 * this file asserts A-4 and the scroll half of A-5.
 *
 * **A sweep plus a ledger, rather than a list of compliant surfaces.** A sweep scoped to what
 * already passes would match almost nothing today, go green, and prove nothing, which is the
 * vacuous pass `tests/e2e/harness.ts` names. So every interactive element on every route is
 * measured, and the surfaces known to be under the floor are listed below with the story whose
 * acceptance condition closes each one. Four directions are asserted, and that is what stops the
 * ledger rotting:
 *
 *  1. An element under the floor that no row lists **fails**. A new or regressed control cannot
 *     arrive quietly.
 *  2. An element a row lists that now **clears** the floor also fails, as a stale row. Stories
 *     2-15, 2-30 and 2-32 must delete their row in the commit that repairs the surface, so
 *     the ledger can only shrink and nothing has to remember to widen a scope later. Story 2-9
 *     already has.
 *  3. A row that stops matching **on any one of the routes it lists** fails, so a row covering
 *     three surfaces cannot go half stale in silence.
 *  4. A row **covers an exact number of elements**, so a seventh nav link at 40 x 22 cannot be
 *     exempted for free by an existing selector. The route set itself is derived from `app/`
 *     rather than hand-listed, so a route added by a later story cannot go unswept either.
 *
 * **The floor is read, never written.** It comes off `--tap` on `:root` in the running page,
 * through the harness. A hand-written pixel literal is what Story 2-34's conformance gate
 * rejects (`epics.md:3740`, `DESIGN.md:654-656`), and a floor restated in a spec file is a floor
 * that drifts from the contract it claims to enforce.
 *
 * **A-5 is measured on elements, not on `scrollWidth`.** Story 2-9 repaired the stylesheet half of
 * KV-5, so `app/app.scss` now ships `100%` widths with `overflow-x: clip` and the home route no
 * longer clamps itself to one viewport. `clip` clips exactly as `hidden` did, which is the point:
 * the document's scroll width still reports as though nothing overflowed, while 28 elements on
 * `/work` really do sit past the right edge. Comparing each measured element's edges to the
 * viewport is what detects that. The remaining half of KV-5 is the component one, `WorkItem.scss`
 * and `WorkHero.scss` on `/work` booked to Stories 2-31 and 2-33, and `ProjectsHero.scss` on
 * `/projects` booked to Story 2-14, which redirects that route away rather than repairing it. The
 * entry stays `Open` until all three land.
 *
 * **No screenshot is taken.** This file writes no snapshot directory, so `keeps exactly one
 * committed baseline` in `tests/e2e/rendered-output.pw.ts` stays true. Same precedent as
 * `tests/e2e/celeste-header.pw.ts:24-26`.
 *
 * Every predicate introduced here is shown firing on a planted control, injected into one page
 * through the browser so it touches no file. The one-time probe that proved the same predicates
 * against a real render is recorded in `ops/hit-target-floor.md` and is not in this tree.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here.
// Same as `tests/e2e/anchor-aliases.pw.ts:42`.
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * A path the Hub does not route, which renders `app/not-found.tsx` through the root layout.
 *
 * It stands in for that file in the derived route set below: `not-found.tsx` has no URL of its
 * own, and any unrouted path reaches it.
 */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * Every surface that renders Hub markup, what each is expected to yield, and whether it carries
 * an animated entrance the measurement has to settle.
 *
 * **The three counts are pinned rather than bounded**, and they are the same numbers
 * `ops/hit-target-floor.md` publishes under "The surfaces swept"; the two are held equal by
 * `ops/__tests__/hit-target-floor.test.ts`. A bounded "at least one" guard would let a seventh
 * chrome link, or a control that stopped rendering, pass without a number moving. A story that
 * changes what a surface renders moves the number here, in the record, and nowhere else.
 *
 * `measured: 0` on `/celeste` is a measurement rather than an omission: `celeste.scss:8-10` sets
 * `display: none` on the header, so all seven of its candidates are removed by the visibility
 * rule and none is left to measure.
 */
const SURFACES = [
  { route: '/', status: 200, entrance: true, found: 16, skipped: 0, measured: 16 },
  { route: '/work', status: 200, entrance: false, found: 11, skipped: 0, measured: 11 },
  { route: '/projects', status: 200, entrance: false, found: 18, skipped: 0, measured: 18 },
  { route: '/celeste', status: 200, entrance: false, found: 7, skipped: 7, measured: 0 },
  { route: NOT_FOUND, status: 404, entrance: false, found: 8, skipped: 0, measured: 8 },
] as const;

/**
 * The routes the Hub serves that render no Hub markup at all.
 *
 * They are excluded by measurement rather than by omission: two are permanent redirects to a PDF
 * (`next.config.js`), which a browser answers by starting a download rather than a navigation,
 * and the third is a JSON endpoint. `page.request` follows the redirect and reports where the
 * visitor lands, which is what the case at the end of this file pins.
 */
const NON_HUB_ROUTES = ['/cv', '/recommendation', '/api/health'] as const;

/**
 * The entrance the home surface animates, and the selector the settle waits on.
 *
 * `HomeLayout.tsx:34,39` tweens these from `opacity: 0` at roughly t=2.0s and t=2.2s. A surface
 * that declares `entrance: true` must match at least one of these nodes, or the wait is a wait on
 * an empty NodeList, which `Array.every` answers `true` for immediately. Story 2-15 renames
 * `.nav-link`, and this is what makes that rename fail here rather than quietly turn the settle
 * into a no-op.
 */
const ENTRANCE_SELECTOR = '.nav-link, .contact-container a';

/**
 * What counts as an interactive element.
 *
 * Native interactive elements plus the WAI-ARIA widget roles. `a` without `href` is not a target
 * and is not matched; `[tabindex="-1"]` is programmatically focusable rather than tappable and is
 * not matched either. Adding a role to the Hub means adding it here, and the pinned per-surface
 * counts are what make that visible: a role that renders and is not listed simply never gets
 * measured, and the count it should have moved does not move.
 */
const INTERACTIVE = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * The one shape an exemption's `source` may take: a path, then the lines the controls sit on.
 *
 * Stated once, here. `ops/__tests__/hit-target-floor.test.ts` reads this literal back out of this
 * file rather than declaring a second shape of its own, because two shapes that disagree turn an
 * exemption authored under `app/` into an agreement failure that has nothing to do with agreement.
 */
const SOURCE_SHAPE = /^[\w./-]+\.tsx:\d+(,\d+)*$/;

/**
 * One surface the Hub ships under the floor today.
 *
 * `measured` is documentation, not an expectation: it records what the box was on the date this
 * row was written, so a reader can see how far under the floor the surface is without running
 * anything. It is held to one thing mechanically, that at least one of its numbers really is
 * under the floor, so a row cannot claim a compliant size while exempting an element.
 *
 * `covers` is an expectation and is the reason a selector cannot exempt more than it was written
 * for. It is the exact number of measured elements the row accounts for **across the whole run**,
 * summed over the routes it lists. A seventh `nav.navbar a` would make the row cover nineteen and
 * fail here rather than inherit an exemption written for six links.
 *
 * `closedBy` is the story whose own acceptance criteria name this floor, so the repair lands
 * where it was planned rather than here. Story 2-8 ships the instrument only.
 */
interface Exemption {
  readonly id: string;
  readonly selector: string;
  readonly source: string;
  readonly routes: readonly string[];
  readonly covers: number;
  readonly measured: string;
  readonly closedBy: string;
}

/**
 * The ledger. Held equal to the table in `ops/hit-target-floor.md` in both directions by
 * `ops/__tests__/hit-target-floor.test.ts`, so neither file is the only reader of the other.
 *
 * **Six rows at Story 2-8, five now.** The chrome logo was not on that story's own list of four
 * and was found by measuring: its `<a>` is a plain inline box, so its rect is the text line box
 * while the 66px-tall image inside it paints past the bottom. Story 2-32 names `Logo` in its title
 * and is what closes it. The home surface is carried as two rows because it is authored in two
 * files at two different sizes. Story 2-9 deleted `directory-links` in the commit that replaced
 * the card grid with the Suite Directory, whose two links meet the floor on both axes; the ledger
 * can only shrink, so nothing had to remember to widen a scope afterwards.
 */
const EXEMPTIONS: readonly Exemption[] = [
  {
    id: 'chrome-logo',
    selector: '.logo a',
    source: 'components/atoms/Logo/Logo.tsx:7',
    routes: ['/work', '/projects', '/a-route-that-does-not-exist'],
    covers: 3,
    measured: '184.00 x 20.00',
    closedBy: 'Story 2-32',
  },
  {
    id: 'chrome-nav',
    selector: 'nav.navbar a',
    source: 'components/atoms/Navbar/Navbar.tsx:6,7,8,9,12,19',
    routes: ['/work', '/projects', '/a-route-that-does-not-exist'],
    covers: 18,
    measured: '38.41 x 22.00 to 98.13 x 22.00',
    closedBy: 'Story 2-15',
  },
  {
    id: 'error-back',
    selector: 'a.error-page__back',
    source: 'components/organisms/ErrorPage/Error404.tsx:50',
    routes: ['/a-route-that-does-not-exist'],
    covers: 1,
    measured: '108.58 x 38.19',
    closedBy: 'Story 2-30',
  },
  {
    id: 'home-nav',
    selector: 'a.nav-link',
    source: 'components/organisms/HomeLayout/HomeLayout.tsx:64,67',
    routes: ['/'],
    covers: 2,
    measured: '320.00 x 23.00',
    closedBy: 'Story 2-32',
  },
  {
    id: 'home-contact',
    selector: '.contact-container a',
    source: 'components/molecules/ContactContainer/ContactContainer.tsx:5,8,15',
    routes: ['/'],
    covers: 3,
    measured: '58.00 x 23.00 to 84.00 x 23.00',
    closedBy: 'Story 2-32',
  },
];

/**
 * Sub-pixel slack on the edge comparison alone, never on the floor.
 *
 * Layout produces fractional positions and a target that ends a third of a pixel outside the
 * viewport is a rounding artifact rather than horizontal scroll. The floor takes no slack: a box
 * measured under `--tap` is under it.
 */
const EDGE_SLACK = 0.5;

/** One element that was measured. */
interface Measured {
  readonly at: string;
  readonly text: string;
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  /** Ids of the exemption rows whose selector matches this element, route filtering aside. */
  readonly matchedIds: readonly string[];
}

/** One element the visibility and accessibility-tree rule removed before measurement. */
interface Skipped {
  readonly at: string;
  readonly why: string;
}

/** What one surface yielded. */
interface Surveyed {
  readonly found: number;
  readonly skipped: Skipped[];
  readonly measured: Measured[];
}

/** One exemption row's bookkeeping, on one route. */
interface Tally {
  matched: number;
  under: number;
}

/** `${id} on ${route}`, so a row covering three routes is tracked as three pairs, not one total. */
type PairKey = string;

const pairKey = (id: string, route: string): PairKey => `"${id}" on ${route}`;

interface Verdict {
  /** Under the floor with no row listing it, on any route. */
  readonly under: string[];
  /** Under the floor, matched by a row that does not list this route. A different failure. */
  readonly misrouted: string[];
  /** Listed by a row and clearing the floor, which makes the row stale. */
  readonly stale: string[];
  /** An edge outside the viewport. */
  readonly wide: string[];
  /** Per row and route, so half-stale rows are visible. */
  readonly hits: Map<PairKey, Tally>;
}

/**
 * Navigate, and refuse to read anything off a page that did not answer the status expected.
 *
 * Local rather than shared, on the idiom `tests/e2e/anchor-aliases.pw.ts:481-485` and
 * `tests/e2e/celeste-header.pw.ts:36-40` already set. DW-22 records that this guard now has
 * several implementations and that hoisting it into `harness.ts` is its own change; this is not
 * the story that makes it.
 */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/**
 * Every route `app/` actually serves, derived from the filesystem rather than restated.
 *
 * The walk is the shape `tests/e2e/contract-serving.pw.ts:88-95` uses over `contracts/`. A route
 * group `(name)` contributes no URL segment, a private folder `_name` contributes no route at
 * all, and `not-found.tsx` is reported as the unrouted path that renders it. A **dynamic**
 * segment is refused rather than guessed: there is no one URL to sweep for `[id]`, and a sweep
 * that silently skipped it would be exactly the hole this derivation closes.
 */
const routesOnDisk = (directory: string, prefix = '', found: string[] = []): string[] => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name.startsWith('_')) continue;
      if (/[[\]]/.test(entry.name)) {
        throw new Error(
          `Hit-target floor: app/${prefix}/${entry.name} is a dynamic segment, so it has no single ` +
            `URL this sweep can visit. Register the concrete paths it should be swept at in ` +
            `SURFACES and teach this walk to expect it, rather than leaving a route unmeasured.`
        );
      }
      const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
      routesOnDisk(join(directory, entry.name), `${prefix}${segment}`, found);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name === 'not-found.tsx') {
      found.push(NOT_FOUND);
      continue;
    }
    if (/^(page|route)\.(tsx|ts|jsx|js)$/.test(entry.name)) found.push(prefix === '' ? '/' : prefix);
  }
  found.sort();
  return found;
};

/**
 * Wait for the page to stop moving under the measurement.
 *
 * Two things move. Web fonts decide how wide a label is, and a label narrower than the floor is
 * one of the two axes this file fails on, so a box measured against a fallback face is a
 * different box. And the home entrance tweens `ENTRANCE_SELECTOR` from `opacity: 0`; the project
 * sets `reducedMotion: 'reduce'`, so `HomeLayout.tsx:19-23` writes the final state on mount
 * instead, but that still happens on hydration rather than at `load`. Waiting for the settled
 * opacity waits for hydration, which is the thing actually being raced.
 *
 * On a surface that declares an entrance, the selector must match something. `Array.every` over
 * an empty NodeList is `true`, so a renamed class turns this wait into a no-op that reports
 * nothing, which is the failure this guard exists to make loud.
 */
const settle = async (page: Page, surface: { route: string; entrance: boolean }): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  if (surface.entrance) {
    const animated = await page.locator(ENTRANCE_SELECTOR).count();
    expect(
      animated,
      `Hit-target floor: "${surface.route}" declares an animated entrance and "${ENTRANCE_SELECTOR}" ` +
        `matches nothing on it, so the settle below would wait on an empty NodeList and return at ` +
        `once. Either the entrance is gone and this surface should stop declaring one, or the class ` +
        `was renamed and this selector has to move with it.`
    ).toBeGreaterThan(0);
  }

  try {
    await page.waitForFunction(
      (selector: string) =>
        [...document.querySelectorAll(selector)].every(
          (node) => window.getComputedStyle(node).opacity === '1'
        ),
      ENTRANCE_SELECTOR,
      { timeout: 15_000 }
    );
  } catch (error) {
    // The original is carried rather than discarded. A crashed page, a navigation out from under
    // the wait and a genuinely unsettled entrance all arrive here, and reporting all three as
    // "the entrance never settled" sends the reader to the wrong component.
    throw new Error(
      `Hit-target floor: the wait for the entrance on "${surface.route}" did not resolve, so every ` +
        `box below would have been measured mid-animation. The links animate from opacity 0 and ` +
        `the project runs with reduced motion, so this is a hydration wait rather than an ` +
        `animation wait. Underlying failure: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * The floor, read off `--tap` on `:root` in the running page.
 *
 * Refuses anything that is not a positive length in pixels. `--tap` is authored as a physical
 * size on purpose (`contracts/tokens.css:93-100`): a target floor is a promise about a fingertip
 * and must not shrink with the root font size, so a value in `rem` here would be a contract
 * change rather than a unit conversion, and it is reported rather than converted.
 */
const floorFrom = async (page: Page): Promise<number> => {
  const declared = await rootCustomPropertyValue(page, '--tap');
  return parseFloor(declared);
};

/** The parser, separated so a planted control can drive it without a page. */
const parseFloor = (declared: string): number => {
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(declared.trim());
  const value = match ? Number(match[1]) : Number.NaN;

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Hit-target floor: --tap reads "${declared}", which is not a positive length in pixels. ` +
        `The floor is a physical-size guarantee and is read from the contract rather than ` +
        `written here, so an unusable value is reported rather than replaced with a default.`
    );
  }

  return value;
};

/**
 * Every exemption selector, put through the browser's own parser before anything is matched
 * against it.
 *
 * An unparseable selector throws a `SyntaxError` inside `Element.matches`, which surfaces as a
 * page-side stack trace naming neither the row nor the file it came from. This turns that into a
 * failure that names the row.
 */
const assertSelectorsParse = async (page: Page, exemptions: readonly Exemption[]): Promise<void> => {
  const broken = await page.evaluate((rows: readonly { id: string; selector: string }[]) => {
    const bad: string[] = [];
    for (const row of rows) {
      try {
        document.createDocumentFragment().querySelector(row.selector);
      } catch (error) {
        bad.push(`"${row.id}" carries the selector ${row.selector}, which the browser refuses: ${String(error)}`);
      }
    }
    return bad;
  }, exemptions.map((row) => ({ id: row.id, selector: row.selector })));

  if (broken.length > 0) {
    throw new Error(`Hit-target floor: an exemption selector does not parse:\n${broken.join('\n')}`);
  }
};

/**
 * The whole surface, measured.
 *
 * Handles are taken **once**, with `.all()`, rather than by counting and then reading by index.
 * An index re-resolves the selector on every read, so a DOM that mutates under the loop would
 * silently shift the sequence and either measure one element twice or skip one, with the count
 * still looking right.
 *
 * Two reads per handle. The first, in the page, answers what the element is and whether the
 * visibility and accessibility-tree rule removes it. The second is Playwright's own
 * `boundingBox()`, which is the measurement AD-19 asks for. A candidate the rule admitted whose
 * box comes back `null` is a failure rather than a skip: `null` is what a detached or invisible
 * element answers, and a sweep that silently dropped one would report a smaller count with
 * nothing saying why.
 */
const measureSurface = async (page: Page, exemptions: readonly Exemption[] = EXEMPTIONS): Promise<Surveyed> => {
  await assertSelectorsParse(page, exemptions);

  const targets: Locator[] = await page.locator(INTERACTIVE).all();

  const skipped: Skipped[] = [];
  const measured: Measured[] = [];

  for (const target of targets) {
    const meta = await target.evaluate(
      (node: Element, selectors: readonly { id: string; selector: string }[]) => {
        const path = (): string => {
          const parts: string[] = [];
          let current: Element | null = node;
          while (current && current !== document.documentElement) {
            let part = current.tagName.toLowerCase();
            if (current.id) part += `#${current.id}`;
            const classes = [...current.classList].join('.');
            if (classes) part += `.${classes}`;
            const parent: Element | null = current.parentElement;
            if (parent) {
              const tag = current.tagName;
              const siblings = [...parent.children].filter((child) => child.tagName === tag);
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
            parts.unshift(part);
            current = current.parentElement;
          }
          return parts.join(' > ');
        };

        // The visibility and accessibility-tree rule, in one place. An element removed from the
        // accessibility tree is not a target a person can reach, and neither is one with no box.
        // `closest` rather than a property read, because `aria-hidden` on an ancestor removes the
        // whole subtree and the attribute is rarely on the control itself.
        const why = ((): string | null => {
          if (node.closest('[aria-hidden="true"]')) return 'inside an aria-hidden subtree';
          if (node.closest('[hidden]')) return 'inside a subtree carrying the hidden attribute';
          if (node.getClientRects().length === 0) return 'generates no box (display:none or detached)';
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return 'zero area';
          if (window.getComputedStyle(node).visibility === 'hidden') return 'visibility:hidden';
          return null;
        })();

        return {
          at: path(),
          text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
          why,
          matchedIds: selectors.filter((row) => node.matches(row.selector)).map((row) => row.id),
        };
      },
      exemptions.map((row) => ({ id: row.id, selector: row.selector }))
    );

    if (meta.why) {
      skipped.push({ at: meta.at, why: meta.why });
      continue;
    }

    const box = await target.boundingBox({ timeout: 5_000 });

    if (!box) {
      throw new Error(
        `Hit-target floor: ${meta.at} passed the visibility rule and then answered no bounding ` +
          `box. A candidate is either skipped with a stated reason or measured; it is never ` +
          `dropped in silence.`
      );
    }

    measured.push({
      at: meta.at,
      text: meta.text,
      width: box.width,
      height: box.height,
      left: box.x,
      right: box.x + box.width,
      matchedIds: meta.matchedIds,
    });
  }

  return { found: targets.length, skipped, measured };
};

const size = (element: Measured): string =>
  `${element.width.toFixed(2)} x ${element.height.toFixed(2)}`;

/**
 * The vacuous-pass guard, as a predicate over one surface's counts.
 *
 * Pure, so the standing case drives it with a synthetic surface rather than asserting an inline
 * `expect` it supplied the message for. That was the shape this case had first, and it was
 * green with the guard deleted, which is precisely the failure the guard exists to prevent.
 */
interface SurfaceCount {
  readonly route: string;
  readonly found: number;
  readonly skipped: number;
  readonly measured: number;
  readonly expectsMeasured: boolean;
}

const countVerdict = (
  observed: SurfaceCount,
  pinned: { found: number; skipped: number; measured: number }
): string[] => {
  const wrong: string[] = [];

  if (observed.found === 0) {
    wrong.push(
      `${observed.route} yielded no interactive candidates at all. A sweep that loops zero times is ` +
        `green over nothing, which is the failure tests/e2e/harness.ts:28 names.`
    );
  }

  if (observed.skipped + observed.measured !== observed.found) {
    wrong.push(
      `${observed.route} found ${observed.found} candidates and accounted for ` +
        `${observed.skipped + observed.measured} of them (${observed.skipped} skipped, ` +
        `${observed.measured} measured). Every candidate is one or the other.`
    );
  }

  if (observed.expectsMeasured && observed.measured === 0) {
    wrong.push(
      `${observed.route} expects measurable controls and measured none. They were all removed by ` +
        `the visibility rule, or they stopped rendering.`
    );
  }

  if (!observed.expectsMeasured && observed.measured > 0) {
    wrong.push(
      `${observed.route} is registered as measuring nothing and measured ${observed.measured} ` +
        `elements. Update SURFACES and ops/hit-target-floor.md rather than the guard.`
    );
  }

  for (const axis of ['found', 'skipped', 'measured'] as const) {
    if (observed[axis] !== pinned[axis]) {
      wrong.push(
        `${observed.route} ${axis} ${observed[axis]}, and SURFACES pins ${pinned[axis]}. A count ` +
          `that moved is a control added, removed or hidden; move the number here and in ` +
          `ops/hit-target-floor.md in the same commit.`
      );
    }
  }

  return wrong;
};

/**
 * The verdict on one surface. Pure over its inputs, so the planted controls can drive it with
 * rows and a ledger of their own rather than having to arrange a real page that fails.
 */
const judge = (
  route: string,
  measured: readonly Measured[],
  floor: number,
  viewportWidth: number,
  exemptions: readonly Exemption[] = EXEMPTIONS
): Verdict => {
  const under: string[] = [];
  const misrouted: string[] = [];
  const stale: string[] = [];
  const wide: string[] = [];
  const hits = new Map<PairKey, Tally>();

  for (const row of exemptions) {
    if (row.routes.includes(route)) hits.set(pairKey(row.id, route), { matched: 0, under: 0 });
  }

  for (const element of measured) {
    // Two sets, because "no row lists this element" and "a row lists it and not on this route"
    // are different findings and the second one sends a reader hunting for a row that exists.
    const matching = exemptions.filter((row) => element.matchedIds.includes(row.id));
    const applicable = matching.filter((row) => row.routes.includes(route));
    const belowFloor = element.width < floor || element.height < floor;

    for (const row of applicable) {
      const key = pairKey(row.id, route);
      const tally = hits.get(key) ?? { matched: 0, under: 0 };
      tally.matched += 1;
      if (belowFloor) tally.under += 1;
      hits.set(key, tally);
    }

    if (belowFloor && applicable.length === 0) {
      if (matching.length === 0) {
        under.push(
          `${route}: ${element.at} ("${element.text}") measures ${size(element)}, and the floor is ` +
            `${floor} on both axes. Nothing in the exemption ledger lists it.`
        );
      } else {
        misrouted.push(
          `${route}: ${element.at} ("${element.text}") measures ${size(element)}, and the floor is ` +
            `${floor} on both axes. It matches ${matching
              .map((row) => `"${row.id}"`)
              .join(' and ')}, which does not list ${route}. Add the route to that row if the ` +
            `surface is meant to be covered, or repair the element.`
        );
      }
    }

    if (!belowFloor && applicable.length > 0) {
      stale.push(
        `${route}: ${element.at} ("${element.text}") measures ${size(element)} and clears the ` +
          `floor of ${floor}, while ${applicable
            .map((row) => `"${row.id}"`)
            .join(' and ')} still lists it. Delete the row, here and in ops/hit-target-floor.md.`
      );
    }

    // Both edges. An element at a negative x scrolls the page just as surely as one past the
    // right edge, and testing only the right edge silently narrows A-5 to half of itself.
    if (element.right > viewportWidth + EDGE_SLACK) {
      wide.push(
        `${route}: ${element.at} ("${element.text}") ends at ${element.right.toFixed(2)}, past the ` +
          `right edge of the ${viewportWidth} viewport. A-5 allows no horizontal scroll at this width.`
      );
    }

    if (element.left < -EDGE_SLACK) {
      wide.push(
        `${route}: ${element.at} ("${element.text}") starts at ${element.left.toFixed(2)}, outside ` +
          `the left edge of the ${viewportWidth} viewport. A-5 allows no horizontal scroll at this width.`
      );
    }
  }

  return { under, misrouted, stale, wide, hits };
};

/** Merge one route's bookkeeping into the run's. Keys are per row **and** route. */
const accumulate = (into: Map<PairKey, Tally>, from: Map<PairKey, Tally>): void => {
  for (const [key, tally] of from) {
    const running = into.get(key) ?? { matched: 0, under: 0 };
    running.matched += tally.matched;
    running.under += tally.under;
    into.set(key, running);
  }
};

/**
 * The bookkeeping half of staleness, over the whole run.
 *
 * Three separate ways a ledger stops describing the tree, and each is named rather than folded
 * into one "the ledger is wrong":
 *
 *  1. A row matches nothing **on one of the routes it lists**. A row covering three surfaces that
 *     goes dead on one of them is half stale, and a run-wide total would hide that entirely.
 *  2. A row covers a different number of elements than it says. This is what stops an existing
 *     selector silently exempting a newly added control.
 *  3. A row matched an element that is not under the floor. `stale` above reports the element;
 *     this reports the arithmetic, and it is what wires `Tally.under` to something.
 */
const ledgerDrift = (
  hits: Map<PairKey, Tally>,
  exemptions: readonly Exemption[] = EXEMPTIONS
): string[] => {
  const drift: string[] = [];

  for (const row of exemptions) {
    let covered = 0;

    for (const route of row.routes) {
      const tally = hits.get(pairKey(row.id, route));
      covered += tally?.matched ?? 0;

      if (!tally || tally.matched === 0) {
        drift.push(
          `${pairKey(row.id, route)} matched no measured element (${row.selector}, ${row.source}). ` +
            `Either the surface is gone from that route or the selector stopped matching there; ` +
            `either way the row is stale on that route and ${row.closedBy} should have narrowed it.`
        );
      }

      if (tally && tally.under !== tally.matched) {
        drift.push(
          `${pairKey(row.id, route)} matched ${tally.matched} elements and only ${tally.under} are ` +
            `under the floor. An exemption covers breaches, not compliant controls.`
        );
      }
    }

    if (covered !== row.covers) {
      drift.push(
        `"${row.id}" covers ${covered} measured elements across ${row.routes.join(', ')} and the ` +
          `ledger says ${row.covers}. A selector that started matching more than it was written ` +
          `for exempts a new control for free; one that matches fewer has lost a surface. Move the ` +
          `number here and in ops/hit-target-floor.md, or narrow the selector.`
      );
    }
  }

  return drift;
};

test.describe('the hit-target floor', () => {
  test('every route app/ serves is registered as a swept surface or as a non-Hub route', () => {
    // The hole this closes: `SURFACES` and `NON_HUB_ROUTES` are hand-written, and KV-4 states in
    // writing that the floor is enforced on every route and that a new undersized control fails on
    // arrival. Story 2-9, the next on the board, adds a surface. Without this case that surface is
    // simply never visited, and every count above it stays green.
    const onDisk = routesOnDisk(join(REPO_ROOT, 'app'));
    const registered: string[] = [...SURFACES.map((surface) => surface.route), ...NON_HUB_ROUTES].sort();

    expect(onDisk.length, 'no route was derived from app/, so this comparison is over nothing').toBeGreaterThan(0);
    expect(onDisk, 'the derived route set no longer carries the home route').toContain('/');
    expect(onDisk, 'the derived route set no longer carries the 404 surface').toContain(NOT_FOUND);

    const unregistered = onDisk.filter((route) => !registered.includes(route));
    const phantom = registered.filter((route) => !onDisk.includes(route));

    expect(
      unregistered,
      `app/ serves a route this file never visits. Add it to SURFACES with its pinned counts, or ` +
        `to NON_HUB_ROUTES if it renders no markup, and move the table in ops/hit-target-floor.md ` +
        `with it. Unregistered: ${unregistered.join(', ')}`
    ).toEqual([]);

    expect(
      phantom,
      `a route is registered here and app/ no longer serves it: ${phantom.join(', ')}`
    ).toEqual([]);

    expect(new Set(registered).size, 'a route is registered twice').toBe(registered.length);

    // The walk, on planted controls, so an empty or over-eager derivation is not read as
    // agreement. `app/scss` holds partials and no route; `app/api/health` holds a route handler.
    expect(onDisk, 'the walk invented a route for a folder holding no page or route file').not.toContain('/scss');
    expect(onDisk, 'the walk no longer finds a route handler').toContain('/api/health');
  });

  test('the ledger is well formed before anything is measured against it', async ({ page }) => {
    // Nothing here touches the browser except to read the floor and parse the selectors, and that
    // is the point: a malformed ledger would make every case below pass or fail for a reason that
    // has nothing to do with a hit target.
    await goTo(page, NOT_FOUND, 404);
    const floor = await floorFrom(page);

    expect(EXEMPTIONS.length, 'the exemption ledger is empty, so the sweep exempts nothing').toBeGreaterThan(0);
    expect(new Set(EXEMPTIONS.map((row) => row.id)).size, 'two rows share an id').toBe(EXEMPTIONS.length);
    expect(new Set(EXEMPTIONS.map((row) => row.selector)).size, 'two rows share a selector').toBe(
      EXEMPTIONS.length
    );

    const swept = SURFACES.map((surface) => surface.route);
    for (const row of EXEMPTIONS) {
      expect(row.routes.length, `"${row.id}" lists no route`).toBeGreaterThan(0);
      expect(new Set(row.routes).size, `"${row.id}" lists a route twice`).toBe(row.routes.length);
      for (const route of row.routes) {
        expect(swept, `"${row.id}" lists ${route}, which is not swept`).toContain(route);
      }
      expect(row.closedBy, `"${row.id}" names no closing story`).toMatch(/^Story \d+-\d+$/);
      expect(row.source, `"${row.id}" does not match SOURCE_SHAPE`).toMatch(SOURCE_SHAPE);
      expect(row.covers, `"${row.id}" claims to cover no element`).toBeGreaterThan(0);
      expect(
        row.covers,
        `"${row.id}" covers ${row.covers} elements across ${row.routes.length} routes, which is ` +
          `fewer than one per route`
      ).toBeGreaterThanOrEqual(row.routes.length);

      // The recorded size is documentation, and this is the one thing it is held to. A row whose
      // numbers all clear the floor is exempting an element it has no evidence is under it.
      const numbers = (row.measured.match(/[0-9]+(?:\.[0-9]+)?/g) ?? []).map(Number);
      expect(numbers.length, `"${row.id}" records no measured numbers`).toBeGreaterThan(0);
      expect(
        Math.min(...numbers),
        `"${row.id}" records ${row.measured}, in which no axis is under the floor of ${floor}`
      ).toBeLessThan(floor);
    }

    // The pinned per-surface counts have to add up to the ledger plus whatever clears the floor,
    // or the two tables are describing different runs.
    const pinnedMeasured = SURFACES.reduce((total, surface) => total + surface.measured, 0);
    const covered = EXEMPTIONS.reduce((total, row) => total + row.covers, 0);
    expect(
      covered,
      `the ledger covers ${covered} elements and SURFACES pins ${pinnedMeasured} measured. The ` +
        `ledger cannot cover more elements than the sweep measures.`
    ).toBeLessThanOrEqual(pinnedMeasured);

    // Every selector, through the browser's own parser, naming the row rather than throwing a
    // page-side SyntaxError from inside `Element.matches`.
    await expect(assertSelectorsParse(page, EXEMPTIONS)).resolves.toBeUndefined();
    await expect(
      assertSelectorsParse(page, [{ ...EXEMPTIONS[0], id: 'planted-bad-selector', selector: 'a:::not-a-pseudo' }])
    ).rejects.toThrow(/planted-bad-selector/);

    // The floor parser, on planted controls, before any comparison rests on it. Without these an
    // unreadable `--tap` could return something that compares plausibly against a real box.
    expect(parseFloor(' 48px ')).toBe(48);
    expect(parseFloor('2.5px')).toBe(2.5);
    for (const refused of ['', 'auto', '0px', '-8px', '3rem', '48', '48 px']) {
      expect(() => parseFloor(refused), `the floor parser accepted "${refused}"`).toThrow(/not a positive length/);
    }

    // And SOURCE_SHAPE itself, so a shape that stopped matching anything would not read as six
    // conforming rows.
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx:7')).toBe(true);
    expect(SOURCE_SHAPE.test('app/not-found.tsx:12,14')).toBe(true);
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx')).toBe(false);
    expect(SOURCE_SHAPE.test('components/atoms/Logo/logo.scss:7')).toBe(false);
  });

  test('every interactive element on every Hub surface clears the floor or is on the ledger', async ({
    page,
  }) => {
    const hits = new Map<PairKey, Tally>();
    const under: string[] = [];
    const misrouted: string[] = [];
    const stale: string[] = [];
    const wide: string[] = [];
    const counted: string[] = [];
    const summary: string[] = [];

    let floor = 0;

    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      await settle(page, surface);

      // Read per route rather than once. A route that failed to load the contract would answer a
      // different floor, and comparing its boxes against another page's number is a comparison
      // between two pages.
      const routeFloor = await floorFrom(page);
      if (floor === 0) floor = routeFloor;
      expect(routeFloor, `--tap resolves differently on ${surface.route}`).toBe(floor);

      // Asserted rather than taken from the config, because the baseline of this whole file is
      // that the measurement happened at AD-19's width.
      expect(page.viewportSize(), `${surface.route} was not measured at the pinned viewport`).toEqual({
        ...RENDERED_VIEWPORT,
      });
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(viewportWidth, `${surface.route} reports a viewport width the config did not set`).toBe(
        RENDERED_VIEWPORT.width
      );

      const { found, skipped, measured } = await measureSurface(page);

      counted.push(
        ...countVerdict(
          {
            route: surface.route,
            found,
            skipped: skipped.length,
            measured: measured.length,
            expectsMeasured: surface.measured > 0,
          },
          surface
        )
      );

      summary.push(
        `${surface.route}: found ${found}, skipped ${skipped.length}, measured ${measured.length}` +
          (skipped.length > 0 ? ` [${skipped.map((row) => `${row.at} (${row.why})`).join('; ')}]` : '')
      );

      const verdict = judge(surface.route, measured, floor, viewportWidth);
      under.push(...verdict.under);
      misrouted.push(...verdict.misrouted);
      stale.push(...verdict.stale);
      wide.push(...verdict.wide);
      accumulate(hits, verdict.hits);
    }

    expect(
      counted,
      `a surface did not yield what it is registered to yield:\n${counted.join('\n')}\n\n${summary.join('\n')}`
    ).toEqual([]);

    expect(
      under,
      `an interactive element is under the ${floor} floor and no exemption lists it. AD-19 makes ` +
        `this the build's problem rather than a reviewer's:\n${under.join('\n')}\n\n${summary.join('\n')}`
    ).toEqual([]);

    expect(
      misrouted,
      `an interactive element is under the floor and the row that matches it does not list this ` +
        `route:\n${misrouted.join('\n')}`
    ).toEqual([]);

    expect(
      stale,
      `an exemption lists an element that now clears the floor. The row is what forces the ledger ` +
        `to shrink as Stories 2-15, 2-30 and 2-32 land, so it is deleted rather than ` +
        `kept:\n${stale.join('\n')}`
    ).toEqual([]);

    const drift = ledgerDrift(hits);
    expect(
      drift,
      `the exemption ledger no longer describes what the sweep measured:\n${drift.join('\n')}`
    ).toEqual([]);

    expect(
      wide,
      `A-5: an interactive element's edge is outside the viewport at the pinned width. This is ` +
        `measured on the element because html and body carry overflow-x: clip, so the document's ` +
        `scroll width is clamped by the clipping rather than by the absence of ` +
        `overflow:\n${wide.join('\n')}`
    ).toEqual([]);
  });

  test('the count guard fires on every way a surface can go vacuous', () => {
    // Driven as a predicate over synthetic counts, the way `judge` is driven below. The shape this
    // case had first asserted an inline `expect` it had supplied the message for, so deleting the
    // guard from the sweep left every case green, which is exactly the vacuity the guard is about.
    const pinned = { found: 8, skipped: 0, measured: 8 };
    const observed = { route: '/synthetic', found: 8, skipped: 0, measured: 8, expectsMeasured: true };

    expect(countVerdict(observed, pinned), 'the guard fires on a surface that is exactly right').toEqual([]);

    expect(countVerdict({ ...observed, found: 0, measured: 0 }, { ...pinned, found: 0, measured: 0 })[0]).toMatch(
      /loops zero times/
    );
    expect(
      countVerdict({ ...observed, measured: 0, skipped: 8 }, pinned).some((line) => /measured none/.test(line))
    ).toBe(true);
    expect(
      countVerdict({ ...observed, expectsMeasured: false }, pinned).some((line) =>
        /registered as measuring nothing/.test(line)
      )
    ).toBe(true);
    expect(countVerdict({ ...observed, skipped: 3 }, pinned).some((line) => /accounted for/.test(line))).toBe(true);
    expect(countVerdict(observed, { ...pinned, measured: 9 }).some((line) => /SURFACES pins 9/.test(line))).toBe(
      true
    );
    expect(countVerdict(observed, { ...pinned, found: 9 }).some((line) => /found 8, and SURFACES pins 9/.test(line))).toBe(
      true
    );

    // Every registered surface is described by a row this predicate can be driven with, so the
    // `/celeste` branch is a real branch rather than a comment.
    expect(SURFACES.filter((surface) => surface.measured === 0).map((surface) => surface.route)).toEqual(['/celeste']);
  });

  test('at least one measured element clears the floor, so the comparison separates two answers', async ({
    page,
  }) => {
    // Without this, a floor read as some enormous number would put every element under it and the
    // case above would still be green, because everything under the floor is on the ledger today.
    await goTo(page, '/work');
    await settle(page, { route: '/work', entrance: false });
    const floor = await floorFrom(page);
    const { measured } = await measureSurface(page);

    const clears = measured.filter((element) => element.width >= floor && element.height >= floor);
    expect(
      clears.length,
      `no element on /work clears the floor of ${floor}, so the sweep cannot tell a compliant ` +
        `target from a breach: ${measured.map((element) => `${element.at} ${size(element)}`).join('; ')}`
    ).toBeGreaterThan(0);

    const breaches = measured.filter((element) => element.width < floor || element.height < floor);
    expect(breaches.length, 'every element on /work clears the floor, so the ledger is dead weight').toBeGreaterThan(
      0
    );
  });

  test('fails on an unlisted element under the floor, naming the route, the selector and the box', async ({
    page,
  }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, entrance: false });
    const floor = await floorFrom(page);

    // Injected into this page through the browser, so no fixture is left in the tree. Same
    // separation `ops/rendered-output-harness.md` draws between a one-time probe and the standing
    // case that replaces it.
    await page.evaluate(() => {
      const planted = document.createElement('a');
      planted.href = '#planted';
      planted.id = 'planted-undersized';
      planted.textContent = 'x';
      planted.setAttribute('style', 'display:inline-flex;width:10px;height:10px;');
      document.body.appendChild(planted);
    });

    const { measured } = await measureSurface(page);
    const verdict = judge(NOT_FOUND, measured, floor, RENDERED_VIEWPORT.width);

    expect(verdict.under, 'the planted undersized control was not reported').toHaveLength(1);
    expect(verdict.under[0]).toContain(NOT_FOUND);
    expect(verdict.under[0]).toContain('a#planted-undersized');
    expect(verdict.under[0], 'the message does not carry the measured box').toContain('10.00 x 10.00');
    expect(verdict.under[0], 'the message does not carry the floor').toContain(String(floor));

    // And the real surface underneath it is still judged the way the standing case judges it, so
    // this control did not pass by disturbing everything else.
    expect(verdict.stale, 'planting a control turned a real row stale').toEqual([]);
    expect(verdict.misrouted, 'the planted control was reported as a route mismatch').toEqual([]);
  });

  test('separates an unlisted element from one whose row does not list this route', async ({ page }) => {
    // Both are "under the floor and not exempt here", and reporting them the same way sends a
    // reader hunting for a row that exists. The planted element matches `a.nav-link`, whose row
    // lists the home route and not the 404.
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, entrance: false });
    const floor = await floorFrom(page);

    await page.evaluate(() => {
      const planted = document.createElement('a');
      planted.href = '#misrouted';
      planted.id = 'planted-misrouted';
      planted.className = 'nav-link';
      planted.textContent = 'y';
      planted.setAttribute('style', 'display:inline-flex;width:12px;height:12px;');
      document.body.appendChild(planted);
    });

    const { measured } = await measureSurface(page);
    const verdict = judge(NOT_FOUND, measured, floor, RENDERED_VIEWPORT.width);

    expect(verdict.misrouted, 'the misrouted control was not reported as such').toHaveLength(1);
    expect(verdict.misrouted[0]).toContain('a#planted-misrouted');
    expect(verdict.misrouted[0], 'the message does not name the row that matched').toContain('"home-nav"');
    expect(verdict.under, 'the misrouted control was also reported as listed by nothing').toEqual([]);
  });

  test('fails on an element that reaches the floor only through vertical padding on a plain inline element', async ({
    page,
  }) => {
    // The case AD-19 and `DESIGN.md:645-648` single out, and the reason this story exists:
    // an inline link with `padding: 0.25rem 0` reads as a padded, comfortable target in the CSS
    // and measures roughly 29px tall. Its label is deliberately wide, so the width axis clears
    // the floor and the failure is the height alone rather than "it is a small element".
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, entrance: false });
    const floor = await floorFrom(page);

    await page.evaluate(() => {
      const planted = document.createElement('a');
      planted.href = '#padded';
      planted.id = 'planted-padded-inline';
      planted.textContent = 'Read the documentation';
      planted.setAttribute('style', 'display:inline;padding:0.25rem 0;');
      document.body.appendChild(planted);
    });

    const { measured } = await measureSurface(page);
    const planted = measured.find((element) => element.at.includes('a#planted-padded-inline'));

    expect(planted, 'the padded inline control was not measured at all').toBeDefined();
    expect(
      planted?.width ?? 0,
      'the padded control is narrower than the floor, so this case would fail on the wrong axis'
    ).toBeGreaterThanOrEqual(floor);
    expect(
      planted?.height ?? 0,
      `vertical padding on a plain inline element no longer leaves the box under the floor. The ` +
        `whole point of this case is that the CSS reads as compliant and the measurement does not.`
    ).toBeLessThan(floor);

    const verdict = judge(NOT_FOUND, measured, floor, RENDERED_VIEWPORT.width);
    const reported = verdict.under.filter((line) => line.includes('a#planted-padded-inline'));
    expect(reported, 'the padded inline control was not reported by the sweep').toHaveLength(1);
    expect(reported[0], 'the report does not name the measured box').toMatch(/measures \d+\.\d\d x \d+\.\d\d/);
  });

  test('fails a listed element that now clears the floor, naming the row to delete', async ({ page }) => {
    // The direction that makes the ledger shrink. This is what Stories 2-9, 2-15, 2-30 and 2-32
    // will hit on the commit that repairs their surface, and it is why they cannot leave a row
    // behind. Planted by injecting a compliant link into the real chrome nav, so a real row
    // rather than a synthetic one goes stale.
    await goTo(page, '/work');
    await settle(page, { route: '/work', entrance: false });
    const floor = await floorFrom(page);

    const planted = await page.evaluate(() => {
      const host = document.querySelector('nav.navbar');
      // Thrown rather than skipped. A missing plant target would leave this case asserting that
      // nothing was reported, which reads as the predicate failing rather than as the fixture
      // being gone, and Story 2-15 reshapes exactly this element.
      if (!host) return false;
      const link = document.createElement('a');
      link.href = '#repaired';
      link.id = 'planted-repaired-nav-link';
      link.textContent = 'Suite';
      // Taken out of flow deliberately. `.navbar` is a wrapping flex row with the default
      // `align-items: stretch`, so an in-flow 80px child would stretch its siblings to 80 as well
      // and this control would be reporting a layout side effect rather than the predicate.
      link.setAttribute(
        'style',
        'position:absolute;top:0;left:0;display:inline-flex;align-items:center;width:80px;height:80px;'
      );
      host.appendChild(link);
      return true;
    });

    expect(
      planted,
      'no nav.navbar exists on /work, so the stale-row control had nothing to plant into. The ' +
        'fixture is gone, not the predicate.'
    ).toBe(true);

    const { measured } = await measureSurface(page);
    const verdict = judge('/work', measured, floor, RENDERED_VIEWPORT.width);

    expect(verdict.stale, 'a repaired listed element was not reported as a stale row').toHaveLength(1);
    expect(verdict.stale[0]).toContain('a#planted-repaired-nav-link');
    expect(verdict.stale[0], 'the message does not name the row to delete').toContain('"chrome-nav"');
    expect(verdict.stale[0], 'the message does not point at the record').toContain('ops/hit-target-floor.md');
    expect(verdict.under, 'the repaired element was also reported as an unlisted breach').toEqual([]);

    // The same plant is also a row covering more than it says it covers, which is the arithmetic
    // half of the same defect and the reason `covers` exists.
    const drift = ledgerDrift(verdict.hits, [EXEMPTIONS.find((row) => row.id === 'chrome-nav')!]);
    expect(drift.some((line) => /covers 7 measured elements/.test(line))).toBe(true);
  });

  test('fails a row that has stopped matching on one of the routes it lists', () => {
    // Driven through the pure verdict, because arranging a real page where a shipped surface has
    // vanished from one route means deleting a component. The row shape is the real one.
    const ghost: Exemption = {
      id: 'a-surface-on-two-routes',
      selector: '.a-class-nothing-renders a',
      source: 'components/atoms/Nowhere/Nowhere.tsx:1',
      routes: ['/work', '/projects'],
      covers: 2,
      measured: '10.00 x 10.00',
      closedBy: 'Story 9-99',
    };

    const live: Measured = {
      at: 'body > a',
      text: 'x',
      width: 1,
      height: 1,
      left: 0,
      right: 1,
      matchedIds: ['a-surface-on-two-routes'],
    };

    // Matches on `/work` and not on `/projects`: half stale, which a run-wide total would hide.
    const hits = new Map<PairKey, Tally>();
    accumulate(hits, judge('/work', [live], 2, RENDERED_VIEWPORT.width, [ghost]).hits);
    accumulate(hits, judge('/projects', [], 2, RENDERED_VIEWPORT.width, [ghost]).hits);

    const drift = ledgerDrift(hits, [ghost]);
    expect(drift.some((line) => line.includes('"a-surface-on-two-routes" on /projects'))).toBe(true);
    expect(drift.some((line) => line.includes('"a-surface-on-two-routes" on /work'))).toBe(false);
    expect(drift.some((line) => /covers 1 measured elements/.test(line))).toBe(true);
    expect(drift.some((line) => /Story 9-99/.test(line))).toBe(true);

    // Both routes matching once each is the healthy case and reports nothing, so the above are
    // differences rather than noise.
    const healthy = new Map<PairKey, Tally>();
    accumulate(healthy, judge('/work', [live], 2, RENDERED_VIEWPORT.width, [ghost]).hits);
    accumulate(healthy, judge('/projects', [live], 2, RENDERED_VIEWPORT.width, [ghost]).hits);
    expect(ledgerDrift(healthy, [ghost])).toEqual([]);

    // And a row matching a compliant element is reported by the arithmetic as well as by `stale`,
    // which is what `Tally.under` is wired to.
    const compliant: Measured = { ...live, width: 9, height: 9 };
    const mixed = new Map<PairKey, Tally>();
    accumulate(mixed, judge('/work', [live, compliant], 2, RENDERED_VIEWPORT.width, [ghost]).hits);
    accumulate(mixed, judge('/projects', [live], 2, RENDERED_VIEWPORT.width, [ghost]).hits);
    expect(ledgerDrift(mixed, [ghost]).some((line) => /only 1 are under the floor/.test(line))).toBe(true);
  });

  test('never sweeps a hidden or decorative node, and never counts one', async ({ page }) => {
    // `/celeste` is the shipped case: `celeste.scss:8-10` hides the header, so every one of its
    // candidates is removed. Asserted here as well as in the sweep, because that route's zero is
    // the one place a broken selector would look exactly like a correct skip.
    await goTo(page, '/celeste');
    await settle(page, { route: '/celeste', entrance: false });

    const shipped = await measureSurface(page);
    expect(shipped.found, '/celeste renders no interactive candidate at all any more').toBeGreaterThan(0);
    expect(shipped.measured, '/celeste measured an element that the header rule should have hidden').toEqual([]);
    expect(shipped.skipped.length).toBe(shipped.found);
    for (const row of shipped.skipped) {
      expect(row.why, `${row.at} was skipped for an unexpected reason`).toContain('generates no box');
    }

    // The other arms of the rule, planted, because nothing in the Hub exercises them today.
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, entrance: false });
    const before = await measureSurface(page);

    await page.evaluate(() => {
      const decorative = document.createElement('div');
      decorative.setAttribute('aria-hidden', 'true');
      decorative.innerHTML =
        '<a href="#aria" id="planted-aria-hidden" style="display:inline-flex;width:8px;height:8px;">a</a>';
      document.body.appendChild(decorative);

      const invisible = document.createElement('a');
      invisible.href = '#none';
      invisible.id = 'planted-display-none';
      invisible.textContent = 'n';
      invisible.setAttribute('style', 'display:none;');
      document.body.appendChild(invisible);

      const flat = document.createElement('a');
      flat.href = '#flat';
      flat.id = 'planted-zero-area';
      flat.textContent = '';
      flat.setAttribute('style', 'display:inline-flex;width:0;height:0;');
      document.body.appendChild(flat);

      const invisibleVisibility = document.createElement('a');
      invisibleVisibility.href = '#invisible';
      invisibleVisibility.id = 'planted-visibility-hidden';
      invisibleVisibility.textContent = 'v';
      invisibleVisibility.setAttribute('style', 'display:inline-flex;width:9px;height:9px;visibility:hidden;');
      document.body.appendChild(invisibleVisibility);

      const inert = document.createElement('div');
      inert.setAttribute('hidden', '');
      inert.innerHTML =
        '<a href="#hidden" id="planted-hidden-attribute" style="display:inline-flex;width:7px;height:7px;">h</a>';
      document.body.appendChild(inert);
    });

    const after = await measureSurface(page);

    expect(after.found, 'the five planted nodes were not matched as candidates at all').toBe(before.found + 5);
    expect(
      after.measured.length,
      `a hidden or decorative node was measured: ${after.measured.map((row) => row.at).join('; ')}`
    ).toBe(before.measured.length);

    // Every arm, asserted by name. Behind an `if` on the path shape, an arm that stopped being
    // planted, or a path builder that stopped emitting ids, would silently stop being demonstrated
    // while this case stayed green.
    const reasonFor = (id: string): string => {
      const row = after.skipped.find((skipped) => skipped.at.includes(`#${id}`));
      expect(row, `the planted node "${id}" was not skipped, so that arm of the rule was not exercised`).toBeDefined();
      return row?.why ?? '';
    };

    expect(reasonFor('planted-aria-hidden')).toContain('aria-hidden');
    expect(reasonFor('planted-hidden-attribute')).toContain('hidden attribute');
    expect(reasonFor('planted-display-none')).toContain('generates no box');
    expect(reasonFor('planted-zero-area')).toContain('zero area');
    expect(reasonFor('planted-visibility-hidden')).toContain('visibility:hidden');

    // The floor never saw them, so a decorative 8px node cannot fail the build and cannot pad the
    // count that proves the sweep measured something.
    const floor = await floorFrom(page);
    const verdict = judge(NOT_FOUND, after.measured, floor, RENDERED_VIEWPORT.width);
    expect(verdict.under.filter((line) => line.includes('planted-'))).toEqual([]);
  });

  test('A-5 fails on an element outside either edge, which a scroll width check reports inconsistently', async ({
    page,
  }) => {
    await goTo(page, NOT_FOUND, 404);
    await settle(page, { route: NOT_FOUND, entrance: false });
    const floor = await floorFrom(page);

    // The premise, asserted before anything is planted. If this surface already carried a clipped
    // overflowing element the case below would pass while reporting the wrong element, and the
    // claim it makes about `scrollWidth` would be about something else entirely.
    const clean = await measureSurface(page);
    expect(
      judge(NOT_FOUND, clean.measured, floor, RENDERED_VIEWPORT.width).wide,
      'the 404 surface already carries an interactive element outside the viewport, so this control ' +
        'cannot show that the planted one is what was caught'
    ).toEqual([]);

    const before = await page.evaluate(() => {
      const inner = window.innerWidth;
      const outside = [...document.querySelectorAll('body, body *')].filter((node) => {
        if (node.getClientRects().length === 0) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return rect.right > inner + 0.5 || rect.left < -0.5;
      }).length;
      return {
        documentScroll: document.documentElement.scrollWidth,
        bodyScroll: document.body.scrollWidth,
        inner,
        outside,
      };
    });

    expect(
      before.outside,
      'the 404 surface already has elements outside the viewport, so the scroll-width claim below ' +
        'would be measuring a pre-existing overflow rather than the planted one'
    ).toBe(0);
    expect(
      before.documentScroll,
      'the 404 surface already overflows, so this control cannot show that the clipping hides it'
    ).toBeLessThanOrEqual(before.inner);

    await page.evaluate(() => {
      const past = document.createElement('a');
      past.href = '#wide';
      past.id = 'planted-past-the-edge';
      past.textContent = 'past the edge';
      past.setAttribute(
        'style',
        'position:absolute;top:0;left:300px;width:200px;height:60px;display:inline-flex;'
      );
      document.body.appendChild(past);

      const behind = document.createElement('a');
      behind.href = '#negative';
      behind.id = 'planted-before-the-edge';
      behind.textContent = 'before the edge';
      behind.setAttribute(
        'style',
        'position:absolute;top:100px;left:-80px;width:60px;height:60px;display:inline-flex;'
      );
      document.body.appendChild(behind);
    });

    const after = await page.evaluate(() => ({
      documentScroll: document.documentElement.scrollWidth,
      bodyScroll: document.body.scrollWidth,
      inner: window.innerWidth,
    }));

    // **The measurement behind the design note, and it is asserted in both directions because the
    // two standard readings disagree on this page.** Measured 2026-09-06 in the pinned image:
    // `document.body.scrollWidth` does **not** grow, because both planted elements are absolutely
    // positioned against the initial containing block and `body` is therefore not their containing
    // block; `document.documentElement.scrollWidth` **does**, because `overflow-x: clip` on the
    // root does not clamp out-of-flow content the way it clamps in-flow overflow. On `/work` the
    // same root read answers 360 while elements sit at 490 (`ops/hit-target-floor.md` § The
    // overflow this assertion does not cover), which is the opposite result from the same call.
    //
    // So a `scrollWidth` check answers differently depending on which element is asked and on how
    // the overflow was produced, and one page carries both answers. That is the whole argument for
    // measuring element edges, and this asserts it rather than asserting about it.
    //
    // The earlier form of this read asserted only that `body` did not grow and named `body`'s
    // `overflow-x: hidden` as the cause. It was true for an unrelated reason, the absolute
    // positioning, and it stayed true after Story 2-9 replaced that rule.
    expect(
      after.bodyScroll,
      `body scroll width grew to ${after.bodyScroll} against a viewport of ${after.inner}, so the ` +
        `two readings no longer disagree and the note this case carries needs re-measuring`
    ).toBeLessThanOrEqual(after.inner);
    expect(
      after.documentScroll,
      `the document scroll width did not grow with the planted overflow, so both readings now agree ` +
        `and this case no longer shows that a scroll width check depends on which element is asked`
    ).toBeGreaterThan(after.inner);

    const { measured } = await measureSurface(page);
    const verdict = judge(NOT_FOUND, measured, floor, after.inner);

    expect(verdict.wide, 'an element outside the viewport was not reported on both edges').toHaveLength(2);
    const right = verdict.wide.find((line) => line.includes('a#planted-past-the-edge'));
    const left = verdict.wide.find((line) => line.includes('a#planted-before-the-edge'));
    expect(right, 'the element past the right edge was not reported').toBeDefined();
    expect(right, 'the message does not carry the right edge it measured').toContain('500.00');
    expect(left, 'the element outside the left edge was not reported').toBeDefined();
    expect(left, 'the message does not carry the left edge it measured').toContain('-80.00');
  });

  test('the candidate selector matches controls and passes over ordinary content', async ({ page }) => {
    // Without this the sweep could be measuring paragraphs, and every count above would be a
    // count of the wrong thing.
    await page.setContent(
      '<html><body>' +
        '<p id="prose">not a control</p>' +
        '<a id="no-href">not a link without href</a>' +
        '<a id="anchor" href="#x" style="display:inline-flex;width:60px;height:60px">link</a>' +
        '<button id="control" style="width:60px;height:60px">button</button>' +
        '<div id="widget" role="button" tabindex="0" style="width:60px;height:60px">role</div>' +
        '<div id="unreachable" tabindex="-1" style="width:60px;height:60px">tabindex -1</div>' +
        '</body></html>'
    );

    const { found, measured } = await measureSurface(page);
    expect(found, 'the candidate selector no longer matches the three controls in this fixture').toBe(3);
    expect(
      measured.map((element) => /#([a-z-]+)/.exec(element.at.split(' > ').pop() ?? '')?.[1] ?? '').sort(),
      'the candidate selector matched prose, a link with no href, or an unreachable tabindex'
    ).toEqual(['anchor', 'control', 'widget']);

    // And a page with no controls at all yields nothing, which is the input the count guard turns
    // into a failure.
    await page.setContent('<html><body><p>no controls here</p></body></html>');
    const empty = await measureSurface(page);
    expect(empty.found, 'the candidate selector matches something on a page with no controls').toBe(0);
    expect(empty.measured).toEqual([]);
    expect(
      countVerdict(
        { route: '/synthetic', found: 0, skipped: 0, measured: 0, expectsMeasured: true },
        { found: 0, skipped: 0, measured: 0 }
      )[0]
    ).toMatch(/loops zero times/);
  });

  test('the floor is read from the contract on every surface it is applied to', async ({ page }) => {
    // The whole file rests on this one read. If `--tap` stopped resolving, the harness throws
    // naming it rather than answering an empty string that would compare equal to nothing.
    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      const declared = await rootCustomPropertyValue(page, '--tap');
      expect(declared, `--tap does not resolve to a pixel length on ${surface.route}`).toMatch(/^\d+(\.\d+)?px$/);
      expect(parseFloor(declared), `--tap is not a positive length on ${surface.route}`).toBeGreaterThan(0);
    }

    await expect(rootCustomPropertyValue(page, '--tap-that-is-not-declared')).rejects.toThrow(
      /--tap-that-is-not-declared/
    );
  });

  test('the two destinations on a directory row are separately addressable, --s-lg apart', async ({
    page,
  }) => {
    // **A-4's independently addressable clause** (`EXPERIENCE.md:763`), which `ops/hit-target-floor.md`
    // recorded as unasserted with the note that the check lands with the first surface to put two
    // targets on one line at this viewport. Until Story 2-9 there was no such surface. There is now,
    // so the clause is asserted here rather than left booked.
    //
    // The size half of A-4 is the sweep's, and it is repeated per box here only because a pair that
    // met the floor while overlapping would satisfy the sweep and fail this clause. What this case
    // adds is the relationship between two boxes, which is a different predicate from either box.
    //
    // Both lengths come from the contract in the running page, never from a literal. `--s-lg` is
    // authored in `rem`, so it is resolved through a probe element rather than parsed: a
    // reader-scaled length has no pixel value until something lays it out.
    await goTo(page, '/');
    await settle(page, { route: '/', entrance: true });

    const floor = await floorFrom(page);
    const apartBy = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.position = 'absolute';
      probe.style.inlineSize = 'var(--s-lg)';
      document.body.append(probe);
      const resolved = probe.getBoundingClientRect().width;
      probe.remove();
      return resolved;
    });
    expect(apartBy, 'the probe resolved --s-lg to nothing, so the comparison below is vacuous').toBeGreaterThan(0);

    const directoryRows = page.locator('.suite-directory__row');
    const rowCount = await directoryRows.count();
    expect(rowCount, 'the directory renders no row on /, so this case measures nothing').toBeGreaterThan(0);

    const wrong: string[] = [];
    let pairs = 0;

    for (let index = 0; index < rowCount; index += 1) {
      const links = directoryRows.nth(index).locator('a[href]');
      // The Hub's own row carries one destination, `You are here` having replaced the other. A row
      // with nothing to overlap is not a failure of this clause.
      if ((await links.count()) < 2) continue;

      const first = await links.nth(0).boundingBox();
      const second = await links.nth(1).boundingBox();
      if (!first || !second) {
        wrong.push(`row ${index} carries a link with no box, so it cannot be hit at all`);
        continue;
      }
      pairs += 1;

      for (const [which, box] of [
        ['the first', first],
        ['the second', second],
      ] as const) {
        if (box.width < floor || box.height < floor) {
          wrong.push(
            `row ${index}: ${which} destination measures ${box.width.toFixed(2)} x ${box.height.toFixed(2)}, ` +
              `under the floor of ${floor}`
          );
        }
      }

      // The largest separation on either axis. Two boxes that overlap on both axes give a negative
      // answer, which is what makes "not overlapping" and "far enough apart" one comparison.
      const measuredApart = Math.max(
        second.x - (first.x + first.width),
        first.x - (second.x + second.width),
        second.y - (first.y + first.height),
        first.y - (second.y + second.height)
      );
      if (measuredApart < apartBy - EDGE_SLACK) {
        wrong.push(
          `row ${index}: the two destinations sit ${measuredApart.toFixed(2)} apart on their ` +
            `separating axis, and --s-lg resolves to ${apartBy.toFixed(2)} here. Two --tap boxes ` +
            `closer than that can overlap, which makes them one target by touch`
        );
      }
    }

    expect(pairs, 'no directory row carried two destinations, so nothing was compared').toBeGreaterThan(0);
    expect(
      wrong,
      `a Suite Directory row does not carry two independently addressable targets:\n${wrong.join('\n')}`
    ).toEqual([]);
  });

  test('the routes that render no Hub markup are excluded by measurement, not by omission', async ({
    page,
  }) => {
    // `/cv` and `/recommendation` are permanent redirects to a PDF, so a browser asked for either
    // starts a download rather than a navigation and there is no document to sweep. `/api/health`
    // answers JSON. All three are named here so a later reader can tell an excluded route from a
    // forgotten one, and so a route that quietly starts rendering markup shows up as a failure
    // here rather than as a gap in the sweep.
    const landings: string[] = [];

    for (const route of NON_HUB_ROUTES) {
      const response = await page.request.get(route);
      expect(response.status(), `${route} stopped answering 2xx`).toBe(200);
      const type = response.headers()['content-type'] ?? '';
      const landed = new URL(response.url()).pathname;
      landings.push(`${route} -> ${landed} (${type})`);
      expect(
        /^(application\/pdf|application\/json)/.test(type),
        `${route} now answers "${type}". If it renders HTML it is a Hub surface and belongs in ` +
          `SURFACES, where its interactive elements would be swept.`
      ).toBe(true);
    }

    expect(landings).toHaveLength(NON_HUB_ROUTES.length);
    expect(landings.filter((line) => line.includes('/pdf/')).length, 'the two PDF redirects have changed').toBe(2);
  });
});
