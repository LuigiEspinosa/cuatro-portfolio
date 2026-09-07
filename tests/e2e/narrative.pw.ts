import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/**
 * The narrative behind one dynamic boundary, measured on what the browser fetches (Story 2-12).
 *
 * FR-1's structure already held before this story: Stories 2-9 and 2-11 made the Suite Directory the
 * terminal section and put the premise above it. What was false was the payload NFR.
 * `ops/asset-budget.md` measured it on 2026-08-29: 6,459 of 418,757 gzipped narrative bytes were
 * deferred, 1.5 percent, because `GemComponent.tsx:5-6` imported `@react-three/postprocessing` and
 * `ParticleWave` statically beside a dynamic `Scene` call and a static import is not deferred by a
 * dynamic call next to it.
 *
 * **The deferral is proved on the served document, never on the import graph.** A test that read the
 * import graph would have been green for the whole time the defect stood: `next/dynamic` was already
 * there. So the question asked here is the one the acceptance criterion asks, is the narrative in
 * what the browser fetches before it can paint, and it is answered by fetching every script the `/`
 * document references and scanning each for a library fingerprint.
 *
 * **The fingerprints are read out of `ops/asset-budget.mjs`, never restated.** That file publishes
 * the table and `ops/__tests__/asset-budget.test.ts:780-797` pins it as literals. A second copy here
 * would drift from the record whose figures it is supposed to corroborate. It is read as text rather
 * than imported because Playwright transpiles a spec to CommonJS and the tool is an ES module using
 * `import.meta`, which that loader refuses; the parse is guarded by its own case below and by the
 * discrimination control, either of which fails loudly if the table arrives empty or half read.
 * Chunk file names are content hashes and are never matched: a test naming one measures a single
 * build and silently passes on the next.
 *
 * **Every clean result is read only after the same measurement has been seen firing.** Where the
 * control is a defect it is planted into the live page through the browser, so no fixture is left in
 * the tree, which is the rule `tests/e2e/premise.pw.ts`, `status-mark.pw.ts` and
 * `suite-directory.pw.ts` set. Where the control is a real artifact it is the deferred narrative
 * chunk itself: the same scan that finds nothing in the eager set finds `three` in the chunk the
 * browser fetches afterwards, which is a discrimination proof rather than a planted one.
 *
 * **No screenshot is taken**, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true. `playwright.config.ts:33-34` globs every `.pw.ts`
 * under `tests/e2e` and `.github/workflows/ci.yml` runs the directory, so this file needs no
 * configuration and no CI job of its own. Adding a job would fail
 * `ops/__tests__/contract-purity.test.ts` and `ops/__tests__/registry-schema.test.ts`, which each pin
 * the six job names as an exact set.
 */

/** The homepage, the one route this story changes. */
const ROUTE = '/';

/** The fragment the Directory heading carries, per `tests/e2e/suite-directory.pw.ts:36-37`. */
const HEADING_ID = 'suite';

/** A path the Hub does not route, which renders `app/not-found.tsx`. Same as `hit-target-floor.pw.ts:69`. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * The routes FR-1's third consequence names, plus the two this story must not move.
 *
 * `/cv` and `/recommendation` answer 308 to a PDF, so they are requested rather than navigated to:
 * a browser answers a PDF redirect by starting a download rather than a navigation. Same treatment
 * and same reason as `tests/e2e/hit-target-floor.pw.ts:93-101`.
 */
const NAVIGABLE_ROUTES = ['/', '/work', '/projects', '/celeste', NOT_FOUND] as const;
const REQUESTED_ROUTES = ['/cv', '/recommendation'] as const;

/**
 * `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
 * repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here.
 * Same as `tests/e2e/hit-target-floor.pw.ts:58-61` and `anchor-aliases.pw.ts:42`.
 */
const REPO_ROOT = resolve(__dirname, '..', '..');

/** The tool that publishes the fingerprint table, and the one place it is written down. */
const BUDGET_TOOL = join(REPO_ROOT, 'ops', 'asset-budget.mjs');

interface Fingerprint {
  library: string;
  mark: string;
  webgl: boolean;
}

/**
 * The `FINGERPRINTS` table, read out of `ops/asset-budget.mjs`.
 *
 * Two counts are taken, the entries this parse produced and the entries the block actually
 * declares, and `the fingerprint table is read whole` below holds them equal. A regex that matched
 * six of ten rows would otherwise narrow the scan silently, and a narrower scan is exactly a scan
 * that reports a clean document.
 */
