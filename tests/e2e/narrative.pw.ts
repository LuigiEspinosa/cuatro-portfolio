import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { RENDERED_VIEWPORT } from './harness';

/**
 * The narrative behind one dynamic boundary, measured on what the browser fetches (Story 2-12).
 *
 * FR-1's structure already held before this story: Stories 2-9 and 2-11 made the Suite Directory the
 * terminal section and put the premise above it. What was false was the payload NFR.
 * `ops/asset-budget.md` measured it on 2026-08-29: 6,459 of 418,757 gzipped narrative bytes were
 * deferred, 1.5 percent, because `GemComponent` imported `@react-three/postprocessing` and
 * `ParticleWave` statically beside a dynamic `Scene` call and a static import is not deferred by a
 * dynamic call next to it.
 *
 * **The deferral is proved on the served document, never on the import graph.** A test that read the
 * import graph would have been green for the whole time the defect stood: `next/dynamic` was already
 * there. So the question asked here is the one the acceptance criterion asks, is the narrative in
 * what the browser fetches before it can paint, and it is answered by fetching every script the `/`
 * document references and scanning each for a library fingerprint.
 *
 * **Deferred is not the same claim as absent, and both are asserted.** A boundary that defers the
 * narrative perfectly and then never mounts it would pass every payload case in this file and be a
 * worse defect than the one it fixes, so `the narrative still runs` looks for a real `<canvas>` in a
 * real browser, with the WebGL-less path as its discriminating control.
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
 * **Nothing here sleeps for a fixed interval.** Every wait is `expect.poll` on a real condition, and
 * every measurement whose subject is a transient state (the gem's initial opacity, a spinner that
 * flashes and is removed) is recorded from an init script that runs before the page's own scripts,
 * so the reading cannot be late. A sweep of a settled DOM would pass against a `loading:` option,
 * which is exactly the hole this file's first version had.
 *
 * **Every clean result is read only after the same measurement has been seen firing.** Where the
 * control is a defect it is planted into the live page through the browser, so no fixture is left in
 * the tree, which is the rule `tests/e2e/premise.pw.ts`, `status-mark.pw.ts` and
 * `suite-directory.pw.ts` set. Where the control is a real artifact it is the deferred narrative
 * chunk itself, or the WebGL-less path.
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
 * The routes FR-1's third consequence names, plus the ones this story must not move.
 *
 * **`/projects` left the navigable list on 2026-09-07.** Story 2-14 answers it with a 301 to
 * `/#suite`, and Playwright follows a redirect, so a route left here would have navigated to `/`
 * and measured the homepage twice under a second name. Its status and `Location` are asserted in
 * `tests/e2e/projects-redirect.pw.ts` instead, without following.
 *
 * **`/cv` moved the other way on 2026-09-10.** Story 2-16 removed its redirect and built the page,
 * so it answers a document a browser can navigate to and it joins the navigable list, where the
 * loop below asserts 200 and rendered text rather than merely that a request resolves.
 *
 * **A second list, `REQUESTED_ROUTES`, sat beside this one until 2026-09-11.** It held
 * `/recommendation`, which answered 308 to a PDF and so was requested rather than navigated to,
 * since a browser answers a PDF redirect by starting a download. Story 2-17 retired that route, so
 * the list would have iterated nothing and was deleted with its loop rather than left as `[]`.
 * `tests/e2e/secondary-surfaces.pw.ts` asserts the 404 it answers now.
 */
const NAVIGABLE_ROUTES = ['/', '/work', '/cv', '/celeste', NOT_FOUND] as const;

/** How long any single condition here is given before it is called a failure. */
const SETTLE_TIMEOUT = 15_000;

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

/** The extensions a `<script src>` may carry and still be a script. */
const SCRIPT_EXTENSIONS = ['.js', '.mjs', '.cjs'];

/**
 * Every script URL the `/` document references, resolved absolute against `base`.
 *
 * `<script src>` plus `<link rel=modulepreload>` plus `<link rel=preload as=script>`, which is the
 * same set `ops/asset-budget.mjs` weighs for a route. Read from the served bytes rather than from
 * the DOM, because the DOM after hydration also holds the chunks the page went on to request, and
 * those are exactly what this measurement has to exclude.
 *
 * Resolved through `new URL` rather than concatenated onto the base: a deploy setting `assetPrefix`
 * emits absolute or off-origin `src` values, and concatenation would turn that into a 404 and a
 * status assertion rather than into the finding the scan exists to report.
 */
const documentScriptUrls = (html: string, base: string): string[] => {
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

  return [...hrefs]
    .map((href) => new URL(href, base).href)
    .filter((url) => SCRIPT_EXTENSIONS.includes(extname(new URL(url).pathname)));
};

