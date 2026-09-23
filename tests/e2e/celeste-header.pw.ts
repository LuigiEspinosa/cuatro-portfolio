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
 * **Two routes reach "no header" by two different mechanisms**, and this file keeps them apart.
 * On `/celeste` the element is rendered and the stylesheet hides it. On `/` `Header.tsx:12`
 * returns `null` and no element exists at all. Conflating them is how a broken suppression
 * passes: `toBeHidden()` is green for an element that is simply absent.
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

  test('/celeste still paints the rest of the block the header rule was edited into, from the roles', async ({
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
    // `--f-display` and `--t-display`. Each is read against its role, resolved in the same page
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

    // `#celeste h1 { font-family: var(--f-display); font-size: var(--t-display); text-align: center;
    // color: var(--token-text); }`. The heading keeps the user agent's bold, 700, which the display
    // face publishes (`700 800`), so the face is loaded at that weight and nothing is synthesised.
    expect(await computed(page, 'h1', 'color'), 'the heading is not --token-text').toBe(roles.text);
    expect(await computed(page, 'h1', 'font-family'), 'the heading is not set in the display family').toBe(
      roles.family
    );
    expect(await computed(page, 'h1', 'font-size'), 'the heading is not at the display size').toBe(roles.size);
    expect(await computed(page, 'h1', 'font-weight')).toBe('700');
    expect(
      await page.evaluate(() => document.fonts.check('700 16px "Bricolage Grotesque"')),
      'the display face is not loaded at the weight the heading asks for'
    ).toBe(true);
    expect(await computed(page, 'h1', 'text-align')).toBe('center');

    // The planted controls: the 2023 ground and a family off the contract, written back over the
    // block, are each reported by the same reads, so a pass above is a measurement.
    await page.addStyleTag({
      content: 'body#celeste { background-color: rgb(68, 68, 68) !important; } #celeste h1 { font-family: serif !important; }',
    });
    expect(await computed(page, 'body', 'background-color'), 'a planted #444 ground reads as the role').not.toBe(
      roles.ground
    );
    expect(await computed(page, 'h1', 'font-family'), 'a planted family reads as the display family').not.toBe(
      roles.family
    );

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
    // **Absence, not `display: none`.** `Header.tsx:12` returns `null` when the pathname is `/`,
    // so the home route never renders a `<header>` for anything to hide, and `celeste.scss` is
    // not involved: its rule is scoped to `#celeste` and the home route's body id is `''`.
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
