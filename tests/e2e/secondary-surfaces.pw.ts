import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rootCustomPropertyValue } from './harness';

/**
 * The secondary surfaces: the retired `/recommendation`, the footer's one link, `/celeste`, and the
 * 404's exits (Story 2-17). Plus A-13, asserted across every surface for the first time.
 *
 * Three routes off the homepage read as half-built until this story. `/recommendation` was a 308
 * to a PDF shadowing a stub that had never rendered, and nothing linked it. `/celeste` was reachable
 * from nowhere and carried no `robots` directive, while the footer that was meant to be its only
 * entry rendered no link. The 404 offered one exit where the header offers two. And A-13, a
 * distinct `<title>` and `lang` on every surface, held everywhere by accident and was asserted
 * nowhere.
 *
 * **What this file adds that the others do not.** `tests/e2e/hit-target-floor.pw.ts` sweeps every
 * control on every surface against the floor and now counts the footer link and both exits; it
 * says nothing about where the link goes, which surfaces carry one, what the 404's exits are, or
 * whether they equal the header's. `tests/e2e/projects-redirect.pw.ts` and `tests/e2e/cv.pw.ts`
 * read the framework's `/cv/` 308 as their status control; neither reads what `/recommendation`
 * answers now. `tests/e2e/celeste-header.pw.ts` owns the header suppression on `/celeste` and is
 * left alone; this file re-reads that one `display` value only as the premise for the claim that
 * the page has no visible control at all. `tests/e2e/chrome-nav.pw.ts` owns the header's pair and
 * its two click landings; the same readings are made here on the 404's pair, which is the same two
 * destinations rendered by a different component.
 *
 * **No screenshot is taken.** This file writes no snapshot directory, so `keeps exactly one
 * committed baseline` in `tests/e2e/rendered-output.pw.ts:216-223` stays true. Same precedent as
 * `tests/e2e/cv.pw.ts:21-24`.
 *
 * **Every predicate here is watched producing the other answer before its clean reading is
 * believed**, and each control is planted through the browser or is a second request, so nothing
 * is left in the tree.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here.
// Same as `tests/e2e/hit-target-floor.pw.ts:62`.
const REPO_ROOT = resolve(__dirname, '..', '..');

/** The route Story 2-17 retired. It answers the 404 document now, like any other unrouted path. */
const RETIRED = '/recommendation';

/** The file the retired redirect used to serve, still served at its own URL because people hold it. */
const RETIRED_PDF = '/pdf/recommendation-letter.pdf';

/** A path the Hub does not route, which renders `app/not-found.tsx`. Same as `hit-target-floor.pw.ts`. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/** The one route the footer links, and the one route the footer is the only way onto. */
const CELESTE = '/celeste';

/** The Directory heading's own id, which is what makes `/#suite` resolve (`SuiteDirectory.tsx:137`). */
const HEADING_ID = 'suite';

/** The 404's exits, which are the header's two destinations rendered by `Error404.tsx`. */
const EXITS = '.error-page a[href]';

/** The footer's one link. */
const FOOTER_LINK = 'footer.site-footer a[href]';

/**
 * Every surface that renders Hub markup, with the status each answers.
 *
 * The same five `SURFACES` in `tests/e2e/hit-target-floor.pw.ts` carries, minus its per-surface
 * counts, which are that file's subject. `/recommendation` is deliberately absent: it renders the
 * 404 document, so it is `NOT_FOUND` under another URL and not a sixth surface, which is also why
 * the A-13 title comparison below is over five values rather than six.
 *
 * **A hand copy, held equal to that file's list by a case below.** That file derives its own list
 * from `app/` in a standing case, so the chain from disk reaches this list without a second walker.
 */
const SURFACES = [
  { route: '/', status: 200 },
  { route: '/work', status: 200 },
  { route: '/cv', status: 200 },
  { route: CELESTE, status: 200 },
  { route: NOT_FOUND, status: 404 },
] as const;

/**
 * What counts as an interactive element on `/celeste`, which is the surface asserted to have none.
 *
 * The same seven element types `tests/e2e/cv.pw.ts:60` reads, for the same reason: the universal
 * instrument with its full role list is `tests/e2e/hit-target-floor.pw.ts`, which already sweeps
 * `/celeste` and pins that all three of its candidates are hidden. This is the local claim.
 */
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Sub-pixel slack on the separation comparison alone, never on the floor. Same figure and same
 * reason as `tests/e2e/chrome-nav.pw.ts:164`.
 */
const EDGE_SLACK = 0.5;

/**
 * Navigate, and refuse to read anything off a page that did not answer the status expected.
 *
 * Local rather than shared, on the idiom `tests/e2e/cv.pw.ts:70-74` and the files it cites set.
 * DW-22 records that this guard now has several implementations and that hoisting it into
 * `harness.ts` is its own change; this is not the story that makes it.
 */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/** One response, read without following: the status, the `Location` header or `''`, and the type. */
