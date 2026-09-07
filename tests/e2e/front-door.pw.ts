import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, rootCustomPropertyValue } from './harness';

/**
 * The non-3D front door and the two skips, measured in a browser (Story 2-13).
 *
 * **This file exists because the rest of the suite cannot see either half.**
 * `playwright.config.ts:79` makes `reducedMotion: 'reduce'` the default context for every project,
 * and reduced motion is one of the four triggers of the non-3D path. So every other spec here runs
 * on the flat front door: the floor sweep never sees the skip control, and nothing anywhere sees
 * the default path's hero at all. Asserting both is this story's job or it is nobody's.
 *
 * **Four triggers, each opened in isolation, and they are not all answered at the same layer.**
 * `prefers-reduced-motion` is answered in CSS, so the served document's layout is already flat. The
 * `Save-Data` request header is answered on the server, so the served *markup* is already flat, and
 * it is opened here with `extraHTTPHeaders` rather than by patching a browser API. A slow
 * `effectiveType` and a WebGL probe that answers nothing exist only in the browser and are opened
 * with `addInitScript`. A case that set two at once could not say which one fired, and the ruling
 * that defines the connection triggers (`saveData === true`, or an `effectiveType` of `slow-2g`,
 * `2g` or `3g`) is only written down in `hooks/useNarrativePath.ts` and in this story's spec, so it
 * is measured one trigger at a time.
 *
 * **Every clean result is read only after the same measurement has been seen reporting the other
 * answer.** Where a control can be a real artifact it is one: the default path is the control for
 * the flat path and the flat path is the control for the default one, on the same build and the
 * same page. Where it cannot, the defect is planted into the running page through the browser, so
 * no fixture is left in the tree, which is the rule `premise.pw.ts`, `status-mark.pw.ts` and
 * `suite-directory.pw.ts` set.
 *
 * **No screenshot is taken**, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true, and no snapshot directory is written.
 *
 * The floor is read off `--tap` on `:root` in the running page, never written here. A pixel
 * literal is what Story 2-34's conformance gate rejects, and a floor restated in a spec file is a
 * floor that drifts from the contract it claims to enforce.
 */

/** The one route this story changes. */
const ROUTE = '/';

/** The fragment the Directory heading carries. `SuiteDirectory.tsx:29` is the declaration. */
const HEADING_ID = 'suite';

/** The landmark the A-6 link targets. `app/page.tsx` is the other half of this. */
const MAIN_ID = 'main';

/** The skip control's label, exactly as `SkipControl.tsx` writes it and `EXPERIENCE.md:286` does. */
const SKIP_CONTROL_LABEL = 'Skip to the suite ↓';

/** How long any single condition here is given before it is called a failure. */
const SETTLE_TIMEOUT = 15_000;

/**
 * A width past the one this project pins, for the fold claims 360 alone cannot settle.
 *
 * Below 768 `HomeLayout.scss` already stacks the hero for every path, so a stacking claim measured
 * only at 360 would be measuring the mobile block rather than the flat modifier. Same idiom and
 * same reason as `tests/e2e/premise.pw.ts:59`.
 */
const WIDE_VIEWPORT = { width: 1024, height: 800 } as const;

/**
 * `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
 * repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here.
 * Same as `tests/e2e/narrative.pw.ts:83` and `hit-target-floor.pw.ts:61`.
 */
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * The gem's own fingerprint, read out of `ops/asset-budget.mjs` rather than restated.
 *
 * `@react-three/postprocessing` is imported by `GemNarrative` and by nothing else in this
 * repository, so its mark in a fetched script is the gem's boundary and not the App Router
 * prefetching `/work` and `/projects`, both of which still carry `three` eagerly. That prefetch is
 * why this is a fingerprint scan rather than a flat "no narrative chunk was requested": neither
 * path is free of `three`, and only one of them fetches the gem.
 *
 * Read as text rather than imported, for the reason DW-40 records: the tool is an ES module using
 * `import.meta`, which Playwright's CommonJS loader refuses. That entry books the third copy of
 * this parse, and this is it.
 *
 * **It throws on an empty result as well as on a missing table, and the difference matters.** A
 * parse that answered `[]` would make every payload case below pass by finding nothing anywhere, and
 * the standing case that checks the table is non-empty does not save them: Playwright runs the rest
 * of the file after a failing test, so one red case would sit beside eight green ones that measured
 * nothing. Throwing here fails the file at collection instead, which is the only place a broken
 * instrument can stop the measurements that use it.
 */
