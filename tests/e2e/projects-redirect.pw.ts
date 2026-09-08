import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * `/projects` answers a permanent redirect to `/#suite`, and nothing renders the Suite Directory
 * twice (Story 2-14).
 *
 * The route used to mount a second `<SuiteDirectory />` over the same Registry. Two renderings of
 * one dataset is the NFR-9 defect this story removes, and the cheapest moment for them to disagree
 * is the one nobody is watching. **The URL survives and the page does not**: `/projects` is live at
 * v2.5.3 and is the Suite Directory's direct ancestor, so NFR-2 forbids answering 404 to the links,
 * bookmarks and search results still pointing at it.
 *
 * **No 3xx was asserted anywhere in this repository before this file.** The two existing redirect
 * cases follow the redirect and read where a visitor lands: `tests/e2e/narrative.pw.ts` for the two
 * PDF routes and `tests/e2e/hit-target-floor.pw.ts` for the non-Hub set. Both are the right shape
 * for the question they ask and the wrong shape for this one, because a client that follows a
 * redirect reads the landing's status and never sees the 301. So every request here that is about
 * the redirect itself passes `maxRedirects: 0`, and the case that is about the landing deliberately
 * does not.
 *
 * **The status is `301`, not the `308` Next emits for `permanent: true`.** Operator ruling of
 * 2026-09-07, written into `next.config.js` as `statusCode: 301` with the reason beside it.
 *
 * No screenshot is taken here, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true. `playwright.config.ts:33-34` collects every
 * `.pw.ts` under `tests/e2e` by glob and `.github/workflows/ci.yml:276-277` runs the whole
 * directory, so this file needs no configuration and no CI job of its own; adding a job would fail
 * the two suites that pin the job names as an exact set.
 *
 * Every clean reading below is taken only after the same measurement has been watched failing, and
 * every planted defect is injected through the browser or is a second request, so nothing is left
 * in the tree.
 */

/** The URL that survives. */
const SOURCE = '/projects';

/** What `next.config.js` names as its destination, fragment included. */
const DESTINATION = '/#suite';

/** Where a client that follows the redirect ends up. A fragment is never sent to a server. */
const LANDING = '/';

/** The heading's own id, which is what makes `/#suite` resolve (`SuiteDirectory.tsx:137`). */
const HEADING_ID = 'suite';

/** The Directory's root element. Exactly one of these may exist across the whole Hub. */
const DIRECTORY = '.suite-directory';

/** A path the Hub does not route, which renders `app/not-found.tsx`. Same as `hit-target-floor.pw.ts`. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * Every surface that renders Hub markup, which is the set NFR-9 is asserted over.
 *
 * The same four `SURFACES` in `tests/e2e/hit-target-floor.pw.ts` carries, minus its per-surface
 * counts, which are that file's subject rather than this one's. `/projects` is deliberately absent:
 * it is no longer a surface, which is the whole of this story.
 */
const SWEPT = [
  { route: LANDING, status: 200 },
  { route: '/work', status: 200 },
  { route: '/celeste', status: 200 },
  { route: NOT_FOUND, status: 404 },
] as const;

/**
 * The routes this story must leave exactly as it found them, with the status each answered at
 * `97bfc6b`, read without following anything.
 *
 * NFR-2 is the reason the URL was redirected rather than deleted, and a story that keeps one URL
 * working by breaking six others has not met it. `/cv` and `/recommendation` answer **308**, which
 * is what `permanent: true` emits and is exactly why this story's own row could not use it.
 */
const UNTOUCHED = [
  { route: LANDING, status: 200 },
  { route: '/work', status: 200 },
  { route: '/celeste', status: 200 },
  { route: '/api/health', status: 200 },
  { route: '/cv', status: 308 },
  { route: '/recommendation', status: 308 },
  { route: NOT_FOUND, status: 404 },
] as const;

/** One response, read without following: the status and the `Location` header, or `''` for none. */
interface Answer {
  readonly status: number;
  readonly location: string;
}

/**
 * Ask for a path and report what came back, refusing to follow anything.
 *
 * `maxRedirects: 0` is the load-bearing option in this file and it is passed here once rather than
 * at each call site, so no case can quietly read a landing while claiming to read a redirect. The
 * control in the first case is the same path read **with** following, which answers 200 and proves
 * this option is doing the work rather than the server.
 */
