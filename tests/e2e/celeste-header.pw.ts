import { expect, test, type Page } from '@playwright/test';

/**
 * The header suppression on `/celeste`, measured in a real browser (Story 2-1).
 *
 * `/celeste` correctly carries no suite navigation, and it used to get there by having
 * `Celeste.tsx` write `display: none` onto the header's DOM node from an effect. The
 * suppression is now `#celeste header` in `celeste.scss`, keyed on the id `Body` writes onto
 * `<body>`, so it is a selector that stops matching rather than a mutation that has to be
 * undone.
 *
 * **A stylesheet is the one thing the unit tests cannot read.** jsdom applies none, so
 * `components/organisms/Celeste/__tests__/Celeste.test.tsx` can only assert that no node is
 * mutated, and `components/atoms/Container/__tests__/Container.test.tsx` can only assert the id
 * the selector keys on. Whether the rule reaches the header, and whether it outranks
 * `.header-container`'s `display: flex`, is a question about a real cascade and is answered
 * here.
 *
 * **Since 2026-09-24 it also reads the page's S10 restyle** (Operator ruling, DW-121): the heading in
 * the display row's roles at `wdth 85` within `14ch`, and the two emoji on a mono line of their own,
 * each against its role resolved in the same page. The restyle lives in the block the header rule
 * sits in, which is why it is read here rather than in a file of its own.
 *
 * **Two routes reach "no header" by two different mechanisms**, and this file keeps them apart.
 * On `/celeste` the element is rendered and the stylesheet hides it. On `/` `Header.tsx:18`
 * renders the skip link alone and no header element exists at all. Conflating them is how a
 * broken suppression passes: `toBeHidden()` is green for an element that is simply absent.
 *
 * Assertions only. No screenshot is taken, so this file writes no snapshot directory and the
 * "keeps exactly one committed baseline" case in `rendered-output.pw.ts` is untouched: that
 * case reads the snapshot directory of its own test file.
 */

/**
 * Navigate, and refuse to read anything off a page that did not answer the status expected.
 *
 * The 404 surface is one of the routes read here, and it is the one `app/not-found.tsx` renders,
 * so the expectation is a parameter rather than a hard 200. Same shape as `goTo` in
 * `tests/e2e/anchor-aliases.pw.ts`.
 */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/** A path the Hub does not route, which renders `app/not-found.tsx` through the root layout. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/** The computed value of `property` on the first element matching `selector`. */
const computed = (page: Page, selector: string, property: string): Promise<string> =>
  page
    .locator(selector)
    .first()
    .evaluate((node, name) => window.getComputedStyle(node).getPropertyValue(name), property);

/** The computed values of several properties on the first element matching `selector`, by name. */
const styles = (page: Page, selector: string, properties: readonly string[]): Promise<Record<string, string>> =>
  page
    .locator(selector)
    .first()
    .evaluate(
      (node, names) => Object.fromEntries(names.map((name) => [name, window.getComputedStyle(node).getPropertyValue(name)])),
      [...properties]
    );

/**
 * What a set of declarations computes to on a throwaway block appended to `host`, read for the
 * properties named, so each expectation is the contract's value as this browser resolves it rather
 * than a number typed here. `host` matters for a value that depends on the element's own face, as
 * `ch` does. The shape of `probe` in `tests/e2e/error-surface.pw.ts`.
 */
const probe = (
  page: Page,
  declared: Record<string, string>,
  properties: readonly string[],
  host = 'body'
): Promise<Record<string, string>> =>
  page.evaluate(
    ({ style, wanted, inside }) => {
      const node = document.createElement('span');
      node.style.display = 'block';
      for (const [property, value] of Object.entries(style)) node.style.setProperty(property, value);
      const parent = document.querySelector(inside);
      if (!parent) throw new Error(`${inside} is not on the page`);
      parent.append(node);
      const resolved = window.getComputedStyle(node);
      const out = Object.fromEntries(wanted.map((name) => [name, resolved.getPropertyValue(name)]));
      node.remove();
      return out;
    },
    { style: declared, wanted: [...properties], inside: host }
  );

