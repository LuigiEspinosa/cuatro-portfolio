import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The Status mark's three structural axes, and A-5's Status half (Story 2-10).
 *
 * **AD-19 states the requirement and also states the way to get it wrong.** The taxonomy is carried
 * by structure rather than hue: `Live` has a 4px dot that `Complete` lacks, `Complete` is solid
 * where `In progress` is dashed, and `In progress` has a border that `Archived` drops. Four values,
 * three axes, no two alike in greyscale. **Asserting `border-style` alone is forbidden**, because
 * `Live` and `Complete` are both `1px solid` and sit 1.13:1 apart in greyscale without the dot, so
 * a border-only assertion passes a broken implementation and fails a correct one. That is not
 * merely avoided here: it is a standing case, which reads the two as identical on `border-style`
 * and says so.
 *
 * **The axes are split across two suites, because they fail in two independent places.** Which
 * values emit a dot is markup and is
 * `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx`. Whether the border is
 * solid, dashed or absent, and whether a dot is actually painted, are the stylesheet's and are
 * here. Asserting the markup half in a browser would mean this file inventing a dot for the three
 * values that never render, which makes the test the author of what it asserts.
 *
 * **Only `Live` reaches the running page, and `data-status` is the seam that gets the other three
 * there.** Nothing in the committed Registry is `Complete`, and `In progress` and `Archived` are
 * held back by the FR-35 filter by design. The attribute at
 * `components/organisms/SuiteDirectory/SuiteDirectory.tsx:93` is the contract between the component
 * and the four selectors at `SuiteDirectory.scss:192-204`, so planting it on a real mark in the
 * live page exercises the shipped stylesheet and nothing else. A fixture route or a test-only
 * component would put a second rendering of the mark in the tree, and a second rendering is the
 * thing that can silently disagree with the first.
 *
 * **Print is the greyscale render, and it is real rather than simulated.** The obvious check
 * applies `filter: grayscale(1)` and measures nothing: a filter is a paint-time operation and
 * `getComputedStyle` answers with the pre-filter value, so all four marks report exactly the
 * colours they reported before. `app/scss/_print.scss:28-35` already forces `#000` on the mark's
 * border, its text and the dot's fill, so under `emulateMedia({ media: 'print' })` hue is deleted
 * at source. Whatever still separates the four values there is structural by construction.
 *
 * **The mark is not interactive** (`EXPERIENCE.md:351`), so nothing here reads `--tap` and no
 * surface or exemption in `tests/e2e/hit-target-floor.pw.ts` moves. The A-5 half asserted here is
 * the other clause of `EXPERIENCE.md:764`: the Status never truncates.
 *
 * Separate from `tests/e2e/hit-target-floor.pw.ts` for the reason `tests/e2e/suite-directory.pw.ts`
 * gives at its `:10-15`: that file's `EXEMPTIONS` and `SURFACES` literals are parsed as text by
 * `ops/__tests__/hit-target-floor.test.ts`, and an unrelated subject inside a file another suite
 * reads structurally is a hazard rather than a saving. `playwright.config.ts:33-34` collects every
 * `.pw.ts` under `tests/e2e` by glob and `.github/workflows/ci.yml:276-277` runs the whole
 * directory, so this file needs no configuration and no CI job.
 *
 * No screenshot is taken, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true. Every defect is injected into a live page through
 * the browser, so no fixture is left in the tree, and no clean result is believed until the same
 * measurement has been seen firing on the same page.
 */

// `__dirname` rather than `import.meta`: this file is compiled as CommonJS by the Playwright
// runner and the repository declares no `"type": "module"`. Same as `hit-target-floor.pw.ts:61`.
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Both routes that render a Status mark.
 *
 * `app/page.tsx` puts the directory below the hero and `app/projects/page.tsx` renders the same
 * component outside `Container`, which is a different width budget. Measuring only the homepage
 * would leave `ops/known-violations.md`'s "not in breach" sentence route-blind on the one route
 * KV-5 already records as overflowing, and the axes are cheap enough to read on both. The axis
 * cases stay on the homepage, the stylesheet being global; the A-5 cases, which are about width,
 * run on each.
 */
const ROUTE = '/';
const ROUTES = ['/', '/projects'] as const;

/**
 * Sub-pixel slack, matching `hit-target-floor.pw.ts:252` and `suite-directory.pw.ts:57`.
 *
 * Layout produces fractional positions and a box ending a third of a pixel past an edge is a
 * rounding artifact rather than overflow.
 */
const EDGE_SLACK = 0.5;

/**
 * The four values, **read out of the published schema rather than written here**.
 *
 * `contracts/registry.schema.json` is the Registry's own definition of the taxonomy and
 * `lib/registry.ts:29` mirrors it under a test that holds the two equal. A list restated in this
 * file would go on asserting four values on the day a fifth was added, and the symptom would be a
 * green suite rather than a missing axis. The same reasoning as reading `--tap` off `:root` instead
 * of writing the floor down.
 */