const answerFor = async (request: APIRequestContext, path: string): Promise<Answer> => {
  const response = await request.get(path, { maxRedirects: 0 });
  return { status: response.status(), location: response.headers()['location'] ?? '' };
};

/**
 * Follow a redirect chain by hand, one hop at a time, recording every hop and its status.
 *
 * Written out rather than delegated to a client that follows, because the statuses in the middle of
 * a chain are the subject: a client that follows reports only where it stopped. It halts on the
 * first non-3xx, or on a `Location` carrying a fragment, which is a client-side instruction no
 * further request can be made from.
 *
 * The bound is a guard against a redirect loop, which would otherwise hang the case until the
 * suite timeout and report nothing about why.
 */
const walk = async (request: APIRequestContext, from: string): Promise<string[]> => {
  const hops: string[] = [];
  let at = from;

  for (let step = 0; step < 4; step += 1) {
    const answer = await answerFor(request, at);
    hops.push(`${at} -> ${answer.status} ${answer.location || '(no Location)'}`);
    if (answer.status < 300 || answer.status >= 400) break;
    if (answer.location === '' || answer.location.includes('#')) break;
    at = answer.location;
  }

  return hops;
};

/** How many `.suite-directory` elements a route renders, after navigating to it. */
const directoriesOn = async (page: Page, route: string, expected: number): Promise<number> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
  return page.locator(DIRECTORY).count();
};

/**
 * The NFR-9 verdict over a set of per-surface counts: which surfaces other than the landing render
 * one, and how many renderings the whole run saw.
 *
 * A pure function over the counts rather than two expressions inline, so the control below can feed
 * a planted reading through **these** computations instead of asserting something adjacent to them.
 */
const verdictOver = (counts: ReadonlyMap<string, number>): { elsewhere: string[]; total: number } => ({
  elsewhere: [...counts]
    .filter(([route, count]) => route !== LANDING && count > 0)
    .map(([route, count]) => `${route} renders ${count}`),
  total: [...counts.values()].reduce((sum, count) => sum + count, 0),
});