test.describe('the site header', () => {
  test('/celeste carries body#celeste and hides the header without touching it', async ({
    page,
  }) => {
    await goTo(page, '/celeste');

    // The mechanism the suppression keys on, asserted rather than assumed. Without this id the
    // rule below matches nothing and the header comes back.
    await expect(page.locator('body#celeste')).toHaveCount(1);

    // **The page really rendered.** `body#celeste` is derived from the URL alone, so it is
    // there whether or not `CelesteComponent` produced anything, and a `/celeste` that rendered
    // nothing at all would satisfy every "no header" read below. The heading is the page.
    const heading = page.locator('h1');
    await expect(heading).toHaveCount(1);
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/Te amo/);

    const header = page.locator('header');

    // **Attached first.** `toBeHidden` also passes for an element that is not in the DOM at
    // all, so on its own it would be green on a route that rendered no header, which is a
    // different page from the one this case is about.
    await expect(header).toHaveCount(1);
    await expect(header).toBeHidden();

    // Hidden by the rule, not by something incidental such as being scrolled out of view.
    expect(await computed(page, 'header', 'display'), 'the header on /celeste is not display:none').toBe(
      'none'
    );

    // The defect itself. The effect wrote `style="display: none"` onto this node; nothing
    // writes an inline style now.
    await expect(header).not.toHaveAttribute('style');
  });

  test('/celeste paints the S10 restyle from the roles: the display line, and the emoji on a mono line of their own', async ({
    page,
  }) => {
    // Story 2-1 edited one selector inside the `#celeste` block, and that block also carries the
    // ground, the centring and the heading rules. `/celeste` has no committed baseline and this
    // file takes no screenshot, so without these reads a mistake anywhere else in the same block
    // (a brace moved, a selector renamed, the whole block lost) leaves every case green while
    // the page is wrong.
    //
    // **Story 2-34 moved the block onto the contract** so the FR-17 conformance gate lands green:
    // `#444`, `#fff`, `system-ui` and `min(8vw, 5rem)` became `--token-bg`, `--token-text`,
    // `--f-display` and `--t-display`. **The Operator ruling of 2026-09-24 (DW-121) restyled the
    // heading to `mockups/secondary-screens.html` S10**: the display row's weight, case, leading and
    // tracking at `wdth 85`, a `14ch` measure, and the two emoji on a mono line of their own. Until
    // that ruling the heading kept the user agent's bold, 700, in mixed case at the face's leading,
    // and this case pinned the 700. Each value is read against its role, resolved in the same page
    // through a probe, rather than against a value restated here.
    await goTo(page, '/celeste');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const roles = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:absolute;left:-99999px;top:0;background-color:var(--token-bg);color:var(--token-text);' +
        'font-family:var(--f-display);font-size:var(--t-display);';
      document.body.appendChild(probe);
      const style = window.getComputedStyle(probe);
      const read = { ground: style.backgroundColor, text: style.color, family: style.fontFamily, size: style.fontSize };
      probe.remove();
      return read;
    });
    // Resolved and distinct, or one colour could satisfy both comparisons below.
    expect(roles.ground, 'var(--token-bg) did not resolve on the probe').not.toBe('rgba(0, 0, 0, 0)');
    expect(roles.ground, '--token-bg and --token-text resolve to one colour').not.toBe(roles.text);
    expect(roles.family, 'var(--f-display) did not resolve on the probe').toContain('Bricolage Grotesque');

    // `#celeste { background-color: var(--token-bg); display: grid; place-items: center; }` on `<body>`.
    expect(await computed(page, 'body', 'background-color'), 'the /celeste ground is not --token-bg').toBe(
      roles.ground
    );
    expect(await computed(page, 'body', 'display'), '/celeste no longer centres on a grid').toBe('grid');
    expect(await computed(page, 'body', 'place-items')).toContain('center');

    // **The display line.** The ground, text, family and size are Story 2-34's; the weight, width,
    // case, leading, tracking and measure are S10's, each against its role at the display size. The
    // weight is the display face's heaviest published (`700 800`), so it is loaded at the weight the
    // heading asks for and nothing is synthesised.
    const display = {
      weight: (await probe(page, { 'font-weight': 'var(--w-black)' }, ['font-weight']))['font-weight'],
      leading: (await probe(page, { 'font-size': 'var(--t-display)', 'line-height': 'var(--lh-display)' }, ['line-height']))['line-height'],
      tracking: (await probe(page, { 'font-size': 'var(--t-display)', 'letter-spacing': 'var(--tr-display)' }, ['letter-spacing']))['letter-spacing'],
      // `ch` is the width of the element's own zero, so the measure is resolved inside the heading.
      measure: (await probe(page, { 'max-inline-size': '14ch' }, ['max-inline-size'], 'h1'))['max-inline-size'],
    };
    expect(display.weight, 'var(--w-black) did not resolve to the heaviest weight').toBe('800');
    const heading = await styles(page, 'h1', [
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'font-stretch',
      'text-transform',
      'line-height',
      'letter-spacing',
      'max-inline-size',
      'text-align',
    ]);
    expect(heading.color, 'the heading is not --token-text').toBe(roles.text);
    expect(heading['font-family'], 'the heading is not set in the display family').toBe(roles.family);
    expect(heading['font-size'], 'the heading is not at the display size').toBe(roles.size);
    expect(heading['font-weight'], 'the heading is not at --w-black').toBe(display.weight);
    expect(heading['font-stretch'], 'the heading is not the display face at wdth 85').toBe('85%');
    expect(heading['text-transform'], 'the heading is not uppercase').toBe('uppercase');
    expect(heading['line-height'], 'the heading is not at --lh-display').toBe(display.leading);
    expect(heading['letter-spacing'], 'the heading is not at --tr-display').toBe(display.tracking);
    expect(heading['max-inline-size'], 'the heading is not capped at 14ch').toBe(display.measure);
    expect(heading['text-align']).toBe('center');
    expect(
      await page.evaluate(() => document.fonts.check('800 16px "Bricolage Grotesque"')),
      'the display face is not loaded at the weight the heading asks for'
    ).toBe(true);
    // The measure is a cap the heading honours, and a different one from the prose measure, so the
    // equality above could not be met by `--measure`.
    const headingWidth = await page.locator('h1').evaluate((node) => node.getBoundingClientRect().width);
    expect(headingWidth, 'the heading is wider than 14ch').toBeLessThanOrEqual(Number.parseFloat(display.measure) + 0.5);
    expect(
      (await probe(page, { 'max-inline-size': 'var(--measure)' }, ['max-inline-size'], 'h1'))['max-inline-size'],
      'the prose measure and 14ch resolve alike, so the measure read discriminates nothing'
    ).not.toBe(display.measure);

    // **The emoji line**, the heading's one element: a block in the mono family at the metadata step,
    // at the regular weight Geist Mono publishes, label tracking and leading, a step of space above it.
    const EMOJI = '.celeste__emoji';
    await expect(page.locator(`h1 > ${EMOJI}`), 'the heading does not carry the emoji line').toHaveCount(1);
    await expect(page.locator(EMOJI)).toHaveText('\u{1F499}\u{1F98B}');
    const mono = await probe(
      page,
      {
        'font-family': 'var(--f-mono)',
        'font-size': 'var(--t-2xs)',
        'font-weight': 'var(--w-regular)',
        'letter-spacing': 'var(--tr-label)',
        'line-height': 'var(--lh-label)',
        'margin-block-start': 'var(--s-md)',
      },
      ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'line-height', 'margin-block-start']
    );
    expect(mono['font-family'], 'var(--f-mono) did not resolve on the probe').toContain('Geist Mono');
    expect(await styles(page, EMOJI, ['display', ...Object.keys(mono)]), 'the emoji line is not the mono line S10 draws').toEqual({
      display: 'block',
      ...mono,
    });

    // **On a line of its own**: the emoji line starts below the bottom of the words' last line.
    const ownLine = () =>
      page.evaluate((selector) => {
        const line = document.querySelector(selector);
        const words = line?.parentElement?.firstChild;
        if (!line || !words || words.nodeType !== Node.TEXT_NODE) return 'no words before the emoji line';
        const range = document.createRange();
        range.selectNodeContents(words);
        const wordsBottom = Math.max(...Array.from(range.getClientRects(), (rect) => rect.bottom));
        return line.getBoundingClientRect().top >= wordsBottom;
      }, EMOJI);
    expect(await ownLine(), 'the emoji share a line with the words').toBe(true);

    // The planted controls: the 2023 ground and a family off the contract, the user agent's bold in
    // mixed case, and the emoji put back inline, written back over the block, are each reported by the
    // same reads, so a pass above is a measurement.
    await page.addStyleTag({
      content:
        'body#celeste { background-color: rgb(68, 68, 68) !important; } ' +
        '#celeste h1 { font-family: serif !important; font-weight: 700 !important; text-transform: none !important; } ' +
        `#celeste ${EMOJI} { display: inline !important; }`,
    });
    const planted = await styles(page, 'h1', ['font-family', 'font-weight', 'text-transform']);
    expect(await computed(page, 'body', 'background-color'), 'a planted #444 ground reads as the role').not.toBe(
      roles.ground
    );
    expect(planted['font-family'], 'a planted family reads as the display family').not.toBe(roles.family);
    expect(planted['font-weight'], 'a planted 700 reads as --w-black').not.toBe(display.weight);
    expect(planted['text-transform'], 'a planted mixed case reads as uppercase').not.toBe('uppercase');
    expect(await ownLine(), 'emoji planted inline still read as a line of their own').toBe(false);

    // And the block is the block: `/work` takes the ordinary block display. Until Story 2-34 this
    // also read `/work`'s ground as different from `/celeste`'s; both paint `--token-bg` now, which is
    // the point, so the display is what tells the two apart.
    await goTo(page, '/work');
    expect(await computed(page, 'body', 'display')).not.toBe('grid');
  });

  test('/work shows the header', async ({ page }) => {
    await goTo(page, '/work');

    const header = page.locator('header');
    await expect(header).toHaveCount(1);
    await expect(header).toBeVisible();
    await expect(header).not.toHaveAttribute('style');

    // The planted control for the read above. If every route computed `display: none` on the
    // header, the `/celeste` case would be measuring nothing.
    expect(
      await computed(page, 'header', 'display'),
      'the header computes display:none on /work as well, so the read on /celeste discriminates nothing'
    ).not.toBe('none');
  });

  test('the 404 surface has a header, which is what the route-group option would have cost', async ({
    page,
  }) => {
    // **The measurement behind a Never clause.** Story 2-1 rejected moving `<Header />` out of
    // the root layout into a route group, and the stated reason is that `app/not-found.tsx` has
    // a header today and a route group would strip it. Nothing measured that, so the premise
    // could rot silently and the next story would inherit a reason that had stopped being true.
    //
    // This route is deliberately unrouted, so it answers 404 rather than 200.
    await goTo(page, NOT_FOUND, 404);

    // The control: the 404 surface really rendered, rather than some other page answering here.
    //
    // **Not `body#_not-found`, though that is what the id reads today.** On this surface alone
    // the `<body id>` is a hydration artifact: `usePathname()` answers `/_not-found` during the
    // prerender and the real request path on the client, so the prerendered `_not-found` only
    // survives while hydration leaves the attribute alone. Measured 2026-08-29: with a
    // structural hydration mismatch planted in `Header`, the id flipped to
    // `a-route-that-does-not-exist` mid-test and the control went red for a reason that had
    // nothing to do with the header. `Error404.tsx:41,44-46` renders the same markup on both
    // sides and is what this case is actually about (a server component since Story 2-30, so the
    // markup is the server's on both).
    await expect(page.locator('.error-page')).toHaveCount(1);
    await expect(page.locator('.error-page__code')).toHaveText('404');

    const header = page.locator('header');
    await expect(header).toHaveCount(1);
    await expect(header).toBeVisible();
    await expect(header).not.toHaveAttribute('style');
  });

  test('/ renders no header element at all, which is a different mechanism', async ({ page }) => {
    // **Absence, not `display: none`.** `Header.tsx:18` renders only the skip link when the pathname
    // is `/` (since 2026-09-24, DW-43), so the home route never renders a `<header>` for anything
    // to hide, and `celeste.scss` is not involved: its rule is scoped to `#celeste` and the home
    // route's body id is `''`.
    //
    // That is the whole distinction between the two routes this file covers. On `/celeste` the
    // element **is** rendered and the stylesheet hides it, which is why that case asserts
    // `toHaveCount(1)` and `toBeHidden()`. Here there is nothing in the DOM to assert anything
    // about, so the count is zero. Asserting `toBeHidden()` on `/` would pass for the wrong
    // reason, because it also passes for an element that is not there.
    await goTo(page, '/');

    await expect(page.locator('header')).toHaveCount(0);

    // The control. A blank page, or an error surface rendered in place of the home route, also
    // carries no header, so the count above only means something once the home route is known
    // to have rendered.
    //
    // **Read as an attribute, not as the selector `body[id='']`.** One rule keys on that
    // selector and works in the cascade: `HomeLayout.scss`, which is what actually paints the home
    // ground (the base ground is `body`'s own `background` in `app/app.scss`). A second rule keyed
    // on it until 2026-09-06, `&[id='']` nested under `body` in `app/app.scss` setting
    // `overflow: hidden` alone, which Story 2-9 deleted because it was the one reason a homepage
    // section below the hero could not be scrolled to. What the selector cannot be is a locator,
    // and that is what this note is for. Chromium answers
    // `querySelectorAll` for
    // any compound ending in `[id='...']` out of the document's id map, and that map never
    // holds the empty string, so `body[id='']` resolves to **zero** elements while
    // `document.body.matches("[id='']")` on the same node answers `true` and the rule paints.
    // Measured 2026-08-29 against a planted `<div id="">` as well, so it is the empty value and
    // not `<body>`; `body[id='work']` resolves to one element on `/work`. The failure direction
    // matters: as a control this was loud, but written as `toHaveCount(0)` it would pass over
    // nothing.
    expect(
      await page.locator('body').getAttribute('id'),
      'the home route no longer carries the empty body id the home ground is painted through'
    ).toBe('');
    await expect(page.locator('.home-container')).toHaveCount(1);
  });

  test('the header is visible on /work loaded straight after /celeste', async ({ page }) => {
    // `/celeste` renders no link, so both of these are full document loads rather than a
    // client-side navigation. What that still pins is that nothing had to be restored: under
    // the old code the header was hidden by a mutation whose undo lived in an effect cleanup,
    // and the whole point of the replacement is that leaving the route is a selector that stops
    // matching.
    await goTo(page, '/celeste');
    await expect(page.locator('header')).toBeHidden();

    await goTo(page, '/work');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header')).not.toHaveAttribute('style');
  });
});
