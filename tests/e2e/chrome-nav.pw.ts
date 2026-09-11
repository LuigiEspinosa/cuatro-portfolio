import { test, expect, type Download, type Page } from '@playwright/test';
import { RENDERED_VIEWPORT, rootCustomPropertyValue } from './harness';

/**
 * The header, reshaped to two destinations and made sticky (Story 2-15).
 *
 * `EXPERIENCE.md:115-123` closes PRD Q8 with two header destinations and no more: `#suite`
 * primary, `/cv` secondary, `/work` folded into `/cv` as a section, `/recommendation` and
 * `/celeste` in the footer. `EXPERIENCE.md:126` names the shape this replaced, five inline links
 * plus a CTA, as the AI-nav tell, and SM-1 measures reaching the Suite Directory, which every
 * further header link competes with.
 *
 * **What this file adds that `tests/e2e/hit-target-floor.pw.ts` does not.** That sweep measures
 * every interactive element on every surface against `--tap` and is what deleted the `chrome-nav`
 * exemption; it says nothing about *which* destinations the header carries, in what order, which
 * one is marked as the current page, or whether the header stays put when the page scrolls. Those
 * are this file's, and the floor is re-measured here on the nav alone so a failure names the
 * header rather than a surface.
 *
 * **No screenshot is taken.** This file writes no snapshot directory, so `keeps exactly one
 * committed baseline` in `tests/e2e/rendered-output.pw.ts` stays true, and
 * `ops/__tests__/hit-target-floor.test.ts:628-634` records why a second one would be a defect.
 * Same precedent as `tests/e2e/celeste-header.pw.ts:24-26`.
 *
 * **Every predicate here is watched producing the other answer before its clean reading is
 * believed**, and the control is planted through the browser or resolved on a probe, so nothing is
 * left in the tree. Two of them take a different shape and it is stated rather than generalized
 * over: the `--z-sticky` and `--token-bg` comparisons are equalities against a value resolved on a
 * probe in the same page, and what can go wrong there is the probe answering the same string for
 * every input rather than the header being wrong. Each is therefore controlled by resolving a
 * **different** token from the same family and requiring the two to differ, which is what makes
 * the equality discriminate. The ground is controlled twice more, against a resolved `transparent`
 * and against an alpha channel, because a translucent ground would still equal its own probe.
 *
 * **`aria-current` had no live instance on the shipped Hub until 2026-09-10, and now it has one.**
 * `Suite` is current only on `/`, where `Header.tsx:12` renders no header at all, and `CV` is
 * current only on `/cv`, which answered a 308 to a PDF until Story 2-16 built the page. This file
 * goes on asserting the attribute **absent** on the two surfaces that are neither destination,
 * watched against a planted mark, because that is the claim those two surfaces support and it is
 * the one a third link marking itself would break. The live instance is asserted where it lives, in
 * `tests/e2e/cv.pw.ts`, and the mechanism is asserted at the unit level in
 * `components/atoms/Navbar/__tests__/Navbar.test.tsx`, which drives the pathname directly. Story
 * 2-16 changed nothing here except this paragraph and the `CV` click below.
 */

/** A path the Hub does not route, which renders `app/not-found.tsx`. Same as the floor sweep's. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * The two surfaces that render the header **and are neither destination**, with the status each
 * answers.
 *
 * **Three surfaces render the header since 2026-09-10 and this list stays at two, deliberately.**
 * Story 2-16 built `/cv`, which is the header's second destination, so on that surface one link
 * carries `aria-current` and the accent rule under its label. Every loop below assumes the opposite:
 * "marks no destination as the current page" is written about a surface that is neither, and the
 * geometry cases measure two links that take one treatment. Adding `/cv` here would turn the first
 * into a false claim and would say nothing the third surface does not already have asserted in
 * `tests/e2e/cv.pw.ts`, which is where that surface's own header reading lives.
 */
const CHROME_SURFACES = [
  { route: '/work', status: 200 },
  { route: NOT_FOUND, status: 404 },
] as const;

/** The header's two destinations, in the order `EXPERIENCE.md:115-123` fixes. */
const DESTINATIONS = [
  { href: '/#suite', label: 'Suite' },
  { href: '/cv', label: 'CV' },
] as const;

/** The Directory heading's own id, which is what makes `/#suite` resolve. */
const HEADING_ID = 'suite';

/** The header's second destination, a route since Story 2-16 removed the 308 that stood for it. */
const CV_ROUTE = '/cv';

