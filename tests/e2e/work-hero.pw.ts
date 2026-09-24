import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test, expect, type APIRequestContext, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { RENDERED_VIEWPORT } from './harness';

/**
 * The `/work` hero and the timeline as a browser renders them (Story 2-33).
 *
 * The story rebuilt `WorkHero` and `WorkTimeline` against the token contract: the display line left
 * and the canvas right, closed beneath by the boundary rule; the meta line a Plate mark; the torus
 * behind one contained `next/dynamic` boundary that is never rendered under reduced motion; one CSS
 * opacity entrance in place of two GSAP tweens; and the timeline's scroll-triggered fade-up deleted.
 * `components/organisms/WorkHero/__tests__/WorkHero.test.tsx` and `WorkTimeline.test.tsx` read the
 * markup, the binding's vars and the stylesheets as they compile. What neither can see is here: the
 * boxes and the pixels, the accessibility tree and the keyboard, what the browser requests on each
 * motion preference, what happens when the torus's chunk does not arrive, and the rows in the frames
 * after a scroll.
 *
 * **Every reading is watched producing the other answer before its clean result is believed.** Each
 * control is planted through the browser (a style tag, an attribute, a node, an aborted request), so
 * nothing is left in the tree.
 *
 * **No screenshot is compared.** Viewport captures are decoded in the page to read pixels, and none is
 * written, so `keeps exactly one committed baseline` in `tests/e2e/rendered-output.pw.ts` stays true.
 * The project's context asks for reduced motion (`playwright.config.ts`); every case that needs the
 * torus opens a context that does not, and differs in nothing else.
 */

const ROUTE = '/work';
const HEADING_NAME = 'Frontend Developer and Team Lead';
const CONTAINMENT_LOG = 'WorkHero: the torus chunk failed to load';
const CANVAS = '.work-hero__canvas-wrap canvas';
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * The fingerprints, read out of `ops/asset-budget.mjs` rather than restated, the way
 * `tests/e2e/narrative.pw.ts` reads them (copied, not imported: a `.pw.ts` imported by another
 * registers its tests twice). A parse that dropped rows would narrow the scan to a clean result, so
 * the entries parsed are held to the entries declared.
 */
