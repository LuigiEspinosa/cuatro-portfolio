import { test, expect, type Download, type Page } from '@playwright/test';
import { RENDERED_VIEWPORT, rootCustomPropertyValue } from './harness';

/**
 * `/cv`, the page built where a redirect used to be (Story 2-16).
 *
 * `next.config.js` answered this route with a 308 to `/pdf/cv.pdf`, which shadows a route file
 * rather than replacing it, so the stub at `app/cv/page.tsx` had never rendered and clicking `CV`
 * in the header started a download. Four things follow from removing that redirect and none of them
 * was assertable before: the route answers a document, the header's `aria-current` mark has a
 * surface to appear on, the accordion is reachable on a second route, and the intro block's two
 * links are new hit targets.
 *
 * **What this file adds that the others do not.** `tests/e2e/hit-target-floor.pw.ts` sweeps every
 * interactive element on every surface and now includes this one; it says nothing about which
 * destination is marked, whether the first entry is open, or what a click on `CV` reaches.
 * `tests/e2e/chrome-nav.pw.ts` owns the header's shape on the two surfaces that are neither
 * destination, and deliberately keeps its two-surface list: every loop in it assumes the surface is
 * not a destination, and this one is. `tests/e2e/rendered-output.pw.ts` owns the pixels, on `/work`.
 *
 * **No screenshot is taken.** This file writes no snapshot directory, so `keeps exactly one
 * committed baseline` in `tests/e2e/rendered-output.pw.ts:216-223` stays true, and
 * `ops/__tests__/hit-target-floor.test.ts` records why a second one would be a defect. Same
 * precedent as `tests/e2e/celeste-header.pw.ts:24-26` and `tests/e2e/chrome-nav.pw.ts:20-23`.
 *
 * **Every predicate here is watched producing the other answer before its clean reading is
 * believed**, and each control is planted through the browser or is a second request, so nothing is
 * left in the tree.
 */

/** The route this file is about. */
const ROUTE = '/cv';

/** The route that mounts the same timeline standalone, and must go on doing so. */
const WORK = '/work';

/** The static file the removed redirect used to serve, still served at its own URL. */
const CV_PDF = '/pdf/cv.pdf';

/** The header's own selector for the destination that is current here. */
const CV_LINK = "nav.navbar a[href='/cv']";

/** The other destination, which is current on `/` and never here. */
const SUITE_LINK = "nav.navbar a[href='/#suite']";

/** What counts as an interactive element. The same set `tests/e2e/hit-target-floor.pw.ts` sweeps. */
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Navigate, and refuse to read anything off a page that did not answer the status expected.
 *
 * Local rather than shared, on the idiom `tests/e2e/chrome-nav.pw.ts:72-76`,
 * `tests/e2e/celeste-header.pw.ts:36-40` and `tests/e2e/hit-target-floor.pw.ts` already set. DW-22
 * records that this guard now has several implementations and that hoisting it into `harness.ts` is
 * its own change; this is not the story that makes it.
 */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/**
 * The pixel floor, read off `--tap` on `:root` in the running page.
 *
 * Never written here. A hand-written literal is what Story 2-34's conformance gate rejects
 * (`DESIGN.md:654-656`), and a floor restated in a spec file is a floor that drifts from the
 * contract it claims to enforce.
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
 * The computed value of one property, resolved by laying out a probe.
 *
 * A custom property's computed value is its declared token stream, so comparing `--token-accent`
 * read off `:root` against a computed `border-bottom-color` compares a declaration against a
 * resolution. Same shape as `tests/e2e/chrome-nav.pw.ts:122-133`.
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

/**
 * The one control on this surface the AD-19 ledger still exempts.
 *
 * `ops/hit-target-floor.md` carries the row as `chrome-logo` and Story 2-32 closes it: the link is
 * a plain inline `<a>` around a 184 x 66 image, so its own box is the 20px text line box. It is
 * excluded by name here rather than by loosening the floor, and the count of what it excludes is
 * asserted, so a second undersized control cannot inherit the exclusion.
 */
const LEDGER_EXEMPT = '.logo a';

