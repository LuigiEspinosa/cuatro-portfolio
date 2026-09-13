import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { RENDERED_VIEWPORT } from './harness';

/**
 * The `suite-reach` mechanism in a browser (Story 2-24).
 *
 * **The tracker is stubbed, deliberately, and the stub is the instrument.** The e2e build sets
 * neither `NEXT_PUBLIC_UMAMI_*` value, so the served page carries no tracker script, and nothing
 * here may reach `analytics.cuatro.dev` (the managed challenge refuses an automated browser by
 * design, and a production website id must never be fed from `localhost`). What this file proves is
 * the component's contract with whatever `window.umami` turns up: nothing before the heading is
 * reached, exactly one `track` after, none again on a reload in the same context, one again in a
 * fresh one, one when the tracker arrives after the heading is already in view, and one when the
 * page jumps past the heading in a single step. The real instrument is the verification session in
 * `ops/visitor-instrumentation.md`, after the merge.
 *
 * **Both front doors, because the story's acceptance criterion names both.** The non-3D path
 * reaches the Directory in zero interactions and the default path through the narrative, and the
 * event must fire the same way on each. `playwright.config.ts:79` makes reduced motion the default
 * context, so the default door is opened in a context of its own, restating every option the
 * project pins rather than inheriting them, the `tests/e2e/front-door.pw.ts:259-279` shape. Which
 * door a context actually landed on is asserted after it settles, so a runner without WebGL cannot
 * run the default door's cases flat and report them green.
 *
 * **The zero readings are measured, not assumed.** Every "nothing was sent" is read after a wait
 * longer than the component's poll period, on a page where the stub is confirmed present and the
 * heading confirmed out of the viewport, and every positive case sees the same recorder record the
 * real call, so a silent page and a broken recorder cannot be confused. The link events are two
 * server-rendered attributes and are proved on the same tree in jsdom
 * (`components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx`), not here.
 *
 * **No screenshot is taken**, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true.
 */

const ROUTE = '/';

/** The fragment the Directory heading carries. `SuiteDirectory.tsx` is the declaration. */
const HEADING_ID = 'suite';

/**
 * The reach event's name, restated from `SuiteReach.tsx`. Playwright's loader cannot import a
 * `'use client'` module, so it is a literal here; `ops/__tests__/visitor-instrumentation.test.ts`
 * holds the export to the record, and a drift fails every positive case below by name.
 */
const REACH_EVENT = 'suite-reach';

/** The component's poll, restated: `SuiteReach.tsx` `TRACKER_POLL_MS` and `TRACKER_POLL_LIMIT`. */
const TRACKER_POLL_MS = 250;
const TRACKER_POLL_LIMIT = 80;

/**
 * How long a page is given to stay silent before "nothing was sent" is read. Several poll periods
 * and several frames: the positive cases below show the event arriving well inside this once the
 * heading is in view, so silence for this long is a measurement rather than a race.
 */
const SILENCE_MS = TRACKER_POLL_MS * 6;

/** How long any single condition here is given before it is called a failure. */
const SETTLE_TIMEOUT = 15_000;

/**
 * The stub, installed before the page's own scripts run. It records every `track` call into an
 * array a case reads back, and nothing else: the component needs `window.umami.track` to be a
 * function, which is what the deployed script sets when it evaluates.
 */
const TRACKER_STUB = `
  window.__umamiCalls = [];
  window.umami = {
    track: (name, data) => { window.__umamiCalls.push({ name, data }); },
  };
`;

interface TrackCall {
  readonly name: string;
  readonly data?: Record<string, unknown>;
}

interface FrontDoor {
  readonly name: string;
  readonly reducedMotion: 'reduce' | 'no-preference';
}

const DOORS: readonly FrontDoor[] = [
  { name: 'the default front door', reducedMotion: 'no-preference' },
  { name: 'the reduced-motion front door', reducedMotion: 'reduce' },
];

/**
 * A context on one door, every option the project pins restated rather than inherited, with the
 * given init scripts on every page it opens.
 */