const FINGERPRINTS = ((): { library: string; mark: string; webgl: boolean }[] => {
  const source = readFileSync(join(REPO_ROOT, 'ops', 'asset-budget.mjs'), 'utf8');
  const block = /export const FINGERPRINTS = \[([\s\S]*?)\n\];/.exec(source)?.[1];
  if (!block) throw new Error('ops/asset-budget.mjs declares no FINGERPRINTS array this parse can find');
  const entries = [...block.matchAll(/\{\s*library:\s*'([^']+)',\s*mark:\s*'((?:[^'\\]|\\.)*)',\s*webgl:\s*(true|false)\s*\}/g)];
  const declared = (block.match(/\blibrary:/g) ?? []).length;
  if (entries.length !== declared) throw new Error(`FINGERPRINTS parsed to ${entries.length} of ${declared} entries`);
  return entries.map((match) => ({ library: match[1], mark: match[2].replace(/\\(.)/g, '$1'), webgl: match[3] === 'true' }));
})();

/** The marks of the WebGL stack, which is what makes a chunk the torus's. */
const WEBGL_MARKS = FINGERPRINTS.filter((entry) => entry.webgl).map((entry) => entry.mark);

/** `ScrollTrigger`'s mark: the library that turns the torus with the scroll, and nothing else here. */
const SCROLL_BINDING_MARK = ((): string => {
  const entry = FINGERPRINTS.find((candidate) => candidate.library === 'gsap/ScrollTrigger');
  if (!entry) throw new Error('ops/asset-budget.mjs no longer fingerprints gsap/ScrollTrigger');
  return entry.mark;
})();

/** Navigate, refuse anything but a 200, and wait for the faces. */
const goTo = async (page: Page, route: string = ROUTE): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer 200`).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

/**
 * Whether React has hydrated the hero: React's own mark on a host node it hydrated, the signal
 * `tests/e2e/harness.ts` reads for the home route, read here on `.work-hero`. The torus's effect runs
 * after this, so a read taken once it holds and two frames have passed has seen the decision.
 */
const hydratedHero = (page: Page) =>
  expect
    .poll(
      () =>
        page.evaluate(() => {
          const hero = document.querySelector('.work-hero');
          return hero !== null && Object.getOwnPropertyNames(hero).some((name) => name.startsWith('__reactFiber$'));
        }),
      { timeout: 15_000, message: 'the hero never hydrated' }
    )
    .toBe(true);

const frames = (page: Page, count = 2) =>
  page.evaluate(
    (wanted) =>
      new Promise<void>((done) => {
        let left = wanted;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    count
  );

/**
 * Open a page on a context that differs from the project's in `options` and in nothing else, hand it
 * to `read`, and close the context.
 */
const onContext = async <T>(browser: Browser, options: BrowserContextOptions, read: (page: Page) => Promise<T>): Promise<T> => {
  const context = await browser.newContext({
    viewport: { ...RENDERED_VIEWPORT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    ...options,
  });
  try {
    return await read(await context.newPage());
  } finally {
    await context.close();
  }
};

/**
 * What a set of declarations computes to on a probe, read for the properties named. Tokens are
 * resolved here rather than restated, so every expectation below is the contract's value as this
 * browser resolves it at this viewport.
 */
const probe = (page: Page, style: Record<string, string>, read: readonly string[]): Promise<Record<string, string>> =>
  page.evaluate(
    ({ declared, wanted }) => {
      const node = document.createElement('span');
      node.style.display = 'block';
      for (const [property, value] of Object.entries(declared)) node.style.setProperty(property, value);
      document.body.append(node);
      const computed = getComputedStyle(node);
      const out = Object.fromEntries(wanted.map((name) => [name, computed.getPropertyValue(name)]));
      node.remove();
      return out;
    },
    { declared: style, wanted: [...read] }
  );

/** A colour role as a computed colour string. */
const role = async (page: Page, name: string): Promise<string> => (await probe(page, { color: `var(${name})` }, ['color'])).color;

/** Colours as four 8-bit channels through a 1 by 1 canvas, refusing a value it would not parse. */
const rasterise = (page: Page, colours: readonly string[]): Promise<string[]> =>
  page.evaluate((list: string[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.globalCompositeOperation = 'copy';
    return list.map((value) => {
      const refused = ['#123456', '#654321'].every((sentinel) => {
        context.fillStyle = sentinel;
        context.fillStyle = value;
        return context.fillStyle === sentinel;
      });
      if (refused) throw new Error(`${value} could not be rasterised`);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return `${r},${g},${b},${a}`;
    });
  }, [...colours]);

/** One row of viewport pixels, decoded in the page from a screenshot (the house shape). */
const pixelRow = async (page: Page, x: number, y: number, width: number): Promise<string[]> => {
  const shot = await page.screenshot();
  return page.evaluate(
    async ({ dataUrl, area }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context for the screenshot');
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(area.x, area.y, area.width, 1);
      const row: string[] = [];
      for (let at = 0; at < data.length; at += 4) row.push(`${data[at]},${data[at + 1]},${data[at + 2]},${data[at + 3]}`);
      return row;
    },
    { dataUrl: `data:image/png;base64,${shot.toString('base64')}`, area: { x: Math.round(x), y: Math.round(y), width: Math.round(width) } }
  );
};

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const boxOf = async (page: Page, selector: string): Promise<Box> => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return box;
};

/** Every script the page requested, and which of them carry one of the marks asked about. */
const scriptLedger = (page: Page) => {
  const requested = new Set<string>();
  page.on('request', (issued) => {
    if (issued.resourceType() === 'script') requested.add(issued.url());
  });
  return {
    requested,
    /** Wait until the set stops growing across two reads, then classify each script by its body. */
    carrying: async (request: APIRequestContext, marks: readonly string[] = WEBGL_MARKS): Promise<string[]> => {
      let previous = -1;
      await expect
        .poll(
          () => {
            const settled = requested.size === previous;
            previous = requested.size;
            return settled;
          },
          { timeout: 15_000, intervals: [500], message: 'the page never stopped requesting scripts' }
        )
        .toBe(true);
      const found: string[] = [];
      for (const url of requested) {
        const response = await request.get(url);
        if (response.status() !== 200) continue;
        const text = await response.text();
        if (marks.some((mark) => text.includes(mark))) found.push(url.split('/').pop() ?? url);
      }
      return found;
    },
  };
};

// ---------------------------------------------------------------------------
// The composition
// ---------------------------------------------------------------------------

test.describe('the hero, where motion is allowed', () => {
  // 768 is the width the two columns start at, 1280 the width the acceptance criterion names and 2400
  // the widest the Hub is read at: the two-column rule holds across the whole range it is written for.
  for (const width of [768, 1280, 2400] as const) {
    test(`sets the display line left of the canvas at ${width}, the columns split 3 to 2, the torus drawn, closed beneath by the boundary rule`, async ({ browser }) => {
      await onContext(browser, { viewport: { width, height: 800 }, reducedMotion: 'no-preference' }, async (page) => {
        await goTo(page);
        await page.locator(CANVAS).waitFor({ state: 'attached', timeout: 20_000 });

        const heading = await boxOf(page, '.work-hero__heading');
        const text = await boxOf(page, '.work-hero__text');
        const wrap = await boxOf(page, '.work-hero__canvas-wrap');
        // **Polled, because the canvas is attached before it is sized.** The renderer measures its box
        // after mounting, so a read taken the frame the element appears can find the element's default
        // 300 x 150 rather than the box it fills a moment later.
        await expect
          .poll(
            async () => {
              const drawn = await boxOf(page, CANVAS);
              return Math.abs(drawn.width - wrap.width) + Math.abs(drawn.height - wrap.height);
            },
            { timeout: 10_000, message: 'the canvas never came to fill its box' }
          )
          .toBeLessThanOrEqual(2);
        const canvas = await boxOf(page, CANVAS);
        console.log(
          `work-hero: at ${width} the text column is ${text.width.toFixed(2)} wide at x ${text.x.toFixed(2)}, the canvas box ` +
            `${wrap.width.toFixed(2)} x ${wrap.height.toFixed(2)} at x ${wrap.x.toFixed(2)}`
        );
        expect(heading.x + heading.width, 'the display line runs into the canvas column').toBeLessThanOrEqual(wrap.x + 0.5);
        expect(text.x + text.width, 'the text column runs into the canvas column').toBeLessThanOrEqual(wrap.x + 0.5);
        expect(heading.y < wrap.y + wrap.height && wrap.y < heading.y + heading.height, 'the display line and the canvas are not side by side').toBe(true);
        expect(wrap.width / wrap.height, 'the canvas box does not keep its 4:3 ratio').toBeCloseTo(4 / 3, 2);
        expect(text.width / wrap.width, 'the text column and the canvas box are not split 3fr to 2fr').toBeCloseTo(3 / 2, 2);
        expect(Math.abs(canvas.width - wrap.width) + Math.abs(canvas.height - wrap.height), 'the canvas does not fill its box').toBeLessThanOrEqual(2);

        const border = await page.locator('.work-hero').evaluate((node) => {
          const style = getComputedStyle(node);
          return { width: style.borderBottomWidth, style: style.borderBottomStyle, colour: style.borderBottomColor, top: style.borderTopWidth };
        });
        const stroke = (await probe(page, { width: 'var(--stroke-boundary)' }, ['width'])).width;
        const boundary = await role(page, '--token-border-interactive');
        expect(border, 'the hero is not closed beneath by the boundary rule, and by nothing else').toEqual({
          width: stroke,
          style: 'solid',
          colour: boundary,
          top: '0px',
        });

        // The rule as pixels: the hero's last row of pixels is the boundary role, rasterised, across its
        // whole width, so the rule is opaque and runs the content width.
        const hero = await boxOf(page, '.work-hero');
        expect(hero.y + hero.height, 'the hero ends below the viewport, where its last row of pixels cannot be read').toBeLessThanOrEqual(800);
        const [expected] = await rasterise(page, [boundary]);
        const row = await pixelRow(page, hero.x + 1, hero.y + hero.height - 1, hero.width - 2);
        const off = [...new Set(row.filter((pixel) => pixel !== expected))];
        expect(off, `the boundary rule is not ${expected} across the hero's width: ${off.slice(0, 3).join(' | ')}`).toEqual([]);

        // The control: the same rule at half alpha over the same ground matches the role nowhere.
        await page.addStyleTag({ content: '.work-hero { border-block-end-color: rgb(120 120 140 / 0.5) !important; }' });
        const planted = await pixelRow(page, hero.x + 1, hero.y + hero.height - 1, hero.width - 2);
        expect(planted.filter((pixel) => pixel === expected), 'a half-alpha rule reads as the role').toEqual([]);
      });
    });
  }

  test('stacks the canvas box under the text at 360, full width at 4:3, with nothing past an edge', async ({ browser }) => {
    await onContext(browser, { reducedMotion: 'no-preference' }, async (page) => {
      await goTo(page);
      await page.locator(CANVAS).waitFor({ state: 'attached', timeout: 20_000 });
      const text = await boxOf(page, '.work-hero__text');
      const wrap = await boxOf(page, '.work-hero__canvas-wrap');
      expect(wrap.y, 'the canvas box does not follow the text').toBeGreaterThanOrEqual(text.y + text.height);
      expect(wrap.width, 'the canvas box is not the text column\'s width').toBeCloseTo(text.width, 1);
      expect(wrap.width / wrap.height, 'the canvas box does not keep its 4:3 ratio').toBeCloseTo(4 / 3, 2);

      const outside = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('.work-hero, .work-hero *')]
            .filter((node) => node.getClientRects().length > 0)
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.right > window.innerWidth + 0.5 || rect.left < -0.5;
            })
            .map((node) => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`)
        );
      expect(await outside(), 'an element of the hero sits past a viewport edge at 360').toEqual([]);
      // The control: a planted wide child of the hero is reported.
      await page.evaluate(() => {
        const wide = document.createElement('div');
        wide.style.cssText = 'width: 480px; height: 4px;';
        document.querySelector('.work-hero__text')?.append(wide);
      });
      expect((await outside()).length, 'the edge read does not see a planted wide element').toBeGreaterThan(0);
    });
  });

  test('keeps the heading a real <h1> in the tree, and the canvas out of it and out of the keyboard\'s path', async ({ page, browser }) => {
    // On the project's context first: no canvas, the heading still the one level-1 heading.
    await goTo(page);
    await hydratedHero(page);
    const reduced = page.getByRole('heading', { level: 1 });
    await expect(reduced, '/work does not carry exactly one level-1 heading').toHaveCount(1);
    await expect(reduced, 'the heading is not named by its own words').toHaveAccessibleName(HEADING_NAME);
    expect(await page.locator('h1').evaluate((node) => node.closest('[aria-hidden]') === null), 'the heading sits inside an aria-hidden subtree').toBe(true);

    // The control: the defect PR #65 fixed, planted back, takes the heading out of the tree.
    await page.evaluate(() => document.querySelector('.work-hero')?.setAttribute('aria-hidden', 'true'));
    await expect(page.getByRole('heading', { level: 1 }), 'an aria-hidden section leaves its heading in the tree').toHaveCount(0);

    await onContext(browser, { reducedMotion: 'no-preference' }, async (moving) => {
      await goTo(moving);
      await moving.locator(CANVAS).waitFor({ state: 'attached', timeout: 20_000 });
      // **The canvas's own two attributes are written when the renderer is created**, a moment after
      // the element is attached (`Scene.tsx`, `onCreated`); the wrapper is hidden from the start. So
      // the element's attributes are waited for, and a canvas that never gets them fails here, named.
      await expect
        .poll(() => moving.evaluate((selector) => document.querySelector(selector)?.getAttribute('tabindex') ?? null, CANVAS), {
          timeout: 10_000,
          message: 'the canvas was never taken out of the tab order, so the renderer never finished creating',
        })
        .toBe('-1');
      await expect(moving.getByRole('heading', { level: 1 }), 'the torus changed the heading count').toHaveCount(1);
      const semantics = await moving.evaluate((selector) => {
        const canvas = document.querySelector(selector);
        if (!canvas) return null;
        return {
          hidden: canvas.getAttribute('aria-hidden'),
          // From the parent up, not from the canvas itself: `closest()` starts at the element, and the
          // library's own wrappers are what a screen reader walks (`tests/e2e/front-door.pw.ts`).
          wrapperHidden: canvas.parentElement?.closest('[aria-hidden="true"]') !== null,
          tabindex: canvas.getAttribute('tabindex'),
          headingHidden: document.querySelector('h1')?.closest('[aria-hidden]') !== null,
        };
      }, CANVAS);
      expect(semantics, 'no canvas mounted, so this reads nothing').not.toBeNull();
      expect(semantics?.hidden, 'the canvas is not aria-hidden').toBe('true');
      expect(semantics?.wrapperHidden, 'the canvas\'s wrappers are in the accessibility tree').toBe(true);
      expect(semantics?.tabindex, 'the canvas is not out of the tab order').toBe('-1');
      expect(semantics?.headingHidden, 'the heading moved inside an aria-hidden subtree with the torus').toBe(false);

      const visited: string[] = [];
      for (let stop = 0; stop < 12; stop += 1) {
        await moving.keyboard.press('Tab');
        visited.push(await moving.evaluate(() => document.activeElement?.tagName ?? '(none)'));
      }
      expect(visited.filter((tag) => tag !== 'BODY' && tag !== '(none)').length, 'twelve Tab presses focused nothing').toBeGreaterThan(0);
      expect(visited, 'a Tab landed on the torus canvas, which has nothing to operate').not.toContain('CANVAS');
    });
  });
});

// ---------------------------------------------------------------------------
// Reduced motion, and what is requested
// ---------------------------------------------------------------------------

test.describe('under reduced motion the torus is not requested at all', () => {
  test('requests no WebGL chunk, draws no canvas and omits its box, where a context allowing motion does all three', async ({ page, browser, request }) => {
    const ledger = scriptLedger(page);
    await goTo(page);
    await hydratedHero(page);
    await frames(page, 4);
    const carrying = await ledger.carrying(request);
    console.log(`work-hero: under reduced motion, ${ledger.requested.size} scripts requested, WebGL-carrying: ${carrying.join(', ') || 'none'}`);
    expect(ledger.requested.size, 'no script was requested at all, so the ledger read nothing').toBeGreaterThan(0);
    expect(carrying, 'a WebGL-carrying chunk was requested under reduced motion').toEqual([]);
    expect(await page.locator('canvas').count(), 'a canvas is drawn under reduced motion').toBe(0);
    expect(await page.locator('.work-hero__canvas-wrap').boundingBox(), 'the canvas box is drawn under reduced motion').toBeNull();
    const columns = await page.locator('.work-hero').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    expect(columns, 'the hero is not one column under reduced motion').toBe(1);

    // The control: the same reads on a context that allows motion find the chunk, the canvas and the box.
    await onContext(browser, { reducedMotion: 'no-preference' }, async (moving) => {
      const movingLedger = scriptLedger(moving);
      await goTo(moving);
      await moving.locator(CANVAS).waitFor({ state: 'attached', timeout: 20_000 });
      const found = await movingLedger.carrying(request);
      console.log(`work-hero: with motion allowed, WebGL-carrying: ${found.join(', ')}`);
      expect(found.length, 'the ledger finds no WebGL chunk where the torus is drawn, so its clean read proves nothing').toBeGreaterThan(0);
      expect(await moving.locator('.work-hero__canvas-wrap').boundingBox(), 'the canvas box is omitted where motion is allowed').not.toBeNull();
    });
  });

  test('and ScrollTrigger arrives with the torus, never without it', async ({ page, browser, request }) => {
    // Until 2026-09-24 `app/providers.tsx` and this hero both imported `ScrollTrigger` at module
    // scope, so every document carried it and a visitor who never gets the torus fetched the library
    // that turns it. DW-36's Operator ruling of that day moved the binding and the registration into
    // `TorusCanvas`, behind the one boundary, so the library arrives with the torus or not at all.
    const ledger = scriptLedger(page);
    await goTo(page);
    await hydratedHero(page);
    await frames(page, 4);
    const carrying = await ledger.carrying(request, [SCROLL_BINDING_MARK]);
    console.log(`work-hero: under reduced motion, ScrollTrigger-carrying: ${carrying.join(', ') || 'none'}`);
    expect(ledger.requested.size, 'no script was requested at all, so the ledger read nothing').toBeGreaterThan(0);
    expect(carrying, 'ScrollTrigger was requested under reduced motion, where there is no torus to turn').toEqual([]);

    // The control: where the torus is drawn, the same read finds the library among what was requested.
    await onContext(browser, { reducedMotion: 'no-preference' }, async (moving) => {
      const movingLedger = scriptLedger(moving);
      await goTo(moving);
      await moving.locator(CANVAS).waitFor({ state: 'attached', timeout: 20_000 });
      const found = await movingLedger.carrying(request, [SCROLL_BINDING_MARK]);
      console.log(`work-hero: with motion allowed, ScrollTrigger-carrying: ${found.join(', ')}`);
      expect(found.length, 'no requested script carries ScrollTrigger where the torus is drawn, so the clean read proves nothing').toBeGreaterThan(0);
    });
  });

  test('takes the torus away when reduced motion is asked for mid-session', async ({ browser }) => {
    await onContext(browser, { reducedMotion: 'no-preference' }, async (page) => {
      await goTo(page);
      await page.locator(CANVAS).waitFor({ state: 'attached', timeout: 20_000 });
      expect(await page.locator(CANVAS).count(), 'the torus was not drawn before the preference changed').toBe(1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.locator('canvas'), 'the torus outlived a preference for reduced motion').toHaveCount(0, { timeout: 10_000 });
      expect(await page.locator('.work-hero__canvas-wrap').boundingBox(), 'the canvas box stays drawn under reduced motion').toBeNull();
    });
  });

  test('contains a torus chunk that never arrives: the page is whole and the failure is logged', async ({ browser }) => {
    await onContext(browser, { reducedMotion: 'no-preference' }, async (page) => {
      const aborted: string[] = [];
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await page.route('**/_next/static/chunks/**', async (route) => {
        const url = route.request().url();
        if (!url.endsWith('.js')) return route.continue();
        const response = await route.fetch();
        const body = await response.text();
        if (WEBGL_MARKS.some((mark) => body.includes(mark))) {
          aborted.push(url.split('/').pop() ?? url);
          return route.abort();
        }
        return route.fulfill({ response, body });
      });
      await goTo(page);
      await hydratedHero(page);
      await expect
        .poll(() => consoleErrors.some((line) => line.startsWith(CONTAINMENT_LOG)), {
          timeout: 15_000,
          message: 'the containment never logged, so either the chunk was not requested or the failure was swallowed',
        })
        .toBe(true);
      console.log(`work-hero: aborted ${aborted.join(', ')}`);
      expect(aborted.length, 'no WebGL chunk was requested, so nothing was contained').toBeGreaterThan(0);
      expect(pageErrors, 'a failed torus chunk threw out of the page').toEqual([]);
      await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(HEADING_NAME);
      await expect(page.locator('.work-hero .plate-mark'), 'a mark is missing with the chunk aborted').toHaveCount(2);
      await expect(page.locator('.work-item'), 'the timeline is missing with the chunk aborted').toHaveCount(4);
      expect(await page.locator('canvas').count(), 'a canvas mounted from an aborted chunk').toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// The display line and the meta line
// ---------------------------------------------------------------------------

test.describe('the display line and the meta line', () => {
  test('sets the heading on the display row at 360, 768, 1024, 1280 and 2400, and breaks no word', async ({ browser }) => {
    await onContext(browser, { reducedMotion: 'no-preference' }, async (page) => {
      const wrongs: string[] = [];
      for (const width of [360, 768, 1024, 1280, 2400]) {
        await page.setViewportSize({ width, height: 800 });
        await goTo(page);
        const loaded = await page.evaluate(() => document.fonts.check('800 16px "Bricolage Grotesque"'));
        const read = await page.locator('.work-hero__heading').evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            family: style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''),
            size: style.fontSize,
            weight: style.fontWeight,
            leading: style.lineHeight,
            tracking: style.letterSpacing,
            transform: style.textTransform,
            colour: style.color,
            moved: style.transform,
          };
        });
        const expected = await probe(
          page,
          {
            'font-size': 'var(--t-display)',
            'font-weight': 'var(--w-black)',
            'line-height': 'var(--lh-display)',
            'letter-spacing': 'var(--tr-display)',
          },
          ['font-size', 'font-weight', 'line-height', 'letter-spacing']
        );
        const colour = await role(page, '--token-text');
        const broken = await page.locator('.work-hero__heading').evaluate((node) => {
          const out: string[] = [];
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            for (const match of (text.textContent ?? '').matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(text, match.index ?? 0);
              range.setEnd(text, (match.index ?? 0) + match[0].length);
              if (range.getClientRects().length !== 1) out.push(match[0]);
            }
          }
          return out;
        });
        console.log(`work-hero: at ${width} the heading is ${read.size} on ${read.leading}, words broken: ${broken.join(', ') || 'none'}`);
        if (!loaded) wrongs.push(`${width}: the display face did not load`);
        if (read.family !== 'Bricolage Grotesque') wrongs.push(`${width}: the heading's first family is ${read.family}`);
        if (read.size !== expected['font-size']) wrongs.push(`${width}: size ${read.size}, the display step is ${expected['font-size']}`);
        if (read.weight !== expected['font-weight']) wrongs.push(`${width}: weight ${read.weight}, the black weight is ${expected['font-weight']}`);
        if (read.leading !== expected['line-height']) wrongs.push(`${width}: leading ${read.leading}, the display leading is ${expected['line-height']}`);
        if (read.tracking !== expected['letter-spacing']) wrongs.push(`${width}: tracking ${read.tracking}, the display tracking is ${expected['letter-spacing']}`);
        if (read.transform !== 'uppercase') wrongs.push(`${width}: the heading is not uppercase`);
        if (read.colour !== colour) wrongs.push(`${width}: the heading is ${read.colour}, the text role is ${colour}`);
        if (read.moved !== 'none') wrongs.push(`${width}: the heading carries a transform`);
        if (broken.length > 0) wrongs.push(`${width}: ${broken.join(', ')} broke across lines`);
      }
      expect(wrongs, wrongs.join('\n')).toEqual([]);

      // The control: a width narrower than the longest word breaks one, and the word read sees it.
      await page.addStyleTag({ content: '.work-hero__heading { max-inline-size: 90px !important; }' });
      const planted = await page.locator('.work-hero__heading').evaluate((node) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let breaks = 0;
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          for (const match of (text.textContent ?? '').matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(text, match.index ?? 0);
            range.setEnd(text, (match.index ?? 0) + match[0].length);
            if (range.getClientRects().length !== 1) breaks += 1;
          }
        }
        return breaks;
      });
      expect(planted, 'the word read does not see a planted break').toBeGreaterThan(0);
    });
  });

  test('carries the meta line as a section Plate mark: the count, then the period, no // and no loose mono text', async ({ page }) => {
    await goTo(page);
    const rows = await page.locator('.work-item').count();
    expect(rows, 'the timeline rendered no row, so the count below is read against nothing').toBeGreaterThan(0);
    await expect(page.locator('.work-hero .plate-mark'), 'the hero does not carry exactly two marks').toHaveCount(2);
    const meta = page.locator('.work-hero__meta .plate-mark');
    await expect(meta).toHaveCount(1);
    expect(await meta.getAttribute('class'), 'the meta mark is not the section variant').toBe('plate-mark');
    expect(await meta.locator('.plate-mark__label').textContent(), 'the label is not the count of positions').toBe(`${rows} POSITIONS`);
    expect(await meta.locator('.plate-mark__domain').textContent(), 'the domain is not the period').toBe('2017 - PRESENT');
    expect(await page.locator('.work-hero').innerText(), 'a // is read in the hero').not.toContain('//');

    /** Every element in the hero carrying its own text in the mono face, outside a Plate mark. */
    const looseMono = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.work-hero *')]
          .filter((node) => [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== ''))
          .filter((node) => getComputedStyle(node).fontFamily.includes('Geist Mono'))
          .filter((node) => !node.closest('.plate-mark'))
          .map((node) => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`)
      );
    expect(await looseMono(), 'mono text sits in the hero outside a Plate mark, which the 2023 meta line was').toEqual([]);
    // The control: the 2023 meta line, planted back as free mono text, is reported.
    await page.evaluate(() => {
      const line = document.createElement('p');
      line.className = 'planted-meta';
      line.style.fontFamily = 'var(--f-mono)';
      line.textContent = '4 POSITIONS // 2017 - PRESENT';
      document.querySelector('.work-hero__text')?.append(line);
    });
    expect(await looseMono(), 'the read does not see planted free mono text').toContain('p.planted-meta');
  });
});

// ---------------------------------------------------------------------------
// The entrance
// ---------------------------------------------------------------------------

/** The hero's two animated elements, and the delays they keep, in order. */
const ANIMATED = ['.work-hero__heading', '.work-hero__meta'] as const;
const DELAYS = [0.1, 0.4] as const;
const KEYFRAME = 'work-hero-enter';

const entranceOf = (page: Page) =>
  page.evaluate((selectors) =>
    selectors.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`${selector} is not on the page`);
      const style = getComputedStyle(node);
      return {
        selector,
        name: style.animationName,
        duration: style.animationDuration,
        timing: style.animationTimingFunction,
        delay: style.animationDelay,
        fill: style.animationFillMode,
        count: style.animationIterationCount,
        opacity: style.opacity,
        inline: node.getAttribute('style'),
      };
    }),
  [...ANIMATED]);

/** Every animation whose target sits in the hero or the timeline. */
const animationsIn = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .map((animation) => (animation.effect as KeyframeEffect | null)?.target ?? null)
      .filter((target): target is Element => target !== null && target.closest('.work-hero, .work-timeline') !== null)
      .map((target) => `${target.tagName.toLowerCase()}.${[...target.classList].join('.')}`)
  );

test.describe('the entrance is one opacity keyframe, the route\'s only one', () => {
  test('with motion allowed, the heading then the meta fade in at the minor duration on the entrance curve, and nothing else moves', async ({ browser }) => {
    await onContext(browser, { reducedMotion: 'no-preference' }, async (page) => {
      await goTo(page);
      const expected = await probe(page, { 'animation-duration': 'var(--dur-minor)', 'animation-timing-function': 'var(--ease-entrance)' }, [
        'animation-duration',
        'animation-timing-function',
      ]);
      expect(expected['animation-duration'], 'the minor duration is collapsed on a context that allows motion').not.toBe('0.001s');
      const read = await entranceOf(page);
      for (const [index, element] of read.entries()) {
        expect(element.name, `${element.selector} does not run the hero's keyframe`).toBe(KEYFRAME);
        expect(element.duration, `${element.selector} is not at --dur-minor`).toBe(expected['animation-duration']);
        expect(element.timing, `${element.selector} is not on --ease-entrance`).toBe(expected['animation-timing-function']);
        expect(Number.parseFloat(element.delay), `${element.selector} is out of the shipped order`).toBeCloseTo(DELAYS[index], 3);
        expect(element.fill).toBe('both');
        expect(element.count, `${element.selector} repeats`).toBe('1');
      }
      const properties = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('.work-hero'))
          .flatMap((animation) =>
            ((animation.effect as KeyframeEffect).getKeyframes() as Record<string, unknown>[]).flatMap((frame) =>
              Object.keys(frame).filter((key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key))
            )
          )
      );
      expect([...new Set(properties)], 'the entrance animates something other than opacity').toEqual(['opacity']);
      expect((await animationsIn(page)).sort(), 'something other than the heading and the meta animates').toEqual(
        ['div.work-hero__meta', 'h1.work-hero__heading'].sort()
      );

      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('.work-hero'))
            .map((animation) => animation.finished)
        )
      );
      const after = await entranceOf(page);
      expect(after.map((element) => element.opacity), 'the entrance did not end at full opacity').toEqual(['1', '1']);
      expect(after.map((element) => element.inline), 'a script wrote an inline style onto an animated element').toEqual([null, null]);
    });
  });

  test('under reduced motion nothing animates, and both are present at the first read', async ({ page, browser }) => {
    await goTo(page);
    for (const element of await entranceOf(page)) {
      expect(element.name, `${element.selector} animates under reduced motion`).toBe('none');
      expect(element.opacity, `${element.selector} is not at full opacity`).toBe('1');
    }
    expect(await animationsIn(page), 'an animation runs in the hero or the timeline under reduced motion').toEqual([]);

    // The control: the same read, on a context that allows motion, sees the keyframe.
    await onContext(browser, { reducedMotion: 'no-preference' }, async (moving) => {
      await goTo(moving);
      expect((await entranceOf(moving)).map((element) => element.name), 'the read cannot see the keyframe at all').toEqual([KEYFRAME, KEYFRAME]);
    });
  });

  test('with every script aborted, the hero is whole and ends at full opacity, and the canvas box stays empty', async ({ browser }) => {
    // **Hydration blocked rather than JavaScript disabled**, the house's no-script reading
    // (`tests/e2e/front-door.pw.ts`): the document, the stylesheet and the faces arrive as served
    // while React never runs, and `page.evaluate` still works to read them. Only `.js` is aborted,
    // because Turbopack serves the route's CSS under the same prefix.
    await onContext(browser, { reducedMotion: 'no-preference' }, async (page) => {
      let aborted = 0;
      await page.route('**/_next/static/chunks/**', async (route) => {
        if (!route.request().url().endsWith('.js')) return route.continue();
        aborted += 1;
        return route.abort();
      });
      await goTo(page);
      expect(aborted, 'no script was aborted, so this is not the no-script reading').toBeGreaterThan(0);
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('.work-hero'))
            .map((animation) => animation.finished)
        )
      );
      expect((await entranceOf(page)).map((element) => element.opacity), 'with no script, the hero stays hidden').toEqual(['1', '1']);
      expect(await page.locator('.work-hero__canvas-wrap').innerHTML(), 'the canvas box is not empty with no script').toBe('');
      await expect(page.locator('.work-item'), 'the timeline is not in the served markup').toHaveCount(4);
    });
  });
});