const schemaStatuses = (): readonly string[] => {
  const source = readFileSync(resolve(REPO_ROOT, 'contracts/registry.schema.json'), 'utf8');
  const schema = JSON.parse(source) as Record<string, unknown>;
  const at = (node: unknown, key: string): unknown =>
    typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined;

  // The entry shape is behind a local `$ref` today and could be inlined tomorrow. Following the
  // pointer rather than naming `definitions.application` means either shape resolves, and a
  // pointer that stops resolving fails loudly here instead of yielding an empty list that every
  // case below would then loop over zero times.
  let entry = at(at(at(schema, 'properties'), 'applications'), 'items');
  const ref = at(entry, '$ref');
  if (typeof ref === 'string') {
    if (!ref.startsWith('#/')) {
      throw new Error(`contracts/registry.schema.json: applications.items points at "${ref}", which is not a local ref`);
    }
    entry = ref
      .slice(2)
      .split('/')
      .reduce<unknown>((node, segment) => at(node, segment.replace(/~1/g, '/').replace(/~0/g, '~')), schema);
  }

  const values = at(at(at(entry, 'properties'), 'status'), 'enum');

  if (!Array.isArray(values) || values.length === 0 || !values.every((value) => typeof value === 'string')) {
    throw new Error(
      'contracts/registry.schema.json: the applications[].status enum could not be read, so the four ' +
        'Status values this file asserts have no source. It is read rather than written so a fifth ' +
        'value cannot go unasserted.'
    );
  }

  return values as readonly string[];
};

const STATUSES = schemaStatuses();

/**
 * The three adjacent pairs the taxonomy's three axes separate, in the order `DESIGN.md:305-307`
 * names them.
 *
 * **This is the one list that is written down rather than derived, and it is checked against the
 * schema below.** Adjacency is a design decision and no machine can read it out of an enum. What a
 * machine can check is that the decision still covers the taxonomy: a fifth status added to
 * `contracts/registry.schema.json` would arrive in `STATUSES` and belong to no pair here, and the
 * first case in this file fails on exactly that rather than quietly asserting three axes over five
 * values.
 */
const PAIRS = [
  { axis: 'the dot', lower: 'Live', upper: 'Complete' },
  { axis: 'the dash', lower: 'Complete', upper: 'In progress' },
  { axis: 'the border', lower: 'In progress', upper: 'Archived' },
] as const;

/**
 * What each value's border must compute to.
 *
 * **One literal, declared here and parsed as text by `ops/__tests__/status-mark-axes.test.ts`**,
 * which holds `ops/status-mark-axes.md`'s per-value table equal to it. That is the shape
 * `ops/__tests__/hit-target-floor.test.ts` uses for the exemption ledger, and it exists because the
 * record is where `ops/rendered-output-harness.md` sends a reader for "the measured values": without
 * the agreement, changing the stylesheet and this file together leaves the record stating a
 * treatment nothing has any more, and every suite green.
 *
 * Written down rather than read off the page, on purpose. A value read from the page cannot
 * disagree with the page.
 */
const EXPECTED = [
  { status: 'Live', borderStyle: 'solid', borderWidth: '1px' },
  { status: 'Complete', borderStyle: 'solid', borderWidth: '1px' },
  { status: 'In progress', borderStyle: 'dashed', borderWidth: '1px' },
  { status: 'Archived', borderStyle: 'none', borderWidth: '0px' },
] as const;

/** Everything about a mark that could carry its value, structural and otherwise. */
interface Mark {
  borderStyle: string[];
  borderWidth: string[];
  borderColour: string;
  colour: string;
  opacity: string;
  whiteSpace: string;
  textOverflow: string;
  display: string;
}

/** The structural triple, which is the whole of what a reader in greyscale has left. */
const structure = (mark: Mark): string => `${mark.borderStyle.join('/')} at ${mark.borderWidth.join('/')}`;

const goTo = async (page: Page, route: string): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('.suite-directory__status').first()).toBeVisible();
};

/** Add a stylesheet to the running page, so a defect is planted without a fixture in the tree. */
const plantStyle = (page: Page, css: string): Promise<void> =>
  page.evaluate((text) => {
    const style = document.createElement('style');
    style.textContent = text;
    document.head.append(style);
  }, css);

/**
 * A duration token's value in milliseconds, resolved through a probe rather than written down.
 *
 * Same helper and same reason as `tests/e2e/suite-directory.pw.ts:173-182`: a duration that governs
 * the interface comes from the contract, and a hand-written millisecond figure drifts from
 * `--dur-major` the day it moves. `transition-duration` computes to seconds, which is what the
 * probe reads back.
 */
const durationMs = (page: Page, role: string): Promise<number> =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.transitionDuration = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).transitionDuration;
    probe.remove();
    const seconds = Number.parseFloat(resolved);
    return Number.isFinite(seconds) ? seconds * 1000 : Number.NaN;
  }, role);

/**
 * Read every value's computed mark off **one real element**, by varying `data-status` on it.
 *
 * One element rather than four, and one round trip rather than four, so nothing but the attribute
 * differs between the readings: a second element could sit in a different grid area, inherit a
 * different colour or be affected by a rule scoped to the family group, and any of those would show
 * up as an axis that is really a difference in context. The attribute is restored before returning,
 * so a later read on the same page sees the page the Registry produced.
 */