const goTo = async (page: Page, route: string): Promise<void> => {
  // Not `networkidle`: the GSAP ticker, and Lenis where the context has not asked for reduced
  // motion (A-17), keep the Hub from ever reaching it (`tests/e2e/harness.ts:92-95`). That matters
  // more than usual on a route whose whole subject is loading.
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

/**
 * An init script that makes every WebGL context request answer `null`.
 *
 * `hooks/useNarrativePath.ts` asks a detached `<canvas>` for a `webgl` context and answers `'flat'`
 * when there is none, so this is how the non-3D front door is reached in a browser that does have
 * WebGL. Until Story 2-13 that path rendered a static image of the same scene; it now renders
 * nothing at all, and the stub is still how the path is reached. Anchored on the symbol rather than
 * on a line range: this file has already outlived two of its own line citations.
 */
const NO_WEBGL = `
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (typeof type === 'string' && type.toLowerCase().includes('webgl')) return null;
    return original.call(this, type, ...rest);
  };
`;

/**
 * Anything that would tell a visitor to wait.
 *
 * Kept character for character identical to `ANNOUNCES_A_WAIT` in
 * `components/molecules/GemComponent/__tests__/GemComponent.test.tsx`, so a spinner one sweep would
 * catch cannot slip past the other. Substring matching on `class` throughout, because `is-loading`
 * and `LoadingRing` are the same defect as `loading`.
 */
const ANNOUNCES_A_WAIT =
  '[role="progressbar"], [role="status"], [aria-busy="true"], [class*="spinner"], ' +
  '[class*="skeleton"], [class*="loading"], [class*="loader"]';

/**
 * An init script that records every announcement the page ever shows, from the first frame.
 *
 * A single sweep of a settled DOM is not a measurement of this claim. `next/dynamic`'s `loading:`
 * component is mounted between first render and the chunk resolving, which on a warm connection is
 * a few dozen milliseconds, and it is then unmounted; a read four seconds later sees nothing and
 * reports a clean route. Recording on every frame from document start is what makes the flash
 * visible, and the control below plants exactly that: a node added at document start and removed
 * before the read.
 */
const ANNOUNCEMENT_RECORDER = `
  window.__announced = [];
  (function record() {
    for (const node of document.querySelectorAll(${JSON.stringify(ANNOUNCES_A_WAIT)})) {
      window.__announced.push(node.outerHTML.slice(0, 200));
    }
    requestAnimationFrame(record);
  })();
`;

/**
 * An init script that samples `.home-gem`'s opacity and filter on every animation frame.
 *
 * The gem's tween starts 0.5s after hydration and runs 0.4s. A test that navigates and then reads
 * is racing that window on a loaded runner, and losing the race reads as "the stylesheet holds no
 * initial state" rather than as "the sample was late". Sampling from before the page's own scripts
 * run removes the race: the whole reveal is in the array by the time anything is asserted.
 */
const GEM_SAMPLER = `
  window.__gemSamples = [];
  (function sample() {
    const gem = document.querySelector('.home-gem');
    if (gem) {
      const style = getComputedStyle(gem);
      window.__gemSamples.push({ opacity: parseFloat(style.opacity), filter: style.filter });
    }
    requestAnimationFrame(sample);
  })();
`;

interface GemSample {
  opacity: number;
  filter: string;
}

/** Everything the sampler has recorded so far. */
const gemSamples = (page: Page): Promise<GemSample[]> =>
  page.evaluate(() => (window as unknown as { __gemSamples?: GemSample[] }).__gemSamples ?? []);

/** Everything the announcement recorder has seen so far, deduplicated. */
const announcements = (page: Page): Promise<string[]> =>
  page.evaluate(() => [
    ...new Set((window as unknown as { __announced?: string[] }).__announced ?? []),
  ]);

/**
 * Run `read` against a context that has not asked for reduced motion.
 *
 * `playwright.config.ts:79` sets `reducedMotion: 'reduce'` for every test, which is what stops the
 * entrance at source for the suites that measure a settled layout. The cases that measure the
 * entrance itself need it running, so they open a second context that differs in that option and in
 * nothing else. Same shape as `tests/e2e/premise.pw.ts:90-108`.
 */
const withMotion = async <T>(
  browser: Browser,
  read: (page: Page) => Promise<T>,
  inits: string[] = []
): Promise<T> => {
  const context = await browser.newContext({
    viewport: { ...RENDERED_VIEWPORT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    for (const init of inits) await page.addInitScript(init);
    return await read(page);
  } finally {
    await context.close();
  }
};

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

    const document = await request.get(new URL(ROUTE, baseURL).href);
    expect(document.status(), 'the home route did not answer 200').toBe(200);

    const urls = documentScriptUrls(await document.text(), baseURL as string);
    expect(
      urls.length,
      'the / document references no script at all, so the scan below reads nothing'
    ).toBeGreaterThan(0);

    const carrying: string[] = [];
    for (const url of urls) {
      const response = await request.get(url);
      expect(response.status(), `${url} is referenced by the document and answered ${response.status()}`).toBe(200);
      const libraries = webglLibrariesIn(await response.text());
      if (libraries.length > 0) carrying.push(`${url} carries ${libraries.join(', ')}`);
    }

    // Logged so `ops/asset-budget.md` can quote a run rather than assert one.
    console.log(`narrative: scanned ${urls.length} eager scripts on ${ROUTE}`);

    expect(
      carrying,
      `the narrative is in the eager entry for ${ROUTE}, so three.js and R3F are fetched at first ` +
        `paint whatever the source looks like:\n${carrying.join('\n')}`
    ).toEqual([]);
  });

  test('and that scan discriminates, measured against the narrative chunk the page then fetches', async ({
    browser,
    request,
    baseURL,
  }) => {
    // The control, and it is a real artifact rather than a planted one. The narrative still exists
    // and the page still fetches it; the claim above is only that the document does not reference
    // it. So the same scan is run over the scripts the browser requested that the document did not
    // name, and it must find `three` there. A scan that found nothing anywhere would pass the case
    // above for the wrong reason.
    //
    // **On a context that has not asked for reduced motion, since Story 2-13.**
    // `playwright.config.ts:79` runs every test with `reducedMotion: 'reduce'`, which is one of the
    // four triggers of the non-3D front door: on that context the narrative is never requested at
    // all, and this control would have nothing to find. The case above is unaffected, because the
    // served document is the same on both paths.
    const document = await request.get(new URL(ROUTE, baseURL).href);
    const eager = new Set(documentScriptUrls(await document.text(), baseURL as string));

    const found = await withMotion(browser, async (page) => {
      const requested: string[] = [];
      page.on('request', (issued) => {
        if (issued.resourceType() === 'script') requested.push(issued.url());
      });

      await goTo(page, ROUTE);

      // The dynamic import is issued from an effect after hydration and after the path has been
      // decided, so the request is not on the navigation's own timeline. Polled rather than slept
      // through: a narrative that never arrives fails here with a message rather than after a sleep.
      const onDemand = () => [...new Set(requested)].filter((url) => !eager.has(url));
      await expect
        .poll(() => onDemand().length, {
          timeout: SETTLE_TIMEOUT,
          message:
            'the browser fetched no script the document did not already name, so either the narrative ' +
            'never loads or this control has nothing to measure',
        })
        .toBeGreaterThan(0);

      const carrying: string[] = [];
      for (const url of onDemand()) {
        const response = await request.get(url);
        if (response.status() !== 200) continue;
        const libraries = webglLibrariesIn(await response.text());
        if (libraries.length > 0) carrying.push(`${url.split('/').pop()} carries ${libraries.join(', ')}`);
      }
      return carrying;
    });

    console.log(`narrative: on-demand scripts carrying WebGL:\n${found.join('\n') || '(none)'}`);

    expect(
      found.length,
      'the same scan finds no WebGL library in anything the page fetched on demand either, so it ' +
        'is not discriminating and the clean result above proves nothing'
    ).toBeGreaterThan(0);
  });
});

/** The marks that belong to the gem's boundary and to nothing else the Hub imports. */
const GEM_ONLY_MARKS = WEBGL_MARKS.filter((entry) => entry.library.includes('postprocessing'));

/**
 * Load `/` once and report which narrative chunks the browser actually fetched.
 *
 * The wait is on the page reaching a state where the path has been decided (a canvas on the
 * narrative path, the flat modifier on the other) and then on the script request set going quiet,
 * so the two paths this is called on are compared at the same point in their lives rather than at
 * the same number of milliseconds.
 *
 * **The context asks for no reduced motion explicitly.** It is one of Story 2-13's four non-3D
 * triggers, and this helper is called to compare a WebGL path against a WebGL-less one: a context
 * that quietly inherited `reduce` would put both loads on the same path and the comparison would
 * report no difference, which is the exact shape of the failure it exists to catch.
 */