interface Answer {
  readonly status: number;
  readonly location: string;
  readonly type: string;
}

/** Ask for a path and report what came back, refusing to follow anything. Same as `projects-redirect.pw.ts`. */
const answerFor = async (request: APIRequestContext, path: string): Promise<Answer> => {
  const response = await request.get(path, { maxRedirects: 0 });
  return {
    status: response.status(),
    location: response.headers()['location'] ?? '',
    type: response.headers()['content-type'] ?? '',
  };
};

/**
 * The pixel floor, read off `--tap` on `:root` in the running page. Never written here
 * (`DESIGN.md:654-656`). Same as `tests/e2e/cv.pw.ts:83-92`.
 */
const floorFrom = async (page: Page): Promise<number> => {
  const declared = await rootCustomPropertyValue(page, '--tap');
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(declared.trim());
  const value = match ? Number(match[1]) : Number.NaN;
  expect(Number.isFinite(value) && value > 0, `--tap reads "${declared}", which is not a positive length in pixels`).toBe(
    true
  );
  return value;
};

/**
 * The computed value of one property, resolved by laying out a probe.
 *
 * A custom property's computed value is its declared token stream, so comparing `--token-focus`
 * read off `:root` against a computed `outline-color` compares a declaration against a resolution.
 * Same shape as `tests/e2e/cv.pw.ts:101-112`.
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
 * `--s-lg` resolved to pixels by laying a probe out, never parsed: it is authored in `rem`, so it
 * has no pixel value until something lays it out. Same as `tests/e2e/chrome-nav.pw.ts:608-616`.
 */
const gapFrom = async (page: Page): Promise<number> => {
  const apartBy = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.inlineSize = 'var(--s-lg)';
    document.body.append(probe);
    const resolved = probe.getBoundingClientRect().width;
    probe.remove();
    return resolved;
  });
  expect(apartBy, 'the probe resolved --s-lg to nothing, so the separation comparison is vacuous').toBeGreaterThan(0);
  return apartBy;
};

/** What `boundingBox()` answers, including the `null` a detached or invisible element gives. */
type MaybeBox = { x: number; y: number; width: number; height: number } | null;

/**
 * The largest separation between two boxes on either axis. Two boxes that overlap on both axes
 * give a negative answer, which is what makes "not overlapping" and "far enough apart" one
 * comparison. Same as `tests/e2e/chrome-nav.pw.ts:177-185`.
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

/**
 * Move focus forward with the keyboard until `locator` holds it, or give up and say so.
 *
 * `locator.focus()` is not usable for a `:focus-visible` reading: Chromium matches that pseudo-class
 * on a link only when the focus arrived through the keyboard. Same as `tests/e2e/cv.pw.ts:174-180`.
 */
const tabTo = async (page: Page, locator: Locator, limit = 30): Promise<boolean> => {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((node) => node === document.activeElement)) return true;
  }
  return false;
};

/** Label and `href` of every anchor `selector` matches, in document order. */
const pairsOn = (page: Page, selector: string): Promise<[string, string][]> =>
  page
    .locator(selector)
    .evaluateAll((nodes: Element[]) =>
      nodes.map((node) => [(node.textContent ?? '').replace(/\s+/g, ' ').trim(), node.getAttribute('href') ?? ''])
    );

/** Which of a set of boxes fails the floor, and by how much. A predicate, so a plant can drive it. */
const underFloor = (boxes: readonly { label: string; width: number; height: number }[], floor: number): string[] =>
  boxes
    .filter((box) => box.width < floor || box.height < floor)
    .map((box) => `"${box.label}" measures ${box.width.toFixed(2)} x ${box.height.toFixed(2)}, and the floor is ${floor}`);

/** Every element `selector` matches, measured, labelled by its text. */
const measure = async (page: Page, selector: string): Promise<{ label: string; width: number; height: number }[]> => {
  const targets = await page.locator(selector).all();
  const boxes: { label: string; width: number; height: number }[] = [];
  for (const target of targets) {
    const label = ((await target.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const box = await target.boundingBox();
    expect(box, `"${label}" on ${page.url()} has no box at all, so it cannot be hit`).toBeTruthy();
    boxes.push({ label, width: box?.width ?? 0, height: box?.height ?? 0 });
  }
  return boxes;
};

/** The `content` of every `<meta name="robots">` in the document head, in order. */
const robotsOn = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('head meta[name="robots"]')].map((node) => node.getAttribute('content') ?? '')
  );

/** The `content` of the `og:title` meta in the document head, or `''` when there is none. */
const ogTitleOn = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '');

/**
 * Every anchor on the open page whose **resolved** pathname is `/celeste`, each classified as inside
 * the home footer or elsewhere.
 *
 * Matched on `HTMLAnchorElement.href`, which the browser has already resolved against the document,
 * rather than on the `href` attribute: a second entrance written as `/celeste/`, `/celeste#x`,
 * `/celeste?x` or the absolute `https://cuatro.dev/celeste` is exactly the accidental link this
 * exists to catch, and an attribute-equality locator sees none of those. A trailing slash is
 * stripped because Next answers `/celeste/` with a 308 to `/celeste`, so it is the same entrance.
 */