const marks = (page: Page, statuses: readonly string[]): Promise<Record<string, Mark>> =>
  page.evaluate((values) => {
    const mark = document.querySelector('.suite-directory__status');
    if (!(mark instanceof HTMLElement)) {
      throw new Error('the directory renders no .suite-directory__status, so there is nothing to read');
    }

    const original = mark.getAttribute('data-status');
    const read: Record<string, unknown> = {};

    for (const value of values) {
      mark.setAttribute('data-status', value);
      const style = getComputedStyle(mark);
      read[value] = {
        // All four sides, because `border: 0` and a border dropped on one edge are different
        // defects and a single-side read cannot tell them apart.
        borderStyle: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
        borderWidth: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        borderColour: style.borderTopColor,
        colour: style.color,
        opacity: style.opacity,
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
        display: style.display,
      };
    }

    if (original === null) mark.removeAttribute('data-status');
    else mark.setAttribute('data-status', original);

    return read as Record<string, never>;
  }, statuses);

/** Every dot the page actually paints, measured. */
const dots = (page: Page) =>
  page.evaluate(() => {
    const found: {
      width: number;
      height: number;
      background: string;
      opacity: string;
      display: string;
      radius: string;
    }[] = [];

    for (const node of document.querySelectorAll('.suite-directory__dot')) {
      if (!(node instanceof HTMLElement)) continue;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      found.push({
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
        background: style.backgroundColor,
        opacity: style.opacity,
        display: style.display,
        radius: style.borderRadius,
      });
    }

    return found;
  });

/** Every rendered mark's own box against its content, and against the viewport. */
const marksOnThePage = (page: Page, slack: number) =>
  page.evaluate((allowance) => {
    const width = window.innerWidth;

    /**
     * How many lines the **value itself** occupies.
     *
     * Measured on the text node through a `Range` rather than by dividing the element's height by
     * its line-height: the mark is padded on both axes (`SuiteDirectory.scss:179`), so that
     * arithmetic reports a comfortably single-line `Live` as two. Ranging the element's whole
     * contents is wrong for a different reason, the dot being an inline fragment of its own, so it
     * is the text node or nothing.
     */
    const lineCount = (element: HTMLElement): number => {
      const text = [...element.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''
      );
      if (!text) return 0;
      const range = document.createRange();
      range.selectNodeContents(text);
      return range.getClientRects().length;
    };

    return [...document.querySelectorAll('.suite-directory__status')].map((node) => {
      const element = node as HTMLElement;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        value: element.getAttribute('data-status') ?? '',
        text: (element.textContent ?? '').trim(),
        // Zero on a non-replaced inline element, where the clipping comparison would be `0 > 0` for
        // any amount of overflow. The caller asserts this is positive, so a mark restyled to
        // `display: inline` fails loudly rather than passing without measuring anything.
        contentBox: element.clientWidth,
        nested: element.closest('.suite-directory__family') !== null,
        clipped: element.scrollWidth > element.clientWidth + allowance,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        outside: box.right > width + allowance || box.left < -allowance,
        left: Number(box.left.toFixed(2)),
        right: Number(box.right.toFixed(2)),
        viewport: width,
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
        lines: lineCount(element),
      };
    });
  }, slack);

