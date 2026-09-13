import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';

/**
 * The Suite Directory's two rendered claims that only a browser can settle (Story 2-9).
 *
 * Both are rows of that story's I/O matrix and neither is visible to jsdom, which applies no
 * stylesheets: one is about what happens to a long unbroken token, the other about what changes on
 * `:hover` and, more to the point, about everything that must not.
 *
 * **Separate from `tests/e2e/hit-target-floor.pw.ts` on purpose.** That file is the A-4 floor and
 * the A-5 edge sweep, and its `EXEMPTIONS` and `SURFACES` literals are parsed as text by
 * `ops/__tests__/hit-target-floor.test.ts`. Adding component cases to it would put an unrelated
 * subject inside a file another suite reads structurally. `playwright.config.ts:33-34` collects
 * every `.pw.ts` under `tests/e2e` by glob, and `.github/workflows/ci.yml:276-277` runs the whole
 * directory, so this file needs no configuration and no CI job of its own.
 *
 * **No screenshot is taken here**, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true. Same precedent as `hit-target-floor.pw.ts`.
 *
 * **Two measurements, because the failure takes two shapes and one of them is invisible to the
 * other.** An element whose box lands outside the viewport is the shape the A-5 sweep already
 * looks for. Text painted outside its own box is the shape it cannot see: the element's rect does
 * not grow, so the overflow shows up only as `scrollWidth` exceeding `clientWidth`. Measured
 * 2026-09-06, a long token in a description produces the second and never the first, because the
 * cell spans a flexible grid track and an item spanning one of those contributes nothing to track
 * sizing. Checking only element rects would have reported that layout as clean.
 *
 * Every defect this file plants is injected into a live page through the browser, so no fixture is
 * left in the tree, and every clean result is read only after the same measurement has been seen
 * firing on the same page with the absorbing rule turned off.
 */

/**
 * The homepage, where the directory sits below the hero, and the only route that renders it.
 *
 * `/projects` rendered the same component until 2026-09-07, when Story 2-14 replaced it with a 301
 * to `/#suite`. That the Hub now renders the Directory exactly once is asserted in
 * `tests/e2e/projects-redirect.pw.ts`.
 */
const ROUTE = '/';

/** The fragment `/#suite` resolves to, which the directory heading carries. */
const HEADING_ID = 'suite';

/**
 * The tightest width at which the three-column layout applies.
 *
 * `RESTYLE-SPEC.md:268` mints exactly one breakpoint, at 760px, and `:658` names 761px among the
 * four widths its F-12 check compares a row at. One past the breakpoint is where the columns have
 * least room, so it is where a track sized by its content blows out first; a comfortable 1024 would
 * hide that. A second context is the only way to reach it, the project viewport being pinned at
 * AD-19's 360. Same shape as `tests/e2e/anchor-aliases.pw.ts:494-508`.
 */
const WIDE_VIEWPORT = { width: 761, height: 900 } as const;

/**
 * Sub-pixel slack on both comparisons.
 *
 * Layout produces fractional positions, and an element ending a third of a pixel past an edge is a
 * rounding artifact rather than overflow. Same value and same reasoning as
 * `tests/e2e/hit-target-floor.pw.ts`.
 */
const EDGE_SLACK = 0.5;

/**
 * A token with no line-breaking opportunity anywhere in it.
 *
 * The matrix names "a stack name or URL wider than its column". A URL is the realistic shape and
 * the weaker test: browsers take a break opportunity after `/` and after `-`, so a long URL can
 * pass a layout a long identifier fails. This is the strict form, long enough to exceed the widest
 * column at either viewport rather than only at 360.
 */
const UNBREAKABLE = `Aaa${'z'.repeat(120)}Zzz`;

/**
 * Every element **on the page** whose box sits outside the viewport on either side.
 *
 * Deliberately the whole document rather than the directory's subtree: a token planted in a row
 * can widen an ancestor the directory does not own, and a check scoped to `.suite-directory *`
 * would report that as clean. The routes this file visits carry no overflow of their own, which
 * the clean read before each plant establishes.
 */