const celesteLinksOn = (page: Page): Promise<string[]> =>
  page.evaluate(
    (route) =>
      [...document.querySelectorAll('a[href]')]
        .filter((node) => {
          const pathname = new URL((node as HTMLAnchorElement).href).pathname;
          return (pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname) === route;
        })
        .map((node) => `${node.closest('footer.site-footer') ? 'footer' : 'elsewhere'}: ${node.outerHTML.slice(0, 80)}`),
    CELESTE
  );

test.describe('the surface list', () => {
  test('equals the swept surfaces in hit-target-floor.pw.ts, which derives its own from app/', () => {
    // `SURFACES` above is a hand copy. A route added to `app/` fails that file's standing case at
    // its `:813` until it is registered there, and this case fails until it is registered here
    // too, so a new surface cannot skip the A-13 read, the robots read or the single-entrance claim
    // in silence. Read as text with the same regex `ops/__tests__/hit-target-floor.test.ts:226-235`
    // uses on the same literal, rather than imported: the walker is that file's and is not
    // duplicated here. Line endings are normalised first, as that suite's `read` does at its `:57`:
    // the Windows checkout is CRLF and the container reads it as the host wrote it, which is how
    // this case failed on its first run with the regex matching nothing.
    const source = readFileSync(join(REPO_ROOT, 'tests', 'e2e', 'hit-target-floor.pw.ts'), 'utf8').replace(
      /\r\n/g,
      '\n'
    );
    const block = /const SURFACES = \[\n([\s\S]*?)\n\] as const;/.exec(source)?.[1];
    expect(block, 'hit-target-floor.pw.ts no longer carries a SURFACES literal this file can read').toBeDefined();

    const entries = [
      ...(block ?? '').matchAll(
        /\{ route: (?:'([^']*)'|(NOT_FOUND)), status: (\d+), entrance: (?:true|false), found: (\d+), skipped: (\d+), measured: (\d+) \},/g
      ),
    ];
    const declared = [...(block ?? '').matchAll(/^\s*\{ route: /gm)].length;
    expect(entries.length, 'the SURFACES literal parsed to no rows, so this comparison is over nothing').toBeGreaterThan(0);
    expect(entries.length, 'the SURFACES literal parsed to fewer rows than it declares, so it was reflowed').toBe(declared);

    const theirs = entries.map((match) => `${match[1] ?? NOT_FOUND} ${match[3]}`).sort();
    const ours = SURFACES.map((surface) => `${surface.route} ${surface.status}`).sort();
    expect(ours, 'this file sweeps a different set of surfaces from hit-target-floor.pw.ts').toEqual(theirs);

    // The parser, on a planted control: a row this file does not carry has to show up as a
    // difference, or an equal result above is two empty lists agreeing.
    const planted = [...theirs, '/planted 200'].sort();
    expect(planted, 'the comparison does not see a planted extra surface').not.toEqual(ours);
  });
});

test.describe('the retired route', () => {
  test('/recommendation answers the 404 document with the two exits, and the PDF stays at its own URL', async ({
    page,
    request,
  }) => {
    // Read without following, because a client that follows reports a landing and never sees a
    // 3xx. That is the only shape in which "this is no longer a redirect" is a measurement.
    const retired = await answerFor(request, RETIRED);
    expect(retired.status, `${RETIRED} answered ${retired.status} rather than 404`).toBe(404);
    expect(retired.location, `${RETIRED} still carries a Location header`).toBe('');
    expect(retired.type, `${RETIRED} does not answer HTML`).toMatch(/^text\/html/);

    // **The control for the reader, and it is the redirect that survives.** `/cv/` answers 308 to
    // `/cv` from Next's own trailing-slash row, so the same reader on the same build has to report
    // a 3xx and a `Location`, or a reader that had stopped seeing redirects at all would look
    // exactly like the clean reading above.
    const framework = await answerFor(request, '/cv/');
    expect(framework.status, '/cv/ no longer answers the 308 Next emits for a trailing slash').toBe(308);
    expect(framework.location, '/cv/ no longer names its slashless form').toBe('/cv');
    expect(framework.status, 'the two readings answer the same status, so 404 says nothing').not.toBe(retired.status);

    // The file the removed redirect used to serve is still served. NFR-2: people hold this URL.
    const pdf = await answerFor(request, RETIRED_PDF);
    expect(pdf.status, `${RETIRED_PDF} is no longer served, so retiring the route cost the artefact`).toBe(200);
    expect(pdf.type, `${RETIRED_PDF} is not a PDF any more`).toMatch(/^application\/pdf/);

    // And the document a browser gets is `Error404`, with its two exits: the retired URL is the 404
    // surface under another name, not a blank 404 and not a stub.
    await goTo(page, RETIRED, 404);
    await expect(page.locator('.error-page'), `${RETIRED} did not render Error404`).toHaveCount(1);
    await expect(page.locator('.error-page__code')).toHaveText('404');
    expect(await pairsOn(page, EXITS), `${RETIRED} renders exits other than the header's`).toEqual(
      await pairsOn(page, 'nav.navbar a')
    );
  });
});

test.describe('the footer link', () => {
  test('/celeste is linked from the home footer, once, inside the footer landmark, at the floor', async ({ page }) => {
    await goTo(page, '/');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const inFooter = page.locator(FOOTER_LINK);
    await expect(inFooter, 'the footer renders something other than exactly one link').toHaveCount(1);
    await expect(inFooter, 'the footer link does not point at /celeste').toHaveAttribute('href', CELESTE);
    await expect(inFooter, 'the footer link is not labelled Celeste').toHaveText('Celeste');

    // Inside `<nav aria-label='Footer'>`, which is what tells the landmark apart from `nav.navbar`.
    const landmark = page.locator("footer.site-footer nav[aria-label='Footer']");
    await expect(landmark, 'the footer renders no navigation landmark labelled Footer').toHaveCount(1);
    await expect(landmark.locator('a[href]'), 'the link sits outside the landmark').toHaveCount(1);

    // The floor on both axes. `hit-target-floor.pw.ts` sweeps this too; it is named here so a
    // failure names the link rather than a count on `/`.
    const floor = await floorFrom(page);
    const boxes = await measure(page, FOOTER_LINK);
    expect(underFloor(boxes, floor), 'the footer link is under the AD-19 floor').toEqual([]);

    // **The control for the floor predicate.** A link planted into the footer with the two size
    // floors taken back off measures its own line box, which is what this link would measure
    // without them, and the predicate has to say so.
    //
    // Planted into the `<footer>` and not into the `<nav>`, deliberately. **Measured 2026-09-11**,
    // while the nav was still a flex row: a plant appended there became a flex item, stretched to
    // the row's height beside the real link and measured 44 tall with its floors off, which is a
    // control that passes the floor it exists to fail. The footer is a block container, where a
    // plain inline link gets its own line box, and that is where it stays now the nav is a plain
    // block too.
    await page.evaluate(() => {
      const host = document.querySelector('footer.site-footer');
      if (!host) return;
      const link = document.createElement('a');
      link.href = '#unfloored';
      link.id = 'planted-unfloored-link';
      link.textContent = 'planted unfloored link';
      link.setAttribute(
        'style',
        'display:inline;min-block-size:0;min-inline-size:0;padding:0;font-size:16px;line-height:20px;white-space:nowrap;'
      );
      host.append(link);
    });
    const planted = await measure(page, 'a#planted-unfloored-link');
    expect(planted, 'the unfloored control was not laid out').toHaveLength(1);
    expect(planted[0].height, 'the unfloored control clears the floor, so it controls nothing').toBeLessThan(floor);
    expect(underFloor(planted, floor), 'the floor predicate does not fire on the unfloored control').toHaveLength(1);
  });

  test('takes the Secondary treatment: a hairline on the inner span, a recolour on hover, the standard ring on focus', async ({
    page,
  }) => {
    // `RESTYLE-SPEC.md:191` fixes the Secondary link: secondary text, `--stroke-hair` in
    // `--token-border-interactive` on an inner span, hover to `--token-accent-hover`, the standard
    // ring on focus. `SiteFooter.scss` declares all four and nothing read any of them back in a
    // browser until this case. Every expectation is a probe resolved in the same page, never a
    // literal, on the shape `tests/e2e/cv.pw.ts:678-731` and `tests/e2e/suite-directory.pw.ts:503`
    // set.
    await goTo(page, '/');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const link = page.locator(FOOTER_LINK);
    const label = link.locator('.site-footer__label');
    await expect(label, 'the footer link carries no inner span for the rule to be drawn on').toHaveCount(1);

    // The rule, on the span and not on the tap box (`RESTYLE-SPEC.md:198-199`): a border on the
    // box sits at the bottom of the padding that gets the box to the floor.
    const rule = await label.evaluate((node) => ({
      width: window.getComputedStyle(node).borderBottomWidth,
      style: window.getComputedStyle(node).borderBottomStyle,
      colour: window.getComputedStyle(node).borderBottomColor,
    }));
    expect(rule.style, 'the footer link is not underlined by a drawn rule').toBe('solid');
    expect(rule.width, 'the footer underline is not --stroke-hair wide').toBe(
      await probeComputed(page, 'border-bottom:var(--stroke-hair) solid red;', 'border-bottom-width')
    );
    expect(rule.colour, 'the footer underline at rest is not --token-border-interactive').toBe(
      await probeComputed(page, 'color:var(--token-border-interactive);', 'color')
    );
    expect(
      await link.evaluate((node) => window.getComputedStyle(node).borderBottomWidth),
      'the underline is drawn on the --tap box rather than on the inner span'
    ).toBe('0px');
    expect(await link.evaluate((node) => window.getComputedStyle(node).color), 'the footer link is not secondary text').toBe(
      await probeComputed(page, 'color:var(--token-text-secondary);', 'color')
    );

    // **The control for the probe**, which would make every colour comparison vacuous if it
    // answered the same string for every input.
    const hover = await probeComputed(page, 'color:var(--token-accent-hover);', 'color');
    expect(hover, 'the probe answers alike for --token-accent-hover and --token-border-interactive').not.toBe(
      rule.colour
    );

    // Hover recolours the rule and changes its width by nothing (`RESTYLE-SPEC.md:200-201`).
    await page.mouse.move(0, 0);
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    // Past the longest duration the contract declares, under reduced motion. Same wait
    // `tests/e2e/suite-directory.pw.ts:531-535` takes.
    await page.waitForTimeout(100);
    const hovered = await label.evaluate((node) => ({
      width: window.getComputedStyle(node).borderBottomWidth,
      colour: window.getComputedStyle(node).borderBottomColor,
    }));
    expect(hovered.colour, 'the footer underline does not recolour to --token-accent-hover on hover').toBe(hover);
    expect(hovered.width, 'the footer underline changes width on hover, which reflows the line').toBe(rule.width);
    await page.mouse.move(0, 0);

    // Focus draws the standard ring, reached by tabbing because `:focus-visible` does not match a
    // scripted focus. It is not the hover colour: two signals, not one.
    await goTo(page, '/');
    const resting = await link.evaluate((node) => window.getComputedStyle(node).outlineStyle);
    expect(resting, 'the footer link draws a focus ring at rest').toBe('none');
    expect(await tabTo(page, link), 'the footer link was never reached by tabbing from the top of /').toBe(true);
    const focused = await link.evaluate((node) => ({
      style: window.getComputedStyle(node).outlineStyle,
      width: window.getComputedStyle(node).outlineWidth,
      colour: window.getComputedStyle(node).outlineColor,
    }));
    expect(focused.style, 'the footer link draws no ring on focus').toBe('solid');
    expect(focused.width, "the footer link's ring is not --stroke-focus wide").toBe(
      await probeComputed(page, 'outline:var(--stroke-focus) solid red;', 'outline-width')
    );
    expect(focused.colour, "the footer link's ring is not painted in --token-focus").toBe(
      await probeComputed(page, 'color:var(--token-focus);', 'color')
    );
    expect(focused.colour, "the footer link's ring is the hover colour rather than the focus role").not.toBe(hover);

    // **The control for the ring.** Take the rule off through the browser, reach the link the same
    // way, and the read has to report no ring, or `outlineStyle` is answering `solid` for something
    // other than the declaration in `SiteFooter.scss`.
    await goTo(page, '/');
    await page.addStyleTag({ content: '.site-footer__link:focus-visible { outline: none !important; }' });
    expect(await tabTo(page, link), 'the footer link left the keyboard order').toBe(true);
    expect(
      await link.evaluate((node) => window.getComputedStyle(node).outlineStyle),
      'the ring survives its own rule being overridden, so it is not the rule this case asserts'
    ).toBe('none');
  });

  test('and nothing else on any surface links /celeste', async ({ page }) => {
    // `EXPERIENCE.md:115-123` puts `/celeste` in the footer and nowhere else. The claim is over
    // every surface, because a second entrance is exactly the kind of thing that arrives in one
    // component while every other file's tests stay green.
    const found = new Map<string, string[]>();

    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      found.set(surface.route, await celesteLinksOn(page));
    }

    expect(found.size, 'no surface was visited').toBe(SURFACES.length);
    expect(found.get('/'), 'the home footer does not carry the one link').toHaveLength(1);
    expect(found.get('/')?.[0], 'the home link is outside the footer').toMatch(/^footer: /);

    const elsewhere = [...found]
      .filter(([route, links]) => route !== '/' && links.length > 0)
      .map(([route, links]) => `${route}: ${links.join(' | ')}`);
    expect(elsewhere, `a surface other than the home footer links ${CELESTE}:\n${elsewhere.join('\n')}`).toEqual([]);

    // **Two controls, both planted into the 404 body and read through the same function.** The
    // relative form has to be seen as `elsewhere`, or an empty result above is a reader that
    // matches nothing. And the absolute form with a trailing slash has to be seen too, because that
    // is the shape an attribute-equality locator misses and the reason the reader resolves the
    // pathname instead.
    await goTo(page, NOT_FOUND, 404);
    await page.evaluate((route) => {
      const relative = document.createElement('a');
      relative.href = route;
      relative.textContent = 'planted relative';
      document.body.append(relative);
      const absolute = document.createElement('a');
      absolute.href = `${window.location.origin}${route}/`;
      absolute.textContent = 'planted absolute';
      document.body.append(absolute);
    }, CELESTE);
    const seen = await celesteLinksOn(page);
    expect(seen.map((line) => line.split(':')[0]), 'the second-entrance reader does not see both planted links').toEqual([
      'elsewhere',
      'elsewhere',
    ]);
    expect(seen[1], 'the absolute trailing-slash form was not the second link seen').toContain('planted absolute');
  });
});