const narrativeChunksOn = async (
  browser: Browser,
  request: APIRequestContext,
  inits: string[]
): Promise<{ chunks: Set<string>; postprocessing: boolean }> => {
  const context = await browser.newContext({
    viewport: { ...RENDERED_VIEWPORT },
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    for (const init of inits) await page.addInitScript(init);

    const scripts = new Set<string>();
    page.on('response', (response) => {
      if (response.request().resourceType() === 'script') scripts.add(response.url());
    });

    await goTo(page, ROUTE);
    await expect(
      page.locator('#gem-canvas canvas, .home-container--flat'),
      'the path was never decided on this load, so nothing can be compared'
    ).toBeVisible({ timeout: SETTLE_TIMEOUT });

    // Quiescence rather than a sleep: poll until the request set stops growing across two reads.
    let previous = -1;
    await expect
      .poll(
        () => {
          const settled = scripts.size === previous;
          previous = scripts.size;
          return settled;
        },
        { timeout: SETTLE_TIMEOUT, intervals: [500], message: 'the page never stopped requesting scripts' }
      )
      .toBe(true);

    const chunks = new Set<string>();
    let postprocessing = false;
    for (const url of scripts) {
      const body = await request.get(url);
      if (body.status() !== 200) continue;
      const text = await body.text();
      if (webglLibrariesIn(text).length === 0) continue;
      chunks.add(url.split('/').pop() ?? url);
      if (GEM_ONLY_MARKS.some((entry) => text.includes(entry.mark))) postprocessing = true;
    }

    return { chunks, postprocessing };
  } finally {
    await context.close();
  }
};

// ---------------------------------------------------------------------------
// The narrative still runs. Deferred is not the same claim as absent.
// ---------------------------------------------------------------------------

test.describe('the narrative still runs', () => {
  test('mounts a real canvas inside #gem-canvas once the chunk arrives', async ({ browser }) => {
    // The failure this whole story could have shipped: a boundary that defers perfectly and never
    // mounts anything. Every payload case in this file passes in that world, and so do the gem's
    // reveal cases, because GSAP writes to the wrapper whether or not the canvas exists. Only
    // looking for the canvas catches it.
    //
    // On a `no-preference` context since Story 2-13: the project's default context asks for
    // reduced motion, which is now the non-3D path and mounts no canvas by design.
    const size = await withMotion(browser, async (page) => {
      await goTo(page, ROUTE);

      const canvas = page.locator('#gem-canvas canvas');
      await expect(canvas, 'no canvas ever mounted, so the narrative is deferred and never runs').toBeVisible({
        timeout: SETTLE_TIMEOUT,
      });

      return canvas.evaluate((node) => ({
        width: (node as HTMLCanvasElement).width,
        height: (node as HTMLCanvasElement).height,
      }));
    });

    expect(size.width, 'the canvas mounted with no drawing buffer width').toBeGreaterThan(0);
    expect(size.height, 'the canvas mounted with no drawing buffer height').toBeGreaterThan(0);
  });

  test('and that read discriminates, measured on the path where no canvas may mount', async ({ browser }) => {
    // The control, and it is the real WebGL-less path rather than a planted one: with the probe
    // answering `null`, the front door is the flat one and nothing at all is drawn in the hero. If
    // a canvas turned up here the case above would be reporting something that appears on every
    // path, which is nothing.
    //
    // **It asserts an absence where it used to assert an image.** Until Story 2-13 this path
    // rendered `gem-fallback.png`, a 1,755,015-byte still of the same scene;
    // `EXPERIENCE.md:173-176` refuses one by name, so the file is deleted and the hero draws
    // nothing. The `no-preference` context is what makes the WebGL stub the trigger under test
    // rather than the motion preference the config sets.
    const hero = await withMotion(
      browser,
      async (page) => {
        await goTo(page, ROUTE);

        await expect(
          page.locator('.home-container--flat'),
          'the WebGL-less load never reached the non-3D path, so this control is not on the path it claims'
        ).toBeVisible({ timeout: SETTLE_TIMEOUT });

        return {
          canvases: await page.locator('.home-container canvas').count(),
          images: await page.locator('.home-container img').count(),
          gems: await page.locator('.home-gem, #gem-canvas').count(),
        };
      },
      [NO_WEBGL]
    );

    expect(hero.canvases, 'a canvas mounted on the path where the WebGL probe answered null').toBe(0);
    expect(hero.images, 'the non-3D path renders an image in the hero, which EXPERIENCE.md:173-176 refuses').toBe(0);
    expect(hero.gems, 'the non-3D path leaves the gem container behind, so the hero has a hole in it').toBe(0);
  });

  test('and the gem chunk is never even requested on that path', async ({ browser, request }) => {
    // The payload half of the same gate. `next/dynamic` issues its import on first render of the
    // returned component, so rendering it before the probe has answered would have every device
    // without WebGL download the whole narrative to draw a static PNG. On a story whose subject is
    // payload that is the miss worth pinning.
    //
    // **Measured as a difference between two loads rather than as an absence on one.** `/` is not
    // free of narrative requests on either path: the App Router prefetches the route bundles behind
    // the hero's two `<Link>`s, and `/work` still carries `three` eagerly, so a flat "no narrative
    // chunk is requested" assertion fails on something this story does not own. The second link
    // pointed at `/projects`, which carried `three-stdlib` through `TorusKnotCanvas` until Story
    // 2-14 deleted the route on 2026-09-07; it now prefetches a redirect, and repointing the chrome
    // at `/#suite` is Story 2-15's job. That prefetch is filed in
    // `_bmad-output/implementation-artifacts/deferred-work.md`.
    // What the gate controls is the difference between the two paths, so that is what is read.
    const withWebgl = await narrativeChunksOn(browser, request, []);
    const withoutWebgl = await narrativeChunksOn(browser, request, [NO_WEBGL]);

    console.log(
      `narrative: with WebGL ${[...withWebgl.chunks].join(', ') || '(none)'}\n` +
        `narrative: without WebGL ${[...withoutWebgl.chunks].join(', ') || '(none)'}`
    );

    const onlyWithWebgl = [...withWebgl.chunks].filter((name) => !withoutWebgl.chunks.has(name));
    expect(
      onlyWithWebgl,
      'both paths fetched the same narrative chunks, so the WebGL probe gates nothing and a device ' +
        'that cannot draw the gem downloads it anyway'
    ).not.toEqual([]);

    // The sharper half of the same claim. `@react-three/postprocessing` is imported by
    // `GemNarrative` and by nothing else in this repository, which `ops/asset-budget.md` shows as a
    // chunk on `/` alone, so its presence is the gem's boundary and not the router's prefetching.
    expect(
      withWebgl.postprocessing,
      'the WebGL path never fetched the gem post-processing chunk, so this comparison has no ' +
        'subject and the case below proves nothing'
    ).toBe(true);
    expect(
      withoutWebgl.postprocessing,
      'a device with no WebGL downloaded the gem post-processing chunk anyway, so the probe is not ' +
        'gating the dynamic import'
    ).toBe(false);
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
   *
   * `leaked` is the other half of the ledger. Without it a run where one narrative chunk was blocked
   * and another slipped through reads exactly like a clean run, because `aborted` is non-empty
   * either way.
   */
  const blockNarrative = async (
    page: Page,
    request: APIRequestContext
  ): Promise<{ aborted: string[]; leaked: string[] }> => {
    const aborted: string[] = [];
    const leaked: string[] = [];
    // Classified once per URL. The verdict is taken over a request context of the test's own rather
    // than over `route.fetch()`, so nothing the page does to its own network stack while the
    // handler is deciding can dispose the response mid-read.
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
      } catch (error) {
        // A request that arrives while the test is already tearing down finds a disposed request
        // context, and the only safe answer is to let it through. That is a hole unless it is
        // recorded: a chunk this handler could not classify may have been the narrative, so it is
        // booked as leaked and every case below fails on a non-empty ledger.
        leaked.push(`${url.split('/').pop() ?? url}: ${String(error).split('\n')[0]}`);
        await route.continue().catch(() => undefined);
      }
    });

    return { aborted, leaked };
  };

  /** The two ledgers, asserted together: something was blocked, and nothing escaped unclassified. */
  const expectCleanBlock = async (ledger: { aborted: string[]; leaked: string[] }): Promise<void> => {
    await expect
      .poll(() => ledger.aborted.length, {
        timeout: SETTLE_TIMEOUT,
        message:
          'no narrative-bearing script was requested, so nothing was blocked and this case measures ' +
          'the page in its ordinary state',
      })
      .toBeGreaterThan(0);

    expect(
      ledger.leaked,
      `a chunk reached the page without being classified, so the narrative may have loaded ` +
        `anyway:\n${ledger.leaked.join('\n')}`
    ).toEqual([]);
  };

  // Every case in this block runs on a `no-preference` context since Story 2-13. Blocking the
  // narrative is only a measurement on the path that requests one, and `playwright.config.ts:79`
  // makes reduced motion, which is a non-3D trigger, the default for every test.
  test('the premise, the Directory and the footer render, and /#suite still focuses the heading', async ({
    browser,
    request,
  }) => {
    await withMotion(browser, async (page) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`));

      const ledger = await blockNarrative(page, request);

      const response = await page.goto(`${ROUTE}#${HEADING_ID}`, { waitUntil: 'load' });
      expect(response?.status(), 'the home route did not answer 200').toBe(200);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      await expectCleanBlock(ledger);
      console.log(`narrative: aborted ${ledger.aborted.length} narrative request(s): ${ledger.aborted.join(', ')}`);

      await expect(page.locator('.premise'), 'the premise block is gone with the narrative blocked').toBeVisible();
      await expect(
        page.locator('.suite-directory__row').first(),
        'the Suite Directory renders no row with the narrative blocked'
      ).toBeVisible();
      await expect(page.locator('footer.site-footer'), 'the footer is gone with the narrative blocked').toBeVisible();

      // `toBeInViewport` retries, which is what handles Lenis taking ownership of the scroll
      // position a moment after hydration, a hazard this case meets only because it runs on
      // `withMotion` (since A-17 the pinned context never constructs Lenis). Same concern as
      // `tests/e2e/suite-directory.pw.ts:278-289`, without the fixed wait.
      await expect(
        page.locator(`#${HEADING_ID}`),
        `#${HEADING_ID} is off screen after the fragment navigation`
      ).toBeInViewport({ timeout: SETTLE_TIMEOUT });

      await expect
        .poll(() => page.evaluate(() => document.activeElement?.id ?? '(none)'), {
          timeout: SETTLE_TIMEOUT,
          message:
            `#${HEADING_ID} is not focused with the narrative blocked, so the payload the page is ` +
            `supposed to be independent of is what was moving focus`,
        })
        .toBe(HEADING_ID);

      // The narrative failing to arrive is a load failure, not an application fault, and it must
      // not surface as one. A chunk-load rejection reaching `window.onerror` would mean a visitor
      // on a flaky connection sees an error page instead of the Directory. The rejection is not
      // silent either: `GemComponent` logs it to the console before containing it.
      expect(errors, `the page reported an error with the narrative blocked:\n${errors.join('\n')}`).toEqual([]);
    });
  });

  test('and nothing announces the wait, from the first frame to settle', async ({ browser, request }) => {
    // `EXPERIENCE.md:658-659` refuses a spinner. The blocked path is where one would be visible for
    // good, so it is the path read here, and the recorder catches a flash as readily as a permanent
    // one: a `loading:` component that mounts and unmounts in 40ms is still a spinner.
    await withMotion(
      browser,
      async (page) => {
        const ledger = await blockNarrative(page, request);
        await goTo(page, ROUTE);
        await expectCleanBlock(ledger);

        const seen = await announcements(page);
        expect(seen, `the route announced a wait while the narrative was missing:\n${seen.join('\n')}`).toEqual([]);
      },
      [ANNOUNCEMENT_RECORDER]
    );
  });

  test('and nothing announces it on the clean path either', async ({ browser }) => {
    await withMotion(
      browser,
      async (page) => {
        await goTo(page, ROUTE);

        // Read after the canvas is up, so the whole window in which a `loading:` component would
        // have been mounted is behind the recorder.
        await expect(page.locator('#gem-canvas canvas')).toBeVisible({ timeout: SETTLE_TIMEOUT });

        const seen = await announcements(page);
        expect(seen, `the route announced a wait while the narrative loaded:\n${seen.join('\n')}`).toEqual([]);
      },
      [ANNOUNCEMENT_RECORDER]
    );
  });

  test('and the recorder catches an announcement that is gone before the read', async ({ page }) => {
    // The control, and it is deliberately a transient. A settled-DOM sweep passes this; the recorder
    // is what does not. Planted at document start and removed two frames later, which is shorter
    // than the lifetime of a real `loading:` component on a warm connection.
    //
    // **Two frames rather than a 100ms timer, since Story 2-13.** The timer form failed once in the
    // pinned container on the non-3D front door, reporting that the recorder had missed the plant.
    // It had: `requestAnimationFrame` does not fire while the main thread is busy hydrating, and
    // when the thread frees up the browser can run a due 100ms timer before the next frame, so the
    // spinner was added and removed without a single sample in between. The timer measured wall
    // clock; what this control needs is that the recorder's own sampler cannot miss a transient, so
    // the removal is now scheduled on the same clock the sampler runs on. It is still gone long
    // before the read, which the count assertion below holds.
    await page.addInitScript(ANNOUNCEMENT_RECORDER);
    await page.addInitScript(`
      const planted = document.createElement('div');
      planted.className = 'planted-spinner';
      planted.setAttribute('role', 'progressbar');
      const attach = () => {
        document.body.append(planted);
        requestAnimationFrame(() => requestAnimationFrame(() => planted.remove()));
      };
      if (document.body) attach();
      else document.addEventListener('DOMContentLoaded', attach, { once: true });
    `);

    await goTo(page, ROUTE);
    await expect(page.locator('.planted-spinner')).toHaveCount(0, { timeout: SETTLE_TIMEOUT });

    const seen = await announcements(page);
    expect(
      seen.join('\n'),
      'a planted spinner that was removed before the read went unrecorded, so the two cases above ' +
        'would pass against a loading option that flashes'
    ).toContain('planted-spinner');
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

  const distinctFonts = (links: { href: string; as: string }[]) => [
    ...new Set(links.filter((link) => link.as === 'font').map((link) => link.href)),
  ];

  test('preloads no font face, nothing narrative, and nothing at high priority', async ({ page, request }) => {
    await goTo(page, ROUTE);
    const links = await preloads(page);

    expect(links.length, 'the / document preloads nothing at all, so this case measures nothing').toBeGreaterThan(0);

    // **Two distinct faces until 2026-09-12, zero since.** `app/layout.tsx` preloaded two local
    // binaries, and Next emitted each link twice, which is why this read is over the distinct set
    // rather than the element count. Story 2-20 deleted both preloads with the faces they named
    // and replaced them with nothing: `GlitchText.tsx` then gated `SplitText` on
    // `document.fonts.ready`, so a preload bought latency, not correctness, and a preload of a
    // contract face would put `contracts/` in a scanned source. Story 2-27 removed that gate on
    // 2026-09-14: the entrance now runs at `--delay` on whichever face is present, and
    // `font-display: swap` swaps Bricolage in when it arrives, so the refusal's first premise is
    // gone and its second stands; whether a preload is worth that trade is DW-99, deferred. The
    // read stays, so a preload put back fails here naming it.
    const fonts = distinctFonts(links);
    expect(
      fonts.length,
      `the / document preloads ${fonts.length} font faces rather than none:\n${fonts.join('\n')}`
    ).toBe(0);

    const high = links.filter((link) => link.priority === 'high');
    expect(
      high.map((link) => link.href),
      'a preload on / asks for high priority, which is the whole non-3D path competing with itself'
    ).toEqual([]);

    // No preload may point at the narrative, whatever its `as` says. This is the one that would
    // catch a bundler deciding to prime the deferred chunk from the document.
    const narrative: string[] = [];
    for (const link of links) {
      if (!SCRIPT_EXTENSIONS.includes(extname(new URL(link.href).pathname))) continue;
      const response = await request.get(link.href);
      if (response.status() !== 200) continue;
      if (webglLibrariesIn(await response.text()).length > 0) narrative.push(link.href);
    }
    expect(narrative, `a preload on / points at the narrative:\n${narrative.join('\n')}`).toEqual([]);
  });

  test('and that read fires, measured against a preload planted into the head', async ({ page }) => {
    await goTo(page, ROUTE);

    // Counted before and after rather than against a literal. A hardcoded expectation here would be
    // the clean count written down a second time, which is the drift this file exists to avoid.
    const before = await preloads(page);
    const fontsBefore = distinctFonts(before).length;
    const highBefore = before.filter((link) => link.priority === 'high').length;

    await page.evaluate(() => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.setAttribute('as', 'font');
      link.setAttribute('fetchpriority', 'high');
      link.href = '/fonts/planted.woff2';
      document.head.append(link);
    });

    const after = await preloads(page);
    expect(distinctFonts(after).length, 'a planted font preload was not seen by the read above').toBe(fontsBefore + 1);
    expect(
      after.filter((link) => link.priority === 'high').length,
      'a planted high-priority preload was not seen, so the priority read reports nothing for the ' +
        'wrong reason'
    ).toBe(highBefore + 1);
  });
});