const readFingerprints = (): { entries: Fingerprint[]; declared: number } => {
  const source = readFileSync(BUDGET_TOOL, 'utf8');
  const block = /export const FINGERPRINTS = \[([\s\S]*?)\n\];/.exec(source);
  if (!block) {
    throw new Error(
      `ops/asset-budget.mjs no longer declares a FINGERPRINTS array this parse can find, so the ` +
        `narrative scan has no table. Fix the parse against the tool, do not restate the table here.`
    );
  }

  const entries = [
    ...block[1].matchAll(
      /\{\s*library:\s*'([^']+)',\s*mark:\s*'((?:[^'\\]|\\.)*)',\s*webgl:\s*(true|false)\s*\}/g
    ),
  ].map((match) => ({
    library: match[1],
    mark: match[2].replace(/\\(.)/g, '$1'),
    webgl: match[3] === 'true',
  }));

  return { entries, declared: (block[1].match(/\blibrary:/g) ?? []).length };
};

const { entries: FINGERPRINTS, declared: FINGERPRINTS_DECLARED } = readFingerprints();

/** The marks that make a chunk the narrative rather than merely a narrative-adjacent library. */
const WEBGL_MARKS = FINGERPRINTS.filter((entry) => entry.webgl);

/**
 * The libraries a script's text carries, by the record's own fingerprints.
 *
 * `chunkLibraries` in `ops/asset-budget.mjs` does the same thing over a whole build. This is the
 * WebGL half of it, applied to one fetched response.
 */
const webglLibrariesIn = (text: string): string[] =>
  WEBGL_MARKS.filter((entry) => text.includes(entry.mark)).map((entry) => entry.library);

/**
 * Every script URL the `/` document references, from the document's own text.
 *
 * `<script src>` plus `<link rel=modulepreload>` plus `<link rel=preload as=script>`, which is the
 * same set `ops/asset-budget.mjs` weighs for a route. Read from the served bytes rather than from
 * the DOM, because the DOM after hydration also holds the chunks the page went on to request, and
 * those are exactly what this measurement has to exclude.
 */
const documentScriptHrefs = (html: string): string[] => {
  const hrefs = new Set<string>();

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    hrefs.add(match[1]);
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = (/\brel=["']([^"']+)["']/i.exec(tag)?.[1] ?? '').toLowerCase().split(/\s+/);
    const as = (/\bas=["']([^"']+)["']/i.exec(tag)?.[1] ?? '').toLowerCase();
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    if (rel.includes('modulepreload') || (rel.includes('preload') && as === 'script')) hrefs.add(href);
  }

  return [...hrefs].filter((href) => extname(href.split('?')[0]) === '.js');
};

const goTo = async (page: Page, route: string): Promise<void> => {
  // Not `networkidle`. The Hub never reaches it: Lenis plus the GSAP ticker keep the page busy
  // indefinitely, so a wait for network idle times out rather than settling
  // (`tests/e2e/harness.ts:86-90`). That matters more than usual on a route whose whole subject is
  // loading.
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

/**
 * Run `read` against a context that has not asked for reduced motion.
 *
 * `playwright.config.ts:79` sets `reducedMotion: 'reduce'` for every test, which is what stops the
 * entrance at source for the suites that measure a settled layout. The three cases that measure the
 * entrance itself need it running, so they open a second context that differs in that option and in
 * nothing else. Same shape as `tests/e2e/premise.pw.ts:90-108`.
 */
const withMotion = async <T>(
  browser: Browser,
  read: (page: Page) => Promise<T>,
  init?: string
): Promise<T> => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    if (init) await page.addInitScript(init);
    return await read(page);
  } finally {
    await context.close();
  }
};

/**
 * An init script that makes every WebGL context request answer `null`.
 *
 * `GemComponent.tsx:24-30` probes for a context and renders the static fallback when there is none,
 * so this is how the fallback path is reached in a browser that does have WebGL. It is the path
 * `filter: brightness(0)` used to black out, which is why the gem's reveal is measured on both.
 */
const NO_WEBGL = `
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (typeof type === 'string' && type.toLowerCase().includes('webgl')) return null;
    return original.call(this, type, ...rest);
  };
`;

// ---------------------------------------------------------------------------
// The deferral, read off the served document.
// ---------------------------------------------------------------------------