test.describe('the Status mark carries its value on three structural axes', () => {
  test('reads all four values the schema admits, off one real element', async ({ page }) => {
    await goTo(page, ROUTE);
    const read = await marks(page, STATUSES);

    expect(STATUSES.length, 'the schema declares no Status values, so every case below is vacuous').toBeGreaterThan(0);
    expect(Object.keys(read).sort(), 'a value the schema declares was not read').toEqual([...STATUSES].sort());

    // Adjacency is written down and cannot be derived, so it is checked for coverage instead. A
    // fifth status belonging to no pair would otherwise leave one value asserted against nothing.
    expect(
      [...new Set(PAIRS.flatMap((pair) => [pair.lower, pair.upper]))].sort(),
      'a Status value the schema declares belongs to no adjacent pair, so no axis separates it from ' +
        'anything and the three-axis claim no longer covers the taxonomy'
    ).toEqual([...STATUSES].sort());
    expect(PAIRS.length, 'the pairs no longer form one chain through every value').toBe(STATUSES.length - 1);
  });

  test('separates every adjacent pair on something that is not hue and not opacity', async ({ page }) => {
    await goTo(page, ROUTE);
    const read = await marks(page, STATUSES);

    for (const pair of PAIRS) {
      const lower = read[pair.lower];
      const upper = read[pair.upper];
      expect(lower, `${pair.lower} was not read`).toBeDefined();
      expect(upper, `${pair.upper} was not read`).toBeDefined();

      if (pair.axis === 'the dot') {
        // The one pair the border cannot separate, which is the whole of AD-19's argument. It is
        // asserted in the negative here and settled by the painted dot below.
        expect(
          structure(lower),
          `${pair.lower} and ${pair.upper} now differ in border treatment. That is not a repair: this ` +
            `file records them as identical because it is why the dot exists, and a border-only ` +
            `assertion becoming viable means the taxonomy moved without this record moving with it`
        ).toBe(structure(upper));
      } else {
        expect(
          structure(lower),
          `${pair.lower} and ${pair.upper} are identical in border treatment, so ${pair.axis} is gone ` +
            `and the two are separated by hue alone`
        ).not.toBe(structure(upper));
      }

      // Never by opacity, anywhere, on any value (`DESIGN.md:316-323`).
      expect(lower.opacity, `${pair.lower} expresses its value with opacity`).toBe('1');
      expect(upper.opacity, `${pair.upper} expresses its value with opacity`).toBe('1');
    }
  });

  test('computes the border treatment the record states, on every side of every value', async ({ page }) => {
    // The per-value agreement, driven by `EXPECTED` so `ops/status-mark-axes.md` can be held equal
    // to the same literal. All four sides, because a border dropped on one edge and a border
    // dropped entirely are different defects that a single-side read cannot tell apart.
    await goTo(page, ROUTE);
    const read = await marks(page, STATUSES);

    expect(
      EXPECTED.map((row) => row.status).sort(),
      'EXPECTED does not describe the values the schema declares'
    ).toEqual([...STATUSES].sort());

    for (const row of EXPECTED) {
      const mark = read[row.status];
      expect(mark, `${row.status} was not read`).toBeDefined();
      expect(mark.borderStyle, `${row.status} is not ${row.borderStyle} on all four sides`).toEqual(
        Array(4).fill(row.borderStyle)
      );
      expect(mark.borderWidth, `${row.status} does not measure ${row.borderWidth} on all four sides`).toEqual(
        Array(4).fill(row.borderWidth)
      );
    }
  });

  test('axis two: Complete is solid where In progress is dashed, at the same width', async ({ page }) => {
    await goTo(page, ROUTE);
    const read = await marks(page, STATUSES);

    expect(read.Complete, 'the schema no longer declares Complete, so this axis has no subject').toBeDefined();
    expect(read['In progress'], 'the schema no longer declares In progress').toBeDefined();

    expect(read.Complete.borderStyle[0], 'Complete is not solid').toBe('solid');
    expect(read['In progress'].borderStyle[0], 'In progress is not dashed').toBe('dashed');
    // Same width, so the axis really is the dash and not a thickness change wearing its name.
    expect(read['In progress'].borderWidth, 'the dash also changes the border width').toEqual(read.Complete.borderWidth);
  });

  test('axis three: In progress has a border that Archived drops entirely', async ({ page }) => {
    await goTo(page, ROUTE);
    const read = await marks(page, STATUSES);

    expect(read.Archived, 'the schema no longer declares Archived, so this axis has no subject').toBeDefined();

    for (const width of read['In progress'].borderWidth) {
      expect(Number.parseFloat(width), 'In progress carries a zero-width border on some side').toBeGreaterThan(0);
    }
    for (const width of read.Archived.borderWidth) {
      expect(Number.parseFloat(width), 'Archived still carries a border').toBe(0);
    }
    // The container goes, the value stays. `DESIGN.md:316-320` drops the border because `Archived`
    // is a record rather than something to act on, not because it should be harder to read: a mark
    // that stopped being displayed would satisfy the zero-width read above and delete the value.
    expect(read.Archived.display, 'the Archived mark is not displayed at all, so its value is gone rather than unboxed').not.toBe(
      'none'
    );
  });

  test('and the whole read follows the stylesheet, rather than answering the same thing every time', async ({
    page,
  }) => {
    // The planted control for all three cases above. Four readings that differ prove nothing unless
    // the instrument is seen changing its answer when the stylesheet changes under it.
    await goTo(page, ROUTE);
    const before = await marks(page, STATUSES);

    await plantStyle(page, ".suite-directory__status[data-status='In progress'] { border-style: solid !important; }");
    // `border-width` alone would change nothing and would read as a dead instrument: `Archived`
    // carries `border: 0`, and a computed border-width is `0px` whenever the style is `none`,
    // however wide the declaration. The style has to come back with the width.
    await plantStyle(
      page,
      ".suite-directory__status[data-status='Archived'] { border-style: solid !important; border-width: 3px !important; }"
    );
    const after = await marks(page, STATUSES);

    expect(
      after['In progress'].borderStyle,
      'the dash survived a rule that overrode it, so this file is not reading the stylesheet at all'
    ).not.toEqual(before['In progress'].borderStyle);
    expect(
      after.Archived.borderWidth,
      "Archived's zero border survived a rule that overrode it, so the width read is a constant"
    ).not.toEqual(before.Archived.borderWidth);
  });
});

