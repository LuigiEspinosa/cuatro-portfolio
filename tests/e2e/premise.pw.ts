import { test, expect, type Browser, type Page } from '@playwright/test';
import { RENDERED_VIEWPORT } from './harness';

/**
 * The premise block, the framework band, the plate mark and the footer line, as they render
 * (Story 2-11).
 *
 * Every row here is one jsdom cannot reach, because jsdom applies no stylesheets. Which strings are
 * drawn and where they come from is
 * `components/organisms/Premise/__tests__/Premise.test.tsx` and its two neighbours; what is settled
 * here is what the browser resolves: the band's alternation and its width axis, the mark's tracking
 * against the token rather than against a figure, `tabular-nums` on both count-bearing elements, the
 * hairlines running the content width, and no horizontal overflow at 360.
 *
 * **Nothing expected is written down.** Every colour, every tracking value and every stroke width is
 * put through a probe element that reads the contract on the running page, for the reason
 * `tests/e2e/suite-directory.pw.ts:184-193` gives: a hand-written literal here drifts from the token
 * it claims to enforce, and a value read from the page cannot disagree with the page. The one
 * literal in this file is `0.16em`, and it appears only inside a planted control, because the whole
 * point of that control is to show the instrument telling the two figures apart.
 *
 * **Every clean result is read only after the same measurement has been seen firing on the same
 * page.** Defects are injected into the live page through the browser, so no fixture is left in the
 * tree, which is the rule `tests/e2e/status-mark.pw.ts` and `tests/e2e/suite-directory.pw.ts` set.
 *
 * **No screenshot is taken**, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true. `playwright.config.ts:33-34` collects every `.pw.ts`
 * under `tests/e2e` by glob and `.github/workflows/ci.yml` runs the whole directory, so this file
 * needs no configuration and no CI job of its own.
 *
 * Separate from `tests/e2e/hit-target-floor.pw.ts` for the reason `tests/e2e/suite-directory.pw.ts`
 * gives at its `:10-15`: that file's `EXEMPTIONS` and `SURFACES` literals are parsed as text by
 * `ops/__tests__/hit-target-floor.test.ts`, and an unrelated subject inside a file another suite
 * reads structurally is a hazard rather than a saving. Story 2-11 added nothing interactive, so that
 * file's count for `/` did not move with it. **Story 2-17 later gave the footer one link**, to
 * `/celeste`, which moved that count by one; the sweep at the end of this file narrowed to the
 * premise block on the same day, and the footer's link has its own reading in
 * `tests/e2e/secondary-surfaces.pw.ts`.
 */

/** The homepage, the one route that renders the premise block and the footer. */
const ROUTE = '/';

/**
 * Sub-pixel slack, matching `hit-target-floor.pw.ts:252`, `suite-directory.pw.ts:57` and
 * `status-mark.pw.ts:80`. Layout produces fractional positions and a box ending a third of a pixel
 * past an edge is a rounding artifact rather than overflow. DW-22 records that these four copies
 * belong in `tests/e2e/harness.ts` and that lifting them is a story of its own.
 */
const EDGE_SLACK = 0.5;

/** A token with no line-breaking opportunity anywhere in it, for the wrapping control. */
const UNBREAKABLE = `Aaa${'z'.repeat(120)}Zzz`;

/**
 * A width past the one this project pins, for the two claims 360 cannot settle.
 *
 * The measure cap is the case: `--measure` resolves wider than the content width at 360, so nothing
 * there can tell a capped paragraph from an uncapped one. Same idiom and same reason as
 * `tests/e2e/anchor-aliases.pw.ts:133` and `tests/e2e/suite-directory.pw.ts:48`.
 */
const WIDE_VIEWPORT = { width: 1024, height: 800 } as const;

const goTo = async (page: Page, route: string): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await expect(page.locator('.premise__band')).toBeVisible();

  // **The vacuity guard, and it is not a formality.** `hubEntry` answers `undefined` when the
  // Registry serves the declared origin from no entry or from more than one, and `Premise` then
  // draws no mark at all. Without this the four plate-mark cases below fail as sixty-second locator
  // timeouts naming nothing, which reads as a hung browser rather than as a Registry that stopped
  // identifying the Hub.
  await expect(
    page.locator('.plate-mark'),
    'the home route draws no plate mark, so hubEntry answered undefined: the Registry serves the ' +
      'declared origin from no entry, or from more than one'
  ).toBeVisible();
};

/**
 * Run `read` against the home route in a second context wider than the pinned viewport.
 *
 * Same shape as `tests/e2e/suite-directory.pw.ts:236-253`, including the reduced-motion and scale
 * options the project sets, so the second context differs from the first in width and in nothing
 * else.
 */