/**
 * Navigate, and refuse to read anything off a page that did not answer the status expected.
 *
 * Local rather than shared, on the idiom `tests/e2e/celeste-header.pw.ts:36-40` and
 * `tests/e2e/hit-target-floor.pw.ts` already set. DW-22 records that this guard now has several
 * implementations and that hoisting it into `harness.ts` is its own change.
 */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/** Every anchor the header's nav renders: its `href`, its text and whether it opens elsewhere. */
const destinationsOn = (page: Page) =>
  page.locator('nav.navbar a').evaluateAll((nodes: Element[]) =>
    nodes.map((node) => ({
      href: node.getAttribute('href') ?? '',
      label: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      target: node.getAttribute('target') ?? '',
    }))
  );

/** Every element inside the header announcing itself as the current page. */
const currentMarksOn = (page: Page) =>
  page
    .locator('header [aria-current]')
    .evaluateAll((nodes: Element[]) =>
      nodes.map((node) => `${node.tagName.toLowerCase()}[${node.getAttribute('aria-current')}]`)
    );

/**
 * The pixel floor, read off `--tap` on `:root` in the running page.
 *
 * Never written here. A hand-written literal is what Story 2-34's conformance gate rejects
 * (`DESIGN.md:654-656`), and a floor restated in a spec file is a floor that drifts from the
 * contract it claims to enforce. `ops/__tests__/hit-target-floor.test.ts` scans for exactly that
 * mistake in the sweep's own file.
 */
const floorFrom = async (page: Page): Promise<number> => {
  const declared = await rootCustomPropertyValue(page, '--tap');
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(declared.trim());
  const value = match ? Number(match[1]) : Number.NaN;
  expect(
    Number.isFinite(value) && value > 0,
    `--tap reads "${declared}", which is not a positive length in pixels`
  ).toBe(true);
  return value;
};

/**
 * The computed value of one property on one element, resolved by laying out a probe.
 *
 * A custom property's computed value is its declared token stream, so `--z-sticky` read off
 * `:root` answers the string `200` and comparing it against a computed `z-index` compares a
 * declaration against a resolution. This resolves the reference the way the element does.
 */