/** One measured box, labelled by what it is, so a failure names the control rather than an index. */
interface Box {
  readonly label: string;
  readonly width: number;
  readonly height: number;
  /** Whether the AD-19 exemption ledger already covers this element on this surface. */
  readonly exempt: boolean;
}

/** Which of a set of boxes fails the floor, and by how much. A predicate, so a plant can drive it. */
const underFloor = (boxes: readonly Box[], floor: number): string[] =>
  boxes
    .filter((box) => box.width < floor || box.height < floor)
    .map(
      (box) =>
        `"${box.label}" measures ${box.width.toFixed(2)} x ${box.height.toFixed(2)}, and the floor ` +
        `is ${floor} on both axes`
    );

/** Every interactive element on the open page, measured, with a label taken off the element. */
const measure = async (page: Page): Promise<Box[]> => {
  const targets = await page.locator(INTERACTIVE).all();
  const boxes: Box[] = [];

  for (const target of targets) {
    const meta = await target.evaluate((node: Element, exemptSelector: string) => {
      const tag = node.tagName.toLowerCase();
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
      const href = node.getAttribute('href');
      return {
        label: `${tag}${href ? `[href=${href}]` : ''}${text ? ` "${text}"` : ''}`,
        exempt: node.matches(exemptSelector),
      };
    }, LEDGER_EXEMPT);
    const box = await target.boundingBox();
    expect(box, `${meta.label} on ${page.url()} has no box at all, so it cannot be hit`).toBeTruthy();
    boxes.push({ label: meta.label, width: box?.width ?? 0, height: box?.height ?? 0, exempt: meta.exempt });
  }

  return boxes;
};

/**
 * Move focus forward with the keyboard until `locator` holds it, or give up and say so.
 *
 * **`locator.focus()` is not usable for a `:focus-visible` reading.** Chromium matches that
 * pseudo-class on a link only when the focus arrived through the keyboard, and a script call does
 * not set that state, so a ring asserted after `element.focus()` would be absent on a correct
 * implementation. Tabbing is what a keyboard visitor does and it is what the rule is written for.
 */
const tabTo = async (page: Page, locator: ReturnType<Page['locator']>, limit = 20): Promise<boolean> => {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((node) => node === document.activeElement)) return true;
  }
  return false;
};

/** Every company heading the timeline renders, in document order. */
const companiesOn = (page: Page) =>
  page
    .locator('.work-item__company')
    .evaluateAll((nodes: Element[]) => nodes.map((node) => (node.textContent ?? '').trim()));