const outsideViewport = (page: Page): Promise<string[]> =>
  page.evaluate((slack) => {
    const width = window.innerWidth;
    const found: string[] = [];

    for (const node of document.querySelectorAll('*')) {
      const box = node.getBoundingClientRect();
      // A node with no box at all is not overflowing anything.
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
 * Every element in the directory painting content wider than its own box.
 *
 * This is the half a rect comparison cannot see, and it is the half a long token actually produces.
 *
 * **Non-replaced inline elements cannot trigger this, and nothing is lost by that.** `clientWidth`
 * and `scrollWidth` are both defined as zero on them, so the comparison is `0 > 0` however far the
 * text runs. An inline box's overflow is accounted for on its nearest block ancestor, which is
 * measured here: the planted-control run reports `section.suite-directory` painting 1007px of
 * content in a 360px box, and the inline spans inside it report nothing. Measured 2026-09-06.
 */
const contentOutsideItsBox = (page: Page): Promise<string[]> =>
  page.evaluate((slack) => {
    const found: string[] = [];

    for (const node of document.querySelectorAll('.suite-directory, .suite-directory *')) {
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

const goTo = async (page: Page, route: string): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('.suite-directory__row').first()).toBeVisible();
};

/**
 * Put an unbreakable token in the two cells that can carry one, and assert both took it.
 *
 * The description is capped at `--measure` and the live link is not, so they fail differently and
 * planting in only one would leave the other's mechanism unexercised.
 */
const plantLongToken = async (page: Page): Promise<void> => {
  const planted = await page.evaluate((token) => {
    const description = document.querySelector('.suite-directory__description');
    const live = document.querySelector('.suite-directory__live .suite-directory__rule');
    if (description) description.textContent = token;
    if (live) live.textContent = `${token.toLowerCase()}.cuatro.dev`;
    return { description: description !== null, live: live !== null };
  }, UNBREAKABLE);

  expect(planted.description, 'no description was found to plant a token into').toBe(true);
  expect(planted.live, 'no live link was found to plant a token into').toBe(true);
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
 * Same principle as reading `--tap` and `--s-lg` off the running page: a length or a duration that
 * governs the interface comes from the contract, and a hand-written millisecond figure here would
 * drift from `--dur-major` the day it moves. `transition-duration` computes to seconds, which is
 * what the probe reads back.
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
 * Everything about a link that hover is allowed to change, and everything it is not.
 *
 * Positions are taken in **document** coordinates, because `hover()` scrolls the element into view
 * and a viewport-relative comparison would report that scroll as movement.
 */
const linkState = (link: Locator) =>
  link.evaluate((element) => {
    const rule = element.querySelector('.suite-directory__rule');
    if (!(rule instanceof HTMLElement)) throw new Error('the link carries no .suite-directory__rule span');

    const linkStyle = getComputedStyle(element);
    const ruleStyle = getComputedStyle(rule);
    const linkBox = element.getBoundingClientRect();
    const ruleBox = rule.getBoundingClientRect();
    const round = (value: number): number => Number(value.toFixed(2));

    return {
      underlineColour: ruleStyle.borderBottomColor,
      underlineWidth: ruleStyle.borderBottomWidth,
      underlineStyle: ruleStyle.borderBottomStyle,
      ruleWidth: round(ruleBox.width),
      ruleHeight: round(ruleBox.height),
      linkWidth: round(linkBox.width),
      linkHeight: round(linkBox.height),
      documentTop: round(linkBox.top + window.scrollY),
      documentLeft: round(linkBox.left + window.scrollX),
      transform: linkStyle.transform,
      boxShadow: linkStyle.boxShadow,
      filter: linkStyle.filter,
      opacity: linkStyle.opacity,
      background: linkStyle.backgroundColor,
      ruleBackground: ruleStyle.backgroundColor,
      textDecorationLine: linkStyle.textDecorationLine,
      fontSize: linkStyle.fontSize,
      letterSpacing: linkStyle.letterSpacing,
      colour: linkStyle.color,
    };
  });

/** Run `read` against the directory in a second context one pixel past the row's breakpoint. */
const pastTheBreakpoint = async <T>(browser: Browser, read: (page: Page) => Promise<T>): Promise<T> => {
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
      'the second context is not past the row breakpoint, so it renders the same layout as the first'
    ).toBeGreaterThan(760);
    return await read(page);
  } finally {
    await context.close();
  }
};

test.describe('the home route can be scrolled to the directory', () => {
  test('carries overflow-x: clip on both elements and a document taller than the viewport', async ({ page }) => {
    // **The story's central claim, and until this case nothing read it.** Story 2-9 repaired the
    // stylesheet half of KV-5: `width: 100%` in place of `100vw`, `min-height` in place of
    // `height: 100vh`, `overflow-x: clip` in place of `hidden`, and the home route's own
    // `overflow: hidden` removed. Every one of those is invisible to jsdom, which applies no
    // stylesheets, and invisible to a browser test that scrolls programmatically, because
    // `scrollIntoView` reaches content a person could not. Reverting the block left the whole
    // suite green while `ops/known-violations.md` went on recording the half as repaired.
    //
    // `clip` specifically, not merely "not hidden". The two clip identically and the difference is
    // that `clip` does not make the element a scroll container, which is why `hidden` breaks
    // descendant `position: sticky` (`DESIGN.md:558-559`). A silent swap back would reintroduce
    // that with nothing failing.
    await goTo(page, ROUTE);

    const layout = await page.evaluate(() => ({
      htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      bodyHeight: document.body.getBoundingClientRect().height,
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      innerHeight: window.innerHeight,
    }));

    expect(layout.htmlOverflowX, 'html no longer carries overflow-x: clip').toBe('clip');
    expect(layout.bodyOverflowX, 'body no longer carries overflow-x: clip').toBe('clip');

    // `height: 100vh` clamped the body to one viewport, which is what made a section below the
    // hero unreachable. A minimum does not.
    expect(
      layout.bodyHeight,
      'the body is no taller than the viewport, so height: 100vh has come back and the payload ' +
        'below the hero cannot be reached'
    ).toBeGreaterThan(layout.innerHeight);
    expect(
      layout.scrollHeight,
      'the document is not taller than the viewport, so there is nothing to scroll to'
    ).toBeGreaterThan(layout.innerHeight);

    // And the heading really is inside that scroll rather than merely existing somewhere.
    const heading = await page.locator(`#${HEADING_ID}`).evaluate((element) => ({
      documentTop: element.getBoundingClientRect().top + window.scrollY,
    }));
    expect(
      heading.documentTop,
      'the directory heading sits above the fold, so this case is not measuring a scroll at all'
    ).toBeGreaterThan(layout.innerHeight);
    expect(
      heading.documentTop,
      'the directory heading sits past the end of the scrollable document'
    ).toBeLessThan(layout.scrollHeight);
  });

  test('and the overflow read is a live read, not a constant', async ({ page }) => {
    // The planted control for the case above. `getComputedStyle` returning `clip` twice proves
    // nothing unless it is seen returning something else on the same page.
    await goTo(page, ROUTE);
    await plantStyle(page, 'html, body { overflow-x: hidden !important; }');

    const planted = await page.evaluate(() => ({
      htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
    }));

    expect(planted.htmlOverflowX, 'the overflow read does not follow the stylesheet').toBe('hidden');
    expect(planted.bodyOverflowX, 'the overflow read does not follow the stylesheet').toBe('hidden');
  });

  test('resolves /#suite to the heading, in view and focused', async ({ page }) => {
    // The fragment is the payload Story 2-14 redirects to and the target Story 2-13's skip control
    // moves focus to, and nothing navigated to it. Two things could break it and neither shows up
    // anywhere else: the heading could stop being focusable, and `app/providers.tsx` installs Lenis
    // globally, which owns the scroll position and could refuse or undo a native fragment jump.
    const response = await page.goto(`${ROUTE}#${HEADING_ID}`, { waitUntil: 'load' });
    expect(response?.status(), 'the home route did not answer 200').toBe(200);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // Long enough for hydration to install Lenis and for anything it does to the scroll position
    // to have happened. A snap back would land inside this window, not after it.
    await page.waitForTimeout(2000);

    const landed = await page.evaluate((id) => {
      const heading = document.getElementById(id);
      if (!heading) return null;
      const box = heading.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        focused: document.activeElement === heading,
        activeElement: document.activeElement?.tagName ?? 'none',
      };
    }, HEADING_ID);

    expect(landed, `nothing on the home route carries id="${HEADING_ID}"`).not.toBeNull();

    expect(
      landed && landed.scrollY > 0,
      `navigating to #${HEADING_ID} left the page at the top. The heading exists, so either the ` +
        `fragment did not resolve or the smooth-scroll library in app/providers.tsx took the ` +
        `position back after the jump`
    ).toBe(true);
    expect(
      landed && landed.top >= 0 && landed.top < landed.innerHeight,
      `the heading is not in view after navigating to #${HEADING_ID}: its top is at ` +
        `${landed?.top.toFixed(2)} in a ${landed?.innerHeight}px viewport`
    ).toBe(true);
    expect(
      landed?.focused,
      `the heading is not focused after navigating to #${HEADING_ID}, so a keyboard reader lands ` +
        `at the top of the document and tabs through the whole hero again. ` +
        `EXPERIENCE.md:420 moves focus, not only scroll position. Active element was ` +
        `${landed?.activeElement}`
    ).toBe(true);
  });
});

test.describe('the Suite Directory absorbs a long unbroken token', () => {
  test('at 360, where the cell spans a flexible track and the grid cannot grow for it', async ({ page }) => {
    await goTo(page, ROUTE);

    // Clean before anything is planted. Without this the case cannot tell a layout that survived
    // the token from one that was already overflowing for an unrelated reason.
    expect(
      await outsideViewport(page),
      'the home route already puts an element outside the viewport, so the plant below proves nothing'
    ).toEqual([]);
    expect(await contentOutsideItsBox(page), 'the directory already paints outside its own boxes').toEqual([]);

    await plantLongToken(page);

    expect(
      await outsideViewport(page),
      'a long unbroken token pushes an element outside the viewport at 360. This is A-5 outright'
    ).toEqual([]);
    expect(
      await contentOutsideItsBox(page),
      'a long unbroken token is painted outside its own box at 360. The element rect does not grow, ' +
        'so this never reaches the A-5 element sweep and is invisible to it'
    ).toEqual([]);
  });

  test('and fails at 360 with the two rules that absorb it turned off, so the measurements fire', async ({
    page,
  }) => {
    // The planted control. A run over a clean page and a run whose measurement was broken look
    // identical, and this is what separates them.
    //
    // Two rules, because the token is absorbed in two places by two mechanisms. `overflow-wrap` on
    // the row lets a long word break rather than paint past its cell. `min-inline-size: 0` on the
    // underline span lets that span shrink at all: it is a flex item of an `inline-flex` link, so
    // its automatic minimum is its min-content width, and left at `auto` it never has to wrap.
    await goTo(page, ROUTE);
    await plantLongToken(page);

    await plantStyle(page, '.suite-directory__row, .suite-directory__row * { overflow-wrap: normal !important; }');
    await plantStyle(page, '.suite-directory__rule { min-inline-size: auto !important; }');

    const outside = await outsideViewport(page);
    const painted = await contentOutsideItsBox(page);

    expect(
      outside.length,
      'the same token puts nothing outside the viewport with both rules off, so the rect measurement ' +
        'is not reading the layout'
    ).toBeGreaterThan(0);
    expect(
      painted.length,
      'the same token paints inside every box with both rules off, so the content measurement is not ' +
        'reading the layout'
    ).toBeGreaterThan(0);
  });

  test('one pixel past the breakpoint, where minmax(0, 5fr) sizes the column', async ({ browser }) => {
    const { clean, cleanContent, planted, plantedContent } = await pastTheBreakpoint(browser, async (wide) => {
      await goTo(wide, ROUTE);
      const before = await outsideViewport(wide);
      const beforeContent = await contentOutsideItsBox(wide);
      await plantLongToken(wide);
      return {
        clean: before,
        cleanContent: beforeContent,
        planted: await outsideViewport(wide),
        plantedContent: await contentOutsideItsBox(wide),
      };
    });

    expect(clean, 'the route already overflows at this width, so the plant proves nothing').toEqual([]);
    expect(cleanContent, 'the directory already paints outside its own boxes at this width').toEqual([]);
    expect(planted, 'a long unbroken token pushes an element outside the viewport in the three-column layout').toEqual(
      []
    );
    expect(plantedContent, 'a long unbroken token is painted outside its own box in the three-column layout').toEqual(
      []
    );
  });

  test('and fails past the breakpoint once minmax(0, ...) comes off the description column', async ({
    browser,
  }) => {
    // `RESTYLE-SPEC.md:273-274` states the zero minimum as a requirement rather than a preference:
    // without it a track's automatic minimum is its content's min-content size, and a long token
    // blows the grid out. This is that sentence demonstrated, with nothing else changed, so what
    // fires is attributable to the one declaration.
    const { outside, painted } = await pastTheBreakpoint(browser, async (wide) => {
      await goTo(wide, ROUTE);
      await plantLongToken(wide);
      await plantStyle(
        wide,
        '@media (min-width: 760px) { .suite-directory__row { grid-template-columns: minmax(12ch, 3fr) 5fr auto !important; } }'
      );
      return { outside: await outsideViewport(wide), painted: await contentOutsideItsBox(wide) };
    });

    expect(
      outside.length,
      'the description column absorbs the token without a zero minimum, so minmax(0, ...) is not what ' +
        'holds this layout together and this file says it is'
    ).toBeGreaterThan(0);
    expect(painted.length, 'nothing paints outside its box either, so neither measurement fired').toBeGreaterThan(0);
  });

  test('and that same removal changes nothing at 360, because 760px is the one breakpoint', async ({ page }) => {
    // The other direction of the control above, and the cheapest evidence that the three-column
    // rule really is confined to one media query: the declaration that blows the layout out past
    // the breakpoint is inert below it.
    await goTo(page, ROUTE);
    await plantLongToken(page);
    await plantStyle(
      page,
      '@media (min-width: 760px) { .suite-directory__row { grid-template-columns: minmax(12ch, 3fr) 5fr auto !important; } }'
    );

    expect(await outsideViewport(page), 'a rule behind min-width: 760px changed the 360 layout').toEqual([]);
    expect(await contentOutsideItsBox(page), 'a rule behind min-width: 760px changed the 360 layout').toEqual([]);
  });
});

test.describe('the Suite Directory on hover', () => {
  test('recolours the underline and moves nothing else', async ({ page }) => {
    await goTo(page, ROUTE);

    const hover = await roleColour(page, '--token-accent-hover');
    const accent = await roleColour(page, '--token-accent');
    const boundary = await roleColour(page, '--token-border-interactive');

    // The settle, read from the contract rather than written here. The project runs with reduced
    // motion, under which the contract collapses every duration to 1ms, so the figure is small and
    // the guard is against the token moving rather than against a long animation.
    const settle = await durationMs(page, '--dur-major');
    expect(settle, '--dur-major does not resolve to a duration, so the wait below is unanchored').toBeGreaterThan(0);

    expect(hover, '--token-accent and --token-accent-hover resolve alike, so a recolour is unreadable').not.toBe(
      accent
    );
    expect(hover, '--token-border-interactive and --token-accent-hover resolve alike').not.toBe(boundary);

    for (const selector of ['.suite-directory__live', '.suite-directory__source']) {
      const link = page.locator(selector).first();
      await expect(link, `${selector} matches nothing, so this loop measures nothing`).toBeVisible();

      // Read at rest with the pointer parked elsewhere and the element already scrolled into view,
      // so `hover()` has no scrolling left to do that would read as movement.
      await page.mouse.move(0, 0);
      await link.scrollIntoViewIfNeeded();
      const before = await linkState(link);

      await link.hover();
      // Comfortably past `--dur-major`, the longest duration the contract declares. Any transition
      // on any property read below has finished, so a difference is a difference in the end state
      // rather than a race against one.
      await page.waitForTimeout(Math.max(settle * 4, 100));
      const after = await linkState(link);

      expect(after.underlineColour, `${selector} does not recolour its underline on hover`).toBe(hover);
      expect(
        before.underlineColour,
        `${selector} already paints the hover colour at rest, so the recolour is not a change`
      ).not.toBe(hover);

      // Everything else, field by field. Width is called out in `RESTYLE-SPEC.md:200-201` because
      // it is a layout property: an underline that grows on hover reflows the line it sits on.
      const { underlineColour: _hovered, ...settled } = after;
      const { underlineColour: _atRest, ...original } = before;
      expect(
        settled,
        `${selector} changes something besides its underline colour on hover. One signal: no lift, ` +
          `no scale, no shadow, no ground, no width change`
      ).toEqual(original);
    }
  });

  test('paints the two links different underlines at rest, which is the hierarchy hover collapses', async ({
    page,
  }) => {
    // The hierarchy `DESIGN.md:672-676` describes: the live link takes the emphasis stroke in
    // accent, the source link a hairline in the boundary role. Read here because the case above
    // compares each link against itself and would pass with both painted identically.
    await goTo(page, ROUTE);

    const live = await linkState(page.locator('.suite-directory__live').first());
    const source = await linkState(page.locator('.suite-directory__source').first());

    expect(live.underlineColour, 'the live underline is not the accent role').toBe(
      await roleColour(page, '--token-accent')
    );
    expect(source.underlineColour, 'the source underline is not the boundary role').toBe(
      await roleColour(page, '--token-border-interactive')
    );
    expect(
      Number.parseFloat(live.underlineWidth),
      'the live underline is not heavier than the source one, so the two read as one rank'
    ).toBeGreaterThan(Number.parseFloat(source.underlineWidth));
  });
});