const probeComputed = (page: Page, declaration: string, property: string): Promise<string> =>
  page.evaluate(
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

/** Which of a set of boxes fails the floor, and on which axis. */
interface Box {
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Sub-pixel slack on the separation comparison alone, never on the floor.
 *
 * The same 0.5 `tests/e2e/hit-target-floor.pw.ts:268` takes, and for the same reason: layout
 * produces fractional positions, and two boxes a third of a pixel closer than `--s-lg` is a
 * rounding artifact rather than a pair a finger cannot separate.
 */
const EDGE_SLACK = 0.5;

/** What `boundingBox()` answers, including the `null` a detached or invisible element gives. */
type MaybeBox = { x: number; y: number; width: number; height: number } | null;

/**
 * The largest separation between two boxes on either axis.
 *
 * Two boxes that overlap on both axes give a negative answer, which is what makes "not
 * overlapping" and "far enough apart" one comparison rather than two. A missing box answers
 * negative infinity rather than throwing, so the caller reports it as too close, which is what an
 * unhittable target is.
 */
const separation = (first: MaybeBox, second: MaybeBox): number => {
  if (!first || !second) return Number.NEGATIVE_INFINITY;
  return Math.max(
    second.x - (first.x + first.width),
    first.x - (second.x + second.width),
    second.y - (first.y + first.height),
    first.y - (second.y + second.height)
  );
};

const underFloor = (boxes: readonly Box[], floor: number): string[] =>
  boxes
    .filter((box) => box.width < floor || box.height < floor)
    .map(
      (box) =>
        `"${box.label}" measures ${box.width.toFixed(2)} x ${box.height.toFixed(2)}, and the floor ` +
        `is ${floor} on both axes`
    );

test.describe('the chrome nav', () => {
  test('carries exactly two destinations, in order, with no external link and no mailto:', async ({
    page,
  }) => {
    for (const surface of CHROME_SURFACES) {
      await goTo(page, surface.route, surface.status);

      // Asserted as an ordered list rather than as two lookups. Two `getByRole` calls pass in
      // either order, and the order is the half PRD Q8 closed: `Suite` is the payload SM-1
      // measures reaching and it comes first.
      expect(
        await destinationsOn(page),
        `${surface.route} does not render the two destinations EXPERIENCE.md:115-123 fixes`
      ).toEqual(DESTINATIONS.map((destination) => ({ ...destination, target: '' })));

      // `/work` is a route and is deliberately not a header destination (`EXPERIENCE.md:96`), and
      // `CV` names the route rather than the PDF beside it. Both are covered by the equality above;
      // they are restated here because a reader of a failure needs the reason. The PDF assertion
      // outlived the redirect: `/pdf/cv.pdf` is now linked from the `/cv` page rather than reached
      // through a 308, and a header label pointed at it would still be a label naming a file.
      const hrefs = (await destinationsOn(page)).map((destination) => destination.href);
      expect(hrefs, `${surface.route} puts /work back in the header`).not.toContain('/work');
      expect(hrefs.join(' '), `${surface.route} points a header label at a PDF`).not.toMatch(/\.pdf/);
      expect(hrefs.join(' '), `${surface.route} still renders a mailto: in the header`).not.toMatch(/mailto:/);
    }

    // **The control.** Plant a third link into the real nav and the same read reports three, so an
    // equality against two is a measurement rather than a locator that matches nothing. Planted
    // through the browser, so no fixture is left in the tree.
    await page.evaluate(() => {
      const host = document.querySelector('nav.navbar');
      if (!host) return;
      const link = document.createElement('a');
      link.href = 'https://example.invalid/blog';
      link.target = '_blank';
      link.textContent = 'Blog';
      host.append(link);
    });

    const planted = await destinationsOn(page);
    expect(planted, 'the read does not react to a third destination planted in the nav').toHaveLength(3);
    expect(
      planted.map((destination) => destination.target),
      'the read does not report target, so an external link could arrive unnoticed'
    ).toContain('_blank');
  });

  test('builds every destination to the floor on both axes, read off the contract', async ({ page }) => {
    for (const surface of CHROME_SURFACES) {
      await goTo(page, surface.route, surface.status);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const floor = await floorFrom(page);
      expect(page.viewportSize(), `${surface.route} was not measured at the pinned viewport`).toEqual({
        ...RENDERED_VIEWPORT,
      });

      const links = page.locator('nav.navbar a');
      const count = await links.count();
      expect(count, `${surface.route} renders no nav link, so nothing is measured here`).toBe(
        DESTINATIONS.length
      );

      const boxes: Box[] = [];
      for (let index = 0; index < count; index += 1) {
        const box = await links.nth(index).boundingBox();
        expect(box, `nav link ${index} on ${surface.route} has no box at all`).toBeTruthy();
        boxes.push({
          label: DESTINATIONS[index].label,
          width: box?.width ?? 0,
          height: box?.height ?? 0,
        });
      }

      expect(
        underFloor(boxes, floor),
        `a header destination on ${surface.route} is under the AD-19 floor. It is built with ` +
          `min-block-size, min-inline-size and inline-flex for exactly this reason, and vertical ` +
          `padding on a plain inline element would read as compliant here and measure otherwise`
      ).toEqual([]);
    }

    // **The control, and it is this nav's own regression.** A link planted into the real nav with
    // the two size floors taken back off measures the line box, which is what every header link
    // measured before this story: roughly 22px tall against a 44px floor. The label is deliberately
    // long, so the width axis clears the floor and the failure is the height alone rather than "it
    // is a small element", which is the case `EXPERIENCE.md:727-732` and `DESIGN.md:645-648` single
    // out. Measured with the same `boundingBox()` and put through the same predicate, so the clean
    // result above is a measurement rather than an empty list.
    const floor = await floorFrom(page);
    await page.evaluate(() => {
      const host = document.querySelector('nav.navbar');
      if (!host) return;
      const link = document.createElement('a');
      link.href = '#unfloored';
      link.id = 'planted-unfloored-nav-link';
      link.textContent = 'Read the documentation';
      link.setAttribute('style', 'min-block-size:0;min-inline-size:0;padding-inline:0;');
      host.append(link);
    });

    const plantedBox = await page.locator('a#planted-unfloored-nav-link').boundingBox();
    expect(plantedBox, 'the unfloored control was not laid out at all').toBeTruthy();
    const reported = underFloor(
      [{ label: 'planted unfloored link', width: plantedBox?.width ?? 0, height: plantedBox?.height ?? 0 }],
      floor
    );
    expect(reported, 'the floor predicate does not fire on a nav link with the floors removed').toHaveLength(1);
    expect(reported[0], 'the report does not carry the measured box').toMatch(/measures \d+\.\d\d x \d+\.\d\d/);
    expect(
      plantedBox?.width ?? 0,
      'the unfloored control is narrower than the floor, so this control fails on the wrong axis'
    ).toBeGreaterThanOrEqual(floor);
    expect(
      plantedBox?.height ?? 0,
      'the unfloored control still reaches the floor on height, so removing min-block-size is not ' +
        'what the shipped links depend on and this control shows nothing'
    ).toBeLessThan(floor);
  });

  test('marks no destination as the current page on a surface that is neither', async ({ page }) => {
    // `/work` and the 404 are the two surfaces that render this header, and neither is a
    // destination, so nothing in the header announces itself as the current page. Before this
    // story `aria-current` appeared nowhere in application code at all, so this is a new property
    // with no prior assertion anywhere.
    for (const surface of CHROME_SURFACES) {
      await goTo(page, surface.route, surface.status);
      expect(
        await currentMarksOn(page),
        `${surface.route} is neither destination and something in its header claims to be the ` +
          `current page`
      ).toEqual([]);
    }

    // **The control, and it is the missing live instance.** No shipped surface marks a link, so
    // the mark is planted onto the link that *would* carry it on `/cv`, and the same read has to
    // report it. Without this, an empty list above is indistinguishable from a selector that never
    // matched anything.
    const marked = await page.evaluate(() => {
      const link = document.querySelector("nav.navbar a[href='/cv']");
      if (!link) return false;
      link.setAttribute('aria-current', 'page');
      return true;
    });
    expect(marked, "no header link points at /cv, so the current-page control had nothing to mark").toBe(true);
    expect(
      await currentMarksOn(page),
      'the read does not report a planted aria-current, so the empty results above mean nothing'
    ).toEqual(['a[page]']);

    // And the accent underline the mark paints is drawn on the inner span rather than on the
    // `--tap` box (`RESTYLE-SPEC.md:198-199`), or the rule floats away from the text by the height
    // of the padding that gets the box to the floor. Read as a computed border on the span, and
    // compared against the same declaration resolved on a probe rather than against a literal.
    const rule = await page
      .locator("nav.navbar a[href='/cv'] .navbar__label")
      .evaluate((node) => ({
        width: window.getComputedStyle(node).borderBottomWidth,
        color: window.getComputedStyle(node).borderBottomColor,
        style: window.getComputedStyle(node).borderBottomStyle,
      }));
    const boxRule = await page
      .locator("nav.navbar a[href='/cv']")
      .evaluate((node) => window.getComputedStyle(node).borderBottomWidth);

    expect(rule.style, 'the current-route mark is not a drawn rule').toBe('solid');
    expect(rule.width, 'the current-route mark is not --stroke-emphasis wide').toBe(
      await probeComputed(page, 'border-bottom:var(--stroke-emphasis) solid red;', 'border-bottom-width')
    );
    expect(rule.color, 'the current-route mark is not painted in --token-accent').toBe(
      await probeComputed(page, 'color:var(--token-accent);', 'color')
    );
    expect(boxRule, 'the mark is drawn on the --tap box rather than on the inner span').toBe('0px');
  });

  test('stays at the top of the viewport under scroll, on an opaque ground at --z-sticky', async ({
    page,
  }) => {
    // **Both surfaces, because they are two render paths.** `/work` is `app/work/page.tsx` and the
    // 404 is `app/not-found.tsx`, and `position: sticky` is broken by any ancestor that becomes a
    // scroll container. That is the whole reason `app/app.scss:97-100` sets `overflow-x: clip`
    // rather than `hidden`, and a rule of that kind arriving on one route's own tree would leave
    // the other green.
    const header = page.locator('header.header-container');

    for (const surface of CHROME_SURFACES) {
      await goTo(page, surface.route, surface.status);
      await expect(
        header,
        `${surface.route} renders no header, so this case measures nothing there`
      ).toHaveCount(1);

      const style = await header.evaluate((node) => {
        const computed = window.getComputedStyle(node);
        return {
          position: computed.position,
          top: computed.top,
          zIndex: computed.zIndex,
          background: computed.backgroundColor,
        };
      });

      expect(
        style.position,
        `the header on ${surface.route} is not sticky, so it scrolls away with the page`
      ).toBe('sticky');
      expect(
        style.top,
        `the header on ${surface.route} is sticky against something other than the top of the viewport`
      ).toBe('0px');

      // The layer is compared against `--z-sticky` resolved through a probe rather than against
      // the number 200. `EXPERIENCE.md:413` names the token, and a literal here would be a second
      // place the contract's stacking order is written down.
      expect(style.zIndex, `the header on ${surface.route} does not sit on the --z-sticky layer`).toBe(
        await probeComputed(page, 'position:relative;z-index:var(--z-sticky);', 'z-index')
      );

      // **Opaque, and it is the paper role.** A sticky header with no ground, or an alpha one,
      // lets the page paint through the links as it scrolls under them (`EXPERIENCE.md:522-523`,
      // and alpha grounds are barred at `DESIGN.md:1281-1283`).
      expect(
        style.background,
        `the header on ${surface.route} carries no opaque token ground`
      ).toBe(await probeComputed(page, 'background-color:var(--token-bg);', 'background-color'));

      // **The ground has to cover the links, not merely exist.** It is painted on the header's own
      // box, and that box carries a block size from a 2023 literal rather than from its content, so
      // "opaque" and "covering" are two different claims: a nav row that sat below the box's bottom
      // edge would be legible over nothing at the one place the ground exists to prevent it. This
      // is why `header.scss` declares a minimum rather than a height. The numbers are logged as
      // well as compared, because the margin between them is what DW-62 is about.
      const ground = await header.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const links = [...node.querySelectorAll('nav.navbar a')].map(
          (link) => link.getBoundingClientRect().bottom
        );
        return {
          top: box.top,
          bottom: box.bottom,
          height: box.height,
          lowestLink: links.length > 0 ? Math.max(...links) : Number.NaN,
          overflow: node.scrollHeight - node.clientHeight,
        };
      });
      console.log(
        `chrome-nav: ${surface.route} header box ${ground.height.toFixed(2)} tall, lowest link ends ` +
          `at ${ground.lowestLink.toFixed(2)}, box ends at ${ground.bottom.toFixed(2)}, ` +
          `scroll overflow ${ground.overflow}`
      );
      expect(
        ground.lowestLink,
        `a nav link on ${surface.route} ends at ${ground.lowestLink.toFixed(2)} and the ground ends ` +
          `at ${ground.bottom.toFixed(2)}, so page content scrolls behind it`
      ).toBeLessThanOrEqual(ground.bottom + EDGE_SLACK);
    }

    // **The controls for the two comparisons that had none**, and they are about the comparisons
    // rather than about the header: both read a resolved token off a probe, and a probe that
    // resolved everything to the same string would make either equality vacuous. So each is run
    // again against a *different* token from the same family, which has to answer differently.
    expect(
      await probeComputed(page, 'position:relative;z-index:var(--z-sticky);', 'z-index'),
      'the layer probe answers the same for --z-sticky and --z-dropdown, so comparing against it ' +
        'says nothing about which layer the header is on'
    ).not.toBe(await probeComputed(page, 'position:relative;z-index:var(--z-dropdown);', 'z-index'));
    expect(
      await probeComputed(page, 'background-color:var(--token-bg);', 'background-color'),
      'the colour probe answers the same for --token-bg and --token-bg-raised, so comparing ' +
        'against it says nothing about which ground the header carries'
    ).not.toBe(await probeComputed(page, 'background-color:var(--token-bg-raised);', 'background-color'));

    // And the ground is opaque as well as correct, which is the half a token comparison cannot
    // see: an alpha value would still equal its own probe.
    const ground = await header.evaluate((node) => window.getComputedStyle(node).backgroundColor);
    expect(ground, 'the sticky header ground is transparent').not.toBe(
      await probeComputed(page, 'background-color:transparent;', 'background-color')
    );
    expect(ground, 'the sticky header ground carries an alpha channel').not.toMatch(
      /\/\s*0?\.\d+\s*\)|rgba\([^)]*,\s*0?\.\d+\s*\)/
    );

    // **And it really stays**, which is what a visitor sees rather than what the stylesheet says.
    // Run on both surfaces for the same reason the computed reads are.
    for (const surface of CHROME_SURFACES) {
      await goTo(page, surface.route, surface.status);

      const height = (await header.boundingBox())?.height ?? 0;
      expect(height, `the header on ${surface.route} has no height`).toBeGreaterThan(0);

      // **A surface with nothing below the fold has nothing to scroll past.** Rather than skip the
      // 404, whose render path is half the reason this loops, a spacer is planted through the
      // browser to give the document a scroll range. Planted only where it is needed and logged
      // when it is, because how much content a surface has is a property of that surface rather
      // than of the header, and pinning which one needs it would be a second thing to keep true.
      // The real guard is the poll below: whatever the spacer did or did not do, the page has to
      // have scrolled before the header is asked to have stayed.
      const planted = await page.evaluate(() => {
        if (document.documentElement.scrollHeight > window.innerHeight * 2) return false;
        const spacer = document.createElement('div');
        spacer.id = 'planted-scroll-range';
        spacer.setAttribute('style', 'block-size:300vh;');
        document.body.append(spacer);
        return true;
      });
      if (planted) console.log(`chrome-nav: planted a scroll range on ${surface.route}`);

      const scrollBy = Math.round(height * 3);
      await page.evaluate((distance) => window.scrollTo(0, distance), scrollBy);
      await expect
        .poll(async () => Math.round(await page.evaluate(() => window.scrollY)), {
          message: `${surface.route} did not scroll, so the header had nothing to stay put against`,
        })
        .toBeGreaterThan(0);

      // `boundingBox()` reports `y` in the page's own coordinates, which is the document for a
      // scrolled page, so the viewport-relative edge is read off `getBoundingClientRect()`
      // instead. Reading `y` here would answer the scroll offset for a sticky header and zero for
      // a static one, which is the wrong way round.
      const scrolled = await header.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      });
      expect(
        Math.round(scrolled.top),
        `the header on ${surface.route} moved off the top of the viewport when the page scrolled`
      ).toBe(0);
      expect(
        Math.round(scrolled.height),
        `the header on ${surface.route} shrank on scroll, which EXPERIENCE.md:413-414 forbids ` +
          `along with hiding it`
      ).toBe(Math.round(height));

      // **The control**, taken on each surface rather than once. The same measurement against a
      // header that is not sticky, planted through the browser, has to produce a negative top;
      // without it, a header that happened to be within its own height of the top would read as
      // staying put.
      await page.addStyleTag({ content: '.header-container { position: static !important; }' });
      expect(
        await header.evaluate((node) => node.getBoundingClientRect().top),
        `a header declared static still sits at the top of a scrolled ${surface.route}, so the ` +
          `reading above is about the scroll position rather than about stickiness`
      ).toBeLessThan(0);
    }
  });

  test('keeps a fragment target out from under the sticky header, and only where there is one', async ({
    page,
  }) => {
    // The consequence of making the header sticky that nothing else here covers: it occupies the
    // top of the scrollport, so a fragment target, or an element the browser scrolls to the top
    // edge when focus reaches it, lands behind 140px of chrome. `header.scss` answers it with
    // `scroll-padding-block-start` on the root element, which is where the viewport's scroll
    // container reads it from.
    for (const surface of CHROME_SURFACES) {
      await goTo(page, surface.route, surface.status);

      const padding = await page.evaluate(
        () => window.getComputedStyle(document.documentElement).scrollPaddingBlockStart
      );
      const height = (await page.locator('header.header-container').boundingBox())?.height ?? 0;

      expect(
        padding,
        `${surface.route} declares no scroll padding, so a fragment target lands behind the header`
      ).not.toBe('auto');
      // **Equality, not a bound.** `header.scss` declares the minimum and this padding from one
      // Sass variable so the two cannot drift, and measured 2026-09-08 the rendered box is that
      // same 140.00. When Story 2-32 makes the height content-driven the two stop being one
      // number, and this is what says so rather than tolerating the gap in silence.
      expect(
        Number.parseFloat(padding),
        `${surface.route} reserves ${padding} for a header that measures ${height}`
      ).toBe(height);
    }

    // **The control, and it is the surface with no header.** `Header.tsx:12` renders nothing on
    // `/`, which is the one route whose fragments the Hub actually uses, so reserving space there
    // would push `/#suite` and the skip-link's `#main` down by a header that is not present. A
    // rule applied to every route would pass every reading above and be wrong here, which is what
    // makes this a control rather than an extra assertion.
    await goTo(page, '/');
    await expect(page.locator('header')).toHaveCount(0);
    expect(
      await page.evaluate(() => window.getComputedStyle(document.documentElement).scrollPaddingBlockStart),
      'the home route reserves scroll padding for a header it does not render'
    ).toBe('auto');
  });

  test('the two destinations are separately addressable, --s-lg apart', async ({ page }) => {
    // **A-4's independently addressable clause** (`EXPERIENCE.md:763`), which asks whether two
    // adjacent targets are separately hittable as well as big enough. That is a statement about
    // the relationship between two boxes rather than about either one, so the floor case above
    // cannot see it: `judge` in `tests/e2e/hit-target-floor.pw.ts` is per element, and the pairwise
    // case that file already carries is scoped to `.suite-directory__row`. Until Story 2-15 the
    // Directory was the only surface in the Hub putting two targets on one line at 360; the header
    // is the second, and this is the only thing asserting the `gap` at `navbar.scss:21`, which is
    // the rule `RESTYLE-SPEC.md:206` states.
    //
    // Both lengths come from the contract in the running page, never from a literal. `--s-lg` is
    // authored in `rem`, so it is resolved through a probe rather than parsed: a reader-scaled
    // length has no pixel value until something lays it out. Same shape as
    // `tests/e2e/hit-target-floor.pw.ts:1539-1548`.
    for (const surface of CHROME_SURFACES) {
      await goTo(page, surface.route, surface.status);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

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
      expect(
        apartBy,
        `the probe resolved --s-lg to nothing on ${surface.route}, so the comparison is vacuous`
      ).toBeGreaterThan(0);

      const links = page.locator('nav.navbar a');
      expect(await links.count(), `${surface.route} does not render two destinations to compare`).toBe(2);

      const first = await links.nth(0).boundingBox();
      const second = await links.nth(1).boundingBox();
      expect(first && second, `a destination on ${surface.route} has no box, so it cannot be hit`).toBeTruthy();

      for (const [which, box] of [
        ['Suite', first],
        ['CV', second],
      ] as const) {
        expect(
          Math.min(box?.width ?? 0, box?.height ?? 0),
          `${which} on ${surface.route} is under the floor, so this pair is not two targets yet`
        ).toBeGreaterThanOrEqual(floor);
      }

      // The largest separation on either axis. Two boxes that overlap on both axes give a negative
      // answer, which is what makes "not overlapping" and "far enough apart" one comparison.
      expect(
        separation(first, second),
        `the two destinations on ${surface.route} sit ${separation(first, second).toFixed(2)} apart ` +
          `on their separating axis, and --s-lg resolves to ${apartBy.toFixed(2)} here. Two --tap ` +
          `boxes closer than that can overlap, which makes them one target by touch`
      ).toBeGreaterThanOrEqual(apartBy - EDGE_SLACK);
    }

    // **The control.** Take the gap off through the browser and the same comparison has to report
    // the pair as too close, or deleting `gap: var(--s-lg)` from `navbar.scss` would leave every
    // reading above green, which is exactly the state this case was added to end.
    await page.addStyleTag({ content: '.navbar { gap: 0 !important; }' });
    const links = page.locator('nav.navbar a');
    const apartBy = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.position = 'absolute';
      probe.style.inlineSize = 'var(--s-lg)';
      document.body.append(probe);
      const resolved = probe.getBoundingClientRect().width;
      probe.remove();
      return resolved;
    });
    expect(
      separation(await links.nth(0).boundingBox(), await links.nth(1).boundingBox()),
      'the two destinations are still --s-lg apart with the gap removed, so the gap is not what ' +
        'holds them apart and this case is measuring something else'
    ).toBeLessThan(apartBy - EDGE_SLACK);
  });

  test('the Suite destination lands on the home route with the Directory in view', async ({ page }) => {
    // FR-2's in-page anchor, on the journey a visitor on `/work` actually takes. Before Story 2-15
    // this link pointed at `/projects`, and the App Router resolved that redirect itself and
    // dropped the fragment, landing the visitor at the top of the homepage with the Directory
    // roughly 886px below an 800px viewport. That is what DW-55 and DW-58 recorded, and pointing
    // the link at the fragment directly is what closes both.
    await goTo(page, '/work');

    // The premise: `/work` carries no Directory of its own, so a Directory found after the click
    // came from the navigation rather than from the page that was already open.
    await expect(
      page.locator(`#${HEADING_ID}`),
      '/work already carries the Directory heading, so this case cannot show the navigation reached it'
    ).toHaveCount(0);

    await page.locator("nav.navbar a[href='/#suite']").click();

    // **Waited on the URL, not on `load`.** A chrome click is an App Router client-side
    // navigation: no load event fires, so `waitForLoadState('load')` resolves against the document
    // that is already open and every read after it races the router. **Measured 2026-09-08**: the
    // pathname below answered `/work` without this, which is what a click that had not landed yet
    // looks like and is indistinguishable from a link that goes nowhere.
    await expect
      .poll(() => page.url().replace(/^https?:\/\/[^/]+/, ''), {
        message:
          'the Suite link never reached /#suite. The URL is polled rather than waited on, because ' +
          'a client-side navigation fires no load event and a same-route fragment fires no ' +
          'navigation at all',
        timeout: 10_000,
      })
      .toBe(`/#${HEADING_ID}`);

    const landed = new URL(page.url());
    expect(landed.pathname, `the Suite link landed on ${landed.pathname} rather than on /`).toBe('/');
    expect(landed.hash, 'the Suite link lost its fragment on the way to the home route').toBe(`#${HEADING_ID}`);

    const heading = page.locator(`#${HEADING_ID}`);
    await expect(heading, 'nothing on / carries the Directory heading id').toHaveCount(1);
    await expect(heading, 'the fragment resolves to something that is not the Directory heading').toHaveClass(
      /suite-directory__heading/
    );
    await expect(heading, 'the Suite link did not bring the Directory heading into view').toBeInViewport();

    // **The control, and it is the same page asked for without the fragment.** The heading has to
    // be out of view then, or "in view" above is a statement about a short page rather than about
    // the fragment having been applied.
    await goTo(page, '/');
    const unanchored = await page.evaluate((id) => {
      const node = document.getElementById(id);
      return {
        scrollY: Math.round(window.scrollY),
        top: node ? Math.round(node.getBoundingClientRect().top) : null,
        viewport: window.innerHeight,
      };
    }, HEADING_ID);

    expect(unanchored.scrollY, '/ does not open at the top of the document').toBe(0);
    expect(
      (unanchored.top ?? 0) > unanchored.viewport,
      `the Directory heading is at ${unanchored.top} in a ${unanchored.viewport}px viewport with no ` +
        `fragment asked for, so it is above the fold anyway and the reading above proves nothing`
    ).toBe(true);
  });

  test('the CV destination reaches the page it names and starts no download', async ({ page }) => {
    // **This case measured the opposite until 2026-09-10, and it is rewritten rather than deleted.**
    // `/cv` was a 308 to `/pdf/cv.pdf`, so clicking `CV` from `/work` was a client-side navigation
    // into a config redirect whose destination the App Router does not serve, and what the visitor
    // got was a file. Story 2-16 built the page, so the control is now the other way round: the
    // click lands on a document and nothing downloads.
    //
    // Reading the `href` off the DOM, as the first case in this file does, passes for a link the
    // router swallows. This is a real click, on the destination `EXPERIENCE.md:120` calls the likely
    // next one after an opinion has formed.
    await goTo(page, '/work');

    const downloads: Download[] = [];
    page.on('download', (download) => downloads.push(download));

    await page.locator(`nav.navbar a[href='${CV_ROUTE}']`).click();

    // **Polled on the URL, not waited on `load`.** A chrome click is an App Router client-side
    // navigation and fires no load event, so a wait resolves against the document already open and
    // every read after it races the router.
    await expect
      .poll(() => new URL(page.url()).pathname, {
        message:
          'clicking CV from /work reached no new URL. A click the router swallows leaves the ' +
          'visitor on the surface they started from, and every other check in this file would ' +
          'still pass',
        timeout: 15_000,
      })
      .toBe(CV_ROUTE);

    expect(
      downloads.map((download) => download.url()),
      'clicking CV started a download, which is what it did while /cv was a 308 to a PDF'
    ).toEqual([]);

    // A URL is not a rendering. The page has to be there, and it has to be the one whose heading
    // this story built rather than a shell the router pushed a path onto.
    await expect(
      page.getByRole('heading', { level: 1 }),
      'the CV destination landed on a document carrying no h1, so the route answered nothing'
    ).toHaveCount(1);

    // **The control, and it is the mechanism that used to fire here.** The `download` listener has
    // to be capable of reporting one, or "no download" above is a claim about a listener that never
    // works. `/pdf/cv.pdf` is still served at its own URL, which is the other half of what Story
    // 2-16 had to keep true, so asking for it directly is both the control and the check that the
    // file the page links did not move.
    await page.evaluate((href) => {
      const planted = document.createElement('a');
      planted.id = 'planted-pdf-download';
      planted.href = href;
      planted.setAttribute('download', '');
      planted.textContent = 'planted';
      document.body.append(planted);
    }, '/pdf/cv.pdf');

    const started = page.waitForEvent('download', { timeout: 15_000 });
    await page.locator('a#planted-pdf-download').click();
    const download = await started;
    expect(
      download.suggestedFilename(),
      'the planted control reached a different file, so the PDF the page links has moved'
    ).toBe('cv.pdf');
  });

  test('the home route still renders no header at all, which is a different mechanism', async ({ page }) => {
    // Unchanged by this story and asserted here because this is the file that made the header
    // sticky: a sticky header that started rendering on `/` would sit over the hero, and A-6's
    // first-tabbable claim (`app/page.tsx:61-63`) rests on nothing focusable preceding the
    // skip-link. `tests/e2e/celeste-header.pw.ts:166-204` owns the distinction between absence
    // and `display: none`; this is the one line of it that this story could have broken.
    await goTo(page, '/');
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('.home-container'), '/ did not render, so the count above means nothing').toHaveCount(
      1
    );
  });
});