const openDoor = async (browser: Browser, door: FrontDoor, inits: readonly string[]): Promise<BrowserContext> => {
  const context = await browser.newContext({
    viewport: { ...RENDERED_VIEWPORT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: door.reducedMotion,
  });
  for (const init of inits) await context.addInitScript(init);
  return context;
};

/** Navigate, refuse a page that did not answer 200, wait for the fonts. `front-door.pw.ts:287-294`. */
const goTo = async (page: Page): Promise<void> => {
  const response = await page.goto(ROUTE, { waitUntil: 'load' });
  expect(response, `navigating to ${ROUTE} produced no response`).toBeTruthy();
  expect(response?.status(), `${ROUTE} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

/**
 * Hydrated and decided, and decided the way the door says. `front-door.pw.ts:311-331` is the
 * reasoning for the first half; the second half is what stops a runner without WebGL from running
 * the default door's cases on the flat path and calling them green.
 */
const settled = async (page: Page, door: FrontDoor): Promise<void> => {
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
        message: `${door.name}: the page never reached a hydrated, decided state`,
      }
    )
    .toBe(true);

  const flat = await page.locator('.home-container--flat').count();
  expect(
    flat,
    door.reducedMotion === 'reduce'
      ? `${door.name} settled on the default path, so this case is not measuring the non-3D door`
      : `${door.name} settled on the flat path, so this case is not measuring the default door: ` +
        `the runner answered no WebGL, and the default door's cases would all run flat`
  ).toBe(door.reducedMotion === 'reduce' ? 1 : 0);
};

/** Every `track` call the stub recorded on this document. */
const calls = (page: Page): Promise<TrackCall[]> =>
  page.evaluate(() => (window as unknown as { __umamiCalls?: TrackCall[] }).__umamiCalls ?? []);

const hasTracker = (page: Page): Promise<boolean> =>
  page.evaluate(() => typeof (window as unknown as { umami?: { track?: unknown } }).umami?.track === 'function');

const flagged = (page: Page, key: string): Promise<boolean> =>
  page.evaluate((name) => sessionStorage.getItem(name) !== null, key);

/** Scroll the heading into view, and wait until the browser agrees it is there. `front-door.pw.ts:665-669`. */
const reach = async (page: Page): Promise<void> => {
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), HEADING_ID);
  await expect(page.locator(`#${HEADING_ID}`), 'the heading could not be scrolled into view').toBeInViewport({
    timeout: SETTLE_TIMEOUT,
  });
};

/** Wait for exactly one reach call to arrive, then hand back everything recorded. */
const expectOneReach = async (page: Page, door: FrontDoor): Promise<void> => {
  await expect
    .poll(async () => (await calls(page)).length, {
      timeout: SETTLE_TIMEOUT,
      message: `${door.name}: the heading is in view and no track call arrived`,
    })
    .toBeGreaterThan(0);

  // Then hold still: a second call arriving a moment later is the defect the flag exists for.
  await page.waitForTimeout(SILENCE_MS);
  const recorded = await calls(page);
  expect(
    recorded.map((call) => call.name),
    `${door.name}: reaching the heading recorded ${JSON.stringify(recorded)}`
  ).toEqual([REACH_EVENT]);
  expect(recorded[0].data, `${door.name}: the reach event carries data, which is an Ask First of the story`).toBeUndefined();
};