test.describe('/cv answers a document', () => {
  test('is a 200 text/html page with no Location header, where it was a 308 to a PDF', async ({
    request,
  }) => {
    // Read without following, because a client that follows a redirect reports the landing's status
    // and never sees the 3xx. That is the shape `tests/e2e/projects-redirect.pw.ts` established and
    // it is the only shape in which "this is no longer a redirect" is a measurement.
    const response = await request.get(ROUTE, { maxRedirects: 0 });

    expect(response.status(), `${ROUTE} answered ${response.status()} rather than a rendered page`).toBe(200);
    expect(response.headers()['location'] ?? '', `${ROUTE} still redirects`).toBe('');
    expect(response.headers()['content-type'] ?? '', `${ROUTE} does not answer HTML`).toMatch(/^text\/html/);

    // **The control, and it is the redirect that survives.** `/recommendation` is still
    // `permanent: true`, so the same reader on the same build has to report a 308 and a `Location`.
    // Without it, a reader that had stopped seeing redirects at all would look exactly like this.
    const surviving = await request.get('/recommendation', { maxRedirects: 0 });
    expect(surviving.status(), '/recommendation no longer answers the 308 permanent: true emits').toBe(308);
    expect(surviving.headers()['location'] ?? '', '/recommendation no longer names its PDF').toBe(
      '/pdf/recommendation-letter.pdf'
    );

    // And the file the removed redirect used to serve is still served, because people hold that URL.
    const pdf = await request.get(CV_PDF, { maxRedirects: 0 });
    expect(pdf.status(), `${CV_PDF} is no longer served, so removing the redirect cost the artefact`).toBe(200);
    expect(pdf.headers()['content-type'] ?? '', `${CV_PDF} is not a PDF any more`).toMatch(/^application\/pdf/);
  });

  test('paints the base body rule, which no id override reaches on this surface', async ({ page }) => {
    // `Body` writes the stripped pathname onto `<body id>`, and `body#cv` matches none of
    // `body#work` (`app/app.scss`), `body[id='']` (`HomeLayout.scss`) or `#celeste`
    // (`celeste.scss`), so the base rule paints. The 404 was the only such surface until this story
    // and three records said so; this is the reading that makes the correction a measurement.
    await goTo(page, ROUTE);

    expect(await page.evaluate(() => document.body.id), '/cv no longer derives its own body id').toBe('cv');

    const ground = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    const image = await page.evaluate(() => window.getComputedStyle(document.body).backgroundImage);

    expect(
      image,
      'body on /cv paints a background image, so one of the grid-ground rules now matches this id ' +
        'and the base rule is not what is being read'
    ).toBe('none');
    expect(ground, 'the ground where the base rule paints is not --token-bg').toBe(
      await probeComputed(page, 'background-color:var(--token-bg);', 'background-color')
    );

    // **The control**, and it is the surface next door. `/work` really does override the base rule,
    // so the same two reads have to answer differently there, or this says nothing about `/cv`.
    await goTo(page, WORK);
    expect(
      await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor),
      'body#work no longer overrides the base ground, so the reading on /cv is not about an override'
    ).not.toBe(ground);
  });
});

test.describe('the header marks this surface as the current page', () => {
  test('marks CV and only CV, with the accent rule on the inner span', async ({ page }) => {
    // **The first live `aria-current` in the repository.** `Navbar.tsx` has compared the pathname
    // against `/cv` since Story 2-15 with nothing to match: `Suite` is current only on `/`, where
    // no header renders at all. `tests/e2e/chrome-nav.pw.ts` plants the mark to control its own
    // absence claim; this is the real one.
    await goTo(page, ROUTE);

    await expect(page.locator(CV_LINK), '/cv renders no CV destination').toHaveCount(1);
    await expect(page.locator(CV_LINK), 'the CV destination is not marked as the current page').toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(
      page.locator(SUITE_LINK),
      'the Suite destination claims to be the current page on /cv'
    ).not.toHaveAttribute('aria-current', /.*/);

    // Exactly one thing in the header announces itself, so a second mark arriving is a failure
    // rather than a second passing lookup.
    const marks = await page
      .locator('header [aria-current]')
      .evaluateAll((nodes: Element[]) => nodes.map((node) => node.getAttribute('aria-current')));
    expect(marks, 'the header marks something other than exactly one current destination').toEqual(['page']);

    // The rule the mark paints, on the inner span rather than on the `--tap` box
    // (`RESTYLE-SPEC.md:198-199`), compared against the same declarations resolved on a probe.
    const rule = await page.locator(`${CV_LINK} .navbar__label`).evaluate((node) => ({
      width: window.getComputedStyle(node).borderBottomWidth,
      color: window.getComputedStyle(node).borderBottomColor,
      style: window.getComputedStyle(node).borderBottomStyle,
    }));

    expect(rule.style, 'the current-route mark is not a drawn rule').toBe('solid');
    expect(rule.width, 'the current-route mark is not --stroke-emphasis wide').toBe(
      await probeComputed(page, 'border-bottom:var(--stroke-emphasis) solid red;', 'border-bottom-width')
    );
    expect(rule.color, 'the current-route mark is not painted in --token-accent').toBe(
      await probeComputed(page, 'color:var(--token-accent);', 'color')
    );
    expect(
      await page.locator(CV_LINK).evaluate((node) => window.getComputedStyle(node).borderBottomWidth),
      'the mark is drawn on the --tap box rather than on the inner span'
    ).toBe('0px');

    // **The control for the rule.** The unmarked destination's label carries no such border, so the
    // three comparisons above are about `aria-current` and not about every label in the nav.
    expect(
      await page
        .locator(`${SUITE_LINK} .navbar__label`)
        .evaluate((node) => window.getComputedStyle(node).borderBottomStyle),
      'the unmarked destination is underlined too, so the rule is not keyed on the current route'
    ).toBe('none');

    // **And the control for the probe**, which would make either colour comparison vacuous if it
    // answered the same string for every input. A different token from the same family has to
    // resolve differently.
    expect(
      await probeComputed(page, 'color:var(--token-accent);', 'color'),
      'the colour probe answers the same for --token-accent and --token-text, so comparing against ' +
        'it says nothing about which role the mark is painted in'
    ).not.toBe(await probeComputed(page, 'color:var(--token-text);', 'color'));
  });

  test('arrives here by a click on CV from /work, and downloads nothing on the way', async ({ page }) => {
    // The journey. Clicking `CV` started a download until 2026-09-10, which is what
    // `tests/e2e/chrome-nav.pw.ts` measured; what this adds is the state the visitor arrives in. A
    // chrome click is an App Router client-side navigation, so `usePathname` re-answers rather than
    // the document being rebuilt, and a mark derived from it could be right on a fresh request and
    // stale after a click.
    await goTo(page, WORK);

    await expect(
      page.locator(`${CV_LINK}[aria-current]`),
      '/work marks the CV destination before the click, so the mark below is not the arrival'
    ).toHaveCount(0);

    const downloads: Download[] = [];
    page.on('download', (download) => downloads.push(download));

    await page.locator(CV_LINK).click();

    await expect
      .poll(() => new URL(page.url()).pathname, {
        message:
          'clicking CV from /work reached no new URL. A click the router swallows leaves the ' +
          'visitor where they started, and a check that only read the href would still pass',
        timeout: 15_000,
      })
      .toBe(ROUTE);

    expect(
      downloads.map((download) => download.url()),
      'clicking CV started a download, which is what it did while /cv was a 308 to a PDF'
    ).toEqual([]);

    await expect(
      page.locator(`${CV_LINK}[aria-current='page']`),
      'the current-page mark did not follow a client-side navigation onto the surface it names'
    ).toHaveCount(1);
    await expect(
      page.getByRole('heading', { level: 1 }),
      'the click landed on a URL and not on a document'
    ).toHaveCount(1);
  });
});