test.describe('axis one, the dot, which is the axis a border cannot carry', () => {
  test('is painted at 4 by 4 with a real fill on every Live mark', async ({ page }) => {
    await goTo(page, ROUTE);
    const painted = await dots(page);

    expect(
      painted.length,
      'the directory paints no Status dot at all, so the axis that separates Live from Complete is absent'
    ).toBeGreaterThan(0);

    // **Reconciled against the marks, not merely non-zero.** Every `Live` mark carries a dot, so
    // one dot for six `Live` rows is five rows that lost the axis, and a loop over whatever dots
    // happen to exist would report that as clean.
    const liveMarks = await page.locator(".suite-directory__status[data-status='Live']").count();
    expect(liveMarks, 'no Live mark renders, so there is nothing this case could be measuring').toBeGreaterThan(0);
    expect(painted.length, `${liveMarks} Live marks render and ${painted.length} dots are painted`).toBe(liveMarks);

    for (const dot of painted) {
      // The square from `DESIGN.md:298-303`, settled at `:621-624`. It is a **literal 4px in the
      // stylesheet with no token behind it**, so it is written here as the design's own number
      // rather than read from the contract, and exact equality is right: `inline-size: 4px` at a
      // device scale factor of 1 produces exactly 4, not a fraction to be tolerated.
      expect(dot.width, 'a Status dot is not 4 wide').toBe(4);
      expect(dot.height, 'a Status dot is not 4 tall').toBe(4);
      // A square, not a pill. `SuiteDirectory.scss:206-215` settles this against the `--r-pill`
      // typo at `RESTYLE-SPEC.md:387`, and until now nothing held the ruling in place.
      expect(dot.radius, 'a Status dot is rounded, so it reads as a pill rather than the plate mark').toBe('0px');
      expect(dot.display, 'a Status dot is present in the markup and not displayed').not.toBe('none');
      expect(dot.opacity, 'a Status dot expresses itself with opacity').toBe('1');
      expect(dot.background, 'a Status dot has no fill, so nothing is painted where the axis should be').not.toBe(
        'rgba(0, 0, 0, 0)'
      );
      expect(dot.background, 'a Status dot has no fill').not.toBe('transparent');
    }
  });

  test('and the same measurement fails against an implementation with the dot removed', async ({ page }) => {
    // The demonstration AD-19 asks for by name: the dot assertion shown failing against an
    // implementation that has dropped the dot. Removed from the page rather than from the tree,
    // which is this suite's rule, and the two shapes of removal are both covered: the node deleted,
    // and the node left in place with nothing painted.
    await goTo(page, ROUTE);
    expect((await dots(page)).length, 'nothing to remove, so this control proves nothing').toBeGreaterThan(0);

    await plantStyle(page, '.suite-directory__dot { display: none !important; background: none !important; }');
    const suppressed = await dots(page);

    expect(suppressed.length, 'the dots vanished from the DOM, which is not what was planted').toBeGreaterThan(0);
    for (const dot of suppressed) {
      expect(dot.display, 'a suppressed dot still reports a display, so the display read is not live').toBe('none');
      expect(dot.width, 'a suppressed dot still measures 4 wide, so the box measurement is not live').toBe(0);
      expect(dot.background, 'a suppressed dot still reports a fill, so the fill read is not live').toBe(
        'rgba(0, 0, 0, 0)'
      );
    }

    await page.evaluate(() => {
      for (const node of document.querySelectorAll('.suite-directory__dot')) node.remove();
    });
    expect(
      (await dots(page)).length,
      'the dots survived being removed from the DOM, so the count is not read from the page'
    ).toBe(0);
  });
});