const gemMarks = (): string[] => {
  const source = readFileSync(join(REPO_ROOT, 'ops', 'asset-budget.mjs'), 'utf8');
  const block = /export const FINGERPRINTS = \[([\s\S]*?)\n\];/.exec(source);
  if (!block) {
    throw new Error(
      `ops/asset-budget.mjs no longer declares a FINGERPRINTS array this parse can find, so this ` +
        `file has no table. Fix the parse against the tool, do not restate the table here.`
    );
  }

  const marks = [
    ...block[1].matchAll(
      /\{\s*library:\s*'([^']+)',\s*mark:\s*'((?:[^'\\]|\\.)*)',\s*webgl:\s*(true|false)\s*\}/g
    ),
  ]
    .filter((match) => match[3] === 'true' && match[1].includes('postprocessing'))
    .map((match) => match[2].replace(/\\(.)/g, '$1'))
    .filter((mark) => mark.length > 0);

  if (marks.length === 0) {
    throw new Error(
      `ops/asset-budget.mjs declares a FINGERPRINTS table with no WebGL-bearing ` +
        `@react-three/postprocessing entry this parse could read, so every payload case in this ` +
        `file would pass by classifying nothing. Fix the parse against the tool.`
    );
  }

  return marks;
};

const GEM_MARKS = gemMarks();

/** An init script that makes every WebGL context request answer `null`. */
const NO_WEBGL = `
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (typeof type === 'string' && type.toLowerCase().includes('webgl')) return null;
    return original.call(this, type, ...rest);
  };
`;

/**
 * An init script that replaces `navigator.connection` with a stated reading.
 *
 * Playwright emulates no Network Information API and Chromium reports the real machine's, so the
 * two connection triggers are reached by shadowing the accessor on the `navigator` instance before
 * the page's own scripts run. Same shape as `NO_WEBGL` above and as
 * `tests/e2e/narrative.pw.ts:197-203`: patch a browser API through `addInitScript`.
 *
 * Not the `Save-Data` request header, which is a different trigger reaching a different layer: that
 * one is read on the server by `app/page.tsx` and is opened below with `extraHTTPHeaders`.
 */
const connectionReporting = (connection: { saveData?: boolean; effectiveType?: string }): string => `
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: ${JSON.stringify(connection)},
  });
`;

/** One way in, and everything a context needs to take it. */
interface FrontDoor {
  /**
   * How a case names the door it wants.
   *
   * Cases used to reach into `NON_3D_PATHS` by index, which reads as an ordering and is not one:
   * moving a row silently repointed the fold, the no-shift comparison and the collapse control at
   * different triggers, all of them still green. `doorNamed` below is the only way in.
   */
  readonly id: 'reduced-motion' | 'save-data' | 'slow-connection' | 'no-webgl' | 'default';
  readonly name: string;
  readonly reducedMotion: 'reduce' | 'no-preference';
  readonly inits: readonly string[];
  /** Sent on every request this context makes. The `Save-Data` door is opened with this and only this. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * Whether the **served** document already carries the flat modifier, before a line of the
   * application has run.
   *
   * True for the `Save-Data` door alone, and it is the whole of what the Operator's 2026-09-07
   * ruling added: the header reaches the server, so the markup is flat rather than corrected to
   * flat. `prefers-reduced-motion` is answered a layer lower again, in CSS, so its served markup is
   * the default one and its served *layout* is flat, which is why this is false for it and the
   * height comparison rather than the class is what proves that door.
   */
  readonly servedFlat: boolean;
  /**
   * Whether this door is settled before the document paints, and therefore may never move.
   *
   * Declared per door rather than inferred. It was read off `inits.length` for one revision, which
   * says "opened with an init script" and happens to coincide today: a door added with an init
   * script that CSS could also answer, or one answered by a header without one, would be sorted
   * into the wrong half with every case still green.
   */
  readonly answeredBeforePaint: boolean;
}

const DEFAULT_PATH: FrontDoor = {
  id: 'default',
  name: 'WebGL present, no motion preference, no data-saving signal',
  reducedMotion: 'no-preference',
  inits: [],
  servedFlat: false,
  answeredBeforePaint: true,
};

/** The four triggers of the non-3D path, each of which must be sufficient on its own. */
const NON_3D_PATHS: readonly FrontDoor[] = [
  {
    id: 'reduced-motion',
    name: 'prefers-reduced-motion: reduce',
    reducedMotion: 'reduce',
    inits: [],
    servedFlat: false,
    answeredBeforePaint: true,
  },
  {
    id: 'save-data',
    name: 'the Save-Data request header',
    reducedMotion: 'no-preference',
    inits: [],
    headers: { 'Save-Data': 'on' },
    servedFlat: true,
    answeredBeforePaint: true,
  },
  {
    id: 'slow-connection',
    name: 'a slow effectiveType',
    reducedMotion: 'no-preference',
    inits: [connectionReporting({ saveData: false, effectiveType: '3g' })],
    servedFlat: false,
    answeredBeforePaint: false,
  },
  {
    id: 'no-webgl',
    name: 'no WebGL',
    reducedMotion: 'no-preference',
    inits: [NO_WEBGL],
    servedFlat: false,
    answeredBeforePaint: false,
  },
];

/** One door, by name. Throws rather than answering `undefined`, which would read as a skipped case. */
const doorNamed = (id: FrontDoor['id']): FrontDoor => {
  const found = [DEFAULT_PATH, ...NON_3D_PATHS].find((door) => door.id === id);
  if (!found) throw new Error(`front-door: no door is registered as "${id}"`);
  return found;
};

/** The two doors a browser alone can open, which are the two that still collapse after hydration. */
const SCRIPT_ONLY_PATHS = NON_3D_PATHS.filter((door) => !door.answeredBeforePaint);

/** The three doors that are answered before the document paints, and must therefore never move. */
const ANSWERED_BEFORE_PAINT: readonly FrontDoor[] = [DEFAULT_PATH, ...NON_3D_PATHS].filter(
  (door) => door.answeredBeforePaint
);

/**
 * Run `read` against `/` on one front door, in a context that differs from the project's in exactly
 * the trigger being measured.
 *
 * Every option the project pins is restated here rather than inherited, because
 * `browser.newContext` does not inherit them: a context that silently defaulted to a different
 * width or motion preference would be measuring a different page. Same shape as
 * `tests/e2e/narrative.pw.ts:280-298` and `premise.pw.ts:90-108`.
 */
const onPath = async <T>(
  browser: Browser,
  door: FrontDoor,
  read: (page: Page) => Promise<T>,
  viewport: { width: number; height: number } = RENDERED_VIEWPORT
): Promise<T> => {
  const context = await browser.newContext({
    viewport: { ...viewport },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: door.reducedMotion,
    ...(door.headers ? { extraHTTPHeaders: { ...door.headers } } : {}),
  });
  try {
    const page = await context.newPage();
    for (const init of door.inits) await page.addInitScript(init);
    return await read(page);
  } finally {
    await context.close();
  }
};

/**
 * Navigate, refuse to read anything off a page that did not answer 200, and wait for the fonts.
 *
 * Not `networkidle`: the Hub never reaches it, because Lenis and the GSAP ticker keep the page busy
 * indefinitely (`tests/e2e/harness.ts:86-90`).
 */
const goTo = async (page: Page, route: string = ROUTE): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

/**
 * Wait until the application has run and the decision has been answered, whichever way.
 *
 * **The hydration half is not redundant, and leaving it out made one case measure nothing.** On the
 * `Save-Data` door the flat modifier is in the served bytes, so a wait for "the modifier or a
 * canvas" is satisfied by the first evaluation, before a line of the bundle has executed: the
 * no-shift comparison on that door then read two pre-hydration states and would have passed with
 * the client bundle blocked entirely.
 *
 * The signal is `GlitchText`'s inline opacity. Its `useGsapContext` callback writes one on mount on
 * every path, `0` where the entrance will run and `1` where reduced motion stops it, and the server
 * writes no inline style at all, so its presence means React hydrated. It is the application's own
 * artifact rather than a library's class name, and it is the earliest one that exists on all four
 * doors.
 */
const settled = async (page: Page): Promise<void> => {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const glitch = document.querySelector<HTMLElement>('.glitch-text__inner');
          const hydrated = glitch !== null && glitch.style.opacity !== '';
          const decided =
            document.querySelector('.home-container--flat') !== null ||
            document.querySelector('#gem-canvas canvas') !== null;
          return hydrated && decided;
        }),
      {
        timeout: SETTLE_TIMEOUT,
        message:
          'the page never reached a hydrated, decided state: either the client bundle never ran, or ' +
          'there is no flat modifier and no canvas, so the hook never answered',
      }
    )
    .toBe(true);
};