test.describe('/celeste has no exit', () => {
  test('renders no visible control, declines indexing, and still hides the header', async ({ page }) => {
    await goTo(page, CELESTE);

    // The premise: the page really rendered, and the header is hidden by the rule
    // `tests/e2e/celeste-header.pw.ts` owns. Re-read here only because "no visible control" on a
    // page whose chrome is hidden is a claim about that rule as much as about the markup.
    await expect(page.locator('h1')).toHaveText(/Te amo/);
    await expect(page.locator('header')).toHaveCount(1);
    expect(await page.locator('header').evaluate((node) => window.getComputedStyle(node).display)).toBe('none');

    // Zero visible interactive elements. The header's three are in the DOM and hidden, which is
    // what `hit-target-floor.pw.ts` pins as `found: 3, skipped: 3`; a visitor can reach none of
    // them, and nothing outside the header is interactive at all.
    const visible = await page.locator(INTERACTIVE).evaluateAll((nodes: Element[]) =>
      nodes.filter((node) => (node as HTMLElement).getClientRects().length > 0).map((node) => node.outerHTML.slice(0, 80))
    );
    expect(visible, `/celeste renders a visible control:\n${visible.join('\n')}`).toEqual([]);

    // `robots: { index: false }` in `app/celeste/page.tsx`, rendered by Next as `noindex`.
    expect(await robotsOn(page), '/celeste does not decline indexing').toEqual(['noindex']);

    // **The control for the visible-control read.** A link planted into the body is visible and
    // has to be counted, or the empty result above is a selector that matches nothing anywhere.
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = '/';
      link.id = 'planted-exit';
      link.textContent = 'planted exit';
      document.body.append(link);
    });
    const withPlant = await page.locator(INTERACTIVE).evaluateAll((nodes: Element[]) =>
      nodes.filter((node) => (node as HTMLElement).getClientRects().length > 0).map((node) => node.id)
    );
    expect(withPlant, 'the visible-control read does not see a planted exit').toEqual(['planted-exit']);
  });

  test('and it is the one routed page with a robots directive', async ({ page }) => {
    // The directive is `/celeste`'s alone among the pages the Hub routes: nothing asks `/`, `/work`
    // or `/cv` to stay out of an index. The 404 is read separately below, because Next injects a
    // `noindex` of its own into a not-found response, which is the framework's and not this
    // story's, and folding it into one loop would either hide that or fail on it.
    const carrying: string[] = [];
    for (const surface of SURFACES.filter((candidate) => candidate.route !== CELESTE && candidate.route !== NOT_FOUND)) {
      await goTo(page, surface.route, surface.status);
      const robots = await robotsOn(page);
      if (robots.length > 0) carrying.push(`${surface.route}: ${robots.join(', ')}`);
    }
    expect(carrying, `a routed page other than ${CELESTE} carries a robots meta:\n${carrying.join('\n')}`).toEqual([]);

    // **The 404 carries one too, and it is Next's rather than this story's.** Measured 2026-09-11
    // against `pnpm start`: `app/not-found.tsx` declares no `robots`, and the tag comes from the
    // framework's not-found boundary
    // (`node_modules/next/dist/client/components/http-access-fallback/error-boundary.js:81-84`),
    // which renders `<meta name="robots" content="noindex">` for every not-found response. The
    // story's matrix predicted the 404 would carry none; this is the reading (DW-78), pinned so a
    // Next release that stops injecting it, or a second directive arriving here, is a named
    // failure.
    await goTo(page, NOT_FOUND, 404);
    expect(await robotsOn(page), "the 404 no longer carries exactly the framework's own noindex").toEqual(['noindex']);

    // **The control for the meta read.** Plant one into a routed page's head and it has to be
    // seen, or an empty list above is a query that reads nothing.
    await goTo(page, '/work');
    await page.evaluate(() => {
      const meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'planted';
      document.head.append(meta);
    });
    expect(await robotsOn(page), 'the robots read does not see a planted meta').toEqual(['planted']);
  });
});