test.describe('the taxonomy in a medium with no hue, which is what O-9 asks', () => {
  test('survives print, where the mark keeps no colour of its own', async ({ page }) => {
    // The genuine greyscale render. `app/scss/_print.scss:16-35` forces the ground white, the text
    // black, and the mark's border, text and dot to `#000`, so hue is deleted at source rather
    // than filtered at paint time. A `filter: grayscale(1)` would leave every computed colour
    // exactly as it was and measure nothing.
    await goTo(page, ROUTE);
    const screen = await marks(page, STATUSES);

    await page.emulateMedia({ media: 'print' });
    const printed = await marks(page, STATUSES);

    // Colour really is gone, on every value. Without this the case below would pass in a medium
    // that never applied the print rules.
    const black = 'rgb(0, 0, 0)';
    for (const status of STATUSES) {
      expect(printed[status].borderColour, `${status} keeps a border colour of its own in print`).toBe(black);
      expect(printed[status].colour, `${status} keeps a text colour of its own in print`).toBe(black);
    }
    expect(
      new Set(STATUSES.map((status) => screen[status].borderColour)).size,
      'the four values already share one border colour on screen, so print collapsed nothing and ' +
        'this case is not measuring the thing it names'
    ).toBeGreaterThan(1);

    // And the taxonomy is still there, on structure alone.
    for (const pair of PAIRS.filter((candidate) => candidate.axis !== 'the dot')) {
      expect(
        structure(printed[pair.lower]),
        `${pair.lower} and ${pair.upper} are indistinguishable in print: ${pair.axis} does not survive ` +
          `a medium with no hue, so the taxonomy was leaning on colour`
      ).not.toBe(structure(printed[pair.upper]));
    }

    // Live and Complete, the pair with no border to separate them, separated by the dot in ink.
    expect(structure(printed.Live), 'Live and Complete parted ways in print, which no rule produces').toBe(
      structure(printed.Complete)
    );
    const inInk = await dots(page);
    expect(inInk.length, 'no dot is painted in print, so Live and Complete are one value there').toBeGreaterThan(0);
    for (const dot of inInk) {
      expect(dot.display, 'the dot is hidden in print by the decorative sweep it is exempted from').not.toBe('none');
      expect(dot.width, 'the dot has no box in print').toBe(4);
      expect(dot.background, 'the dot is not inked in print, so it prints as nothing').toBe(black);
    }
  });

  test('and hue alone could never have carried the Live and Complete distinction, measured', async ({ page }) => {
    // AD-19's argument, taken off the running page instead of quoted. `DESIGN.md:310-314` says that
    // if `Live` and `Complete` were separated only by border colour they would be too close in
    // greyscale to read, and that is the whole reason the dot exists. This measures the distance
    // and compares it against the 3:1 floor `EXPERIENCE.md:760` sets for non-text.
    //
    // **A bound, not the figure.** Pinning the measured ratio would make every token movement a
    // failure of this file, and the load-bearing claim is not "the number is 1.13" but "the number
    // is under the floor, so colour cannot be the signal". Computed colours arrive as `lab()`, so
    // the conversion to sRGB is done by painting each one and reading the pixel back rather than by
    // parsing components out of the string, which would read Lab values as if they were sRGB.
    await goTo(page, ROUTE);

    const measured = await page.evaluate(() => {
      const mark = document.querySelector('.suite-directory__status');
      if (!(mark instanceof HTMLElement)) throw new Error('the directory renders no Status mark');

      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('no 2d context, so no colour could be resolved to sRGB');

      const luminance = (colour: string): number => {
        // **`fillStyle` fails silently.** Assigning an unparseable string leaves the previous value
        // in place, and the colours here arrive as `lab()`, so a canvas that could not parse one
        // would return the last colour it did parse and the ratio below would come out at 1. The
        // sentinel is what separates "these two colours are alike" from "neither was read".
        context.fillStyle = '#010203';
        context.fillStyle = colour;
        if (context.fillStyle === '#010203') {
          throw new Error(`the canvas could not parse "${colour}", so it was never converted to sRGB`);
        }

        context.clearRect(0, 0, 1, 1);
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
        // A translucent colour composites onto the cleared canvas, which is transparent black, so
        // its luminance would silently be the luminance of itself over black rather than over the
        // ground it actually sits on.
        if (alpha !== 255) {
          throw new Error(`"${colour}" is not opaque, so its luminance here would be measured against nothing`);
        }

        const channel = (value: number): number => {
          const c = value / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const ratio = (a: string, b: string): number => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };

      const original = mark.getAttribute('data-status');
      const colours = (value: string) => {
        mark.setAttribute('data-status', value);
        const style = getComputedStyle(mark);
        return { border: style.borderTopColor, text: style.color };
      };
      const live = colours('Live');
      const complete = colours('Complete');
      if (original === null) mark.removeAttribute('data-status');
      else mark.setAttribute('data-status', original);

      const ground = getComputedStyle(document.body).backgroundColor;
      return {
        border: ratio(live.border, complete.border),
        text: ratio(live.text, complete.text),
        liveAgainstGround: ratio(live.border, ground),
        completeAgainstGround: ratio(complete.border, ground),
      };
    });

    // The conversion is working at all: each mark's own border still clears the 3:1 non-text floor
    // against the ground, which is what `DESIGN.md:300-301` records. Without this a broken colour
    // read would return 1 for everything and the two assertions below would pass vacuously.
    expect(measured.liveAgainstGround, 'the Live border no longer clears 3:1 against the ground').toBeGreaterThan(3);
    expect(measured.completeAgainstGround, 'the Complete border no longer clears 3:1 against the ground').toBeGreaterThan(
      3
    );

    expect(
      measured.border,
      `Live and Complete now sit ${measured.border.toFixed(3)}:1 apart in greyscale on their borders, ` +
        `which clears the 3:1 non-text floor. Colour would then carry the distinction on its own and ` +
        `the argument this file records for the dot no longer holds as written`
    ).toBeLessThan(3);
    expect(
      measured.text,
      `Live and Complete now sit ${measured.text.toFixed(3)}:1 apart in greyscale on their text`
    ).toBeLessThan(3);
  });

  test('and the print read is a live read, not the screen read under another name', async ({ page }) => {
    // The control. `emulateMedia` silently doing nothing would leave every assertion above passing
    // against screen values, and the mark is `#000` on neither axis there.
    await goTo(page, ROUTE);
    const screen = await marks(page, STATUSES);
    expect(
      screen.Live.borderColour,
      'the Live mark already paints its border black on screen, so print changes nothing and the ' +
        'greyscale case above cannot tell the two media apart'
    ).not.toBe('rgb(0, 0, 0)');

    await page.emulateMedia({ media: 'print' });
    expect(
      (await marks(page, STATUSES)).Live.borderColour,
      'emulateMedia changed nothing, so the print rules were never applied'
    ).not.toBe(screen.Live.borderColour);
  });
});

test.describe("A-5's other half: the Status never truncates", () => {
  /**
   * A-5's Status clause on one route.
   *
   * `EXPERIENCE.md:764` is two clauses and Story 2-8 asserted one of them. This is the other: a
   * value clipped, ellipsised or wrapped mid-word is a taxonomy the reader cannot read, and it is
   * invisible to a sweep over interactive elements because the mark is not one
   * (`EXPERIENCE.md:351`).
   *
   * **Called from one case per route rather than looped, so the titles stay literal.**
   * `ops/__tests__/status-mark-axes.test.ts` reads them out of this file as text and holds
   * `ops/status-mark-axes.md` equal to them; a title built from a template literal parses as its
   * source and never matches what the runner reports.
   */
  const expectNoTruncation = async (page: Page, route: string): Promise<void> => {
    await goTo(page, route);
    const rendered = await marksOnThePage(page, EDGE_SLACK);

    expect(rendered.length, `${route} renders no Status mark, so this case is vacuous`).toBeGreaterThan(0);

    for (const mark of rendered) {
      expect(mark.text, `a Status mark on ${route} renders no text`).not.toBe('');
      expect(
        mark.contentBox,
        `the "${mark.text}" mark on ${route} reports a content box of zero, so the clipping ` +
          `comparison below is 0 > 0 for any amount of overflow and measures nothing`
      ).toBeGreaterThan(0);
      expect(
        mark.clipped,
        `the "${mark.text}" mark on ${route} paints ${mark.scrollWidth}px of content in a ` +
          `${mark.clientWidth}px box, so its value is cut off at ${mark.viewport} wide`
      ).toBe(false);
      expect(
        mark.outside,
        `the "${mark.text}" mark on ${route} spans [${mark.left}, ${mark.right}] against a viewport ` +
          `of ${mark.viewport}`
      ).toBe(false);
      // `nowrap` is what stops a two-word value breaking across lines. `In progress` is the case:
      // wrapped, it reads as two labels rather than one value.
      expect(mark.whiteSpace, `the "${mark.text}" mark on ${route} may wrap mid-value`).toBe('nowrap');
      expect(mark.textOverflow, `the "${mark.text}" mark on ${route} ellipsises its own value`).not.toBe('ellipsis');
      expect(mark.lines, `the "${mark.text}" mark on ${route} renders on more than one line`).toBe(1);
    }
  };

  test('at 360 on the homepage, where the row has least room', async ({ page }) => {
    await expectNoTruncation(page, ROUTES[0]);
  });

  test('at 360 on /projects, which renders the same component outside Container', async ({ page }) => {
    // The second route is not a formality. `/projects` renders `<SuiteDirectory />` on a different
    // width budget, and `ops/known-violations.md` already records it as the route putting eight
    // elements past the right edge, invisible to `scrollWidth` because `ProjectsHero.scss:9` clips
    // them. An overflow claim measured only on the homepage is weakest exactly where it matters.
    await expectNoTruncation(page, ROUTES[1]);
  });

  test('and the same measurement fires against a mark clamped too narrow to hold its value', async ({ page }) => {
    // The planted control. A page whose marks all fit and a page whose measurement is broken look
    // identical from the clean read alone.
    await goTo(page, ROUTE);
    await plantStyle(page, '.suite-directory__status { max-inline-size: 12px !important; overflow: hidden !important; }');

    const clamped = await marksOnThePage(page, EDGE_SLACK);
    expect(
      clamped.filter((mark) => mark.clipped).length,
      'every mark still fits its own box after being clamped to a fraction of its width, so the ' +
        'truncation measurement is not reading the layout'
    ).toBeGreaterThan(0);
  });

  test('holds for the three values the filter never renders, in every row position', async ({ page }) => {
    // Only `Live` reaches the page, and it is the shortest of the four at four characters, so the
    // clean read above has never seen the value that would truncate first. Planting the text as
    // well as the attribute is the only way to measure the other three.
    //
    // **Into every mark, not the first one.** `groupByFamily` nests the `tracker-family` members
    // inside `.suite-directory__family`, which `SuiteDirectory.scss:312-316` insets with
    // `padding-inline: var(--s-md)` and a hairline on each side, so a nested mark has strictly less
    // room than a top-level one. `document.querySelector` returns a top-level mark, the Hub's own
    // entry being first in file order, so planting into it measures the roomiest position and calls
    // the result A-5.
    await goTo(page, ROUTE);

    const positions = await page.locator('.suite-directory__status').count();
    expect(positions, 'no marks to plant into').toBeGreaterThan(0);

    for (const status of STATUSES) {
      const planted = await page.evaluate((value) => {
        const marks = [...document.querySelectorAll('.suite-directory__status')];
        for (const mark of marks) {
          if (!(mark instanceof HTMLElement)) continue;
          mark.setAttribute('data-status', value);
          // The text node only, so the dot span beside it survives the write.
          for (const node of mark.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) node.textContent = value;
          }
        }
        return marks.length;
      }, status);

      expect(planted, `the plant reached ${planted} marks and the page has ${positions}`).toBe(positions);

      const read = await marksOnThePage(page, EDGE_SLACK);
      expect(
        read.some((mark) => mark.nested),
        'no mark sits inside the family group, so the narrower of the two row positions is unmeasured'
      ).toBe(true);

      for (const mark of read) {
        const where = mark.nested ? 'inside the family group' : 'at the top level';
        expect(mark.text, `planting ${status} did not change the text of the mark ${where}`).toContain(status);
        expect(mark.contentBox, `the ${status} mark ${where} reports a content box of zero`).toBeGreaterThan(0);
        expect(
          mark.clipped,
          `the ${status} mark ${where} paints ${mark.scrollWidth}px in a ${mark.clientWidth}px box, so it is ` +
            `cut off at ${mark.viewport} wide`
        ).toBe(false);
        expect(mark.outside, `the ${status} mark ${where} spans [${mark.left}, ${mark.right}]`).toBe(false);
        expect(mark.lines, `the ${status} mark ${where} renders on more than one line`).toBe(1);
      }
    }
  });
});