/** The hit-target floor, read off `--tap` on `:root` in the running page. */
const floorFrom = async (page: Page): Promise<number> => {
  const declared = await rootCustomPropertyValue(page, '--tap');
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(declared.trim());
  const value = match ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--tap reads "${declared}", which is not a positive length in pixels`);
  }
  return value;
};

/** What one load drew in the hero, as one read. */
interface Hero {
  readonly flat: boolean;
  readonly canvases: number;
  readonly images: number;
  readonly gemContainers: number;
  readonly skipControls: number;
}

const heroOn = (page: Page): Promise<Hero> =>
  page.evaluate(() => ({
    flat: document.querySelector('.home-container--flat') !== null,
    canvases: document.querySelectorAll('.home-container canvas').length,
    images: document.querySelectorAll('.home-container img').length,
    gemContainers: document.querySelectorAll('.home-gem, #gem-canvas').length,
    skipControls: document.querySelectorAll('.skip-control').length,
  }));

/** Every script the page fetched that carries the gem's own library. */
const gemChunksOn = async (page: Page, request: APIRequestContext): Promise<string[]> => {
  const scripts = new Set<string>();
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') scripts.add(response.url());
  });

  await goTo(page);
  await settled(page);

  // Quiescence rather than a sleep: poll until the request set stops growing across two reads, so
  // the two paths are compared at the same point in their lives rather than after the same delay.
  let previous = -1;
  await expect
    .poll(
      () => {
        const quiet = scripts.size === previous;
        previous = scripts.size;
        return quiet;
      },
      { timeout: SETTLE_TIMEOUT, intervals: [500], message: 'the page never stopped requesting scripts' }
    )
    .toBe(true);

  const carrying: string[] = [];
  for (const url of scripts) {
    const response = await request.get(url);
    if (response.status() !== 200) continue;
    const text = await response.text();
    if (GEM_MARKS.some((mark) => text.includes(mark))) carrying.push(url.split('/').pop() ?? url);
  }
  return carrying;
};

// ---------------------------------------------------------------------------
// The instrument, before anything is measured with it.
// ---------------------------------------------------------------------------

test.describe('the fingerprint this file classifies with', () => {
  test('is read whole out of ops/asset-budget.mjs', () => {
    // Every payload claim below rests on this mark. A parse that returned nothing would report a
    // clean flat path and a clean default path alike, which is a scan that classifies nothing.
    expect(
      GEM_MARKS.length,
      'no @react-three/postprocessing fingerprint was parsed out of ops/asset-budget.mjs, so every ' +
        'payload case in this file would pass by finding nothing anywhere'
    ).toBeGreaterThan(0);
    expect(
      GEM_MARKS.every((mark) => mark.length > 0),
      'a fingerprint parsed to an empty mark, which matches every position in every chunk'
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The four triggers, each on its own, and the default path as their control.
// ---------------------------------------------------------------------------

test.describe('the non-3D front door', () => {
  for (const door of NON_3D_PATHS) {
    test(`${door.name} reaches it, and the hero draws nothing at all`, async ({ browser }) => {
      // Four rows of the matrix, one per trigger, each sufficient on its own. What is asserted is
      // the same on all four, because `EXPERIENCE.md:172-178` closes Q7 with one artefact rather
      // than two: there is one non-3D front door, whichever trigger opened it.
      const hero = await onPath(browser, door, async (page) => {
        await goTo(page);
        await settled(page);
        return heroOn(page);
      });

      expect(hero.flat, `${door.name} did not reach the flat front door`).toBe(true);
      expect(hero.canvases, `${door.name} mounted a canvas`).toBe(0);
      expect(
        hero.images,
        `${door.name} renders an image in the hero. EXPERIENCE.md:173-176 refuses a still of the 3D ` +
          `scene by name, and gem-fallback.png is deleted`
      ).toBe(0);
      expect(
        hero.gemContainers,
        `${door.name} leaves the gem's container behind, which below 768 is a 90vw hole in the hero`
      ).toBe(0);
      expect(
        hero.skipControls,
        `${door.name} renders the skip control. This path reaches the Directory in zero interactions ` +
          `(EXPERIENCE.md:154-169), so there is nothing for a control to save`
      ).toBe(0);
    });
  }

  test('and every one of those reads reports the opposite on the default path', async ({ browser }) => {
    // The control for all four cases above, and it is a real artifact rather than a planted one:
    // the same five reads, on the same build, on the path that does mount a canvas and does render
    // a control. Without it, a hero that had stopped rendering entirely would pass every case above.
    const hero = await onPath(browser, DEFAULT_PATH, async (page) => {
      await goTo(page);
      await settled(page);
      await expect(page.locator('#gem-canvas canvas')).toBeVisible({ timeout: SETTLE_TIMEOUT });
      return heroOn(page);
    });

    expect(hero.flat, 'the default path took the flat modifier, so the four cases above prove nothing').toBe(false);
    expect(hero.canvases, 'the default path mounted no canvas').toBeGreaterThan(0);
    expect(hero.gemContainers, 'the default path renders no gem container').toBeGreaterThan(0);
    expect(hero.skipControls, 'the default path renders no skip control').toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Payload. The chunk is not fetched, measured against the path that fetches it.
// ---------------------------------------------------------------------------

test.describe('the gem chunk', () => {
  test('is fetched on the default path, which is what makes its absence measurable', async ({ browser, request }) => {
    // The control first, deliberately. Every absence below is only worth what this presence is
    // worth: a run where the fingerprint never matched anything would report four clean paths.
    const carrying = await onPath(browser, DEFAULT_PATH, (page) => gemChunksOn(page, request));
    console.log(`front-door: default path fetched ${carrying.join(', ') || '(nothing carrying the gem)'}`);
    expect(
      carrying.length,
      'the default path fetched no script carrying @react-three/postprocessing, so the gem never ' +
        'loads and the four absences below measure nothing'
    ).toBeGreaterThan(0);
  });

  for (const door of NON_3D_PATHS) {
    test(`is never requested on ${door.name}`, async ({ browser, request }) => {
      // `next/dynamic` issues its import on first render of the returned component, so not
      // rendering it is the whole of the gate. This is the browser half of that claim; the jsdom
      // half is `components/molecules/GemComponent/__tests__/GemComponent.test.tsx`.
      const carrying = await onPath(browser, door, (page) => gemChunksOn(page, request));
      expect(
        carrying,
        `${door.name} fetched the gem chunk anyway, so a visitor on the non-3D path downloads a ` +
          `narrative that is never drawn:\n${carrying.join('\n')}`
      ).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// A document that varies on a request header, and the cache in front of it.
// ---------------------------------------------------------------------------

test.describe('the served document', () => {
  test('really is two documents, one per value of the header', async ({ request, baseURL }) => {
    // The control first, because the cache rule below only matters if the response varies at all.
    // Two requests to one URL, differing in one request header, returning different documents: that
    // is the whole hazard, and it is asserted rather than assumed from the source.
    const url = new URL(ROUTE, baseURL as string).href;
    const plain = await request.get(url);
    const saving = await request.get(url, { headers: { 'Save-Data': 'on' } });

    expect(plain.status(), 'the home route did not answer 200').toBe(200);
    expect(saving.status(), 'the home route did not answer 200 to a Save-Data request').toBe(200);

    const plainBody = await plain.text();
    const savingBody = await saving.text();

    expect(
      savingBody.includes('home-container--flat'),
      'a Save-Data request was served the default hero, so the header is not being read on the server'
    ).toBe(true);
    expect(
      plainBody.includes('home-container--flat'),
      'a request with no Save-Data header was served the flat hero, so the route is not varying, it ' +
        'is just flat'
    ).toBe(false);
  });

  test('is not storable by a shared cache unless it declares that it varies', async ({ request, baseURL }) => {
    // AD-26 puts Cloudflare in front of this origin, and the response above is not the same for
    // every visitor. A shared cache that stored one and replayed it for the other would hand a
    // data-saving visitor the 3D front door, or the reverse.
    //
    // **Asserted as the guarantee rather than as one header, because Next owns `Vary` here.**
    // `next.config.js` declares `Vary: Save-Data` for this route and Next overwrites it with its own
    // RSC list on every App Router response, measured 2026-09-07 and recorded in DW-51. What holds
    // today is the `no-store, private` a dynamically rendered route is answered with, which forbids
    // shared storage outright. Either is sufficient and one of them must be true: the day someone
    // makes this route cacheable without repairing the `Vary`, this case fails.
    const response = await request.get(new URL(ROUTE, baseURL as string).href, {
      headers: { 'Save-Data': 'on' },
    });
    expect(response.status(), 'the home route did not answer 200').toBe(200);

    const headers = response.headers();
    const vary = (headers['vary'] ?? '').toLowerCase();
    const cacheControl = (headers['cache-control'] ?? '').toLowerCase();
    console.log(`front-door: / answers vary "${vary}" and cache-control "${cacheControl}"`);

    const declaresVary = vary.split(',').some((token) => token.trim() === 'save-data');
    const unstorable = cacheControl.includes('no-store') || cacheControl.includes('private');

    expect(
      declaresVary || unstorable,
      `/ varies on the Save-Data request header and neither says so nor forbids a shared cache ` +
        `from storing it. Vary is "${vary}" and Cache-Control is "${cacheControl}"`
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The fold. The lock is released and the Directory costs no interaction.
// ---------------------------------------------------------------------------

/** The hero's box and the two facts about it that the fold claim rests on. */
const foldOn = (page: Page) =>
  page.evaluate(() => {
    const container = document.querySelector('.home-container');
    const name = document.querySelector('.home-panel--name');
    const premise = document.querySelector('.premise');
    if (!container || !name || !premise) return null;

    return {
      heroHeight: container.getBoundingClientRect().height,
      panelPosition: getComputedStyle(name).position,
      premiseTop: premise.getBoundingClientRect().top + window.scrollY,
      innerHeight: window.innerHeight,
    };
  });

test.describe('the fold on the non-3D path', () => {
  for (const viewport of [RENDERED_VIEWPORT, WIDE_VIEWPORT]) {
    test(`releases the viewport lock and stacks the panels at ${viewport.width}`, async ({ browser }) => {
      // Two widths, because below 768 `HomeLayout.scss` already stacks the hero on every path: a
      // stacking claim measured only at 360 would be measuring the mobile block. The lock is what
      // the modifier releases, and it exists at both widths.
      const flat = await onPath(
        browser,
        doorNamed('reduced-motion'),
        async (page) => {
          await goTo(page);
          await settled(page);
          return foldOn(page);
        },
        viewport
      );

      const locked = await onPath(
        browser,
        DEFAULT_PATH,
        async (page) => {
          await goTo(page);
          await settled(page);
          return foldOn(page);
        },
        viewport
      );

      expect(flat, 'the flat load rendered no hero, no name panel or no premise').not.toBeNull();
      expect(locked, 'the default load rendered no hero, no name panel or no premise').not.toBeNull();
      if (!flat || !locked) return;

      console.log(
        `front-door: hero at ${viewport.width} is ${flat.heroHeight.toFixed(2)} flat and ` +
          `${locked.heroHeight.toFixed(2)} locked, premise at ${flat.premiseTop.toFixed(2)} and ` +
          `${locked.premiseTop.toFixed(2)}`
      );

      // The release, measured as a comparison between two real loads rather than against a number
      // written here. A hero that is still exactly one viewport tall has not released anything.
      expect(
        flat.heroHeight,
        `the non-3D hero is no shorter than the locked one at ${viewport.width}, so HomeLayout.scss ` +
          `still holds it at 100dvh and the premise is exactly where it was`
      ).toBeLessThan(locked.heroHeight);

      // And the point of releasing it: the premise and the framework band are what this visitor
      // lands on, rather than a viewport of hero they have to scroll past.
      expect(
        flat.premiseTop,
        `the premise still starts below the fold at ${viewport.width}, so the non-3D front door is ` +
          `not the typographic hero EXPERIENCE.md:154-169 diagrams`
      ).toBeLessThan(flat.innerHeight);

      expect(
        flat.panelPosition,
        `the hero panels are still absolutely positioned at ${viewport.width}, so they overlap ` +
          `rather than stack in reading order`
      ).toBe('static');
      if (viewport.width >= 768) {
        expect(
          locked.panelPosition,
          'the panels are static on the default path at this width too, so the case above is not ' +
            'measuring the flat modifier at all'
        ).toBe('absolute');
      }
    });
  }

  test('reaches the Directory with no control to activate, and none rendered', async ({ browser }) => {
    // `EXPERIENCE.md:169` claims zero interactions to the suite on this path. What that forbids is
    // a control standing between the visitor and the Directory, so what is asserted is that the
    // Directory is in the same document, below the hero, and that scrolling to it needs no click:
    // no route change, no expander, and no skip control, which is the default path's affordance.
    await onPath(browser, doorNamed('reduced-motion'), async (page) => {
      await goTo(page);
      await settled(page);
      const before = page.url();

      expect(await page.locator('.skip-control').count(), 'the flat path renders a skip control').toBe(0);
      await expect(page.locator(`#${HEADING_ID}`), 'the flat path renders no Directory heading').toHaveCount(1);

      await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), HEADING_ID);
      await expect(
        page.locator(`#${HEADING_ID}`),
        'the Directory heading cannot be scrolled to on the flat path'
      ).toBeInViewport({ timeout: SETTLE_TIMEOUT });
      await expect(
        page.locator('.suite-directory__row').first(),
        'the Suite Directory renders no row on the flat path'
      ).toBeVisible();

      expect(page.url(), 'reaching the Directory changed the route').toBe(before);
    });
  });
});

// ---------------------------------------------------------------------------
// No shift. What the document paints and what the decision settles on agree.
// ---------------------------------------------------------------------------

/**
 * The hero's height as the served document paints it, before a line of the application has run.
 *
 * **Hydration is blocked rather than JavaScript disabled.** This is the frame every visitor really
 * sees for the hundreds of milliseconds before the bundle arrives, and it is the frame a late
 * decision moves. Aborting the application's script chunks leaves the document, the stylesheet and
 * the preloaded fonts exactly as they are served while React never runs, and it leaves
 * `page.evaluate` working, so `document.fonts.ready` can still be awaited rather than slept
 * through. Disabling scripting outright would take the instrument away with the subject.
 *
 * **The pattern ends in `.js` for a reason that cost a run.** Turbopack emits the route's CSS under
 * `_next/static/chunks/` too, so a block on that prefix alone takes the stylesheet with the bundle
 * and every hero measures as unstyled text: 220.88 at every width and on every path, which reads as
 * a collapsed hero rather than as a missing stylesheet. The guard below is what makes that
 * mistake fail as itself. Same pattern as `tests/e2e/narrative.pw.ts`'s chunk block.
 */
const servedHeroHeight = async (
  browser: Browser,
  door: FrontDoor,
  viewport: { width: number; height: number } = RENDERED_VIEWPORT
): Promise<number> =>
  onPath(
    browser,
    door,
    async (page) => {
      const aborted: string[] = [];
      await page.route('**/_next/static/chunks/**/*.js', async (route) => {
        aborted.push(route.request().url());
        await route.abort();
      });

      const response = await page.goto(ROUTE, { waitUntil: 'load' });
      expect(response?.status(), 'the home route did not answer 200 with hydration blocked').toBe(200);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      expect(
        aborted.length,
        'no application chunk was requested, so hydration was not blocked and this is not the ' +
          'pre-hydration frame at all'
      ).toBeGreaterThan(0);

      // **What the served markup says about this door, asserted rather than assumed.** With React
      // never running, the modifier can only be there because the server put it there, which is
      // true for the `Save-Data` door and false for every other. It is both halves of one guard:
      // the block really did stop hydration, and the header really did reach the server.
      expect(
        await page.locator('.home-container--flat').count(),
        door.servedFlat
          ? `the served document for ${door.name} does not carry the flat modifier, so either the ` +
            `header never reached the server or the route stopped reading it`
          : `the served document for ${door.name} carries the flat modifier, so React ran despite ` +
            `the block`
      ).toBe(door.servedFlat ? 1 : 0);

      // **What the markup holds, not only what class it carries.** The `Save-Data` ruling is that
      // the document arrives flat rather than arriving whole and being corrected, so the served
      // bytes have no gem container and no skip control in them at all. Every other door serves the
      // default path's markup and corrects it later, by CSS or by script, so the same read is the
      // opposite expectation there rather than an unasserted one.
      const servedHero = await page.evaluate(() => ({
        gems: document.querySelectorAll('.home-gem, #gem-canvas').length,
        controls: document.querySelectorAll('.skip-control').length,
      }));
      expect(
        servedHero.gems > 0,
        door.servedFlat
          ? `the served document for ${door.name} still carries the gem container, so the flat hero ` +
            `is a correction rather than what was sent`
          : `the served document for ${door.name} carries no gem container, so it is not the default ` +
            `path's geometry`
      ).toBe(!door.servedFlat);
      expect(
        servedHero.controls > 0,
        door.servedFlat
          ? `the served document for ${door.name} still carries the skip control, which this path ` +
            `does not offer`
          : `the served document for ${door.name} carries no skip control, so one would have to ` +
            `arrive after paint and push the page down`
      ).toBe(!door.servedFlat);

      // The stylesheet arrived. `HomeLayout.scss` lays the hero out as a grid on the default path
      // and as a flex column on the flat one, and the UA default for a `<div>` is neither, so this
      // separates "the served document" from "the served document with its stylesheet blocked",
      // which are two very different heights and only one of them is the subject.
      const display = await page.evaluate(() => {
        const container = document.querySelector('.home-container');
        return container ? getComputedStyle(container).display : '(no .home-container)';
      });
      expect(
        ['grid', 'flex'],
        `the served hero computes display: ${display}, so its stylesheet did not load and this ` +
          `measurement is of unstyled text rather than of the hero`
      ).toContain(display);

      const box = await page.locator('.home-container').boundingBox();
      expect(box, 'the served document renders no .home-container at all').not.toBeNull();
      return box?.height ?? -1;
    },
    viewport
  );

const settledHeroHeight = (
  browser: Browser,
  door: FrontDoor,
  viewport: { width: number; height: number } = RENDERED_VIEWPORT
): Promise<number> =>
  onPath(
    browser,
    door,
    async (page) => {
      await goTo(page);
      await settled(page);
      const box = await page.locator('.home-container').boundingBox();
      expect(box, 'the settled page renders no .home-container at all').not.toBeNull();
      return box?.height ?? -1;
    },
    viewport
  );

/**
 * Two loads of the same document measure the same hero to within a few pixels or they do not.
 *
 * The tolerance is for font metrics settling differently between a scripted and an unscripted load,
 * not for layout: the shift this file is written against is a hero collapsing by hundreds of
 * pixels one frame after paint, and nothing near this number can hide one.
 */
const SETTLING_SLACK = 8;

/**
 * An init script that records `.home-container`'s height on every animation frame, from before the
 * page's own scripts run, and marks the frame at which the web fonts stopped moving it.
 *
 * The served-against-settled comparisons below read two states; this reads every state in between,
 * which is what the matrix asks for: recorded from the running page, not argued from the effect's
 * position. A collapse that happened and was undone, or one that happened twice, is invisible to a
 * two-point comparison and is exactly what a sampler catches. Same shape as
 * `tests/e2e/narrative.pw.ts`'s gem sampler.
 *
 * **Type settling moves this hero, and it is neither a collapse nor this story's.** On the flat
 * front door the height is the content's, so a face swapping in changes it: measured at 555.70 to
 * 542.70 at a 1024 viewport, 13.00px across two nav lines, on the reduced-motion door, which is
 * decided in CSS and cannot have moved for any reason of this story's. It happens a frame or two
 * after `document.fonts.ready` resolves, so the marker below narrows the window without closing it,
 * and `COLLAPSE_FLOOR` is what separates the two kinds of movement: the collapse this file is
 * written against is 257.30px on the same page and the same run, and 279.30px in the pinned
 * container.
 */
const HEIGHT_SAMPLER = `
  window.__heroHeights = [];
  window.__fontsReadyAt = -1;
  document.fonts.ready.then(() => {
    window.__fontsReadyAt = window.__heroHeights.length;
  });
  (function sample() {
    const hero = document.querySelector('.home-container');
    if (hero) window.__heroHeights.push(hero.getBoundingClientRect().height);
    requestAnimationFrame(sample);
  })();
`;

interface HeightSamples {
  readonly all: number[];
  readonly afterFonts: number;
}

const heroHeights = (page: Page): Promise<HeightSamples> =>
  page.evaluate(() => {
    const scope = window as unknown as { __heroHeights?: number[]; __fontsReadyAt?: number };
    return { all: scope.__heroHeights ?? [], afterFonts: scope.__fontsReadyAt ?? -1 };
  });

/**
 * What counts as the hero moving, for the frame sampler alone.
 *
 * Eight times the two-point tolerance, and it is a separation rather than a guess. Measured
 * 2026-09-07 on both hosts this suite runs on: the largest type settling on these doors is 13.00px,
 * and the collapse is 257.30px on the authoring machine and 279.30px in
 * `mcr.microsoft.com/playwright:v1.62.1-noble`. Anything between is neither, the cases below print
 * what they measured, and the control cases fail loudly if a collapse ever falls near this floor.
 */
const COLLAPSE_FLOOR = 64;

/** Every step between consecutive samples that is larger than the collapse floor, signed. */
const heightSteps = (samples: readonly number[]): { drops: number[]; rises: number[] } => {
  const drops: number[] = [];
  const rises: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const change = samples[index] - samples[index - 1];
    if (change < -COLLAPSE_FLOOR) drops.push(change);
    if (change > COLLAPSE_FLOOR) rises.push(change);
  }
  return { drops, rises };
};

/**
 * Load `/` on one door with the sampler running, and hand back every height it recorded once the
 * fonts had settled.
 */
const heightsOn = (
  browser: Browser,
  door: FrontDoor,
  viewport: { width: number; height: number } = RENDERED_VIEWPORT
): Promise<number[]> =>
  onPath(
    browser,
    { ...door, inits: [HEIGHT_SAMPLER, ...door.inits] },
    async (page) => {
      await goTo(page);
      await settled(page);

      // Several more frames than the resolution needs, so the sample after the decision is in the
      // array rather than racing it, and all of them after the fonts stopped moving the hero.
      await expect
        .poll(
          async () => {
            const { all, afterFonts } = await heroHeights(page);
            return afterFonts < 0 ? 0 : all.length - afterFonts;
          },
          {
            timeout: SETTLE_TIMEOUT,
            message: `no frame was sampled after document.fonts.ready on ${door.name}`,
          }
        )
        .toBeGreaterThan(4);

      const { all, afterFonts } = await heroHeights(page);
      return all.slice(afterFonts);
    },
    viewport
  );

test.describe('resolving the path does not move the page', () => {
  for (const viewport of [RENDERED_VIEWPORT, WIDE_VIEWPORT]) {
    test(`the reduced-motion front door is already flat in the served document at ${viewport.width}`, async ({
      browser,
    }) => {
      // **The reason `HomeLayout.scss` carries the flat shape under a media query as well as under
      // a modifier class.** `prefers-reduced-motion` is the trigger CSS can answer, so it is
      // answered in CSS: this visitor's first paint is already the flat hero, and there is no frame
      // in which the page is one viewport tall and then is not.
      const served = await servedHeroHeight(browser, doorNamed('reduced-motion'), viewport);
      const settledHeight = await settledHeroHeight(browser, doorNamed('reduced-motion'), viewport);
      console.log(
        `front-door: reduced motion at ${viewport.width} served ${served.toFixed(2)}, settled ` +
          `${settledHeight.toFixed(2)}`
      );

      expect(
        Math.abs(served - settledHeight),
        `the hero is ${served.toFixed(2)} in the served document and ${settledHeight.toFixed(2)} once ` +
          `the decision resolves, so a reduced-motion visitor sees it move`
      ).toBeLessThanOrEqual(SETTLING_SLACK);
    });
  }

  for (const viewport of [RENDERED_VIEWPORT, WIDE_VIEWPORT]) {
    test(`the Save-Data front door is already flat in the served markup at ${viewport.width}`, async ({
      browser,
    }) => {
      // **Operator ruling of 2026-09-07, and the layer it moved.** `Save-Data` is an HTTP request
      // header, so unlike the other three triggers it reaches the server: `app/page.tsx` reads it
      // and hands `HomeLayout` a verdict, and the document this visitor receives has no gem
      // container and no skip control in it at all. That is a stronger claim than the
      // reduced-motion one above, which corrects the layout of markup that is still the default
      // path's, and `servedHeroHeight` asserts the modifier itself on this door.
      const served = await servedHeroHeight(browser, doorNamed('save-data'), viewport);
      const settledHeight = await settledHeroHeight(browser, doorNamed('save-data'), viewport);
      console.log(
        `front-door: Save-Data at ${viewport.width} served ${served.toFixed(2)}, settled ` +
          `${settledHeight.toFixed(2)}`
      );

      expect(
        Math.abs(served - settledHeight),
        `the hero is ${served.toFixed(2)} in the served document and ${settledHeight.toFixed(2)} once ` +
          `hydration finishes, so a Save-Data visitor still sees it move`
      ).toBeLessThanOrEqual(SETTLING_SLACK);
    });
  }

  test('and the default path does not move either, its geometry being what the document renders', async ({
    browser,
  }) => {
    // The undecided state renders the default path's geometry, so resolving to `'narrative'`
    // changes nothing: the canvas mounts inside a container that was already the size it is, and
    // the skip control is in the served markup rather than added a frame later.
    //
    // **Measured at the wider viewport, and only there.** Below 768 this hero's height is its
    // content's, and `GlitchText` re-splits the display line into per-character inline blocks once
    // the fonts resolve, which can rewrap it. That reflow predates this story and belongs to the
    // component that does it; measuring here at 360 would attribute it to the decision. At 768 and
    // wider the panels are absolutely positioned and the container is the lock itself, so what is
    // compared is exactly what this story changes.
    const served = await servedHeroHeight(browser, DEFAULT_PATH, WIDE_VIEWPORT);
    const settledHeight = await settledHeroHeight(browser, DEFAULT_PATH, WIDE_VIEWPORT);
    console.log(`front-door: default path served ${served.toFixed(2)}, settled ${settledHeight.toFixed(2)}`);

    expect(
      Math.abs(served - settledHeight),
      `the hero is ${served.toFixed(2)} in the served document and ${settledHeight.toFixed(2)} once ` +
        `the narrative mounts, so the canvas arriving moves the page`
    ).toBeLessThanOrEqual(SETTLING_SLACK);
  });

  test('and that comparison fires, measured on a trigger only script can read', async ({ browser }) => {
    // **The control, and it is a real artifact rather than a planted one.** A slow `effectiveType`
    // exists nowhere but `navigator.connection`: no header carries it and no media query answers
    // it, so this door is decided after hydration by construction and the hero really does collapse
    // one frame later. That is what makes the four clean readings above measurements rather than a
    // comparison that always agrees.
    //
    // **It moved here from `Save-Data` on 2026-09-07.** That trigger used to carry this control and
    // now cannot: the Operator ruled that a trigger which can be answered before paint must be, and
    // a request header can. The two doors that remain are the two the browser alone knows, and
    // DW-47 records them.
    const slow = doorNamed('slow-connection');
    const served = await servedHeroHeight(browser, slow, WIDE_VIEWPORT);
    const settledHeight = await settledHeroHeight(browser, slow, WIDE_VIEWPORT);
    console.log(
      `front-door: a slow effectiveType served ${served.toFixed(2)}, settled ${settledHeight.toFixed(2)}`
    );

    expect(
      served - settledHeight,
      'the slow-connection path settles at the same height it was served at, so either the trigger ' +
        'no longer reaches the flat front door or the readings above are comparing nothing'
    ).toBeGreaterThan(SETTLING_SLACK);

    // The direction is asserted as well as the difference. A late decision that made the hero
    // taller would push the Directory down the page under a reader who had already started
    // reading; this one only ever pulls it up.
    expect(
      settledHeight,
      'resolving the path grew the hero, which moves content down under a reader mid-page'
    ).toBeLessThan(served);
  });
});

// ---------------------------------------------------------------------------
// The same claim, on every frame the visitor is shown rather than on two of them.
// ---------------------------------------------------------------------------

test.describe('the running page settles at one height', () => {
  for (const door of ANSWERED_BEFORE_PAINT) {
    test(`${door.name} never moves, sampled every frame`, async ({ browser }) => {
      // The matrix asks for this recorded from the running page rather than argued from the
      // effect's position, and a two-point comparison cannot see a collapse that happened and was
      // undone. Measured at the wider viewport for the reason the default-path case states: below
      // 768 `GlitchText` rewraps the display line when the fonts resolve, which is a real movement
      // this story does not own.
      const samples = await heightsOn(browser, door, WIDE_VIEWPORT);
      const { drops, rises } = heightSteps(samples);

      expect(samples.length, `no frame was sampled on ${door.name}, so this case measures nothing`).toBeGreaterThan(4);
      expect(
        [...drops, ...rises],
        `the hero collapsed on ${door.name}, which is answered before the document paints and must ` +
          `therefore never collapse: ${samples.map((height) => height.toFixed(2)).join(', ')}`
      ).toEqual([]);
    });
  }

  for (const door of SCRIPT_ONLY_PATHS) {
    test(`${door.name} collapses exactly once, and only downward`, async ({ browser }) => {
      // The other half of the same instrument, and the control for the three cases above: a sampler
      // that reported no movement anywhere would pass them by never firing. These two doors are
      // knowable only in the browser, so they take one collapse, and both facts about it are
      // asserted rather than tolerated: exactly one step, and it shrinks.
      const samples = await heightsOn(browser, door, WIDE_VIEWPORT);
      const { drops, rises } = heightSteps(samples);

      console.log(
        `front-door: ${door.name} moved ${drops.map((step) => step.toFixed(2)).join(', ') || '(not at all)'}`
      );

      // **The slice did not eat the collapse.** `heightsOn` starts counting at
      // `document.fonts.ready`, and nothing in the platform orders that against hydration: on a
      // cold container the fonts could settle after the hero had already collapsed, leaving a
      // sampler that saw only the flat state and a case that failed for a reason it does not own.
      // The first sample on these doors is the tall one, or this case says so rather than blaming
      // the collapse count below.
      expect(
        samples[0] - samples[samples.length - 1],
        `${door.name} was already collapsed by the first sample. The frame window starts at ` +
          `document.fonts.ready, so the fonts settled later than hydration on this run and the ` +
          `collapse happened outside the window rather than not happening`
      ).toBeGreaterThan(COLLAPSE_FLOOR);

      expect(
        drops.length,
        `${door.name} did not collapse exactly once. It is decided after hydration, so it collapses ` +
          `once: ${samples.map((height) => height.toFixed(2)).join(', ')}`
      ).toBe(1);

      // And the collapse is far enough above the floor that the floor is a separation rather than a
      // coincidence. If this ever fails, the three cases above have stopped being measurements.
      expect(
        Math.abs(drops[0] ?? 0),
        `${door.name} collapsed by ${Math.abs(drops[0] ?? 0).toFixed(2)}, which is close enough to ` +
          `the ${COLLAPSE_FLOOR} floor that type settling and a collapse are no longer separable`
      ).toBeGreaterThan(COLLAPSE_FLOOR * 2);
      expect(
        rises,
        `${door.name} grew the hero mid-load, which pushes the Directory down under a reader who ` +
          `had already started reading`
      ).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// The skip control. FR-2's one interaction, on the path that costs one.
// ---------------------------------------------------------------------------

test.describe('the skip control', () => {
  for (const viewport of [RENDERED_VIEWPORT, WIDE_VIEWPORT]) {
    test(`is above the fold at ${viewport.width}, carries its exact label, and clears the floor`, async ({
      browser,
    }) => {
      // The floor sweep cannot see this control: `playwright.config.ts:79` runs the reduced-motion
      // context, which is the non-3D path, where it does not render. Measuring it here is the whole
      // reason this file exists.
      //
      // **Both widths, because the control has two placements and only one of them used to be
      // measured.** `SkipControl.scss` puts it in the hero's stacked column below 768 and anchors it
      // to the bottom edge of the locked hero at 768 and wider. Read at 360 alone, deleting the
      // second block left it centred in the middle of the viewport on top of the gem, with every
      // assertion here still green: it was still visible, still above the fold and still 44 by 44.
      await onPath(
        browser,
        DEFAULT_PATH,
        async (page) => {
          await goTo(page);
          await settled(page);

          const floor = await floorFrom(page);
          const control = page.locator('.skip-control');
          await expect(control, 'the default path renders no skip control').toBeVisible();

          expect(
            (await control.textContent())?.trim(),
            'the skip control no longer carries the label EXPERIENCE.md:286 writes'
          ).toBe(SKIP_CONTROL_LABEL);

          const box = await control.boundingBox();
          const name = await page.locator('.home-panel--name').boundingBox();
          const nav = await page.locator('.home-panel--nav').boundingBox();
          expect(box, 'the skip control has no box').not.toBeNull();
          expect(name, 'the hero renders no name panel, so the placement below is unmeasurable').not.toBeNull();
          expect(nav, 'the hero renders no nav panel, so the placement below is unmeasurable').not.toBeNull();
          if (!box || !name || !nav) return;

          console.log(
            `front-door: skip control at ${viewport.width} measures ${box.width.toFixed(2)} x ` +
              `${box.height.toFixed(2)} at y ${box.y.toFixed(2)}, name panel at y ${name.y.toFixed(2)}, ` +
              `nav panel at y ${nav.y.toFixed(2)}`
          );
          expect(
            box.width,
            `the skip control is ${box.width.toFixed(2)} wide against a floor of ${floor}`
          ).toBeGreaterThanOrEqual(floor);
          expect(
            box.height,
            `the skip control is ${box.height.toFixed(2)} tall against a floor of ${floor}`
          ).toBeGreaterThanOrEqual(floor);

          // Above the fold, which is what makes it FR-2's one interaction from a cold arrival rather
          // than a control the visitor has to scroll to find (`EXPERIENCE.md:418-419`).
          const innerHeight = await page.evaluate(() => window.innerHeight);
          expect(box.y, 'the skip control starts above the top of the viewport').toBeGreaterThanOrEqual(0);
          expect(
            box.y + box.height,
            `the skip control ends at ${(box.y + box.height).toFixed(2)} in a ${innerHeight}px viewport, ` +
              `so a cold arrival has to scroll before it can use it`
          ).toBeLessThanOrEqual(innerHeight);

          // Both edges inside the viewport, which is A-5 at the width this project pins.
          expect(box.x, 'the skip control starts outside the left edge').toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, 'the skip control ends outside the right edge').toBeLessThanOrEqual(
            viewport.width
          );

          // And it is where its stylesheet puts it, which is a different claim from being on
          // screen. Below 768 it opens the hero's column, ahead of the name panel. At 768 and wider
          // it is anchored to the bottom edge of a hero whose panels are absolutely positioned, so
          // it sits below the lowest of them rather than in the middle of the scene: dropping the
          // `min-width` block leaves it centred in the grid, which is on screen, above the fold,
          // 44 by 44, and on top of the gem.
          if (viewport.width < 768) {
            expect(
              box.y,
              'below 768 the skip control is not first in the hero column, so it is no longer the ' +
                'first thing a cold arrival meets'
            ).toBeLessThan(name.y);
          } else {
            expect(
              box.y,
              'at 768 and wider the skip control is not anchored below the hero panels, so its ' +
                'placement block is gone and it is floating over the scene'
            ).toBeGreaterThan(nav.y);
          }
        },
        viewport
      );
    });
  }

  test('and that measurement fires, against the same control planted under the floor', async ({ browser }) => {
    // The control for the case above, planted into the running page: the same read, on the same
    // element, shrunk below the floor. Without it a `boundingBox` that answered the viewport would
    // pass the case above for the wrong reason.
    await onPath(browser, DEFAULT_PATH, async (page) => {
      await goTo(page);
      await settled(page);
      const floor = await floorFrom(page);

      await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent =
          '.skip-control { min-block-size: 0 !important; min-inline-size: 0 !important; ' +
          'padding: 0 !important; font-size: 4px !important; }';
        document.head.append(style);
      });

      const box = await page.locator('.skip-control').boundingBox();
      expect(box, 'the planted control has no box at all').not.toBeNull();
      expect(
        Math.min(box?.width ?? floor, box?.height ?? floor),
        'a skip control planted under the floor still measured at or above it, so the read above is ' +
          'not a measurement of this element'
      ).toBeLessThan(floor);
    });
  });

  test('moves focus to the Directory heading, not merely the scroll position', async ({ browser }) => {
    // `EXPERIENCE.md:723` says moves focus, not only scroll. A control that scrolled alone leaves a
    // keyboard reader at the top of the document, tabbing through the whole hero again to reach
    // what they just asked to skip to. Same shape as `suite-directory.pw.ts:365-371`, on a click
    // rather than on hash arrival.
    await onPath(browser, DEFAULT_PATH, async (page) => {
      await goTo(page);
      await settled(page);

      const before = await page.evaluate(() => document.activeElement?.id ?? '(none)');
      expect(
        before,
        'the Directory heading is already focused before the control is used, so the read below is a ' +
          'constant'
      ).not.toBe(HEADING_ID);

      await page.locator('.skip-control').click();

      await expect
        .poll(() => page.evaluate(() => document.activeElement?.id ?? '(none)'), {
          timeout: SETTLE_TIMEOUT,
          message: 'activating the skip control did not move focus to the Directory heading',
        })
        .toBe(HEADING_ID);

      await expect(
        page.locator(`#${HEADING_ID}`),
        'the Directory heading is focused and off screen, so the scroll did not follow the focus'
      ).toBeInViewport({ timeout: SETTLE_TIMEOUT });
    });
  });
});

// ---------------------------------------------------------------------------
// The A-6 skip-link. First tabbable, revealed on focus, and a real target.
// ---------------------------------------------------------------------------

/** Where focus is, and what the focused element measures. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return null;
    const box = active.getBoundingClientRect();
    return {
      tag: active.tagName,
      className: active.className,
      href: active.getAttribute('href') ?? '',
      text: (active.textContent ?? '').replace(/\s+/g, ' ').trim(),
      top: box.top,
      left: box.left,
      right: box.right,
      width: box.width,
      height: box.height,
      innerHeight: window.innerHeight,
    };
  });

test.describe('the A-6 skip-link', () => {
  for (const door of [DEFAULT_PATH, doorNamed('reduced-motion')]) {
    test(`is the first tabbable element on ${door.name}`, async ({ browser }) => {
      // A-6 had no implementation anywhere in this repository before this story, and no other story
      // creates one. It is asserted on both front doors because it belongs to the document rather
      // than to either path.
      await onPath(browser, door, async (page) => {
        await goTo(page);
        await settled(page);
        const floor = await floorFrom(page);

        // Off-screen before it is focused, and off-screen on the block axis rather than clipped to
        // a pixel: `hit-target-floor.pw.ts` measures a clipped link at 1x1 and fails AD-19 on it,
        // and fails an element whose left or right edge is outside the viewport.
        const parked = await page.locator('.skip-link').boundingBox();
        expect(parked, 'the home route renders no skip-link').not.toBeNull();
        expect(
          parked ? parked.y + parked.height : 0,
          'the skip-link is on screen before anything focused it'
        ).toBeLessThanOrEqual(0);
        expect(parked?.x ?? -1, 'the skip-link is parked outside the left edge, which is A-5').toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Tab');
        const landed = await focused(page);

        expect(landed, 'nothing is focused after one Tab').not.toBeNull();
        expect(
          landed?.className,
          `one Tab from the loaded document landed on ${landed?.tag}.${landed?.className} rather than ` +
            `on the skip-link, so A-6 is not the first tabbable element`
        ).toContain('skip-link');
        expect(landed?.href, 'the skip-link no longer targets the main landmark').toBe(`#${MAIN_ID}`);

        // Visible at the moment it has focus, which is the whole of what makes it usable.
        expect(landed?.top ?? -1, 'the skip-link is still off screen while focused').toBeGreaterThanOrEqual(0);
        expect(
          landed?.top ?? Number.MAX_SAFE_INTEGER,
          'the focused skip-link is below the fold'
        ).toBeLessThan(landed?.innerHeight ?? 0);

        expect(landed?.width ?? 0, 'the focused skip-link is under the floor on width').toBeGreaterThanOrEqual(floor);
        expect(landed?.height ?? 0, 'the focused skip-link is under the floor on height').toBeGreaterThanOrEqual(floor);

        // And it resolves to something. A skip-link pointing at an id nothing carries sends the
        // reader to the top of the document, which is where they already were.
        const target = await page.evaluate((id) => {
          const node = document.getElementById(id);
          return node ? { tag: node.tagName, tabindex: node.getAttribute('tabindex') } : null;
        }, MAIN_ID);
        expect(target, `nothing on the home route carries id="${MAIN_ID}"`).not.toBeNull();
        expect(target?.tag, 'the skip-link targets something other than the main landmark').toBe('MAIN');
        expect(target?.tabindex, 'the main landmark cannot receive focus, so the skip only scrolls').toBe('-1');
      });
    });

    test(`skips to the landmark when Enter is pressed on ${door.name}`, async ({ browser }) => {
      // **The thing the control is for, and nothing measured it.** Everything above establishes
      // that the link is first, visible and correctly targeted; none of it establishes that using
      // it does anything. A skip-link whose target lost its `tabindex`, or whose `href` stopped
      // resolving, would leave a keyboard reader exactly where they were, having pressed the
      // control that exists to move them, with every assertion above still green.
      await onPath(browser, door, async (page) => {
        await goTo(page);
        await settled(page);

        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');

        await expect
          .poll(() => page.evaluate(() => document.activeElement?.id ?? '(none)'), {
            timeout: SETTLE_TIMEOUT,
            message:
              'activating the A-6 link did not move focus to the main landmark, so a keyboard ' +
              'reader who used it is still at the top of the document',
          })
          .toBe(MAIN_ID);
      });
    });
  }

  test('and that read fires, measured against a focusable element planted ahead of it', async ({ browser }) => {
    // The control. "The first Tab lands on the skip-link" means nothing unless the same read is
    // seen naming something else, and the honest way to arrange that is to put a tabbable element
    // in front of it, which is exactly the regression the case above exists to catch: a header, a
    // banner or a live region rendered ahead of the link.
    await onPath(browser, DEFAULT_PATH, async (page) => {
      await goTo(page);
      await settled(page);

      await page.evaluate(() => {
        const link = document.querySelector('.skip-link');
        const planted = document.createElement('a');
        planted.href = '#planted';
        planted.className = 'planted-first-tabbable';
        planted.textContent = 'Planted';
        link?.parentElement?.insertBefore(planted, link);
        (document.activeElement as HTMLElement | null)?.blur();
      });

      await page.keyboard.press('Tab');
      const landed = await focused(page);

      expect(
        landed?.className,
        'a focusable element planted ahead of the skip-link did not take the first Tab, so the read ' +
          'above reports the skip-link whatever the document holds'
      ).toContain('planted-first-tabbable');
    });
  });
});

// ---------------------------------------------------------------------------
// Two answers to one question, and they have to be the same answer.
// ---------------------------------------------------------------------------

test.describe('the stylesheet and the hook agree about reduced motion', () => {
  test('leaves the flat rules nothing to hide, and would hide anything they were given', async ({ browser }) => {
    // `HomeLayout.scss` answers `prefers-reduced-motion` in CSS and `useNarrativePath` answers it in
    // script. They agree today, and nothing held them to it: DW-48 contemplates a later story
    // putting reduced-motion visitors back on the narrative path, which would leave the stylesheet
    // hiding a gem that React had rendered and a canvas drawing perfectly and invisibly, with every
    // other case in this file green.
    //
    // So both directions are read on the same page. The script rendered neither element, and the
    // stylesheet would have hidden either if it had.
    await onPath(browser, doorNamed('reduced-motion'), async (page) => {
      await goTo(page);
      await settled(page);

      const rendered = await page.evaluate(() =>
        [...document.querySelectorAll('.home-gem, .skip-control')].map((node) => ({
          className: node.className,
          display: getComputedStyle(node).display,
        }))
      );
      expect(
        rendered,
        'the reduced-motion hero renders an element the flat stylesheet exists to hide. If it is ' +
          'display:none the visitor has an invisible canvas drawing behind the page; if it is not, ' +
          'the two answers have diverged the other way'
      ).toEqual([]);

      expect(
        await page.locator('.home-container--flat').count(),
        'the script did not answer flat on a reduced-motion context, while the stylesheet did'
      ).toBe(1);

      // The control, planted into the running page: the rule is live, so a gem the script rendered
      // would be caught by the read above rather than passing as an absence.
      const planted = await page.evaluate(() => {
        const gem = document.createElement('div');
        gem.className = 'home-gem';
        document.querySelector('.home-container')?.append(gem);
        return getComputedStyle(gem).display;
      });
      expect(
        planted,
        'a gem planted into the reduced-motion hero is not hidden by the stylesheet, so the read ' +
          'above reports agreement for the wrong reason'
      ).toBe('none');
    });
  });
});

// ---------------------------------------------------------------------------
// A-14. The canvas is decoration, and it is treated as decoration.
// ---------------------------------------------------------------------------

test.describe('the narrative canvas', () => {
  test('is aria-hidden and outside the tab order', async ({ browser }) => {
    // A-14 is double-owned with Story 2-29 and this story runs first. The claim is made on the
    // element rather than on the source, because `@react-three/fiber` spreads unknown props onto
    // its own wrapper and what matters is what the browser ends up with.
    await onPath(browser, DEFAULT_PATH, async (page) => {
      await goTo(page);
      await settled(page);
      await expect(page.locator('#gem-canvas canvas')).toBeVisible({ timeout: SETTLE_TIMEOUT });

      const semantics = await page.evaluate(() => {
        const canvas = document.querySelector('#gem-canvas canvas');
        if (!canvas) return null;
        return {
          hidden: canvas.getAttribute('aria-hidden'),
          // **From the parent up, not from the canvas itself.** `closest()` starts at the element,
          // which `Scene.tsx` marks in `onCreated`, so a read anchored on the canvas answers `true`
          // whatever the wrapper says: deleting the `aria-hidden` prop on `<Canvas>` left this case
          // green with `@react-three/fiber`'s two wrapper divs back in the accessibility tree.
          // Those wrappers are what a screen reader walks, and they are a separate claim from the
          // attribute on the element, so they are read separately.
          wrapperHidden: canvas.parentElement?.closest('[aria-hidden="true"]') !== null,
          tabindex: canvas.getAttribute('tabindex'),
        };
      });

      expect(semantics, 'no canvas mounted, so A-14 is asserted about nothing').not.toBeNull();
      expect(semantics?.hidden, 'the canvas element is not aria-hidden').toBe('true');
      expect(
        semantics?.wrapperHidden,
        "the canvas's wrappers are not inside an aria-hidden subtree, so @react-three/fiber's own " +
          'divs are in the accessibility tree around a decorative scene'
      ).toBe(true);
      expect(semantics?.tabindex, 'the canvas is not removed from the tab order').toBe('-1');

      // Tabbing through the whole hero never lands on it. The attribute reads are what the tree
      // says; this is what a keyboard actually does, and the two are different claims.
      const visited: string[] = [];
      for (let stop = 0; stop < 12; stop += 1) {
        await page.keyboard.press('Tab');
        visited.push(await page.evaluate(() => document.activeElement?.tagName ?? '(none)'));
      }

      expect(
        visited.filter((tag) => tag !== 'BODY' && tag !== '(none)').length,
        'twelve Tab presses focused nothing at all, so the sweep below is vacuous'
      ).toBeGreaterThan(0);
      expect(visited, 'a Tab landed on the narrative canvas, which has nothing to operate').not.toContain('CANVAS');
    });
  });
});