// ---------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------

test.describe('the timeline', () => {
  for (const route of ['/work', '/cv'] as const) {
    test(`leaves every row at rest in the frames after a scroll on ${route}, where a planted fade is seen`, async ({ browser }) => {
      await onContext(browser, { reducedMotion: 'no-preference' }, async (page) => {
        await goTo(page, route);

        /** Scroll each row into view and read every row across the next frames; what is not at rest. */
        const afterEachScroll = () =>
          page.evaluate(async () => {
            const rows = [...document.querySelectorAll('.work-item')];
            const moving = new Set<string>();
            const read = () => {
              const running = new Set(
                document
                  .getAnimations()
                  .filter((animation) => animation.playState === 'running')
                  .map((animation) => (animation.effect as KeyframeEffect | null)?.target ?? null)
              );
              rows.forEach((row, index) => {
                const style = getComputedStyle(row);
                if (style.opacity !== '1') moving.add(`row ${index} at opacity ${style.opacity}`);
                if (!['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform)) moving.add(`row ${index} moved by ${style.transform}`);
                if (row.getAttribute('style')) moving.add(`row ${index} carries an inline style`);
                if (running.has(row)) moving.add(`row ${index} runs an animation`);
              });
            };
            for (const row of rows) {
              row.scrollIntoView({ block: 'center', behavior: 'instant' });
              for (let frame = 0; frame < 6; frame += 1) {
                await new Promise((next) => requestAnimationFrame(next));
                read();
              }
            }
            return { rows: rows.length, moving: [...moving] };
          });

        const clean = await afterEachScroll();
        expect(clean.rows, `${route} renders no row`).toBeGreaterThan(0);
        expect(clean.moving, `a row on ${route} is not at rest after the scroll that reveals it`).toEqual([]);

        // The control: a fade on the rows, planted as CSS, is what the same read reports.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.addStyleTag({
          content: '@keyframes planted-fade { from { opacity: 0; } } .work-item { animation: planted-fade 3s both; }',
        });
        expect((await afterEachScroll()).moving.length, 'the read does not see a planted fade').toBeGreaterThan(0);
      });
    });
  }

  for (const route of ['/work', '/cv'] as const) {
    test(`starts the timeline at the container's content edge on ${route}, flush like the block above it`, async ({ page }) => {
      await goTo(page, route);
      const edges = () =>
        page.evaluate(() => {
          const container = document.querySelector('section.container');
          const row = document.querySelector('.work-item');
          const above = document.querySelector('.work-hero__text, .cv-intro');
          if (!container || !row || !above) throw new Error('the container, a row or the block above it is missing');
          const content = container.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(container).paddingLeft);
          return { content, row: row.getBoundingClientRect().left, above: above.getBoundingClientRect().left };
        });
      const read = await edges();
      expect(read.row, 'the first row does not start at the container\'s content edge').toBeCloseTo(read.content, 1);
      expect(read.above, 'the block above the timeline does not start at the same edge').toBeCloseTo(read.content, 1);
      // The control: the 2023 inline padding, planted back, moves the row off the edge.
      await page.addStyleTag({ content: '.work-timeline { padding-inline: var(--page-pad) !important; }' });
      expect((await edges()).row - read.content, 'the edge read does not see planted inline padding').toBeGreaterThan(1);
    });
  }
});