test.describe('the /projects redirect', () => {
  test('answers exactly 301 and names /#suite, read without following it', async ({ request }) => {
    const answer = await answerFor(request, SOURCE);

    expect(answer.status, `${SOURCE} answered ${answer.status} rather than a 301`).toBe(301);
    expect(answer.location, `${SOURCE} redirects somewhere other than ${DESTINATION}`).toBe(DESTINATION);

    // **The control for `maxRedirects: 0`, which is the option this whole file rests on.** Read the
    // same path with following left on and the response is the landing's: 200, no `Location` at
    // all. Without this the two assertions above would be a claim about a flag nobody checked, and
    // the identical case written without the flag would have been green against a 308 or a 302.
    const followed = await request.get(SOURCE);
    expect(followed.status(), 'following the redirect no longer reaches a rendered page').toBe(200);
    expect(
      followed.headers()['location'] ?? '',
      'the followed response still carries a Location header, so the reader below is not reading a landing'
    ).toBe('');

    // **The control for the status literal.** `301` has to be the answer to this row and not the
    // answer to every redirect the Hub serves, or the assertion above measures nothing. `/cv` uses
    // `permanent: true` and answers 308 through the same reader, on the same build.
    const cv = await answerFor(request, '/cv');
    expect(cv.status, '/cv no longer answers the 308 that permanent: true emits').toBe(308);
    expect(cv.location, '/cv no longer redirects to its PDF').toBe('/pdf/cv.pdf');
    expect(cv.status, 'the two redirect rows answer the same status, so 301 says nothing').not.toBe(answer.status);

    // And the control for `Location` itself: a route that does not redirect carries none, so an
    // empty header and a matching one are distinguishable.
    const home = await answerFor(request, LANDING);
    expect(home.status, 'the landing route stopped answering 200').toBe(200);
    expect(home.location, 'a non-redirecting route reports a Location header').toBe('');
  });

  test('a visitor lands on the Directory rather than on the top of the page', async ({ page }) => {
    // The fragment is applied by the browser, which is the point: it never reaches the server, so
    // no assertion about it can be made against a response. It is made against the landed page.
    //
    // **This is the document-request path**, which is what an inbound link, a bookmark or a search
    // result takes. The in-app path a chrome `<Link>` takes is a different navigation and behaves
    // differently; it has its own case below.
    const response = await page.goto(SOURCE, { waitUntil: 'load' });
    expect(response, `navigating to ${SOURCE} produced no response`).toBeTruthy();
    expect(response?.status(), `${SOURCE} did not land on a 200`).toBe(200);

    const landed = new URL(page.url());
    expect(landed.pathname, `${SOURCE} landed on ${landed.pathname} rather than on ${LANDING}`).toBe(LANDING);
    expect(landed.hash, 'the browser dropped the fragment, so the visitor arrives at the top of the page').toBe(
      `#${HEADING_ID}`
    );

    // The fragment resolves to something. An id nothing carries scrolls nowhere and fails silently,
    // which is the failure mode a URL check alone cannot see.
    const heading = page.locator(`#${HEADING_ID}`);
    await expect(heading, `nothing on ${LANDING} carries the id ${HEADING_ID}`).toHaveCount(1);
    await expect(heading, 'the fragment resolves to something that is not the Directory heading').toHaveClass(
      /suite-directory__heading/
    );
    await expect(heading).toBeVisible();

    // And the Directory itself is on the landing, which is what makes the redirect an answer to the
    // request rather than a polite dismissal of it.
    await expect(page.locator(DIRECTORY), `${LANDING} renders no Suite Directory`).toHaveCount(1);

    // **The control.** Remove the id and the same three reads report an unresolved fragment, so the
    // clean result above is a measurement rather than a locator that matches anything.
    await page.evaluate((id) => document.getElementById(id)?.removeAttribute('id'), HEADING_ID);
    await expect(page.locator(`#${HEADING_ID}`), 'the fragment check does not fire on a removed id').toHaveCount(0);
  });

  test('the trailing-slash form reaches the same destination, in two hops', async ({ request }) => {
    // `/projects/` is a common inbound form: a trailing slash is what a CMS, a mail client or a
    // hand-typed URL often produces, and nothing above covered it. **Measured 2026-09-07** rather
    // than predicted, by walking the chain one hop at a time with nothing followed.
    //
    // The first hop is Next's own trailing-slash normalisation, which is a **308** because
    // `trailingSlash` is left at its default; the second is this story's row. So the two statuses
    // in the chain are deliberately different numbers, and neither is the other's doing.
    expect(await walk(request, `${SOURCE}/`), 'the trailing-slash form no longer reaches /#suite in two hops').toEqual([
      '/projects/ -> 308 /projects',
      '/projects -> 301 /#suite',
    ]);

    // **The control**, and the reason the 308 above is attributed to Next rather than to this
    // story: the same walker over a route this story never touched produces the same first hop and
    // then stops on a rendered page. It also shows the walker terminating on a non-3xx, so an empty
    // or one-line result above would be a walker that stopped early rather than a shorter chain.
    expect(await walk(request, '/work/'), 'the walker no longer follows a chain to a rendered page').toEqual([
      '/work/ -> 308 /work',
      '/work -> 200 (no Location)',
    ]);
  });

  test('forwards the query it was given, adds nothing, and keeps the fragment', async ({ request }) => {
    // **Observed 2026-09-07**, rather than assumed: Next forwards an incoming query string to a
    // destination that declares none of its own, and it splices it in ahead of the fragment.
    const withQuery = await answerFor(request, `${SOURCE}?ref=x&b=2`);
    expect(withQuery.status, 'a query string changed the status of the redirect').toBe(301);
    expect(withQuery.location, 'the redirect did not carry the query it was given through to /').toBe(
      '/?ref=x&b=2#suite'
    );

    // The control that makes "forwards" a measurement rather than a guess: the same source with no
    // query redirects with no query. So what arrives in the first reading is the request's, not an
    // invention of the rule.
    const bare = await answerFor(request, SOURCE);
    expect(bare.location, 'the bare redirect invents a query string').toBe(DESTINATION);
    expect(bare.location, 'the two readings are identical, so the query above proves nothing').not.toBe(
      withQuery.location
    );
  });

  test('matches the source case-insensitively, which is Next behaviour and not this rule', async ({ request }) => {
    // **A finding, recorded rather than smoothed over.** This story's own matrix predicted that
    // `/Projects` "is not a route and 404s", on the belief that `next.config.js` matches `source`
    // case-sensitively. It does not: `redirects()` compiles its source with case sensitivity off by
    // default, so every case variant of the path takes this redirect. **Observed 2026-09-07** in
    // the pinned container and against a local production build.
    //
    // It is asserted here rather than left unstated because it is a real behaviour change. Before
    // this story `/Projects` reached `app/not-found.tsx`, the App Router's own matching being
    // case-sensitive; it now answers 301. Nothing in NFR-2's list covers that path, and the change
    // is in the forgiving direction, but a reader who assumes the matrix is filed in
    // `deferred-work.md` along with what closing it would cost.
    for (const variant of ['/Projects', '/PROJECTS']) {
      const answer = await answerFor(request, variant);
      expect(answer.status, `${variant} answered ${answer.status}`).toBe(301);
      expect(answer.location, `${variant} redirects somewhere other than ${DESTINATION}`).toBe(DESTINATION);
    }

    // The control, and the reason this is a finding about case rather than about prefixes: a path
    // that merely begins with the source is not matched, so the rule is anchored and only its case
    // folding is loose.
    const near = await answerFor(request, `${SOURCE}X`);
    expect(near.status, `${SOURCE}X was swallowed by the redirect, so the source is not anchored`).toBe(404);
    expect(near.location, `${SOURCE}X redirects, which the source should not match`).toBe('');
  });

  test('exactly one surface renders the Suite Directory, and it is the home route', async ({ page }) => {
    // NFR-9. This is the defect the redirect exists to remove: two renderings of one Registry that
    // cannot be told apart until they disagree. `Premise` and `SiteFooter` render figures derived
    // from the same data rather than entries, and are deliberately out of this count.
    const renderings = new Map<string, number>();
    for (const surface of SWEPT) {
      renderings.set(surface.route, await directoriesOn(page, surface.route, surface.status));
    }

    expect(renderings.size, 'no surface was visited, so this count is over nothing').toBe(SWEPT.length);
    expect(renderings.get(LANDING), `${LANDING} does not render the Suite Directory`).toBe(1);

    const clean = verdictOver(renderings);
    expect(
      clean.elsewhere,
      'a second surface renders the Suite Directory, which is the NFR-9 defect Story 2-14 removes'
    ).toEqual([]);
    expect(clean.total, 'the Hub renders the Suite Directory more than once').toBe(1);

    // **The control, and it drives the same two computations rather than a third reading.** Plant a
    // second directory into a swept surface through the browser, re-measure that surface, and put
    // the reading back through `verdictOver`. Both halves then report the breach: `elsewhere` names
    // `/work` and `total` reads 2 against the 1 above.
    //
    // Counting the planted node on its own page would prove only that the locator matches something
    // planted. It would leave the two predicates this case actually asserts never having been
    // watched producing anything, and a selector that had stopped matching reports one rendering on
    // the home route and zero everywhere else, which is exactly what passing looks like.
    //
    // Injected into the live page, so nothing is left in the tree.
    await page.goto('/work', { waitUntil: 'load' });
    await expect(page.locator(DIRECTORY), '/work already renders a directory before anything is planted').toHaveCount(
      0
    );
    await page.evaluate((selector) => {
      const planted = document.createElement('section');
      planted.className = selector.slice(1);
      document.body.append(planted);
    }, DIRECTORY);

    const planted = await page.locator(DIRECTORY).count();
    expect(planted, 'the count does not react to a second directory planted on a swept surface').toBe(1);

    const breached = verdictOver(new Map(renderings).set('/work', planted));
    expect(
      breached.elsewhere,
      'the second-surface check reports nothing against a surface that really does render one'
    ).toEqual(['/work renders 1']);
    expect(breached.total, 'the run-wide total does not move when a second rendering is planted').toBe(2);
  });

  test('leaves every other route answering exactly what it answered before', async ({ request }) => {
    // NFR-2, stated as this story's own claim rather than inherited from another file. The status
    // is read without following, so a route that started redirecting would be visible here instead
    // of hiding behind its landing's 200.
    const driftAgainst = async (expected: readonly { route: string; status: number }[]): Promise<string[]> => {
      const found: string[] = [];
      for (const { route, status } of expected) {
        const answer = await answerFor(request, route);
        if (answer.status !== status) found.push(`${route} answered ${answer.status}, expected ${status}`);
      }
      return found;
    };

    const drift = await driftAgainst(UNTOUCHED);
    expect(drift, `a route this story must not touch has moved:\n${drift.join('\n')}`).toEqual([]);

    // **The control runs the same comparison over the same routes, with one expectation
    // deliberately wrong.** `/work` really answers 200, so asking it for a 404 is exactly the shape
    // a route that had moved would take, and the loop has to produce a line naming both numbers.
    //
    // Reading some other route instead would show that `answerFor` can see a status; it would not
    // show this comparison producing a drift line, and an empty result above would then be
    // indistinguishable from a loop that never compared anything.
    const planted = await driftAgainst(
      UNTOUCHED.map((row) => (row.route === '/work' ? { ...row, status: 404 } : row))
    );
    expect(
      planted,
      'the comparison reports no drift against an expectation that is deliberately wrong, so the ' +
        'clean result above is not a measurement'
    ).toEqual(['/work answered 200, expected 404']);
  });

  test('a chrome link reaches the homepage but not the Directory, which Story 2-15 owns', async ({ page }) => {
    // **The journey most visitors actually take, and it behaves differently from every case above.**
    // `Navbar.tsx:7` and `HomeLayout.tsx:145` still point at `/projects`; repointing them is Story
    // 2-15's job under the Operator ruling of 2026-09-07, so this story measures what the link does
    // rather than changing it.
    //
    // **Measured 2026-09-07, in the pinned container: the fragment does not survive.** A chrome
    // click is an App Router client-side navigation, and the router resolves the redirect itself
    // rather than handing the browser a `Location` to apply. The visitor lands on `/` with an empty
    // hash at `scrollY` 0, with the Directory heading roughly 886px below a 800px viewport, so a
    // nav click lands at the top of the homepage and not on the Directory.
    //
    // Nothing here is broken: NFR-2 is met, the destination is right, and the Directory is one
    // scroll away. What is not met is FR-2's "lands on the Directory", on this path only. It is
    // filed as **DW-58** with Story 2-15 named as the owner, because the fix is to repoint the two
    // links at `/#suite`, which those two files are that story's to change.
    await page.goto('/work', { waitUntil: 'load' });

    const link = page.locator(`nav.navbar a[href='${SOURCE}']`);
    await expect(link, `/work renders no chrome link to ${SOURCE}, so this case measures nothing`).toHaveCount(1);

    await link.click();
    await page.waitForLoadState('load');
    await expect(page.locator(DIRECTORY), 'the chrome link did not reach a page rendering the Directory').toHaveCount(
      1
    );

    const landed = new URL(page.url());
    expect(landed.pathname, `the chrome link landed on ${landed.pathname} rather than on ${LANDING}`).toBe(LANDING);
    expect(
      landed.hash,
      'the client-side navigation now carries the fragment through. That is better than the ' +
        'behaviour DW-58 records, so this expectation is the thing to update, and DW-58 is the ' +
        'thing to close'
    ).toBe('');

    // The consequence, measured rather than inferred from the empty hash: the heading is below the
    // fold and the page has not scrolled to it.
    const arrival = await page.evaluate((id) => {
      const node = document.getElementById(id);
      return {
        scrollY: Math.round(window.scrollY),
        top: node ? Math.round(node.getBoundingClientRect().top) : null,
        viewport: window.innerHeight,
      };
    }, HEADING_ID);

    expect(arrival.top, `nothing on ${LANDING} carries the id ${HEADING_ID}`).not.toBeNull();
    expect(arrival.scrollY, 'the page scrolled, so the landing is not the top of the document').toBe(0);
    expect(
      (arrival.top ?? 0) > arrival.viewport,
      `the Directory heading is at ${arrival.top} in a ${arrival.viewport}px viewport, so it is in ` +
        `view after all and DW-58 overstates the gap`
    ).toBe(true);

    // **The control**, and it is the document-request path from the case above, run here so the two
    // readings sit side by side on the same build. Same destination, same Directory, and the hash
    // that the click did not produce. Without it, an empty hash reads as "this browser drops
    // fragments" rather than as a difference between two kinds of navigation.
    await page.goto(SOURCE, { waitUntil: 'load' });
    expect(
      new URL(page.url()).hash,
      'the document-request path also lost the fragment, so the reading above is about the browser ' +
        'rather than about the client-side router'
    ).toBe(`#${HEADING_ID}`);
  });
});