test.describe('the Status mark is not interactive', () => {
  test('carries no tooltip, no popover, no hover affordance and no place in the tab order', async ({ page }) => {
    // `EXPERIENCE.md:351-352`: no tooltip, no popover, no hover state. A person who wants to know
    // what `Complete` means reads the word. The 44px floor therefore does not apply to it, which is
    // why it is absent from `tests/e2e/hit-target-floor.pw.ts` rather than exempted in it, and this
    // is what keeps that absence honest.
    await goTo(page, ROUTE);

    const shape = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('.suite-directory__status')];
      return marks.map((node) => {
        const element = node as HTMLElement;
        return {
          tag: element.tagName.toLowerCase(),
          title: element.getAttribute('title'),
          describedBy: element.getAttribute('aria-describedby'),
          popover: element.getAttribute('popovertarget') ?? element.getAttribute('popover'),
          role: element.getAttribute('role'),
          tabIndex: element.getAttribute('tabindex'),
          interactive: element.closest('a, button, [role="button"], [role="link"]') !== null,
          cursor: getComputedStyle(element).cursor,
        };
      });
    });

    expect(shape.length, 'no Status mark was found, so this case is vacuous').toBeGreaterThan(0);
    for (const mark of shape) {
      expect(mark.title, 'a Status mark carries a title, which is a tooltip').toBeNull();
      expect(mark.describedBy, 'a Status mark points at a description, which is a tooltip by another name').toBeNull();
      expect(mark.popover, 'a Status mark carries a popover').toBeNull();
      expect(mark.role, 'a Status mark claims a role, so it announces as something actionable').toBeNull();
      expect(mark.tabIndex, 'a Status mark declares a tabindex, so it is in or deliberately out of the tab order').toBeNull();
      expect(mark.interactive, 'a Status mark sits inside a link or a button, so it is clickable after all').toBe(false);
      // `pointer` specifically, not `auto`. The claim is that the mark promises no interaction, and
      // `default` makes that promise just as well; pinning `auto` would fail a correct
      // implementation for a cosmetic reason and say the mark had become clickable.
      expect(
        mark.cursor,
        'a Status mark paints a pointer cursor, which promises an interaction it has not got'
      ).not.toBe('pointer');
    }
  });

  test('and changes nothing at all when the pointer rests on it', async ({ page }) => {
    await goTo(page, ROUTE);

    const read = () =>
      page.locator('.suite-directory__status').first().evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const round = (value: number): number => Number(value.toFixed(2));
        return {
          borderColour: style.borderTopColor,
          borderStyle: style.borderTopStyle,
          borderWidth: style.borderTopWidth,
          colour: style.color,
          background: style.backgroundColor,
          opacity: style.opacity,
          transform: style.transform,
          boxShadow: style.boxShadow,
          textDecorationLine: style.textDecorationLine,
          width: round(box.width),
          height: round(box.height),
          documentTop: round(box.top + window.scrollY),
          documentLeft: round(box.left + window.scrollX),
        };
      });

    // The settle, read from the contract rather than written here, the same way
    // `suite-directory.pw.ts:507` reads it. A hard-coded wait is a wait that drifts from
    // `--dur-major` the day the token moves, and a transition landing after the read would make
    // this case pass on the values it took before hovering.
    const settle = await durationMs(page, '--dur-major');
    expect(settle, '--dur-major does not resolve to a duration, so the wait below is unanchored').toBeGreaterThan(0);

    const mark = page.locator('.suite-directory__status').first();
    await page.mouse.move(0, 0);
    await mark.scrollIntoViewIfNeeded();
    const before = await read();

    await mark.hover();
    await page.waitForTimeout(Math.max(settle * 4, 400));
    const after = await read();

    expect(after, 'the Status mark changes under the pointer, so it has a hover state it is forbidden to have').toEqual(
      before
    );
  });

  test('and that comparison fires, measured against a hover state planted on the mark', async ({ page }) => {
    // The control the two cases above were missing. Reading a mark that never changes and reading
    // one whose comparison is broken look identical, and this is what separates them: a real
    // `:hover` rule of exactly the kind `EXPERIENCE.md:351` forbids, planted, and both instruments
    // seen reacting to it.
    await goTo(page, ROUTE);
    await plantStyle(
      page,
      '.suite-directory__status:hover { background: rgb(255, 0, 0) !important; cursor: pointer !important; }'
    );

    const mark = page.locator('.suite-directory__status').first();
    await page.mouse.move(0, 0);
    await mark.scrollIntoViewIfNeeded();
    const before = await mark.evaluate((element) => getComputedStyle(element).backgroundColor);

    await mark.hover();
    await page.waitForTimeout(400);
    const after = await mark.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      cursor: getComputedStyle(element).cursor,
    }));

    expect(
      after.background,
      'a planted :hover rule changed nothing, so the hover comparison is not reading the page'
    ).not.toBe(before);
    expect(after.cursor, 'a planted pointer cursor was not read, so the cursor assertion is not live').toBe('pointer');
  });
});