test.describe('the narrative is not in what the browser fetches before it can paint', () => {
  test('the fingerprint table is read whole out of ops/asset-budget.mjs', async () => {
    // The instrument before the measurement. Every case in this file classifies a script with this
    // table, so a parse that dropped rows would narrow the scan and report a clean document for the
    // wrong reason. Held against the tool's own declaration count rather than against a literal:
    // a literal here would be the second copy of the table this file exists to avoid.
    expect(
      FINGERPRINTS.length,
      `the FINGERPRINTS parse produced ${FINGERPRINTS.length} entries against ${FINGERPRINTS_DECLARED} ` +
        `declared in ops/asset-budget.mjs`
    ).toBe(FINGERPRINTS_DECLARED);
    expect(FINGERPRINTS_DECLARED, 'ops/asset-budget.mjs declares no fingerprint at all').toBeGreaterThan(0);
    expect(
      WEBGL_MARKS.length,
      'the table carries no WebGL-bearing fingerprint, so this file classifies nothing'
    ).toBeGreaterThan(0);
    expect(
      FINGERPRINTS.every((entry) => entry.mark.length > 0),
      'a fingerprint parsed to an empty mark, which matches every position in every chunk'
    ).toBe(true);
  });

  test('no script the / document references carries a WebGL fingerprint', async ({ request, baseURL }) => {
    // The vacuity guard first. A fingerprint table that arrived empty, or a document parse that
    // found no scripts, would make every assertion below pass while measuring nothing.
    expect(
      WEBGL_MARKS.length,
      'ops/asset-budget.mjs publishes no WebGL-bearing fingerprint, so this scan classifies nothing'
    ).toBeGreaterThan(0);

    const document = await request.get(`${baseURL}${ROUTE}`);
    expect(document.status(), 'the home route did not answer 200').toBe(200);

    const hrefs = documentScriptHrefs(await document.text());
    expect(
      hrefs.length,
      'the / document references no script at all, so the scan below reads nothing'
    ).toBeGreaterThan(0);

    const carrying: string[] = [];
    for (const href of hrefs) {
      const response = await request.get(`${baseURL}${href}`);
      expect(response.status(), `${href} is referenced by the document and answered ${response.status()}`).toBe(200);
      const libraries = webglLibrariesIn(await response.text());
      if (libraries.length > 0) carrying.push(`${href} carries ${libraries.join(', ')}`);
    }

    // Logged so `ops/asset-budget.md` can quote a run rather than assert one.
    console.log(`narrative: scanned ${hrefs.length} eager scripts on ${ROUTE}`);

    expect(
      carrying,
      `the narrative is in the eager entry for ${ROUTE}, so three.js and R3F are fetched at first ` +
        `paint whatever the source looks like:\n${carrying.join('\n')}`
    ).toEqual([]);
  });

  test('and that scan discriminates, measured against the narrative chunk the page then fetches', async ({
    page,
    request,
    baseURL,
  }) => {
    // The control, and it is a real artifact rather than a planted one. The narrative still exists
    // and the page still fetches it; the claim above is only that the document does not reference
    // it. So the same scan is run over the scripts the browser requested that the document did not
    // name, and it must find `three` there. A scan that found nothing anywhere would pass the case
    // above for the wrong reason.
    const requested: string[] = [];
    page.on('request', (request_) => {
      if (request_.resourceType() === 'script') requested.push(request_.url());
    });

    await goTo(page, ROUTE);
    // The dynamic import is issued from an effect after hydration, so the request is not on the
    // navigation's own timeline. Long enough for it on a loaded runner, short enough that a
    // narrative that never arrives fails here rather than passing quietly.
    await page.waitForTimeout(4_000);

    const document = await request.get(`${baseURL}${ROUTE}`);
    const eager = new Set(documentScriptHrefs(await document.text()).map((href) => new URL(href, baseURL).href));

    const onDemand = [...new Set(requested)].filter((url) => !eager.has(url));
    expect(
      onDemand.length,
      'the browser fetched no script the document did not already name, so either the narrative ' +
        'never loads or this control has nothing to measure'
    ).toBeGreaterThan(0);

    const found: string[] = [];
    for (const url of onDemand) {
      const response = await request.get(url);
      if (response.status() !== 200) continue;
      const libraries = webglLibrariesIn(await response.text());
      if (libraries.length > 0) found.push(`${url.split('/').pop()} carries ${libraries.join(', ')}`);
    }

    console.log(`narrative: on-demand scripts carrying WebGL:\n${found.join('\n') || '(none)'}`);

    expect(
      found.length,
      'the same scan finds no WebGL library in anything the page fetched on demand either, so it ' +
        'is not discriminating and the clean result above proves nothing'
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Payload independence, demonstrated by taking the narrative away.
// ---------------------------------------------------------------------------

test.describe('the page is whole with the narrative blocked', () => {
  /**
   * Abort every request for a script that carries a WebGL fingerprint, and let everything else
   * through untouched.
   *
   * Selected by fingerprint rather than by file name: chunk names are content hashes and change
   * every build, so a route pattern naming one would stop matching and quietly stop blocking
   * anything, which is the failure mode this whole file is written against.
   */
  const blockNarrative = async (
    page: Page,
    request: APIRequestContext
  ): Promise<{ aborted: string[] }> => {
    const aborted: string[] = [];
    // Classified once per URL. The verdict is taken over a request context of the test's own rather
    // than over `route.fetch()`, so nothing the page does to its own network stack while the
    // handler is deciding can dispose the response mid-read, and every request the page makes is
    // either aborted or continued untouched.
    const narrative = new Map<string, boolean>();

    await page.route('**/_next/static/chunks/**/*.js', async (route) => {
      const url = route.request().url();

      try {
        if (!narrative.has(url)) {
          const response = await request.get(url);
          narrative.set(url, response.status() === 200 && webglLibrariesIn(await response.text()).length > 0);
        }

        if (narrative.get(url)) {
          aborted.push(url.split('/').pop() ?? url);
          await route.abort();
          return;
        }

        await route.continue();
      } catch {
        // A request that arrives while the test is already tearing down finds a disposed request
        // context. Letting it through is the safe answer: every case here asserts on `aborted`, so a
        // narrative request that slipped past shows up as an empty ledger rather than as a pass.
        await route.continue().catch(() => undefined);
      }
    });

    return { aborted };
  };

  test('the premise, the Directory and the footer render, and /#suite still focuses the heading', async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`));

    const { aborted } = await blockNarrative(page, request);

    const response = await page.goto(`${ROUTE}#${HEADING_ID}`, { waitUntil: 'load' });
    expect(response?.status(), 'the home route did not answer 200').toBe(200);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    // Long enough for the dynamic import to be issued and refused, and for anything Lenis does to
    // the scroll position after hydration to have happened. Same reason as
    // `tests/e2e/suite-directory.pw.ts:334-336`.
    await page.waitForTimeout(4_000);

    // The control. If nothing was blocked, everything below is a description of the ordinary page.
    expect(
      aborted,
      'no narrative-bearing script was requested, so nothing was blocked and this case measures ' +
        'the page in its ordinary state'
    ).not.toEqual([]);
    console.log(`narrative: aborted ${aborted.length} narrative request(s): ${aborted.join(', ')}`);

    await expect(page.locator('.premise'), 'the premise block is gone with the narrative blocked').toBeVisible();
    await expect(
      page.locator('.suite-directory__row').first(),
      'the Suite Directory renders no row with the narrative blocked'
    ).toBeVisible();
    await expect(page.locator('footer.site-footer'), 'the footer is gone with the narrative blocked').toBeVisible();

    const landed = await page.evaluate((id) => {
      const heading = document.getElementById(id);
      if (!heading) return null;
      const box = heading.getBoundingClientRect();
      return {
        focused: document.activeElement === heading,
        activeElement: document.activeElement?.tagName ?? 'none',
        inView: box.top < window.innerHeight && box.bottom > 0,
      };
    }, HEADING_ID);

    expect(landed, `nothing on the home route carries id="${HEADING_ID}" with the narrative blocked`).not.toBeNull();
    expect(landed?.inView, `#${HEADING_ID} is off screen after the fragment navigation`).toBe(true);
    expect(
      landed?.focused,
      `#${HEADING_ID} is not focused with the narrative blocked, so the payload the page is ` +
        `supposed to be independent of is what was moving focus. Active element was ${landed?.activeElement}`
    ).toBe(true);

    // The narrative failing to arrive is a load failure, not an application fault, and it must not
    // surface as one. A chunk-load rejection reaching `window.onerror` would mean a visitor on a
    // flaky connection sees an error page instead of the Directory.
    expect(errors, `the page reported an error with the narrative blocked:\n${errors.join('\n')}`).toEqual([]);
  });

  test('and nothing announces the wait, on the blocked path or the clean one', async ({ page, request }) => {
    // `EXPERIENCE.md:658-659` refuses a spinner. The blocked path is where one would be visible for
    // good, so it is the path worth reading, and the clean path is read in the same case because a
    // skeleton that flashes for 200ms is still a skeleton.
    const { aborted } = await blockNarrative(page, request);
    await goTo(page, ROUTE);
    await page.waitForTimeout(4_000);

    expect(
      aborted,
      'no narrative-bearing script was blocked, so this reads the ordinary page rather than the ' +
        'one the visitor gets when the chunk never arrives'
    ).not.toEqual([]);

    const announcing = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[role="progressbar"], [role="status"], [aria-busy="true"], [class*="spinner"], ' +
            '[class*="skeleton"], [class*="loading"], [class*="loader"]'
        ),
      ].map((node) => node.outerHTML.slice(0, 200))
    );

    expect(
      announcing,
      `the route announces a wait while the narrative is missing:\n${announcing.join('\n')}`
    ).toEqual([]);
  });

  test('and that sweep fires, measured against a control planted into the route', async ({ page }) => {
    await goTo(page, ROUTE);

    await page.evaluate(() => {
      const spinner = document.createElement('div');
      spinner.className = 'planted-spinner';
      spinner.setAttribute('role', 'progressbar');
      document.body.append(spinner);
    });

    const announcing = await page.evaluate(
      () =>
        document.querySelectorAll(
          '[role="progressbar"], [role="status"], [aria-busy="true"], [class*="spinner"], ' +
            '[class*="skeleton"], [class*="loading"], [class*="loader"]'
        ).length
    );

    expect(
      announcing,
      'a planted spinner was not seen, so the sweep above reports nothing for the wrong reason'
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The preload set, pinned rather than assumed.
// ---------------------------------------------------------------------------

test.describe("the / document's preload set", () => {
  /** Every `<link rel~=preload>` in the document, as the browser parsed it. */
  const preloads = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('link[rel~="preload"]')].map((node) => ({
        href: (node as HTMLLinkElement).href,
        as: node.getAttribute('as')?.toLowerCase() ?? '',
        priority: (node.getAttribute('fetchpriority') ?? '').toLowerCase(),
      }))
    );

  test('preloads two font faces, nothing narrative, and nothing at high priority', async ({ page, request }) => {
    await goTo(page, ROUTE);
    const links = await preloads(page);

    expect(links.length, 'the / document preloads nothing at all, so this case measures nothing').toBeGreaterThan(0);

    // The document emits the layout's two font preloads twice, so the claim is about the distinct
    // set of faces rather than about the number of link elements. A browser fetches a URL once.
    const fonts = [...new Set(links.filter((link) => link.as === 'font').map((link) => link.href))];
    expect(
      fonts.length,
      `the / document preloads ${fonts.length} font faces rather than two:\n${fonts.join('\n')}`
    ).toBe(2);

    const high = links.filter((link) => link.priority === 'high');
    expect(
      high.map((link) => link.href),
      'a preload on / asks for high priority, which is the whole non-3D path competing with itself'
    ).toEqual([]);

    // No preload may point at the narrative, whatever its `as` says. This is the one that would
    // catch a bundler deciding to prime the deferred chunk from the document.
    const narrative: string[] = [];
    for (const link of links) {
      if (extname(new URL(link.href).pathname) !== '.js') continue;
      const response = await request.get(link.href);
      if (response.status() !== 200) continue;
      if (webglLibrariesIn(await response.text()).length > 0) narrative.push(link.href);
    }
    expect(narrative, `a preload on / points at the narrative:\n${narrative.join('\n')}`).toEqual([]);
  });

  test('and that read fires, measured against a preload planted into the head', async ({ page }) => {
    await goTo(page, ROUTE);

    await page.evaluate(() => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.setAttribute('as', 'font');
      link.setAttribute('fetchpriority', 'high');
      link.href = '/fonts/planted.woff2';
      document.head.append(link);
    });

    const links = await preloads(page);
    const fonts = [...new Set(links.filter((link) => link.as === 'font').map((link) => link.href))];

    expect(fonts.length, 'a planted font preload was not seen by the read above').toBe(3);
    expect(
      links.filter((link) => link.priority === 'high').length,
      'a planted high-priority preload was not seen, so the priority read reports nothing for the ' +
        'wrong reason'
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The gem's reveal, and the properties the entrance is allowed to touch.
// ---------------------------------------------------------------------------

test.describe("the gem's reveal", () => {
  /** Read `.home-gem`'s two properties at a moment in the entrance. */
  const readGem = (page: Page) =>
    page.evaluate(() => {
      const gem = document.querySelector('.home-gem');
      if (!gem) return null;
      const style = getComputedStyle(gem);
      return { opacity: Number.parseFloat(style.opacity), filter: style.filter };
    });

  for (const webgl of [true, false]) {
    test(`goes 0 to 1 on opacity with no filter anywhere, WebGL ${webgl ? 'present' : 'absent'}`, async ({
      browser,
    }) => {
      const samples = await withMotion(
        browser,
        async (page) => {
          await goTo(page, ROUTE);
          // `HomeLayout.tsx` starts the gem's tween at t=0.5s over 0.4s, so this reads inside the
          // window where the stylesheet's initial state is still visible.
          const start = await readGem(page);
          await page.waitForTimeout(700);
          const during = await readGem(page);
          await page.waitForTimeout(2_500);
          const end = await readGem(page);
          return { start, during, end };
        },
        webgl ? undefined : NO_WEBGL
      );

      expect(samples.start, 'the home route renders no .home-gem').not.toBeNull();

      expect(
        samples.start?.opacity,
        'the gem is already fully opaque before its tween runs, so the stylesheet no longer holds ' +
          'an initial state and the tween is a flourish rather than a reveal'
      ).toBeLessThan(1);
      expect(samples.end?.opacity, 'the gem never reaches full opacity, so the reveal does not complete').toBe(1);

      // `filter: brightness(0)` at `HomeLayout.scss:190` is what the reveal used to undo. Left
      // behind it would black out the fallback image too, which is why this is read on both paths.
      for (const [name, sample] of Object.entries(samples)) {
        expect(
          sample?.filter,
          `the gem carries a filter at the "${name}" sample, and EXPERIENCE.md:685-699 allows ` +
            `transform and opacity only`
        ).toBe('none');
      }
    });
  }

  test('and that read fires, measured against a filter planted onto the gem', async ({ browser }) => {
    const planted = await withMotion(browser, async (page) => {
      await goTo(page, ROUTE);
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = '.home-gem { filter: brightness(0) !important; }';
        document.head.append(style);
      });
      return readGem(page);
    });

    expect(
      planted?.filter,
      'a planted brightness(0) was read as "none", so the filter read above reports a clean gem ' +
        'for the wrong reason'
    ).toContain('brightness');
  });
});

test.describe('the entrance touches only opacity and transform, and does not loop', () => {
  /**
   * The inline declarations that **change** inside the hero over the whole entrance, and the probe
   * element's opacity at each sample.
   *
   * GSAP animates by rewriting inline declarations, so a property whose inline value moves between
   * two samples is a property something is tweening. Changes rather than presence, deliberately:
   * R3F's `<Canvas>` writes a fixed `position`, `overflow` and `pointer-events` onto its own
   * wrapper, and a sweep that counted those would report the narrative's layout as an animation.
   *
   * The `#gem-canvas` subtree is skipped for the same reason one step further in.
   * `WebGLRenderer.setSize` writes `style.width` and `style.height` in pixels onto the `<canvas>`
   * every time it measures, which is the renderer sizing its own drawing buffer rather than
   * anything anyone tweened. `.home-gem` itself is outside that subtree and is read, which is what
   * matters: it is the element the entrance actually targets.
   *
   * Read from the running page rather than from the source because `EXPERIENCE.md:685-699` is a
   * claim about what the visitor's compositor is asked to do.
   */
  const sweep = (page: Page, selector: string) =>
    page.evaluate(
      async ({ probe }) => {
        const changed = new Set<string>();
        const previous = new Map<Element, Map<string, string>>();
        const opacities: number[] = [];

        for (let tick = 0; tick < 70; tick += 1) {
          for (const node of document.querySelectorAll<HTMLElement>('.home-container, .home-container *')) {
            if (node.closest('#gem-canvas')) continue;
            const now = new Map<string, string>();
            for (let index = 0; index < node.style.length; index += 1) {
              const name = node.style[index];
              now.set(name, node.style.getPropertyValue(name));
            }

            // A node seen for the first time contributes nothing: its opening inline styles are a
            // starting state, not a tween. Only the second and later samples can show movement.
            const before = previous.get(node);
            if (before) {
              for (const [name, value] of now) if (before.get(name) !== value) changed.add(name);
              for (const name of before.keys()) if (!now.has(name)) changed.add(name);
            }
            previous.set(node, now);
          }

          const measured = document.querySelector(probe);
          if (measured) opacities.push(Number.parseFloat(getComputedStyle(measured).opacity));
          await new Promise((settle) => requestAnimationFrame(() => setTimeout(settle, 50)));
        }

        return { properties: [...changed].sort(), opacities };
      },
      { probe: selector }
    );

  /** `transform` plus `opacity`, and the spellings a browser may echo back for either. */
  const ALLOWED = new Set(['opacity', 'transform', '-webkit-transform', 'translate', 'rotate', 'scale']);

  test('writes no property outside opacity and transform, and no opacity ever goes back down', async ({
    browser,
  }) => {
    const observed = await withMotion(browser, async (page) => {
      await goTo(page, ROUTE);
      return sweep(page, '.home-role');
    });

    expect(
      observed.properties.length,
      'the entrance wrote no inline property at all over four seconds, so either it did not run ' +
        'or this sweep is reading the wrong subtree'
    ).toBeGreaterThan(0);

    const offending = observed.properties.filter((property) => !ALLOWED.has(property));
    expect(
      offending,
      `the entrance animates a property EXPERIENCE.md:685-699 does not allow: ${offending.join(', ')}. ` +
        `The whole set observed was ${observed.properties.join(', ')}`
    ).toEqual([]);

    // A `yoyo` shows up here and nowhere else: the value walks back down between samples. The role
    // line carried `repeat: 4, yoyo: true` until this story, so it is the element read.
    const dips = observed.opacities
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => index > 0 && value < observed.opacities[index - 1] - 0.01);

    expect(
      observed.opacities.length,
      'no opacity sample was taken, so the loop check measures nothing'
    ).toBeGreaterThan(10);
    expect(
      dips.map(({ index, value }) => `sample ${index} fell to ${value}`),
      'the entrance walks an opacity back down, which is a yoyo or a repeat, and ' +
        'EXPERIENCE.md:693-694 allows one orchestrated entrance with no loop in it'
    ).toEqual([]);
  });

  test('and both halves of that sweep fire, measured against controls planted into the hero', async ({ browser }) => {
    const observed = await withMotion(browser, async (page) => {
      await goTo(page, ROUTE);

      await page.evaluate(() => {
        const container = document.querySelector('.home-container');
        if (!container) throw new Error('no .home-container to plant into');

        // A property outside the allowed set, moving the way a tween moves one. A static inline
        // declaration would not do: the sweep reads change, so the control has to change.
        const offender = document.createElement('div');
        container.append(offender);
        let step = 0;
        window.setInterval(() => {
          step += 1;
          offender.style.filter = `brightness(${step % 2 === 0 ? 0.5 : 1})`;
        }, 100);

        // A yoyo, expressed as the CSS animation equivalent so no second timeline is created.
        const style = document.createElement('style');
        style.textContent =
          '@keyframes planted-yoyo { 0% { opacity: 1 } 50% { opacity: 0.1 } 100% { opacity: 1 } }' +
          '.planted-yoyo { animation: planted-yoyo 0.6s linear infinite; }';
        document.head.append(style);
        const looping = document.createElement('div');
        looping.className = 'planted-yoyo';
        container.append(looping);
      });

      return sweep(page, '.planted-yoyo');
    });

    expect(
      observed.properties,
      'a planted inline filter was not seen, so the property sweep above reports a clean entrance ' +
        'for the wrong reason'
    ).toContain('filter');

    const dips = observed.opacities.filter(
      (value, index) => index > 0 && value < observed.opacities[index - 1] - 0.01
    );
    expect(
      dips.length,
      'a planted yoyo was not seen, so the loop check above reports no loop for the wrong reason'
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FR-1's three consequences, and the routes this story must not move.
// ---------------------------------------------------------------------------

test.describe("FR-1's three consequences", () => {
  test('the Directory is reachable with no click and no route change, and nothing follows it but the footer', async ({
    page,
  }) => {
    await goTo(page, ROUTE);
    const before = page.url();

    const shape = await page.evaluate(() => {
      const directory = document.querySelector('.suite-directory');
      if (!directory) return null;
      const main = directory.closest('main');
      const siblings = [...(main?.parentElement?.children ?? [])];

      // `<script>` renders nothing and `<next-route-announcer>` is Next's own visually hidden live
      // region, injected into `<body>` by the router on every route. Neither is content following
      // the Directory, and neither exists in `app/__tests__/page.test.tsx`'s jsdom render, which is
      // where the exact-children claim is pinned. Everything else that follows `<main>` is.
      const rendering = (node: Element) =>
        !['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'NEXT-ROUTE-ANNOUNCER'].includes(node.tagName);

      return {
        inMain: Boolean(main),
        lastInMain: main?.lastElementChild === directory,
        afterMain: siblings
          .slice(siblings.indexOf(main as Element) + 1)
          .filter(rendering)
          .map((node) => node.tagName),
      };
    });

    expect(shape, 'the home route renders no Suite Directory').not.toBeNull();
    expect(shape?.inMain, 'the Suite Directory is not inside the main landmark').toBe(true);
    expect(shape?.lastInMain, 'something in main follows the Suite Directory').toBe(true);
    expect(shape?.afterMain, 'something other than the footer follows main').toEqual(['FOOTER']);
    expect(page.url(), 'reaching the Directory changed the route').toBe(before);
  });

  for (const route of NAVIGABLE_ROUTES) {
    test(`${route} still renders after the boundary move`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'load' });
      expect(response, `navigating to ${route} produced no response`).toBeTruthy();
      expect(response?.status(), `${route} answered ${response?.status()}`).toBe(route === NOT_FOUND ? 404 : 200);

      // A 200 with an empty document is not a rendering. The Hub's chrome is what every one of
      // these surfaces has in common.
      const rendered = await page.evaluate(() => document.body.innerText.trim().length);
      expect(rendered, `${route} answered but rendered no text`).toBeGreaterThan(0);
    });
  }

  for (const route of REQUESTED_ROUTES) {
    test(`${route} still resolves to its document`, async ({ request, baseURL }) => {
      const response = await request.get(`${baseURL}${route}`);
      expect(response.ok(), `${route} answered ${response.status()} after following its redirect`).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Scroll work: this story adds none, and the sweep that says so is shown firing.
// ---------------------------------------------------------------------------

test.describe('the Hub does no scroll work of its own', () => {
  /**
   * Every `.ts`, `.tsx` file under the Hub's own source, tests excluded.
   *
   * Read from disk rather than from the browser deliberately. `app/providers.tsx` installs Lenis and
   * `ScrollTrigger`, both of which register native `scroll` listeners of their own from inside
   * `node_modules`, so a browser-side count of listeners cannot answer the question the rule asks,
   * which is whether the Hub's own components do scroll work. `tests/e2e/hit-target-floor.pw.ts`
   * already reads the tree from a spec file for the same kind of claim.
   */
  const sourceFiles = (): string[] => {
    const out: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(join(REPO_ROOT, directory), { withFileTypes: true })) {
        const next = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(next);
        } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
          out.push(next);
        }
      }
    };
    for (const root of ['app', 'components', 'hooks', 'lib']) walk(root);
    return out;
  };

  /** A raw `scroll` listener, or the observer `EXPERIENCE.md:696` would require if there were any. */
  const SCROLL_LISTENER = /addEventListener\(\s*(['"`])scroll\1/;
  const OBSERVER = /\bIntersectionObserver\b/;

  test('registers no raw scroll listener and constructs no IntersectionObserver', async () => {
    const files = sourceFiles();
    expect(files.length, 'the source sweep found no file, so it measures nothing').toBeGreaterThan(0);

    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(REPO_ROOT, file), 'utf8');
      if (SCROLL_LISTENER.test(text)) hits.push(`${file} registers a raw scroll listener`);
      if (OBSERVER.test(text)) hits.push(`${file} constructs an IntersectionObserver`);
    }

    // This story adds no scroll work, so it adds no observer either: asserting a mechanism nothing
    // uses would be a test of nothing. What is asserted is that neither appears.
    expect(
      hits,
      `EXPERIENCE.md:696 forbids a raw scroll listener, and this story introduced no scroll ` +
        `work:\n${hits.join('\n')}`
    ).toEqual([]);
  });

  test('and both matchers fire, measured against a needle the sweep is run over', async () => {
    // The control is the matcher rather than a planted file: writing a `.tsx` into the tree during
    // a run would leave a fixture behind, which every other suite here refuses to do.
    expect(SCROLL_LISTENER.test("window.addEventListener('scroll', onScroll)")).toBe(true);
    expect(SCROLL_LISTENER.test('window.addEventListener("scroll", onScroll)')).toBe(true);
    expect(OBSERVER.test('const io = new IntersectionObserver(entries => {})')).toBe(true);

    // And it does not fire on the things that merely read like it, which is what makes a clean
    // sweep meaningful rather than merely narrow.
    expect(SCROLL_LISTENER.test("element.addEventListener('wheel', onWheel)")).toBe(false);
    expect(SCROLL_LISTENER.test("lenis.on('scroll', ScrollTrigger.update)")).toBe(false);
  });
});