test.describe('the timeline is reachable on this surface', () => {
  test('opens the first entry with a panel taller than zero, before any click', async ({ page }) => {
    // **The defect this closes is in the server output, not in the effect.** `WorkItem` used to
    // write `height: 0` into every panel unconditionally, so the open entry was collapsed until
    // hydration and stayed collapsed with scripting off. The markup half is asserted in
    // `app/cv/__tests__/page.test.tsx`, where a browser cannot hide it by hydrating first; this is
    // the reading a visitor gets.
    await goTo(page, ROUTE);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const triggers = page.locator('button.work-item__header');
    const count = await triggers.count();
    expect(count, '/cv renders no accordion trigger, so nothing below is measured').toBeGreaterThan(0);

    const expanded = await triggers.evaluateAll((nodes: Element[]) =>
      nodes.map((node) => node.getAttribute('aria-expanded'))
    );
    expect(expanded[0], 'the first entry does not announce itself as open').toBe('true');
    expect(
      expanded.slice(1),
      'more than one entry announces itself as open, so the panel heights below are ambiguous'
    ).toEqual(Array(count - 1).fill('false'));

    // Every trigger's `aria-controls` resolves to a panel that exists. Nothing asserted this
    // anywhere before Story 2-16, so a typo in either half of `${entry.id}-content` was invisible.
    const dangling = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-controls]')]
        .map((node) => node.getAttribute('aria-controls') ?? '')
        .filter((id) => id === '' || document.getElementById(id) === null)
    );
    expect(dangling, 'a trigger names a panel id no element on the page carries').toEqual([]);

    const heights = await page
      .locator('.work-item__content')
      .evaluateAll((nodes: Element[]) => nodes.map((node) => node.getBoundingClientRect().height));

    expect(heights.length, 'no panel rendered').toBe(count);
    expect(heights[0], 'the open entry has no height, so its detail is not on the page').toBeGreaterThan(0);

    // **The control, and it is the other three panels.** They are closed and must measure zero, or
    // "taller than zero" above is a statement about every panel rather than about the open one.
    expect(
      heights.slice(1).filter((height) => height > 0),
      'a closed panel has height, so the accordion is not collapsing anything and the reading above ' +
        'is not about the open entry'
    ).toEqual([]);
  });

  test('renders the same four companies /work does, and /work still renders them alone', async ({
    page,
  }) => {
    // **One timeline per document.** `WorkItem` builds each panel id as `${entry.id}-content`, so a
    // second mount in one page would duplicate all four ids. And `/work` keeps rendering
    // standalone: this story mounts the component on a second route, it does not move it.
    await goTo(page, ROUTE);
    const onCv = await companiesOn(page);
    expect(onCv.length, '/cv renders no company').toBeGreaterThan(0);
    expect(await page.locator('.work-timeline').count(), '/cv mounts the timeline more than once').toBe(1);

    await goTo(page, WORK);
    const onWork = await companiesOn(page);

    expect(onWork, '/work no longer renders the same timeline this story reused').toEqual(onCv);
    expect(await page.locator('.work-timeline').count(), '/work stopped mounting the timeline').toBe(1);

    // **The two routes are not the same document**, which is what makes the equality above a reuse
    // rather than a redirect nobody noticed. `/work` carries the hero and its heading; `/cv` carries
    // neither, and exactly one of them owns the `<h1>` on each.
    expect(await page.locator('.work-hero').count(), '/work no longer renders its hero').toBe(1);
    await goTo(page, ROUTE);
    expect(await page.locator('.work-hero').count(), '/cv renders the hero, so both routes claim one h1').toBe(0);
  });
});