test.describe('the 404 exits', () => {
  test('are the header’s two destinations, in its order, each at the floor, and none marked current', async ({
    page,
  }) => {
    await goTo(page, NOT_FOUND, 404);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // The pairs, pinned as literals here and compared against the header on the same page below.
    // Both, because the literal is what the design fixes (`EXPERIENCE.md:285`) and the equality is
    // what `RESTYLE-SPEC.md:472` asks: never more exits than the header, never fewer.
    const exits = await pairsOn(page, EXITS);
    expect(exits, 'the 404 does not render exactly Suite and CV, in that order').toEqual([
      ['Suite', '/#suite'],
      ['CV', '/cv'],
    ]);
    expect(exits, "the 404's exits differ from the header's on the same page").toEqual(await pairsOn(page, 'nav.navbar a'));

    // No exit announces itself as the current page: an unrouted path is neither destination.
    await expect(page.locator('.error-page a[aria-current]'), 'a 404 exit claims to be the current page').toHaveCount(
      0
    );

    // Each at or above `--tap` on both axes. The entrance tween in `Error404.tsx` fades the exits
    // in and translates them; neither changes a box's size, and `hit-target-floor.pw.ts` measures
    // the same elements in the same way without waiting on it.
    const floor = await floorFrom(page);
    const boxes = await measure(page, EXITS);
    expect(boxes, 'no exit was measured').toHaveLength(2);
    expect(underFloor(boxes, floor), 'a 404 exit is under the AD-19 floor').toEqual([]);

    // **The control.** A third link planted into `.error-page` has to break the equality, the
    // literal and the count, or the three readings above are locators matching nothing.
    await page.evaluate(() => {
      const host = document.querySelector('.error-page__exits');
      if (!host) return;
      const link = document.createElement('a');
      link.href = '/planted';
      link.textContent = 'Planted';
      link.setAttribute('aria-current', 'page');
      host.append(link);
    });
    const planted = await pairsOn(page, EXITS);
    expect(planted, 'the exits read does not see a planted third exit').toHaveLength(3);
    expect(planted, 'a third exit still equals the header, so the equality above discriminates nothing').not.toEqual(
      await pairsOn(page, 'nav.navbar a')
    );
    await expect(page.locator('.error-page a[aria-current]'), 'the aria-current read does not see a planted mark').toHaveCount(1);
  });

  test('are separately addressable, --s-lg apart', async ({ page }) => {
    // **A-4's independently addressable clause** (`EXPERIENCE.md:763`), on the third surface in the
    // Hub to put two targets on one line at 360. The floor case above is per element and cannot
    // see the relationship between the two boxes; this is the only thing asserting the `gap` on
    // `.error-page__exits`, which is the rule `RESTYLE-SPEC.md:206` states. Same shape as
    // `tests/e2e/chrome-nav.pw.ts:587-667` for the header's pair.
    await goTo(page, NOT_FOUND, 404);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const floor = await floorFrom(page);
    const apartBy = await gapFrom(page);

    const links = page.locator(EXITS);
    expect(await links.count(), 'the 404 does not render two exits to compare').toBe(2);

    const first = await links.nth(0).boundingBox();
    const second = await links.nth(1).boundingBox();
    expect(first && second, 'an exit has no box, so it cannot be hit').toBeTruthy();
    for (const [which, box] of [
      ['Suite', first],
      ['CV', second],
    ] as const) {
      expect(
        Math.min(box?.width ?? 0, box?.height ?? 0),
        `${which} is under the floor, so this pair is not two targets yet`
      ).toBeGreaterThanOrEqual(floor);
    }

    expect(
      separation(first, second),
      `the two exits sit ${separation(first, second).toFixed(2)} apart on their separating axis, and ` +
        `--s-lg resolves to ${apartBy.toFixed(2)} here. Two --tap boxes closer than that can overlap, ` +
        `which makes them one target by touch`
    ).toBeGreaterThanOrEqual(apartBy - EDGE_SLACK);

    // **The control.** Take the gap off through the browser and the same comparison has to report
    // the pair as too close, or deleting `gap: var(--s-lg)` from `error-page.scss` would leave the
    // reading above green.
    await page.addStyleTag({ content: '.error-page__exits { gap: 0 !important; }' });
    expect(
      separation(await links.nth(0).boundingBox(), await links.nth(1).boundingBox()),
      'the two exits are still --s-lg apart with the gap removed, so the gap is not what holds them ' +
        'apart and this case is measuring something else'
    ).toBeLessThan(apartBy - EDGE_SLACK);
  });

  test('Suite lands on the home route with the Directory in view, and CV lands on /cv', async ({ page }) => {
    // The two journeys off the 404, on the shape `tests/e2e/chrome-nav.pw.ts:670-767` has for the
    // header's pair. The `href`s are pinned above; this is the click, because a link the router
    // swallows passes every read of the attribute.
    await goTo(page, NOT_FOUND, 404);
    await expect(
      page.locator(`#${HEADING_ID}`),
      'the 404 already carries the Directory heading, so this case cannot show the navigation reached it'
    ).toHaveCount(0);

    await page.locator(`${EXITS}[href='/#${HEADING_ID}']`).click();

    // Polled on the URL, not waited on `load`: a chrome click is an App Router client-side
    // navigation and fires no load event.
    await expect
      .poll(() => page.url().replace(/^https?:\/\/[^/]+/, ''), {
        message: 'the Suite exit never reached /#suite',
        timeout: 10_000,
      })
      .toBe(`/#${HEADING_ID}`);

    const landed = new URL(page.url());
    expect(landed.pathname, `the Suite exit landed on ${landed.pathname} rather than on /`).toBe('/');
    expect(landed.hash, 'the Suite exit lost its fragment on the way to the home route').toBe(`#${HEADING_ID}`);

    const heading = page.locator(`#${HEADING_ID}`);
    await expect(heading, 'nothing on / carries the Directory heading id').toHaveCount(1);
    await expect(heading, 'the fragment resolves to something that is not the Directory heading').toHaveClass(
      /suite-directory__heading/
    );
    await expect(heading, 'the Suite exit did not bring the Directory heading into view').toBeInViewport();

    // **The control, and it is the same page asked for without the fragment.** The heading has to
    // be out of view then, or "in view" above is a statement about a short page.
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

    // The other exit. A URL is not a rendering, so the page has to be there with its own heading.
    await goTo(page, NOT_FOUND, 404);
    await page.locator(`${EXITS}[href='/cv']`).click();
    await expect
      .poll(() => new URL(page.url()).pathname, { message: 'the CV exit never reached /cv', timeout: 15_000 })
      .toBe('/cv');
    await expect(
      page.getByRole('heading', { level: 1 }),
      'the CV exit landed on a document carrying no h1, so the route answered nothing'
    ).toHaveCount(1);
  });
});