for (const door of DOORS) {
  test.describe(`suite-reach on ${door.name}`, () => {
    test('sends nothing before the heading is reached, and exactly one event after', async ({ browser }) => {
      const context = await openDoor(browser, door, [TRACKER_STUB]);
      try {
        const page = await context.newPage();
        await goTo(page);
        await settled(page, door);

        expect(await hasTracker(page), 'the stub is not installed, so nothing here can record').toBe(true);
        // Out of the viewport, asserted rather than assumed: a heading already in view would make
        // "nothing before the scroll" a case that measures nothing.
        await expect(
          page.locator(`#${HEADING_ID}`),
          'the Directory heading sits inside the first viewport, so the pre-scroll reading measures nothing'
        ).not.toBeInViewport();

        // Silence, measured: longer than the poll period, on a page where the observer has had
        // time to attach and report the heading below the fold.
        await page.waitForTimeout(SILENCE_MS);
        expect(await calls(page), `${door.name}: an event was sent before the heading was reached`).toEqual([]);
        expect(await flagged(page, REACH_EVENT), 'the flag was set before anything was sent').toBe(false);

        await reach(page);
        await expectOneReach(page, door);
        expect(await flagged(page, REACH_EVENT), 'the send left no flag behind').toBe(true);
      } finally {
        await context.close();
      }
    });

    test('sends none again on a reload in the same context, and one again in a fresh one', async ({ browser }) => {
      const first = await openDoor(browser, door, [TRACKER_STUB]);
      try {
        const page = await first.newPage();
        await goTo(page);
        await settled(page, door);
        await reach(page);
        await expectOneReach(page, door);

        // The reload. `addInitScript` runs again, so the recorder starts empty and the stub is
        // back; `sessionStorage` survives, which is the whole of the once-per-session rule.
        await goTo(page);
        await settled(page, door);
        expect(await hasTracker(page), 'the stub did not reinstall on reload, so silence below would prove nothing').toBe(
          true
        );
        expect(await calls(page), 'the recorder did not reset on reload, so the count below is stale').toEqual([]);
        expect(await flagged(page, REACH_EVENT), 'the flag did not survive the reload').toBe(true);

        await reach(page);
        await page.waitForTimeout(SILENCE_MS);
        expect(await calls(page), `${door.name}: a reload in the same tab sent suite-reach again`).toEqual([]);
      } finally {
        await first.close();
      }

      // A fresh context is a new tab's storage: the same door, the same scroll, one event again.
      // This is the control for the silence above, on the same build and the same page.
      const second = await openDoor(browser, door, [TRACKER_STUB]);
      try {
        const page = await second.newPage();
        await goTo(page);
        await settled(page, door);
        expect(await flagged(page, REACH_EVENT), 'a fresh context carries the flag, so it is not fresh').toBe(false);
        await reach(page);
        await expectOneReach(page, door);
      } finally {
        await second.close();
      }
    });

    test('sends one when the tracker arrives after the heading is already in view', async ({ browser }) => {
      // `afterInteractive` puts the script after hydration, and on a slow connection after the
      // visitor has scrolled. The component polls for the tracker and only then observes, so the
      // observer's initial notification is what counts a heading already in view. The stub is
      // installed here by hand, after the scroll, rather than before the page's scripts.
      const context = await openDoor(browser, door, []);
      try {
        const page = await context.newPage();
        await goTo(page);
        await settled(page, door);
        const settledAt = Date.now();
        expect(await hasTracker(page), 'a tracker is present on the e2e build, so this case cannot arrive late').toBe(
          false
        );

        await reach(page);
        await page.waitForTimeout(SILENCE_MS);
        expect(await hasTracker(page), 'a tracker appeared on its own').toBe(false);

        // The component's poll gives up `TRACKER_POLL_LIMIT` ticks after its effect ran, which is
        // no later than `settled` resolved. A stub installed after that bound is a slow runner,
        // not a component defect, and it is reported as such rather than as a missing event.
        const elapsed = Date.now() - settledAt;
        expect(
          elapsed,
          `${door.name}: the stub is being installed ${elapsed} ms after the page settled, past the ` +
            `${TRACKER_POLL_MS * TRACKER_POLL_LIMIT} ms poll bound less the silence wait, so the component ` +
            `has stopped looking: a slow runner, not a component defect`
        ).toBeLessThan(TRACKER_POLL_MS * TRACKER_POLL_LIMIT - SILENCE_MS);

        await page.addScriptTag({ content: TRACKER_STUB });
        expect(await hasTracker(page), 'the late stub did not install').toBe(true);
        await expectOneReach(page, door);
      } finally {
        await context.close();
      }
    });

    test('sends one when the page jumps past the heading in a single step', async ({ browser }) => {
      // End, Ctrl+End or a scrollbar drag moves the heading from below the viewport to above it
      // between two frames, and against the bare viewport that is "not intersecting" on both sides,
      // so an observer would never notify. `EXPERIENCE.md:696` allows no scroll listener to catch
      // it; the component extends the observer's root upward instead, and this is the jump seen
      // becoming a crossing in a real browser. One `scrollTo` to the end of the document is the
      // step, and the heading is asserted above the viewport afterwards so the case measures a
      // jump and not a scroll that stopped on it.
      const context = await openDoor(browser, door, [TRACKER_STUB]);
      try {
        const page = await context.newPage();
        await goTo(page);
        await settled(page, door);
        expect(await hasTracker(page), 'the stub is not installed, so nothing here can record').toBe(true);
        await expect(page.locator(`#${HEADING_ID}`)).not.toBeInViewport();
        await page.waitForTimeout(SILENCE_MS);
        expect(await calls(page), `${door.name}: an event was sent before the jump`).toEqual([]);

        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect
          .poll(() => page.locator(`#${HEADING_ID}`).evaluate((element) => element.getBoundingClientRect().bottom), {
            timeout: SETTLE_TIMEOUT,
            message: `${door.name}: the jump left the heading in or below the viewport, so this measures no jump`,
          })
          .toBeLessThan(0);

        await expectOneReach(page, door);
      } finally {
        await context.close();
      }
    });
  });
}