// ---------------------------------------------------------------------------
// The gem's reveal, on both motion preferences and both WebGL paths.
// ---------------------------------------------------------------------------

test.describe("the gem's reveal", () => {
  // **One case where there were two, because the WebGL-less twin no longer has a subject.** Until
  // Story 2-13 the gem's wrapper was on the page whether or not a canvas mounted, holding a static
  // image, so the reveal was worth reading on both. That path now renders no `.home-gem` at all,
  // which `the narrative still runs` above asserts directly. What is left here is the reveal on the
  // one path that has a gem to reveal.
  test('goes 0 to 1 on opacity with no filter anywhere', async ({ browser }) => {
    const samples = await withMotion(
      browser,
      async (page) => {
        await goTo(page, ROUTE);
        await expect
          .poll(async () => (await gemSamples(page)).at(-1)?.opacity ?? -1, {
            timeout: SETTLE_TIMEOUT,
            message: 'the gem never reached full opacity, so the reveal does not complete',
          })
          .toBe(1);
        return gemSamples(page);
      },
      [GEM_SAMPLER]
    );

    expect(samples.length, 'the sampler recorded no frame, so the home route renders no .home-gem').toBeGreaterThan(1);

    expect(
      samples[0].opacity,
      'the gem is already fully opaque on the first frame, so the stylesheet no longer holds an ' +
        'initial state and the tween is a flourish rather than a reveal'
    ).toBeLessThan(1);
    expect(samples.at(-1)?.opacity, 'the gem never reaches full opacity').toBe(1);

    // `filter: brightness(0)`, once at `HomeLayout.scss:190` as the file stood before Story 2-26
    // deleted the ring blocks above it, is what the reveal used to undo. Read on
    // every frame rather than at three chosen moments, because a filter that appears mid-entrance
    // and is gone by the end is the same breach as one that stays.
    const filtered = [...new Set(samples.map((sample) => sample.filter))].filter((value) => value !== 'none');
    expect(
      filtered,
      `the gem carried a filter during the entrance, and EXPERIENCE.md:685-699 allows transform ` +
        `and opacity only: ${filtered.join(', ')}`
    ).toEqual([]);
  });

  /**
   * Every element `HomeLayout.scss`'s reduced-motion block names, and the one it cannot: the gem,
   * which this path does not render at all.
   *
   * A selector that matches nothing is reported rather than skipped, so a renamed class reads as a
   * fixture failure instead of as a hero with no animation on it.
   */
  const REDUCED_MOTION_SELECTORS = [
    '.home-panel--name',
    '.home-panel--sys',
    '.home-role',
    'a.nav-link',
    '.home-panel--contact .contact-container a',
  ] as const;

  /**
   * What each selector's elements compute for the entrance, and whether anything is animating.
   *
   * Shared by the reduced-motion cases and by the control below them, so the control exercises the
   * same code path rather than a second read that happens to agree with it.
   */
  const heroMotionState = (page: Page, selectors: readonly string[]) =>
    page.evaluate((list: string[]) => {
      const animated: string[] = [];
      for (const selector of list) {
        const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
        if (nodes.length === 0) {
          animated.push(`${selector} matched nothing, so the fixture is gone rather than the claim`);
          continue;
        }
        nodes.forEach((node, index) => {
          const name = getComputedStyle(node).animationName;
          if (name !== 'none') animated.push(`${selector}[${index}] computes animation-name "${name}"`);
        });
      }

      const hero = document.querySelector('.home-container');
      const running = hero
        ? document.getAnimations().filter((animation) => {
            const target = (animation as unknown as { effect?: { target?: Element | null } }).effect?.target ?? null;
            return target !== null && hero.contains(target);
          }).length
        : -1;

      const role = document.querySelector('.home-role');
      return {
        animated,
        running,
        roleOpacity: role ? Number.parseFloat(getComputedStyle(role).opacity) : -1,
      };
    }, [...selectors]);

  for (const webgl of [true, false]) {
    test(`the reduced-motion hero is at its final state immediately, WebGL ${
      webgl ? 'present' : 'absent'
    }`, async ({ page }) => {
      // **What this case reads changed with Story 2-29, and the reason it exists did not.** Until
      // then `HomeLayout.scss` opened the role line, the sys panel and the five links at
      // `opacity: 0` and only `gsap.set(finalState, { opacity: 1, y: 0 })` in `HomeLayout`'s
      // reduced-motion branch ever lifted them, so deleting that branch left this visitor with a
      // permanently blank hero and an eventual-opacity poll caught it.
      //
      // **That poll stopped being able to fail.** The entrance is now a `home-enter` keyframe with
      // `animation-fill-mode: both`, whose base state is the final state, so with the reduced-motion
      // block deleted the hero is blank for the delay, between 1.3s and 2.36s, and then at full
      // opacity: a poll with a 15s budget passes either way and nothing would pin the override.
      // Corrected 2026-09-21 in the same commit as the entrance, after the audit named it.
      //
      // **So this reads what reduced motion actually changes.** `HomeLayout.scss`'s block under the
      // query sets `animation: none` on every animated element in the hero, in the
      // `GlitchText.scss:50-58` shape, because the contract's duration collapse to 1ms does not
      // touch `animation-delay` and a 1ms run still waits it out. Computed `animation-name` answers
      // that at any moment on any run, and `document.getAnimations()` says the same thing one level
      // down: on this path nothing in the hero is animating at all. Delete the block and both fail
      // immediately, by name.
      //
      // The gem half of it is gone rather than moved: reduced motion is one of the four non-3D
      // triggers, so this hero has no `.home-gem` to reveal, which is asserted here as the last
      // half of the same read. The WebGL stub is carried through both values to show that: on this
      // context it changes nothing, because the motion preference has already decided the path.
      //
      // This case runs on the default context, which `playwright.config.ts:79` already sets to
      // `reducedMotion: 'reduce'`.
      if (!webgl) await page.addInitScript(NO_WEBGL);
      await goTo(page, ROUTE);

      const read = await heroMotionState(page, REDUCED_MOTION_SELECTORS);

      expect(
        read.animated,
        `a reduced-motion visitor's hero still carries the entrance. HomeLayout.scss's ` +
          `prefers-reduced-motion block sets animation: none on every one of these, and without it ` +
          `the hero is blank for the delay before the keyframe fills it:\n${read.animated.join('\n')}`
      ).toEqual([]);

      expect(
        read.running,
        'an animation is running inside the hero on a reduced-motion context, which is the same ' +
          'defect one level down from the computed read above'
      ).toBe(0);

      expect(
        read.roleOpacity,
        'the role line is not at full opacity on the frame this was read, so the base state is no ' +
          'longer the final state and a reduced-motion visitor waits for it'
      ).toBe(1);

      expect(
        await page.locator('.home-gem').count(),
        'the reduced-motion hero still carries the gem container, which EXPERIENCE.md:656 says is ' +
          'never requested on this path'
      ).toBe(0);
    });
  }

  test('and all three reduced-motion reads fire, measured against the states they assert away', async ({ page }) => {
    // The control, and since 2026-09-21 it covers **all three** reads rather than the opacity one.
    // The Step-04 review found the two added that day, `animated` and `running`, with nothing
    // showing they could fire; this plants the state each exists to catch and shows it reported,
    // then takes it away and shows it gone, in the `display-entrance.pw.ts:300-302,352-357` shape.
    await goTo(page, ROUTE);

    const clean = await heroMotionState(page, REDUCED_MOTION_SELECTORS);
    expect(clean.animated, 'the surface under the plants already carries the entrance').toEqual([]);
    expect(clean.running, 'the surface under the plants is already animating').toBe(0);
    expect(clean.roleOpacity, 'the surface under the plants is already dimmed').toBe(1);

    // One: an animation put back on the role line, which is exactly what deleting the
    // reduced-motion block would leave. Five seconds and no delay, so it is running rather than
    // waiting, which is what `getAnimations()` is asked about.
    const unplantMotion = await page.addStyleTag({
      content: '.home-role { animation: home-enter 5s linear 0s both !important; }',
    });
    const animating = await heroMotionState(page, REDUCED_MOTION_SELECTORS);
    expect(
      animating.animated,
      'a planted entrance on the role line was not reported by the computed read'
    ).toEqual(['.home-role[0] computes animation-name "home-enter"']);
    expect(animating.running, 'a planted running animation was not seen by getAnimations()').toBeGreaterThan(0);
    await unplantMotion.evaluate((node) => (node as Element).remove());

    const afterMotion = await heroMotionState(page, REDUCED_MOTION_SELECTORS);
    expect([afterMotion.animated.length, afterMotion.running], 'the planted animation outlived its case').toEqual([0, 0]);

    // Two: the hero left at the stylesheet's old initial state, which is the failure this case has
    // existed for since Story 2-12.
    const unplantDim = await page.addStyleTag({ content: '.home-role { opacity: 0 !important; }' });
    expect(
      (await heroMotionState(page, REDUCED_MOTION_SELECTORS)).roleOpacity,
      'a hero planted at opacity 0 still read as 1, so the read is a constant'
    ).toBe(0);
    await unplantDim.evaluate((node) => (node as Element).remove());

    expect(
      (await heroMotionState(page, REDUCED_MOTION_SELECTORS)).roleOpacity,
      'the planted opacity outlived its case'
    ).toBe(1);
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

  /**
   * What the stylesheets declare and what the running hero asks of them.
   *
   * **The entrance stopped writing inline styles on 2026-09-21.** Story 2-29 replaced
   * `HomeLayout.tsx`'s GSAP timeline with one `home-enter` keyframe and five `animation-delay`
   * declarations, so the inline sweep above now legitimately observes nothing and can no longer be
   * the thing that proves the entrance ran. It is kept, because a tween returning to this component
   * is exactly what it catches. What the entrance animates is read here instead: every property any
   * `@keyframes` block on this route declares, and the iteration count and direction every animated
   * element in the hero computes, which is where a loop or a yoyo would show up in a CSS entrance.
   *
   * The `#gem-canvas` subtree is skipped for the reason the sweep above gives.
   */
  const declaredEntrance = (page: Page, selectors: readonly string[]) =>
    page.evaluate((list: string[]) => {
      const selectors = list;
      const properties = new Set<string>();
      const walk = (rules: readonly CSSRule[]): void => {
        for (const rule of rules) {
          const keyframes = rule as CSSKeyframesRule;
          if (typeof keyframes.name === 'string' && keyframes.cssRules) {
            for (const frame of [...keyframes.cssRules] as CSSKeyframeRule[]) {
              for (let index = 0; index < frame.style.length; index += 1) properties.add(frame.style[index]);
            }
            continue;
          }
          const group = rule as CSSGroupingRule;
          if (group.cssRules) walk([...group.cssRules]);
        }
      };
      for (const sheet of [...document.styleSheets]) {
        // A stylesheet this document cannot read is not one this repository wrote.
        try {
          walk([...sheet.cssRules]);
        } catch {
          continue;
        }
      }

      const animated: string[] = [];
      const iterations = new Set<string>();
      const directions = new Set<string>();
      for (const node of document.querySelectorAll<HTMLElement>('.home-container, .home-container *')) {
        if (node.closest('#gem-canvas')) continue;
        const style = getComputedStyle(node);
        if (style.animationName === 'none' || style.animationName === '') continue;
        animated.push(style.animationName);
        iterations.add(style.animationIterationCount);
        directions.add(style.animationDirection);
      }

      const sites = (selectors as string[]).map((selector) => ({
        selector,
        elements: [...document.querySelectorAll<HTMLElement>(selector)].map((node) => {
          const style = getComputedStyle(node);
          return {
            name: style.animationName,
            delay: Math.round(Number.parseFloat(style.animationDelay) * 1000),
            fill: style.animationFillMode,
          };
        }),
      }));

      return {
        properties: [...properties].sort(),
        animated: [...new Set(animated)].sort(),
        iterations: [...iterations].sort(),
        directions: [...directions].sort(),
        sites,
      };
    }, [...selectors]);

  /**
   * The five rules `HomeLayout.scss` animates, each with the delays its elements carry, in the
   * order the entrance plays them.
   *
   * **Nothing read the delays or the fill until 2026-09-21.** The settle in
   * `hit-target-floor.pw.ts` and `accessibility-floor.pw.ts` waits on `ENTRANCE_SELECTOR`, which is
   * the two link groups only, so `.home-panel--sys`, `.home-role` and `.home-gem` were observed by
   * nothing on the default door: dropping a delay, or dropping `both` from any of the five, shipped
   * green. `both` is not a detail. It is the whole of the no-script guarantee the spec's No-script
   * row and DW-42 rest on: the keyframe supplies only the `from`, so `backwards` is what holds an
   * element absent through its delay and `forwards` is what leaves it present afterwards. Without
   * it the hero flickers to its base state and back. Found by the Step-04 review.
   *
   * **Five, not six.** `.home-panel--name` carried a sixth until the same day; the retired timeline
   * never named it and the 2023 stylesheet gave it no initial state, so it had been painting
   * immediately and the entrance had started hiding the hero's name for 500ms.
   *
   * A selector matching a different number of elements is reported as a fixture failure rather than
   * skipped, the way `REDUCED_MOTION_SELECTORS` above is read.
   */
  const ENTRANCE_SITES = [
    { selector: '.home-gem', delays: [500] },
    { selector: '.home-role', delays: [1300] },
    { selector: '.home-panel--sys', delays: [1600] },
    { selector: 'a.nav-link', delays: [2000, 2080] },
    { selector: '.home-panel--contact .contact-container a', delays: [2200, 2280, 2360] },
  ] as const;

  /** `transform` plus `opacity`, and the spellings a browser may echo back for either. */
  const ALLOWED = new Set(['opacity', 'transform', '-webkit-transform', 'translate', 'rotate', 'scale']);

  test('writes no property outside opacity and transform, and no opacity ever goes back down', async ({
    browser,
  }) => {
    const { declared, ...observed } = await withMotion(browser, async (page) => {
      await goTo(page, ROUTE);
      const fromCss = await declaredEntrance(page, ENTRANCE_SITES.map((site) => site.selector));
      const fromInline = await sweep(page, '.home-role');
      return { ...fromInline, declared: fromCss };
    });

    expect(
      declared.animated.length,
      'no element in the hero declares an animation at all, so either the entrance did not run or ' +
        'this sweep is reading the wrong subtree'
    ).toBeGreaterThan(0);
    expect(declared.animated, `the hero entrance is not the home-enter keyframe: ${declared.animated.join(', ')}`).toContain(
      'home-enter'
    );

    const declaredOffending = declared.properties.filter((property) => !ALLOWED.has(property));
    expect(
      declaredOffending,
      `a @keyframes block on ${ROUTE} animates a property EXPERIENCE.md:685-699 does not allow: ` +
        `${declaredOffending.join(', ')}. The whole set declared was ${declared.properties.join(', ')}`
    ).toEqual([]);

    // **Every animated rule, with its delay and its fill.** This is the read the Step-04 review
    // found missing: `both` is the no-script guarantee and three of the five sites were observed by
    // nothing at all on this door.
    const offSequence: string[] = [];
    for (const site of ENTRANCE_SITES) {
      const read = declared.sites.find((entry) => entry.selector === site.selector);
      if (!read || read.elements.length !== site.delays.length) {
        offSequence.push(
          `${site.selector} matched ${read?.elements.length ?? 0} elements and the table names ${site.delays.length}, ` +
            `so the fixture moved rather than the entrance`
        );
        continue;
      }
      read.elements.forEach((element, index) => {
        if (element.name !== 'home-enter') offSequence.push(`${site.selector}[${index}] animates "${element.name}"`);
        if (element.delay !== site.delays[index]) {
          offSequence.push(`${site.selector}[${index}] waits ${element.delay}ms and the table says ${site.delays[index]}ms`);
        }
        if (element.fill !== 'both') {
          offSequence.push(
            `${site.selector}[${index}] fills "${element.fill}" rather than "both", so the keyframe's from is not held ` +
              `through the delay and a document with no script flickers`
          );
        }
      });
    }
    console.log(
      `narrative: entrance sites ${declared.sites
        .map((site) => `${site.selector} [${site.elements.map((element) => `${element.delay}ms ${element.fill}`).join(', ')}]`)
        .join('; ')}`
    );
    expect(offSequence, `the entrance is off the sequence this file tables:\n${offSequence.join('\n')}`).toEqual([]);

    // A loop and a yoyo, read where a CSS entrance would carry them. `EXPERIENCE.md:693-694` allows
    // one orchestrated entrance per page load and nothing inside it that repeats.
    expect(
      declared.iterations,
      `an animation in the hero repeats: iteration counts ${declared.iterations.join(', ')}`
    ).toEqual(['1']);
    expect(
      declared.directions,
      `an animation in the hero alternates, which is a yoyo by another name: ${declared.directions.join(', ')}`
    ).toEqual(['normal']);

    const offending = observed.properties.filter((property) => !ALLOWED.has(property));
    expect(
      offending,
      `something in the hero writes an inline property EXPERIENCE.md:685-699 does not allow: ` +
        `${offending.join(', ')}. The whole set observed was ${observed.properties.join(', ')}`
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
});

// ---------------------------------------------------------------------------
// Scroll work: this story adds none, and the sweeps that say so are shown firing.
// ---------------------------------------------------------------------------

test.describe('no raw scroll listener is registered in the Hub source', () => {
  /**
   * Every `.ts` and `.tsx` file under one of the Hub's own source roots, tests excluded.
   *
   * Read from disk rather than from the browser deliberately. `app/providers.tsx` registers
   * `ScrollTrigger` and, only when the motion preference is not `reduce` (A-17), constructs Lenis;
   * both register native `scroll` listeners of their own from inside `node_modules`, so a
   * browser-side count of listeners cannot answer the question the rule asks, which is whether the
   * Hub's own components do scroll work, and on the pinned context it would not even see Lenis.
   * `tests/e2e/hit-target-floor.pw.ts` already reads the tree from a spec file for the same kind of
   * claim.
   *
   * A missing root is reported rather than thrown on, and the caller is told how many roots existed,
   * so a rename cannot turn this sweep into a pass over nothing.
   */
  const sourceFiles = (roots: readonly string[]): { files: string[]; missing: string[] } => {
    const files: string[] = [];
    const missing: string[] = [];

    const walk = (directory: string) => {
      for (const entry of readdirSync(join(REPO_ROOT, directory), { withFileTypes: true })) {
        const next = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(next);
        } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
          files.push(next);
        }
      }
    };

    for (const root of roots) {
      if (!existsSync(join(REPO_ROOT, root))) {
        missing.push(root);
        continue;
      }
      walk(root);
    }

    return { files, missing };
  };

  /** Where `EXPERIENCE.md:696`'s rule applies, which is everywhere the Hub's own code lives. */
  const SOURCE_ROOTS = ['app', 'components', 'hooks', 'lib'] as const;

  /**
   * The files Story 2-12 owns.
   *
   * The `IntersectionObserver` sweep is scoped to these rather than to the whole tree, because the
   * spec's claim is only that **this story** adds no scroll work. `EXPERIENCE.md:696` positively
   * requires an observer wherever there is scroll work, so a later story adding a legitimate one
   * must not fail a Story 2-12 case with a message about scroll work.
   */
  const OWNED = ['components/molecules/GemComponent', 'components/organisms/HomeLayout', 'hooks'] as const;

  const SCROLL_LISTENER = /addEventListener\(\s*(['"`])scroll\1/;
  const OBSERVER = /\bIntersectionObserver\b/;

  test('registers no raw addEventListener("scroll") anywhere in the Hub source', async () => {
    const { files, missing } = sourceFiles(SOURCE_ROOTS);
    expect(missing, `a source root this sweep names does not exist: ${missing.join(', ')}`).toEqual([]);
    expect(files.length, 'the source sweep found no file, so it measures nothing').toBeGreaterThan(0);

    const hits = files.filter((file) => SCROLL_LISTENER.test(readFileSync(join(REPO_ROOT, file), 'utf8')));

    // Named for what it measures. Lenis and ScrollTrigger both register native `scroll` listeners
    // from `node_modules`, so this is not a claim that no listener exists on the page; it is the
    // claim `EXPERIENCE.md:696` actually makes, that the Hub's own code registers none.
    expect(hits, `EXPERIENCE.md:696 forbids a raw scroll listener:\n${hits.join('\n')}`).toEqual([]);
  });

  test('and Story 2-12 adds no IntersectionObserver to the files it owns', async () => {
    const { files, missing } = sourceFiles(OWNED);
    expect(missing, `a file this story owns is not where this sweep looks: ${missing.join(', ')}`).toEqual([]);
    expect(files.length, 'the owned-file sweep found no file, so it measures nothing').toBeGreaterThan(0);

    const hits = files.filter((file) => OBSERVER.test(readFileSync(join(REPO_ROOT, file), 'utf8')));

    // This story adds no scroll work, so it adds no observer either: asserting a mechanism nothing
    // uses would be a test of nothing. What is asserted is that this story did not quietly add one.
    expect(hits, `Story 2-12 introduced scroll work it does not declare:\n${hits.join('\n')}`).toEqual([]);
  });

  test('and both matchers fire, measured against a needle the sweep is run over', async () => {
    // The control is the matcher rather than a planted file: writing a `.tsx` into the tree during
    // a run would leave a fixture behind, which every other suite here refuses to do.
    expect(SCROLL_LISTENER.test("window.addEventListener('scroll', onScroll)")).toBe(true);
    expect(SCROLL_LISTENER.test('window.addEventListener("scroll", onScroll)')).toBe(true);
    expect(OBSERVER.test('const io = new IntersectionObserver(entries => {})')).toBe(true);

    // And it does not fire on the things that merely read like it, which is what makes a clean
    // sweep meaningful rather than merely narrow, and which is why the case above is titled for
    // `addEventListener` rather than for scroll work in general.
    expect(SCROLL_LISTENER.test("element.addEventListener('wheel', onWheel)")).toBe(false);
    expect(SCROLL_LISTENER.test("lenis.on('scroll', ScrollTrigger.update)")).toBe(false);
  });
});