test.describe('A-13 on every surface', () => {
  test('sets lang on the root element and a distinct title on each of the five surfaces', async ({ page }) => {
    // `EXPERIENCE.md` books A-13 as a distinct `<title>` and `lang` set on every surface. It held
    // everywhere by accident until this story: `app/layout.tsx:41` sets `lang='en'` and every
    // page names itself, and nothing read either back.
    const titles = new Map<string, string>();
    const langs: string[] = [];

    for (const surface of SURFACES) {
      await goTo(page, surface.route, surface.status);
      langs.push(`${surface.route}: ${await page.evaluate(() => document.documentElement.getAttribute('lang') ?? '')}`);
      titles.set(surface.route, await page.title());
    }

    expect(titles.size, 'no surface was visited').toBe(SURFACES.length);
    expect(langs, 'a surface does not set lang="en" on its root element').toEqual(
      SURFACES.map((surface) => `${surface.route}: en`)
    );
    for (const [route, title] of titles) {
      expect(title.trim(), `${route} has an empty title`).not.toBe('');
    }
    expect(new Set(titles.values()).size, `two surfaces share a title:\n${[...titles].map(([r, t]) => `${r}: ${t}`).join('\n')}`).toBe(
      SURFACES.length
    );

    // `/recommendation` is the 404 document, so it is not a sixth title: the same value the
    // unrouted path carries, read on the retired URL.
    await goTo(page, RETIRED, 404);
    expect(await page.title(), `${RETIRED} carries a title of its own rather than the 404's`).toBe(titles.get(NOT_FOUND));

    // **The control for the distinctness read.** Overwrite one page's title with another's through
    // the browser, re-read it through the same call, and the set has to shrink by one.
    await goTo(page, '/work');
    await page.evaluate((title) => {
      document.title = title;
    }, titles.get('/cv') ?? '');
    const overwritten = new Map(titles).set('/work', await page.title());
    expect(overwritten.get('/work'), 'the title overwrite did not take, so the control planted nothing').toBe(
      titles.get('/cv')
    );
    expect(new Set(overwritten.values()).size, 'the distinctness read does not shrink on a duplicated title').toBe(
      SURFACES.length - 1
    );

    // And the lang read, on a control: take the attribute off and the same read has to report it.
    await page.evaluate(() => document.documentElement.removeAttribute('lang'));
    expect(await page.evaluate(() => document.documentElement.getAttribute('lang') ?? ''), 'the lang read does not see a removed attribute').toBe('');
  });

  test('the 404 previews under its own title rather than a retired route’s', async ({ page }) => {
    // `app/not-found.tsx` carried `openGraph.title: 'Projects | Luigi Espinosa'` until Story 2-17,
    // a page gone since Story 2-14, so every unrouted path shared as a link previewed under another
    // route's name. The block is dropped and Next resolves `og:title` from `title`; measured
    // 2026-09-11 against the local build, that is `Page not Found | Luigi Espinosa`, the document
    // title with the layout's template applied. `app/__tests__/not-found.test.tsx` pins the export;
    // this reads what the document says.
    await goTo(page, NOT_FOUND, 404);
    const title = await page.title();
    expect(title, 'the 404 has no title to compare against').not.toBe('');
    expect(await ogTitleOn(page), 'the 404 previews under a title other than its own').toBe(title);

    // **The control.** Overwrite the meta's `content` through the browser and re-read it through
    // the same function: it has to report the planted value, or the equality above is a reader that
    // answers the title whatever the head says.
    await page.evaluate(() => {
      document.querySelector('head meta[property="og:title"]')?.setAttribute('content', 'Projects | Planted');
    });
    expect(await ogTitleOn(page), 'the og:title read does not see the planted value').toBe('Projects | Planted');
    expect(await ogTitleOn(page), 'the planted value still equals the title, so the equality above discriminates nothing').not.toBe(
      title
    );
  });
});