const atAWiderWidth = async <T>(browser: Browser, read: (page: Page) => Promise<T>): Promise<T> => {
  const context = await browser.newContext({
    viewport: { ...WIDE_VIEWPORT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    expect(
      page.viewportSize()?.width ?? 0,
      'the second context is no wider than the pinned one, so the measure cap is as unmeasurable ' +
        'there as it is here'
    ).toBeGreaterThan(RENDERED_VIEWPORT.width);
    return await read(page);
  } finally {
    await context.close();
  }
};

/** Add a stylesheet to the running page, so a defect is planted without a fixture in the tree. */
const plantStyle = (page: Page, css: string): Promise<void> =>
  page.evaluate((text) => {
    const style = document.createElement('style');
    style.textContent = text;
    document.head.append(style);
  }, css);

/**
 * The pinned viewport, asserted rather than assumed from the config.
 *
 * Three cases here name 360 in their titles and in their failure messages, and none of them read
 * the width they were run at. Same guard and same reason as `hit-target-floor.pw.ts:905-912` and
 * `anchor-aliases.pw.ts:978-979`: the baseline of an overflow claim is the width it was measured at.
 */
const expectPinnedViewport = async (page: Page): Promise<void> => {
  expect(page.viewportSize(), 'this case names 360 and was not run at the pinned viewport').toEqual({
    ...RENDERED_VIEWPORT,
  });
  expect(
    await page.evaluate(() => window.innerWidth),
    'the page reports a viewport width the config did not set'
  ).toBe(RENDERED_VIEWPORT.width);
};

/** A contract role's resolved colour, read through a probe rather than written down. */
const roleColour = (page: Page, role: string): Promise<string> =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, role);

/**
 * A tracking token's resolved length in px, at a given font size token.
 *
 * Tracking is authored in `em`, so it resolves against the element's own font size and a probe that
 * did not carry the same size would answer a different number for the same token. The probe takes
 * both, which is what makes the comparison against the plate mark a comparison of tokens rather than
 * of coincidences.
 */
const trackingPx = (page: Page, tracking: string, size: string): Promise<string> =>
  page.evaluate(([trackingName, sizeName]) => {
    const probe = document.createElement('span');
    probe.style.fontSize = `var(${sizeName})`;
    probe.style.letterSpacing = `var(${trackingName})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).letterSpacing;
    probe.remove();
    return resolved;
  }, [tracking, size]);

/** A family token's resolved stack, through a probe, so a family is compared and not a substring. */
const roleFamily = (page: Page, role: string): Promise<string> =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.fontFamily = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).fontFamily;
    probe.remove();
    return resolved;
  }, role);

/**
 * What a size, a weight and a leading token resolve to together, through one probe.
 *
 * Together rather than one at a time, because a unitless line-height resolves against the element's
 * own font size: read on a probe carrying a different size it would answer a different number for
 * the same token, and the comparison would be against a coincidence.
 */
const typeScale = (page: Page, tokens: { size: string; weight: string; leading: string }) =>
  page.evaluate((names) => {
    const probe = document.createElement('span');
    probe.style.fontSize = `var(${names.size})`;
    probe.style.fontWeight = `var(${names.weight})`;
    probe.style.lineHeight = `var(${names.leading})`;
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const read = { fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
    probe.remove();
    return read;
  }, tokens);

/** Everything about the premise paragraph that the lede role decides. */
const ledeType = (page: Page) =>
  page.locator('.premise__lede').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      maxInlineSize: style.maxInlineSize,
      fontFamily: style.fontFamily,
      colour: style.color,
    };
  });

/** A length token's resolved value, through a probe, for the stroke widths. */
const lengthPx = (page: Page, role: string): Promise<string> =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.borderTopStyle = 'solid';
    probe.style.borderTopWidth = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).borderTopWidth;
    probe.remove();
    return resolved;
  }, role);

/** Every element on the page whose box sits outside the viewport on either side. */
const outsideViewport = (page: Page): Promise<string[]> =>
  page.evaluate((slack) => {
    const width = window.innerWidth;
    const found: string[] = [];

    for (const node of document.querySelectorAll('*')) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (box.right > width + slack || box.left < -slack) {
        const name = typeof node.className === 'string' ? node.className.split(' ')[0] : '';
        found.push(
          `${node.tagName.toLowerCase()}${name ? `.${name}` : ''} spans [${box.left.toFixed(2)}, ${box.right.toFixed(
            2
          )}] against a viewport of ${width}`
        );
      }
    }

    return found;
  }, EDGE_SLACK);

/**
 * Every element in the two new blocks painting content wider than its own box.
 *
 * The half a rect comparison cannot see. A band that scrolled rather than wrapped would keep its own
 * box at the container width and paint its names straight past it, and the element sweep above would
 * call that clean.
 */
const contentOutsideItsBox = (page: Page): Promise<string[]> =>
  page.evaluate((slack) => {
    const found: string[] = [];

    for (const node of document.querySelectorAll('.premise, .premise *, .site-footer, .site-footer *')) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.scrollWidth > node.clientWidth + slack) {
        const name = node.className.split(' ')[0];
        found.push(
          `${node.tagName.toLowerCase()}${name ? `.${name}` : ''} paints ${node.scrollWidth}px of content in a ` +
            `${node.clientWidth}px box`
        );
      }
    }

    return found;
  }, EDGE_SLACK);

/** The computed values a band name carries, per position, in DOM order. */
const bandNames = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.premise__framework')].map((node) => {
      const element = node as HTMLElement;
      const style = getComputedStyle(element);
      return {
        text: (element.textContent ?? '').trim(),
        colour: style.color,
        fontStretch: style.fontStretch,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        textTransform: style.textTransform,
      };
    })
  );

/** One element's box against its container's content box, so a rule can be held to the content width. */
const ruleGeometry = (page: Page, selector: string, containerSelector: string) =>
  page.evaluate(([target, container]) => {
    const element = document.querySelector(target);
    const parent = document.querySelector(container);
    if (!(element instanceof HTMLElement)) throw new Error(`nothing matches ${target}`);
    if (!(parent instanceof HTMLElement)) throw new Error(`nothing matches ${container}`);

    const style = getComputedStyle(parent);
    const box = element.getBoundingClientRect();
    const outer = parent.getBoundingClientRect();
    const padStart = Number.parseFloat(style.paddingInlineStart);
    const padEnd = Number.parseFloat(style.paddingInlineEnd);

    return {
      width: Number(box.width.toFixed(2)),
      contentWidth: Number((outer.width - padStart - padEnd).toFixed(2)),
      padStart: Number(padStart.toFixed(2)),
      viewport: window.innerWidth,
    };
  }, [selector, containerSelector]);

test.describe('the premise takes the lede role, which is three tokens and a cap', () => {
  test('resolves its size, its weight and its leading to the tokens the lede is assigned', async ({ page }) => {
    // `DESIGN.md:471` gives the lede `--t-base`, `:483` puts it at 300 against display 800, and
    // `:485-486` sets its leading. None of the three is visible to jsdom, and until this case
    // existed all three could be changed with the whole suite green: a reviewer swapped the weight
    // to `--w-bold` and the leading to `--lh-label` and nothing anywhere noticed.
    await goTo(page, ROUTE);

    const expected = await typeScale(page, { size: '--t-base', weight: '--w-light', leading: '--lh-lede' });
    expect(expected.fontWeight, '--w-light did not resolve to a weight, so the comparison is unanchored').not.toBe('');
    expect(expected.lineHeight, '--lh-lede did not resolve to a length').not.toBe('normal');

    const lede = await ledeType(page);

    expect(lede.fontSize, 'the premise is not set at the lede step on the type scale').toBe(expected.fontSize);
    expect(lede.fontWeight, 'the premise is not set at the lede weight').toBe(expected.fontWeight);
    expect(lede.lineHeight, 'the premise is not set at the lede leading').toBe(expected.lineHeight);
    // Compared against the resolved stack rather than by substring: the mono stack also contains the
    // body family's name, so a `toContain` here would pass on the wrong family.
    expect(lede.fontFamily, 'the premise is not set in the body family').toBe(await roleFamily(page, '--f-body'));
    expect(lede.colour, 'the premise is not secondary text').toBe(await roleColour(page, '--token-text-secondary'));

    // **The cap resolves to a length, which is all this width can say about it.** `--measure`
    // resolves wider than the content width at 360, so nothing here can tell a capped paragraph
    // from an uncapped one. Whether it binds is settled in a second context below.
    expect(lede.maxInlineSize, 'the premise carries no measure cap at all').not.toBe('none');
    expect(
      Number.parseFloat(lede.maxInlineSize),
      `the premise measure cap resolved to "${lede.maxInlineSize}", which is not a length`
    ).toBeGreaterThan(0);
  });

  test('and all four reads are live, each measured against the premise restyled under it', async ({ page }) => {
    // The planted control, field by field rather than in one plant, so each read is attributable.
    // The plants accumulate, so every step compares against the reading before it and changes one
    // property. These are the exact mutations that survived the suite before this block existed.
    await goTo(page, ROUTE);
    const clean = await ledeType(page);

    await plantStyle(page, '.premise__lede { font-weight: var(--w-bold) !important; }');
    const heavier = await ledeType(page);
    expect(heavier.fontWeight, 'the weight survived being overridden, so the weight read is a constant').not.toBe(
      clean.fontWeight
    );

    await plantStyle(page, '.premise__lede { line-height: var(--lh-label) !important; }');
    const tighter = await ledeType(page);
    expect(tighter.lineHeight, 'the leading survived being overridden, so the leading read is a constant').not.toBe(
      heavier.lineHeight
    );

    await plantStyle(page, '.premise__lede { max-inline-size: none !important; }');
    const uncapped = await ledeType(page);
    expect(uncapped.maxInlineSize, 'the cap survived being removed, so the measure read is a constant').not.toBe(
      tighter.maxInlineSize
    );

    await plantStyle(page, '.premise__lede { font-size: var(--t-sm) !important; }');
    const smaller = await ledeType(page);
    expect(smaller.fontSize, 'the size survived being overridden, so the size read is a constant').not.toBe(
      uncapped.fontSize
    );
  });

  test('and the measure really caps the line, at a width where it can', async ({ browser }) => {
    // The claim `DESIGN.md:489` makes, measured where it is measurable. At the pinned 360 the block
    // has 320px of content and the cap resolves wider than that, so the cap and its absence produce
    // the same layout there. A second context is the only way to reach it, which is the idiom
    // `anchor-aliases.pw.ts:133` and `suite-directory.pw.ts:236-253` already set.
    const measured = await atAWiderWidth(browser, async (wide) => {
      await goTo(wide, ROUTE);

      const read = () =>
        wide.evaluate(() => {
          const lede = document.querySelector('.premise__lede');
          const block = document.querySelector('.premise');
          if (!(lede instanceof HTMLElement) || !(block instanceof HTMLElement)) return null;
          const blockStyle = getComputedStyle(block);
          const outer = block.getBoundingClientRect();
          return {
            width: Number(lede.getBoundingClientRect().width.toFixed(2)),
            cap: Number.parseFloat(getComputedStyle(lede).maxInlineSize),
            contentWidth: Number(
              (
                outer.width -
                Number.parseFloat(blockStyle.paddingInlineStart) -
                Number.parseFloat(blockStyle.paddingInlineEnd)
              ).toFixed(2)
            ),
          };
        });

      const capped = await read();
      // The control, in the same context and on the same page: the cap removed, the line spreads.
      await plantStyle(wide, '.premise__lede { max-inline-size: none !important; }');
      return { capped, uncapped: await read() };
    });

    expect(measured.capped, 'the wider context renders no premise').not.toBeNull();
    expect(measured.uncapped, 'the wider context lost the premise after the plant').not.toBeNull();

    const capped = measured.capped as NonNullable<typeof measured.capped>;
    const uncapped = measured.uncapped as NonNullable<typeof measured.uncapped>;

    expect(
      capped.contentWidth,
      'the block is no wider than the cap even here, so the cap still cannot bind and this case ' +
        'measures nothing'
    ).toBeGreaterThan(capped.cap);
    expect(
      Math.abs(capped.width - capped.cap),
      `the premise runs ${capped.width}px wide against a ${capped.cap}px cap in a ${capped.contentWidth}px ` +
        `container, so the measure is not holding it`
    ).toBeLessThan(EDGE_SLACK);
    expect(
      uncapped.width,
      'removing the cap changed nothing, so the width above was decided by the container rather than ' +
        'by the measure'
    ).toBeGreaterThan(capped.width);
  });
});

test.describe('the framework band alternates two roles, which is its whole rhythm', () => {
  test('paints odd positions secondary and even positions the muted accent', async ({ page }) => {
    await goTo(page, ROUTE);

    const secondary = await roleColour(page, '--token-text-secondary');
    const muted = await roleColour(page, '--token-accent-muted');
    expect(
      secondary,
      '--token-text-secondary and --token-accent-muted resolve alike, so an alternation would be ' +
        'unreadable and this case could not tell one from the other'
    ).not.toBe(muted);

    const names = await bandNames(page);
    expect(names.length, 'the band draws nothing, so this case is vacuous').toBeGreaterThan(1);

    for (const [at, name] of names.entries()) {
      const expected = at % 2 === 0 ? secondary : muted;
      const role = at % 2 === 0 ? '--token-text-secondary' : '--token-accent-muted';
      expect(name.colour, `"${name.text}" sits at position ${at + 1} and does not paint ${role}`).toBe(expected);
    }

    // The stronger claim, which a per-position loop alone would satisfy on a band painted one
    // colour if the roles ever collapsed: two distinct colours really are on the page.
    expect(new Set(names.map((name) => name.colour)).size, 'the band paints one colour, so the alternation is gone').toBe(
      2
    );
  });

  test('and that read follows the stylesheet rather than answering the same thing every time', async ({ page }) => {
    // The planted control. A band read as alternating proves nothing unless the instrument is seen
    // reporting something else when the stylesheet changes under it.
    await goTo(page, ROUTE);
    const before = await bandNames(page);
    expect(new Set(before.map((name) => name.colour)).size).toBe(2);

    await plantStyle(page, '.premise__framework { color: var(--token-text-secondary) !important; }');
    const after = await bandNames(page);

    expect(
      new Set(after.map((name) => name.colour)).size,
      'the alternation survived a rule that overrode every name to one colour, so the colour read is ' +
        'not reading the page'
    ).toBe(1);
  });
});

test.describe('the band is display type at the narrow end of its width axis', () => {
  test('renders bold uppercase at the smallest step, with the width axis selected', async ({ page }) => {
    await goTo(page, ROUTE);

    const scale = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.fontSize = 'var(--t-3xs)';
      probe.style.fontWeight = 'var(--w-bold)';
      document.body.append(probe);
      const style = getComputedStyle(probe);
      const read = { size: style.fontSize, weight: style.fontWeight };
      probe.remove();
      return read;
    });

    const names = await bandNames(page);
    expect(names.length, 'the band draws nothing').toBeGreaterThan(0);

    for (const name of names) {
      // `font-stretch`, not `font-variation-settings`: the property is what selects the axis
      // through font matching, and the published face declares a live range, so this is a
      // selection rather than a synthesis.
      expect(name.fontStretch, `"${name.text}" is not set at the narrow end of the width axis`).toBe('75%');
      expect(name.fontWeight, `"${name.text}" does not take the bold weight the contract declares`).toBe(scale.weight);
      expect(name.fontSize, `"${name.text}" is not at the smallest step on the type scale`).toBe(scale.size);
      expect(name.textTransform, `"${name.text}" is not uppercase`).toBe('uppercase');
      expect(name.fontFamily, `"${name.text}" is not set in the display family`).toContain('Bricolage');
    }
  });

  test('and the width read is live, measured against a band widened back to the default', async ({ page }) => {
    // The control. `font-stretch` reporting `75%` twice proves nothing unless it is seen reporting
    // something else on the same element.
    await goTo(page, ROUTE);
    expect((await bandNames(page))[0].fontStretch).toBe('75%');

    await plantStyle(page, '.premise__band { font-stretch: 100% !important; }');
    expect(
      (await bandNames(page))[0].fontStretch,
      'the width axis survived a rule that overrode it, so the read is a constant'
    ).toBe('100%');
  });
});

test.describe('the band is bounded above and below by hairlines', () => {
  test('draws both rules in the border role, each running the content width and not the viewport', async ({
    page,
  }) => {
    // `DESIGN.md:682-684` bounds the band above **and** below. One rule is a section divider and
    // two are a band, so the pair is the treatment rather than a doubled separator, and each has to
    // run the content width of the block (`RESTYLE-SPEC.md:312-313`) or it stops aligning with the
    // rules above and below it down the page.
    await goTo(page, ROUTE);

    const stroke = await lengthPx(page, '--stroke-hair');
    const border = await roleColour(page, '--token-border');

    const rules = await page.locator('.premise__band').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        topWidth: style.borderTopWidth,
        topStyle: style.borderTopStyle,
        topColour: style.borderTopColor,
        bottomWidth: style.borderBottomWidth,
        bottomStyle: style.borderBottomStyle,
        bottomColour: style.borderBottomColor,
      };
    });

    expect(rules.topStyle, 'the band carries no rule above it').toBe('solid');
    expect(rules.bottomStyle, 'the band carries no rule below it').toBe('solid');
    expect(rules.topWidth, 'the rule above the band is not a hairline').toBe(stroke);
    expect(rules.bottomWidth, 'the rule below the band is not a hairline').toBe(stroke);
    expect(rules.topColour, 'the rule above the band is not the border role').toBe(border);
    expect(rules.bottomColour, 'the rule below the band is not the border role').toBe(border);

    const geometry = await ruleGeometry(page, '.premise__band', '.premise');
    expect(geometry.padStart, 'the block is not padded, so the content width and the viewport agree').toBeGreaterThan(0);
    expect(
      Math.abs(geometry.width - geometry.contentWidth),
      'the band rules do not run the content width'
    ).toBeLessThan(EDGE_SLACK);
    expect(geometry.width, 'the band rules run the full viewport width').toBeLessThan(geometry.viewport);
  });

  test('and the stroke read is live, measured against a band whose rules are widened', async ({ page }) => {
    // The control. A hairline read twice proves nothing unless the instrument is seen reporting a
    // different width on the same element.
    await goTo(page, ROUTE);
    const stroke = await lengthPx(page, '--stroke-hair');

    await plantStyle(page, '.premise__band { border-block-start-width: 7px !important; }');
    const planted = await page.locator('.premise__band').evaluate((element) => getComputedStyle(element).borderTopWidth);

    expect(planted, 'the rule above the band survived being widened, so the stroke read is a constant').not.toBe(
      stroke
    );
  });
});

test.describe('the plate mark is tracked by the token and not by a figure', () => {
  test('resolves its tracking to the contract label value at its own size', async ({ page }) => {
    // `epics.md:2508` states this tracking one step wider than `DESIGN.md:686` does, and the
    // reference mockup follows `epics.md` while its own nav and count rows follow `DESIGN.md`.
    // DESIGN.md wins any value, so the mark names the token and this case reads the token off the
    // running page rather than restating either figure.
    await goTo(page, ROUTE);

    const expected = await trackingPx(page, '--tr-label', '--t-3xs');
    const measured = await page.locator('.plate-mark').evaluate((element) => ({
      letterSpacing: getComputedStyle(element).letterSpacing,
      fontFamily: getComputedStyle(element).fontFamily,
      fontSize: getComputedStyle(element).fontSize,
      textTransform: getComputedStyle(element).textTransform,
      colour: getComputedStyle(element).color,
    }));

    expect(expected, '--tr-label did not resolve to a length, so the comparison below is unanchored').not.toBe(
      'normal'
    );
    expect(measured.letterSpacing, 'the plate mark is not tracked at --tr-label').toBe(expected);
    expect(measured.fontFamily, 'the plate mark is not set in the mono family').toContain('Geist Mono');
    expect(measured.textTransform, 'the plate mark is not uppercase').toBe('uppercase');
    expect(measured.colour, 'the plate mark is not secondary text').toBe(await roleColour(page, '--token-text-secondary'));
  });

  test('and the tracking read separates the two figures the plan disagrees on', async ({ page }) => {
    // The control, and the reason it is worth having: the drift is one step on the same axis, so a
    // dead instrument would report agreement with either. The wider figure is planted here and
    // nowhere else in this story.
    await goTo(page, ROUTE);
    const expected = await trackingPx(page, '--tr-label', '--t-3xs');

    await plantStyle(page, '.plate-mark { letter-spacing: 0.16em !important; }');
    const planted = await page.locator('.plate-mark').evaluate((element) => getComputedStyle(element).letterSpacing);

    expect(
      planted,
      'the plate mark still reports the token value after being tracked one step wider, so this file ' +
        'cannot tell the two figures apart and its agreement above means nothing'
    ).not.toBe(expected);
  });

  test('sits on a hairline in the border role, running the content width and not the viewport', async ({ page }) => {
    await goTo(page, ROUTE);

    const stroke = await lengthPx(page, '--stroke-hair');
    const border = await roleColour(page, '--token-border');
    const drawn = await page.locator('.plate-mark').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: style.borderBottomWidth,
        style: style.borderBottomStyle,
        colour: style.borderBottomColor,
      };
    });

    expect(drawn.style, 'the mark sits on no rule at all').toBe('solid');
    expect(drawn.width, 'the mark sits on something other than a hairline').toBe(stroke);
    expect(drawn.colour, 'the rule beneath the mark is not the border role').toBe(border);

    const geometry = await ruleGeometry(page, '.plate-mark', '.premise');
    expect(geometry.padStart, 'the block is not padded, so the content width and the viewport are the same').toBeGreaterThan(
      0
    );
    expect(Math.abs(geometry.width - geometry.contentWidth), 'the rule does not run the content width').toBeLessThan(
      EDGE_SLACK
    );
    expect(geometry.width, 'the rule runs the full viewport width').toBeLessThan(geometry.viewport);
  });
});

test.describe('every count-bearing element carries tabular numerals', () => {
  test('computes tabular-nums on the plate mark and on the footer line', async ({ page }) => {
    // `DESIGN.md:490` binds this to every count, plate mark and metric. Neither line carries a digit
    // today, both figures being spelled, and the rule is set on the element so the day one arrives
    // it does not shift the characters beside it.
    await goTo(page, ROUTE);

    for (const selector of ['.plate-mark', '.site-footer__line']) {
      const value = await page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).fontVariantNumeric);
      expect(value, `${selector} does not carry tabular numerals`).toContain('tabular-nums');
    }
  });

  test('and the read is live, measured against the same elements set back to normal', async ({ page }) => {
    await goTo(page, ROUTE);
    await plantStyle(page, '.plate-mark, .site-footer__line { font-variant-numeric: normal !important; }');

    for (const selector of ['.plate-mark', '.site-footer__line']) {
      const value = await page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).fontVariantNumeric);
      expect(value, `${selector} still reports tabular numerals after being overridden`).not.toContain('tabular-nums');
    }
  });
});

test.describe('the footer line is fine print below a rule at the content width', () => {
  test('renders in mono at the smallest step in secondary text, over a hairline', async ({ page }) => {
    await goTo(page, ROUTE);

    const stroke = await lengthPx(page, '--stroke-hair');
    const border = await roleColour(page, '--token-border');
    const secondary = await roleColour(page, '--token-text-secondary');

    const drawn = await page.locator('.site-footer__line').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        colour: style.color,
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        borderColour: style.borderTopColor,
        text: (element.textContent ?? '').trim(),
      };
    });

    expect(drawn.text, 'the footer renders no line').not.toBe('');
    expect(drawn.fontFamily, 'the footer line is not set in the mono family').toContain('Geist Mono');
    expect(drawn.colour, 'the footer line is not secondary text').toBe(secondary);
    expect(drawn.borderStyle, 'the footer line sits on no rule').toBe('solid');
    expect(drawn.borderWidth, 'the rule above the footer line is not a hairline').toBe(stroke);
    expect(drawn.borderColour, 'the rule above the footer line is not the border role').toBe(border);

    const geometry = await ruleGeometry(page, '.site-footer__line', '.site-footer');
    expect(geometry.padStart, 'the footer is not padded, so this case measures nothing').toBeGreaterThan(0);
    expect(
      Math.abs(geometry.width - geometry.contentWidth),
      'the rule above the footer line does not run the content width'
    ).toBeLessThan(EDGE_SLACK);
    expect(geometry.width, 'the rule runs the full viewport width').toBeLessThan(geometry.viewport);
  });

  test('follows the Directory in the document and sits outside main', async ({ page }) => {
    // FR-1: nothing follows the Directory except footer content. This is the placement half of it,
    // and it is what Stories 2-12 and 2-17 both assume exists.
    await goTo(page, ROUTE);

    const placed = await page.evaluate(() => {
      const directory = document.querySelector('.suite-directory');
      const footer = document.querySelector('.site-footer');
      const premise = document.querySelector('.premise');
      if (!directory || !footer || !premise) return null;
      return {
        premiseBeforeDirectory: (premise.compareDocumentPosition(directory) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        directoryBeforeFooter: (directory.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        footerInsideMain: footer.closest('main') !== null,
        premiseInsideMain: premise.closest('main') !== null,
      };
    });

    expect(placed, 'the home route is missing the premise, the directory or the footer').not.toBeNull();
    expect(placed?.premiseBeforeDirectory, 'the premise does not precede the Directory in the document').toBe(true);
    expect(placed?.directoryBeforeFooter, 'the footer does not follow the Directory').toBe(true);
    expect(placed?.premiseInsideMain, 'the premise sits outside the main content').toBe(true);
    expect(placed?.footerInsideMain, 'the footer sits inside main, which is not footer content').toBe(false);
  });
});

test.describe('the block holds at 360, where the viewport has least room', () => {
  test('puts nothing outside the viewport and paints nothing outside its own box', async ({ page }) => {
    await goTo(page, ROUTE);
    await expectPinnedViewport(page);

    expect(
      await outsideViewport(page),
      'the home route puts an element outside the viewport at 360, which is A-5 outright'
    ).toEqual([]);
    expect(
      await contentOutsideItsBox(page),
      'the premise block or the footer paints outside its own box at 360. The element rect does not ' +
        'grow, so this never reaches an element sweep and is invisible to one'
    ).toEqual([]);
  });

  test('wraps the band rather than scrolling it, which is what flex-wrap is doing there', async ({ page }) => {
    await goTo(page, ROUTE);
    await expectPinnedViewport(page);

    const band = await page.locator('.premise__band').evaluate((element) => ({
      wrap: getComputedStyle(element).flexWrap,
      display: getComputedStyle(element).display,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    expect(band.display, 'the band is not a flex container, so flex-wrap decides nothing').toBe('flex');
    expect(band.wrap, 'the band does not wrap, so a name past the edge would scroll or clip').toBe('wrap');
    expect(
      band.scrollWidth,
      `the band paints ${band.scrollWidth}px of names in a ${band.clientWidth}px box`
    ).toBeLessThanOrEqual(band.clientWidth + EDGE_SLACK);
  });

  test('and both measurements fire against a band held on one line with a name it cannot break', async ({ page }) => {
    // The planted control for the two cases above. A run over a clean page and a run whose
    // measurement was broken look identical, and this is what separates them. Two changes, because
    // the band absorbs a long name by wrapping and a single unbreakable token defeats wrapping:
    // together they are the shape the layout has to survive.
    await goTo(page, ROUTE);
    await expectPinnedViewport(page);

    const planted = await page.evaluate((token) => {
      const name = document.querySelector('.premise__framework');
      if (!name) return false;
      name.textContent = token;
      return true;
    }, UNBREAKABLE);
    expect(planted, 'no band name was found to plant a token into').toBe(true);

    await plantStyle(page, '.premise__band { flex-wrap: nowrap !important; }');

    // Both, because the clean case above makes both claims and a control that fired only one of
    // them would leave the other's zero result meaning nothing. They see different failures: a box
    // landing past the viewport edge, and content painted past a box whose own rect never grew.
    const outside = await outsideViewport(page);
    const painted = await contentOutsideItsBox(page);

    expect(
      outside.length,
      'an unbreakable name on a band held to one line puts nothing outside the viewport, so the rect ' +
        'measurement is not reading the layout'
    ).toBeGreaterThan(0);
    expect(
      painted.length,
      'the same name paints inside every box, so the content measurement is not reading the layout'
    ).toBeGreaterThan(0);
  });

  test('absorbs a domain longer than the one the Registry carries today', async ({ page }) => {
    // The mark reads its trailing cell off the Hub's own entry, so its width is whatever hostname
    // the estate is served from. The committed one is short and every layout holds for it; the day
    // the Hub moves, a longer one arrives with no other edit and nothing would have measured it.
    await goTo(page, ROUTE);
    await expectPinnedViewport(page);

    expect(await outsideViewport(page), 'the route already overflows, so the plant below proves nothing').toEqual([]);
    expect(await contentOutsideItsBox(page), 'the block already paints outside its own boxes').toEqual([]);

    const planted = await page.evaluate((token) => {
      const cell = document.querySelector('.plate-mark__domain');
      if (!cell) return false;
      cell.textContent = `${token.toLowerCase()}.example`;
      return true;
    }, UNBREAKABLE);
    expect(planted, 'the mark draws no trailing cell to plant a domain into').toBe(true);

    expect(
      await outsideViewport(page),
      'a long hostname on the plate mark pushes an element outside the viewport at 360, which is A-5'
    ).toEqual([]);
    expect(
      await contentOutsideItsBox(page),
      'a long hostname is painted outside the mark box. The element rect does not grow, so this never ' +
        'reaches an element sweep'
    ).toEqual([]);
  });

  test('and the same domain escapes once the cell is not allowed to shrink', async ({ page }) => {
    // The control for the case above, and the demonstration that the two declarations doing the
    // work are the ones named. A flex item's automatic minimum is its own min-content width, so a
    // hostname left at `auto` never has to break however permissive the wrapping rule is.
    await goTo(page, ROUTE);
    await page.evaluate((token) => {
      const cell = document.querySelector('.plate-mark__domain');
      if (cell) cell.textContent = `${token.toLowerCase()}.example`;
    }, UNBREAKABLE);

    await plantStyle(
      page,
      '.plate-mark__label, .plate-mark__domain { min-inline-size: auto !important; overflow-wrap: normal !important; }'
    );

    const outside = await outsideViewport(page);
    const painted = await contentOutsideItsBox(page);

    expect(
      outside.length + painted.length,
      'the same hostname is absorbed with both declarations off, so neither is what holds the mark ' +
        'together and this file says they are'
    ).toBeGreaterThan(0);
  });
});

test.describe('the band disappears in a medium with no ornament, and the line does not', () => {
  test('is swept out of print by the decorative rule, while the footer line survives', async ({ page }) => {
    // `app/scss/_print.scss:12` already hides every `aria-hidden` element, so the band needs no rule
    // of its own and correctly leaves a printed page. The footer line is not hidden and is a fact,
    // so it stays. Asserted because the two halves are one rule and a later exemption to that rule
    // could take either.
    await goTo(page, ROUTE);

    const onScreen = await page.evaluate(() => ({
      band: getComputedStyle(document.querySelector('.premise__band') as Element).display,
      line: getComputedStyle(document.querySelector('.site-footer__line') as Element).display,
    }));
    expect(onScreen.band, 'the band is already hidden on screen, so print collapses nothing').not.toBe('none');

    await page.emulateMedia({ media: 'print' });
    const inPrint = await page.evaluate(() => ({
      band: getComputedStyle(document.querySelector('.premise__band') as Element).display,
      line: getComputedStyle(document.querySelector('.site-footer__line') as Element).display,
    }));

    expect(inPrint.band, 'the band prints, so ornament made of sub-contrast text reaches paper').toBe('none');
    expect(inPrint.line, 'the footer line is swept out of print with the ornament').not.toBe('none');
    expect(onScreen.line, 'the footer line was already hidden on screen').not.toBe('none');
  });
});

/**
 * What the interactive sweep below walks: the premise block and everything in it.
 *
 * **`.site-footer, .site-footer *` was part of this until 2026-09-11.** Story 2-17 gave the footer
 * its one link, to `/celeste`, so the footer is no longer a surface this story's "nothing
 * interactive" claim can be made about. That link is asserted by name in
 * `tests/e2e/secondary-surfaces.pw.ts` and counted in `tests/e2e/hit-target-floor.pw.ts`; what
 * stays here is the premise block's own claim. Declared once so the sweep and its control cannot
 * walk different subtrees.
 */
const SWEPT = '.premise, .premise *';

test.describe('nothing this story adds to the premise block is interactive', () => {
  test('adds no control to the home route from the premise block', async ({ page }) => {
    // `tests/e2e/hit-target-floor.pw.ts` pins an exact number of interactive elements for `/`.
    // That number is held there; this is the local claim behind it, so a control arriving in the
    // premise block fails naming the component rather than naming a count.
    await goTo(page, ROUTE);

    const found = await page.evaluate(
      (swept) =>
        [...document.querySelectorAll(swept)]
          .filter((node) =>
            node.matches('a[href], button, input, select, textarea, summary, [role], [tabindex], [contenteditable="true"]')
          )
          .map((node) => `${node.tagName.toLowerCase()}.${(node as HTMLElement).className}`),
      SWEPT
    );

    expect(found, `the premise block renders something interactive:\n${found.join('\n')}`).toEqual([]);
  });

  test('and that sweep fires, measured against a control planted into the block', async ({ page }) => {
    await goTo(page, ROUTE);
    const planted = await page.evaluate(() => {
      const band = document.querySelector('.premise__band');
      if (!band) return false;
      const link = document.createElement('a');
      link.href = '#suite';
      link.textContent = 'planted';
      band.append(link);
      return true;
    });
    expect(planted, 'no band was found to plant a control into').toBe(true);

    const found = await page.evaluate(
      (swept) =>
        [...document.querySelectorAll(swept)].filter((node) =>
          node.matches('a[href], button, input, select, textarea, summary, [role], [tabindex], [contenteditable="true"]')
        ).length,
      SWEPT
    );
    expect(found, 'a planted link was not seen, so the sweep above reports nothing for the wrong reason').toBe(1);
  });
});