test.describe('every control on /cv is a real target', () => {
  test('measures each interactive element at or above --tap on both axes', async ({ page }) => {
    // A-4 (`EXPERIENCE.md:763`), re-measured here on this surface alone so a failure names the page
    // rather than a sweep. `tests/e2e/hit-target-floor.pw.ts` is the universal instrument and
    // carries the one authored control still under the floor, the chrome logo, in its ledger.
    await goTo(page, ROUTE);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const floor = await floorFrom(page);
    expect(page.viewportSize(), '/cv was not measured at the pinned viewport').toEqual({ ...RENDERED_VIEWPORT });

    const boxes = await measure(page);
    expect(boxes.length, '/cv yielded no interactive element, so this loop is over nothing').toBeGreaterThan(0);

    const swept = boxes.filter((box) => !box.exempt);
    expect(
      boxes.length - swept.length,
      `the ledger exemption ${LEDGER_EXEMPT} no longer matches exactly one element on this surface, ` +
        `so either the logo stopped rendering or a second control is being excused for free`
    ).toBe(1);

    expect(
      underFloor(swept, floor),
      `a control on ${ROUTE} is under the AD-19 floor. The intro block's links are built with ` +
        `min-block-size, min-inline-size and inline-flex for exactly this reason, and vertical ` +
        `padding on a plain inline element would read as compliant here and measure otherwise`
    ).toEqual([]);

    // The intro block's two links are the new targets this story added, so they are named rather
    // than left to a count: a link that stopped rendering would shrink the sweep silently.
    const intro = await page.locator('.cv-intro a[href]').evaluateAll((nodes: Element[]) =>
      nodes.map((node) => node.getAttribute('href'))
    );
    expect(intro.sort(), 'the intro block no longer carries its two destinations').toEqual(['/#suite', CV_PDF]);

    // **The control, and it is this page's own regression.** A link planted into the intro block
    // with the two size floors taken back off measures its line box, which is what every one of
    // these would measure without them.
    //
    // Two things about the plant are deliberate. The label clears the floor on width and is held on
    // one line, so the failure is the **height** alone rather than "it is a small element", which is
    // the case `EXPERIENCE.md:727-732` and `DESIGN.md:645-648` single out. And it is held on one line
    // by `white-space: nowrap` rather than by being short: measured 2026-09-10, a longer label
    // wrapped inside the 256px content area and the union of its two line boxes cleared 44px on
    // height, so the control passed the floor it exists to fail.
    await page.evaluate(() => {
      const host = document.querySelector('.cv-intro');
      if (!host) return;
      const link = document.createElement('a');
      link.href = '#unfloored';
      link.id = 'planted-unfloored-link';
      link.textContent = 'Read the file';
      link.setAttribute(
        'style',
        'display:inline;min-block-size:0;min-inline-size:0;padding-inline:0;' +
          'font-size:16px;line-height:20px;white-space:nowrap;'
      );
      host.append(link);
    });

    const plantedBox = await page.locator('a#planted-unfloored-link').boundingBox();
    expect(plantedBox, 'the unfloored control was not laid out at all').toBeTruthy();

    const reported = underFloor(
      [
        {
          label: 'planted unfloored link',
          width: plantedBox?.width ?? 0,
          height: plantedBox?.height ?? 0,
          exempt: false,
        },
      ],
      floor
    );
    expect(reported, 'the floor predicate does not fire on a link with the floors removed').toHaveLength(1);
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

  test('gives both intro links a focus ring that is not the hover treatment', async ({ page }) => {
    // `RESTYLE-SPEC.md:200-203`: hover recolours the existing underline and never changes its width;
    // focus draws the standard ring, which is an outline and therefore costs no layout. The two are
    // different signals, and a component that painted one for both would pass any check that read
    // only one of them.
    await goTo(page, ROUTE);

    const links = page.locator('.cv-intro a[href]');
    const count = await links.count();
    expect(count, '/cv renders no intro link, so nothing is measured here').toBe(2);

    for (let index = 0; index < count; index += 1) {
      // Reloaded per link, so each reading starts from an unfocused document and the tab count
      // below is from the top of the page rather than from wherever the previous link left off.
      await goTo(page, ROUTE);

      const link = links.nth(index);
      const label = (await link.textContent())?.trim() ?? `link ${index}`;

      const resting = await link.evaluate((node) => window.getComputedStyle(node).outlineStyle);
      expect(resting, `"${label}" draws a focus ring at rest`).toBe('none');

      expect(
        await tabTo(page, link),
        `"${label}" was never reached by tabbing forward from the top of /cv, so it is out of the ` +
          `keyboard order or something ahead of it traps focus`
      ).toBe(true);

      const focused = await link.evaluate((node) => ({
        style: window.getComputedStyle(node).outlineStyle,
        width: window.getComputedStyle(node).outlineWidth,
        color: window.getComputedStyle(node).outlineColor,
      }));

      expect(focused.style, `"${label}" draws no ring on focus`).toBe('solid');
      expect(focused.width, `"${label}"'s ring is not --stroke-focus wide`).toBe(
        await probeComputed(page, 'outline:var(--stroke-focus) solid red;', 'outline-width')
      );
      expect(focused.color, `"${label}"'s ring is not painted in --token-focus`).toBe(
        await probeComputed(page, 'color:var(--token-focus);', 'color')
      );
      expect(focused.color, `"${label}"'s ring is the hover colour rather than the focus role`).not.toBe(
        await probeComputed(page, 'color:var(--token-accent-hover);', 'color')
      );
    }

    // **The control.** Take the rule off through the browser, reach the same link the same way, and
    // the read has to report no ring, or `outlineStyle` is answering `solid` for something other
    // than the declaration in `CvIntro.scss` and the readings above are about a browser default.
    await goTo(page, ROUTE);
    await page.addStyleTag({ content: '.cv-intro__link:focus-visible { outline: none !important; }' });
    expect(await tabTo(page, links.first()), 'the first intro link left the keyboard order').toBe(true);
    expect(
      await links.first().evaluate((node) => window.getComputedStyle(node).outlineStyle),
      'the ring survives its own rule being overridden, so it is not the rule this file asserts'
    ).toBe('none');
  });
});
