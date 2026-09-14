import { test, expect, type Browser, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue, rootCustomPropertyValue } from './harness';

/**
 * The display entrance on `/`, measured in a browser (Story 2-27, `DESIGN.md:730-737`,
 * `EXPERIENCE.md:447-469`).
 *
 * `GlitchText` is a real `<h1>` whose words are split at render time into inline per-character
 * spans that one CSS keyframe fades in, staggered by DOM index and fitted inside `--dur-major`.
 * Everything here is read off the running page: the type roles through a probe element and the
 * motion roles off `:root`, never typed, so a contract that moved a value would move the
 * expectation with it (AD-24, FR-37).
 *
 * **Every read is seen firing on a planted control before its green result is read as good news.**
 * The controls are planted through the browser and removed in the same case, so none is left in
 * the tree, which is the rule `front-door.pw.ts` and `accessibility-floor.pw.ts` set. The story
 * also planted each of `animation-iteration-count: infinite`, `text-shadow` and `aria-label` into
 * the source once, saw the case fail naming it, and removed it; that reading is in the story's spec.
 *
 * **Two contexts, because the project's is the wrong one for half of this.** `playwright.config.ts`
 * pins `reducedMotion: 'reduce'`, which is the door on which the entrance must not run at all, so
 * the entrance itself is read on a `no-preference` context opened here, and the reduced-motion
 * reads are held equal to it on everything but the animation.
 *
 * The grapheme and `tag` rows of the story's matrix are render-time facts of the component and are
 * read in `components/molecules/GlitchText/__tests__/GlitchText.test.tsx`; this file reads what
 * `/` renders and what the stylesheet computes, including on a one-character fixture.
 *
 * **No screenshot is taken**, so `keeps exactly one committed baseline` in
 * `tests/e2e/rendered-output.pw.ts` stays true, and no snapshot directory is written.
 */

const ROUTE = '/';
const HEADING = 'h1.glitch-text';
const CHAR = '.glitch-text__char';
/** The words `HomeLayout.tsx:110` passes, and the level-1 heading `/` names. */
const NAME = 'Luigi Espinosa';
/** The one keyframe `GlitchText.scss` declares. */
const KEYFRAME = 'glitch-text-arrive';
/** `EXPERIENCE.md:695`: the whole stagger is capped at about half a second. */
const ENTRANCE_CAP_SECONDS = 0.5;
/** Slack on a time read back through the computed-style serialiser, which rounds. */
const TIME_SLACK = 0.001;
/** Slack on a pixel comparison alone, never on an identity. */
const PX_SLACK = 0.05;
/** Room after the entrance window for the compositor to commit the final frame. */
const SETTLE_SLACK_MS = 250;

/** `__dirname` rather than `import.meta.url`: Playwright transpiles to CommonJS (`front-door.pw.ts:64-67`). */
const REPO_ROOT = resolve(__dirname, '..', '..');
const BUILT_CHUNKS = join(REPO_ROOT, '.next', 'static', 'chunks');

/** The three strings the deleted loop carried and nothing under `app/` or `components/` may carry again. */
const LOOP_TRACES = ['glitch-loop', 'rgba(255, 0, 80', 'rgba(0, 255, 255'] as const;

// ---------------------------------------------------------------------------
// Contexts, navigation, probes
// ---------------------------------------------------------------------------

/**
 * Run `read` against `/` on a context that differs from the project's in the motion preference and
 * nothing else. Every option the project pins is restated because `browser.newContext` inherits
 * none of them (`front-door.pw.ts:259-279`).
 */
const onMotion = async <T>(
  browser: Browser,
  reducedMotion: 'reduce' | 'no-preference',
  read: (page: Page) => Promise<T>
): Promise<T> => {
  const context = await browser.newContext({
    viewport: { ...RENDERED_VIEWPORT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion,
  });
  try {
    return await read(await context.newPage());
  } finally {
    await context.close();
  }
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

/** The computed value of one property, resolved by laying out a probe (`accessibility-floor.pw.ts:483-494`). */
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
 * A `<time>` as seconds, from the contract's `220ms`, the built contract's minified `.22s` or the
 * serialiser's `0.22s`; refused otherwise.
 */
const seconds = (value: string, what: string): number => {
  const match = /^(-?(?:[0-9]+\.?[0-9]*|\.[0-9]+))(ms|s)$/.exec(value.trim());
  if (!match) throw new Error(`Display entrance: ${what} reads "${value}", which is not a time`);
  return match[2] === 'ms' ? Number(match[1]) / 1000 : Number(match[1]);
};

/** A pixel length, refused when it is not one. */
const px = (value: string, what: string): number => {
  const match = /^(-?(?:[0-9]+\.?[0-9]*|\.[0-9]+))px$/.exec(value.trim());
  if (!match) throw new Error(`Display entrance: ${what} reads "${value}", which is not a pixel length`);
  return Number(match[1]);
};

/** The first family of a `font-family` list, unquoted. */
const firstFamily = (list: string): string => list.split(',')[0].trim().replace(/^["']|["']$/g, '');

/** Every computed property the type roles fix on the heading, plus the three the design forbids. */
interface TypeRead {
  readonly family: string;
  readonly weight: string;
  readonly stretch: string;
  readonly size: string;
  readonly lineHeight: string;
  readonly tracking: string;
  readonly transform: string;
  readonly color: string;
  readonly textShadow: string;
  readonly clipPath: string;
  readonly translate: string;
}

const typeRead = async (page: Page): Promise<TypeRead> => ({
  family: firstFamily(await computedStyleValue(page, HEADING, 'font-family')),
  weight: await computedStyleValue(page, HEADING, 'font-weight'),
  stretch: await computedStyleValue(page, HEADING, 'font-stretch'),
  size: await computedStyleValue(page, HEADING, 'font-size'),
  lineHeight: await computedStyleValue(page, HEADING, 'line-height'),
  tracking: await computedStyleValue(page, HEADING, 'letter-spacing'),
  transform: await computedStyleValue(page, HEADING, 'text-transform'),
  color: await computedStyleValue(page, HEADING, 'color'),
  textShadow: await computedStyleValue(page, HEADING, 'text-shadow'),
  clipPath: await computedStyleValue(page, HEADING, 'clip-path'),
  translate: await computedStyleValue(page, HEADING, 'transform'),
});

/** One span, as the page computes it. */
interface CharRead {
  readonly index: string;
  readonly text: string;
  readonly display: string;
  readonly name: string;
  readonly duration: string;
  readonly timing: string;
  readonly iterations: string;
  readonly fill: string;
  readonly delay: string;
  readonly opacity: number;
}

const charsRead = (page: Page): Promise<CharRead[]> =>
  page.evaluate(
    ([heading, char]) =>
      [...document.querySelectorAll<HTMLElement>(`${heading} ${char}`)].map((node) => {
        const style = window.getComputedStyle(node);
        return {
          index: node.style.getPropertyValue('--i').trim(),
          text: node.textContent ?? '',
          display: style.display,
          name: style.animationName,
          duration: style.animationDuration,
          timing: style.animationTimingFunction,
          iterations: style.animationIterationCount,
          fill: style.animationFillMode,
          delay: style.animationDelay,
          opacity: Number.parseFloat(style.opacity),
        };
      }),
    [HEADING, CHAR] as const
  );

/** The two custom properties inline on the heading. */
const headingVars = (page: Page): Promise<{ count: string; delay: string }> =>
  page.evaluate((heading) => {
    const node = document.querySelector<HTMLElement>(heading);
    if (!node) throw new Error(`no ${heading} on the page`);
    return { count: node.style.getPropertyValue('--count').trim(), delay: node.style.getPropertyValue('--delay').trim() };
  }, HEADING);

/** Plant a stylesheet into the page and hand back its removal. */
const plantStyle = async (page: Page, css: string): Promise<() => Promise<void>> => {
  await page.evaluate((text) => {
    const style = document.createElement('style');
    style.id = 'display-entrance-plant';
    style.textContent = text;
    document.head.append(style);
  }, css);
  return () => page.evaluate(() => document.getElementById('display-entrance-plant')?.remove());
};

/** Wait out the whole window: `--delay`, then one `--dur-major`, then a little for the last frame. */
const waitOutTheEntrance = async (page: Page, delay: number, major: number): Promise<void> => {
  await page.waitForTimeout((delay + major) * 1000 + SETTLE_SLACK_MS);
};

/** Everything a `.scss` under `root` says, path by path. */
const stylesheetsUnder = (root: string): Map<string, string> => {
  const found = new Map<string, string>();
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.scss')) found.set(path.slice(REPO_ROOT.length + 1).replace(/\\/g, '/'), readFileSync(path, 'utf8'));
    }
  };
  walk(root);
  return found;
};

// ---------------------------------------------------------------------------
// The cases
// ---------------------------------------------------------------------------

test('the heading is a real h1 carrying the words, split into indexed inline spans, with no ARIA on any node', async ({
  browser,
}) => {
  await onMotion(browser, 'no-preference', async (page) => {
    await goTo(page);
    expect(await page.locator(HEADING).count(), `${ROUTE} renders no ${HEADING}`).toBe(1);
    expect(await page.locator(HEADING).evaluate((node) => node.parentElement?.className), 'the heading is not the name panel\'s own child').toContain('home-panel--name');

    const vars = await headingVars(page);
    const chars = await charsRead(page);
    expect(chars.length, 'the heading splits into a different number of spans than the name has characters').toBe(NAME.length);
    expect(vars.count, '--count on the heading is not the span count').toBe(String(chars.length));
    expect(vars.delay, '--delay on the heading is not the 1.0 HomeLayout.tsx:110 passes').toBe('1s');
    expect(chars.map((char) => char.index), 'the spans are not indexed 0 to n-1 in DOM order').toEqual(chars.map((_, index) => String(index)));
    expect(chars.map((char) => char.text).join(''), 'the spans do not spell the name').toBe(NAME);
    expect(await page.locator(HEADING).evaluate((node) => node.textContent), 'the heading\'s text content is not the name').toBe(NAME);
    expect(chars.filter((char) => char.display !== 'inline').map((char) => `${char.index}: ${char.display}`), 'a span is not inline, so assistive technology reads a box per letter').toEqual([]);

    const aria = await page.locator(`${HEADING}, ${HEADING} *`).evaluateAll((nodes) =>
      nodes.filter((node) => ['aria-label', 'aria-hidden', 'role', 'aria-level'].some((name) => node.hasAttribute(name))).map((node) => node.outerHTML.slice(0, 80))
    );
    expect(aria, 'an ARIA attribute or a role is on the heading or inside it').toEqual([]);
  });
});

test('computes the display roles read off the page, and neither shadow, clip nor transform', async ({ browser }) => {
  await onMotion(browser, 'no-preference', async (page) => {
    await goTo(page);

    // The roles, resolved on the same page, never typed.
    const family = firstFamily(await rootCustomPropertyValue(page, '--f-display'));
    const weight = await rootCustomPropertyValue(page, '--w-black');
    const size = await probeComputed(page, 'font-size:var(--t-display);', 'font-size');
    const lineHeight = await probeComputed(page, 'font-size:var(--t-display);line-height:var(--lh-display);', 'line-height');
    const tracking = await probeComputed(page, 'font-size:var(--t-display);letter-spacing:var(--tr-display);', 'letter-spacing');
    const color = await probeComputed(page, 'color:var(--token-text);', 'color');
    const ratio = Number(await rootCustomPropertyValue(page, '--lh-display'));
    expect(family, '--f-display declares no first family').not.toBe('');
    expect(weight, '--w-black is not the heaviest weight the display face publishes').toBe('800');
    expect(Number.isFinite(ratio) && ratio >= 0.95, `--lh-display reads ${ratio}, under the 0.95 all-caps floor RESTYLE-SPEC.md:411-412 fixes`).toBe(true);

    const read = await typeRead(page);
    const wrong: string[] = [];
    if (read.family !== family) wrong.push(`font-family computes "${read.family}" first, expected ${family}`);
    if (read.weight !== weight) wrong.push(`font-weight computes ${read.weight}, expected ${weight}`);
    if (read.stretch !== '100%') wrong.push(`font-stretch computes ${read.stretch}, expected 100% for wdth 100`);
    if (Math.abs(px(read.size, 'font-size') - px(size, '--t-display')) > PX_SLACK) wrong.push(`font-size computes ${read.size}, --t-display resolves to ${size}`);
    if (Math.abs(px(read.lineHeight, 'line-height') - px(lineHeight, '--lh-display')) > PX_SLACK) wrong.push(`line-height computes ${read.lineHeight}, --lh-display resolves to ${lineHeight}`);
    if (Math.abs(px(read.lineHeight, 'line-height') - ratio * px(read.size, 'font-size')) > PX_SLACK) wrong.push(`line-height ${read.lineHeight} is not ${ratio} times the size ${read.size}`);
    if (Math.abs(px(read.tracking, 'letter-spacing') - px(tracking, '--tr-display')) > PX_SLACK) wrong.push(`letter-spacing computes ${read.tracking}, --tr-display resolves to ${tracking}`);
    if (read.transform !== 'uppercase') wrong.push(`text-transform computes ${read.transform}`);
    if (read.color !== color) wrong.push(`color computes ${read.color}, --token-text resolves to ${color}`);
    if (read.textShadow !== 'none') wrong.push(`text-shadow computes ${read.textShadow}`);
    if (read.clipPath !== 'none') wrong.push(`clip-path computes ${read.clipPath}`);
    if (read.translate !== 'none') wrong.push(`transform computes ${read.translate}`);
    console.log(`display-entrance: ${HEADING} computes ${JSON.stringify(read)}`);
    expect(wrong, `the heading is off the display roles:\n${wrong.join('\n')}`).toEqual([]);

    // The depth read, on a planted shadow, before its `none` is read as good news.
    const unplant = await plantStyle(page, `${HEADING}{text-shadow:1px 1px red!important}`);
    expect((await typeRead(page)).textShadow, 'a planted text-shadow was not seen').not.toBe('none');
    await unplant();
    expect((await typeRead(page)).textShadow, 'the planted shadow outlived its case').toBe('none');
  });
});

test('every character enters on opacity alone, once, in DOM order, inside --dur-major after --delay', async ({ browser }) => {
  await onMotion(browser, 'no-preference', async (page) => {
    await goTo(page);
    const minor = seconds(await rootCustomPropertyValue(page, '--dur-minor'), '--dur-minor');
    const major = seconds(await rootCustomPropertyValue(page, '--dur-major'), '--dur-major');
    // Declared on `:root`, and resolved through a probe because the built contract minifies the
    // token stream (`cubic-bezier(.16,1,.3,1)`) and the serialiser writes `cubic-bezier(0.16, 1, 0.3, 1)`.
    expect(await rootCustomPropertyValue(page, '--ease-entrance')).toContain('cubic-bezier');
    const ease = await probeComputed(page, 'animation-timing-function:var(--ease-entrance);', 'animation-timing-function');
    const delay = seconds((await headingVars(page)).delay, '--delay');
    expect(major, '--dur-major is over the ~500ms cap EXPERIENCE.md:695 sets, so fitting inside it proves nothing').toBeLessThanOrEqual(ENTRANCE_CAP_SECONDS);
    expect(minor, '--dur-minor is not shorter than --dur-major, so there is no room for a stagger').toBeLessThan(major);

    const chars = await charsRead(page);
    expect(chars.length, 'no span was read').toBe(NAME.length);
    const wrong: string[] = [];
    for (const char of chars) {
      if (char.name !== KEYFRAME) wrong.push(`${char.index}: animation-name ${char.name}, expected ${KEYFRAME}`);
      if (Math.abs(seconds(char.duration, 'animation-duration') - minor) > TIME_SLACK) wrong.push(`${char.index}: animation-duration ${char.duration}, --dur-minor is ${minor}s`);
      if (char.timing !== ease) wrong.push(`${char.index}: animation-timing-function ${char.timing}, --ease-entrance resolves to ${ease}`);
      if (char.iterations !== '1') wrong.push(`${char.index}: animation-iteration-count ${char.iterations}, expected 1`);
      if (char.fill !== 'both') wrong.push(`${char.index}: animation-fill-mode ${char.fill}, expected both`);
    }
    const delays = chars.map((char) => seconds(char.delay, `animation-delay of span ${char.index}`));
    for (let index = 1; index < delays.length; index += 1) {
      if (!(delays[index] > delays[index - 1])) wrong.push(`span ${index} starts at ${delays[index]}s, not after span ${index - 1} at ${delays[index - 1]}s`);
    }
    if (Math.abs(delays[0] - delay) > TIME_SLACK) wrong.push(`the first span starts at ${delays[0]}s, --delay is ${delay}s`);
    const span = delays[delays.length - 1] + minor - delays[0];
    if (span > major + TIME_SLACK) wrong.push(`the entrance runs ${span.toFixed(4)}s from the first start to the last end, past --dur-major ${major}s`);
    if (span > ENTRANCE_CAP_SECONDS) wrong.push(`the entrance runs ${span.toFixed(4)}s, past the ${ENTRANCE_CAP_SECONDS}s cap`);
    console.log(`display-entrance: ${chars.length} spans, delays ${delays.map((value) => value.toFixed(4)).join(', ')}, ${span.toFixed(4)}s first start to last end`);
    expect(wrong, `the entrance is not the one the design specifies:\n${wrong.join('\n')}`).toEqual([]);

    // After the window every span is present, and the heading paints no depth.
    await waitOutTheEntrance(page, delay, major);
    const after = await charsRead(page);
    expect(
      after.filter((char) => char.opacity < 1).map((char) => `${char.index}: opacity ${char.opacity}`),
      `a span is still below full opacity ${delay + major}s after first paint`
    ).toEqual([]);
    const settled = await typeRead(page);
    expect([settled.textShadow, settled.clipPath, settled.translate], 'the heading paints depth or an offset after the entrance').toEqual(['none', 'none', 'none']);

    // Both reads on planted controls: a loop, and a span held below full opacity.
    const unplantLoop = await plantStyle(page, `${CHAR}{animation-iteration-count:infinite!important}`);
    expect((await charsRead(page)).map((char) => char.iterations), 'a planted infinite iteration count was not seen').toEqual(chars.map(() => 'infinite'));
    await unplantLoop();
    const unplantDim = await plantStyle(page, `${CHAR}{opacity:.5!important}`);
    expect((await charsRead(page)).filter((char) => char.opacity < 1), 'a planted half-opacity was not seen').toHaveLength(chars.length);
    await unplantDim();
    expect((await charsRead(page)).every((char) => char.iterations === '1' && char.opacity === 1), 'a planted control outlived its case').toBe(true);
  });
});

test('under reduced motion every span is present at full opacity from the first evaluation, and nothing else differs', async ({
  browser,
}) => {
  const moving = await onMotion(browser, 'no-preference', async (page) => {
    await goTo(page);
    return typeRead(page);
  });
  await onMotion(browser, 'reduce', async (page) => {
    await goTo(page);
    const chars = await charsRead(page);
    expect(chars.length, 'no span was read on the reduced-motion door').toBe(NAME.length);
    expect(
      chars.filter((char) => char.name !== 'none' || char.opacity !== 1).map((char) => `${char.index}: animation-name ${char.name}, opacity ${char.opacity}`),
      'a span animates, or is not at full opacity, on the door that asked for stillness'
    ).toEqual([]);

    const still = await typeRead(page);
    const differing = (Object.keys(still) as (keyof TypeRead)[]).filter((key) => still[key] !== moving[key]).map((key) => `${key}: ${still[key]} under reduced motion, ${moving[key]} without`);
    expect(differing, 'the reduced-motion door changes something about the heading other than the animation').toEqual([]);
  });
});

test('with the client bundle blocked the heading is served with its words and still arrives', async ({ browser }) => {
  await onMotion(browser, 'no-preference', async (page) => {
    await page.route('**/_next/static/chunks/*.js', (route) => route.abort());
    await goTo(page);

    // The block took: React never marked the container, so nothing below depends on hydration.
    const hydrated = await page.evaluate(() => {
      const container = document.querySelector('.home-container');
      return container !== null && Object.getOwnPropertyNames(container).some((name) => name.startsWith('__reactFiber$'));
    });
    expect(hydrated, 'the client bundle ran, so this case is not measuring the served document').toBe(false);

    expect(await page.locator(HEADING).evaluate((node) => node.textContent), 'the served markup does not carry the words').toBe(NAME);
    const major = seconds(await rootCustomPropertyValue(page, '--dur-major'), '--dur-major');
    const delay = seconds((await headingVars(page)).delay, '--delay');
    await waitOutTheEntrance(page, delay, major);
    const chars = await charsRead(page);
    expect(chars.length, 'no span was served').toBe(NAME.length);
    expect(chars.filter((char) => char.opacity < 1).map((char) => `${char.index}: opacity ${char.opacity}`), 'a span never reached full opacity with no script running').toEqual([]);
  });
});

test('a one-character heading delays its one span by exactly --delay, and the stagger fits the count', async ({ browser }) => {
  // Planted markup, read against the shipped stylesheet: the arithmetic in `animation-delay` on
  // the two ends of `--count`, and what a missing `--count` falls to.
  await onMotion(browser, 'no-preference', async (page) => {
    await goTo(page);
    const minor = seconds(await rootCustomPropertyValue(page, '--dur-minor'), '--dur-minor');
    const major = seconds(await rootCustomPropertyValue(page, '--dur-major'), '--dur-major');
    const delayOf = (heading: string, span: string): Promise<string> =>
      page.evaluate(
        ([headingAttributes, spanAttributes]) => {
          const planted = document.createElement('h1');
          planted.className = 'glitch-text';
          planted.setAttribute('style', headingAttributes);
          const char = document.createElement('span');
          char.className = 'glitch-text__char';
          char.setAttribute('style', spanAttributes);
          char.textContent = 'A';
          planted.append(char);
          document.body.append(planted);
          const read = window.getComputedStyle(char).animationDelay;
          planted.remove();
          return read;
        },
        [heading, span] as const
      );

    expect(seconds(await delayOf('--count:1;--delay:0.3s', '--i:0'), 'the one span')).toBeCloseTo(0.3, 3);
    expect(seconds(await delayOf('--count:14;--delay:0.3s', '--i:0'), 'the first of fourteen')).toBeCloseTo(0.3, 3);
    expect(seconds(await delayOf('--count:14;--delay:0.3s', '--i:13'), 'the last of fourteen')).toBeCloseTo(0.3 + (major - minor), 3);
    expect(seconds(await delayOf('--count:1', '--i:0'), 'no --delay'), 'no --delay does not fall back to 0s').toBe(0);
    expect(seconds(await delayOf('--delay:0.3s', '--i:5'), 'no --count'), 'a missing --count does not invalidate the delay to 0s').toBe(0);
  });
});

test('the accessibility tree carries one level-1 heading named by the text, and nothing generic is named', async ({ page }) => {
  await goTo(page);
  const heading = page.getByRole('heading', { level: 1, name: NAME, exact: true });
  expect(await heading.count(), `the tree does not carry exactly one level-1 heading named ${NAME}`).toBe(1);
  expect(await page.getByRole('heading', { level: 1 }).count(), 'the tree carries more than one level-1 heading').toBe(1);
  const snapshot = await page.locator(HEADING).ariaSnapshot();
  console.log(`display-entrance: aria snapshot of ${HEADING}:\n${snapshot}`);
  expect(snapshot).toContain(`heading "${NAME}" [level=1]`);
  expect(snapshot, 'the snapshot names a generic node, so a wrapper or a span carries a name of its own').not.toMatch(/generic "/);

  // The name read, on a planted label: it moves the name off the words, and the case would fail.
  await page.locator(HEADING).evaluate((node) => node.setAttribute('aria-label', 'Planted Name'));
  expect(await page.getByRole('heading', { level: 1, name: NAME, exact: true }).count(), 'a planted aria-label was not seen by the name read').toBe(0);
  expect(await page.locator(HEADING).ariaSnapshot()).toContain('heading "Planted Name" [level=1]');
  await page.locator(HEADING).evaluate((node) => node.removeAttribute('aria-label'));
  expect(await page.getByRole('heading', { level: 1, name: NAME, exact: true }).count(), 'the planted label outlived its case').toBe(1);
});

test('the built CSS and every stylesheet under app/ and components/ carry no trace of the loop', () => {
  expect(existsSync(BUILT_CHUNKS), `${BUILT_CHUNKS} is not there, so there is no build to read`).toBe(true);
  const built = readdirSync(BUILT_CHUNKS).filter((name) => name.endsWith('.css'));
  expect(built.length, 'the build wrote no stylesheet').toBeGreaterThan(0);
  const carrying: string[] = [];
  let arrivals = 0;
  for (const name of built) {
    const text = readFileSync(join(BUILT_CHUNKS, name), 'utf8');
    expect(statSync(join(BUILT_CHUNKS, name)).size, `${name} is empty`).toBeGreaterThan(0);
    if (text.includes(KEYFRAME)) arrivals += 1;
    for (const trace of ['glitch-loop', 'text-shadow']) if (text.includes(trace)) carrying.push(`.next/static/chunks/${name} carries ${trace}`);
  }
  expect(arrivals, `no built stylesheet carries @keyframes ${KEYFRAME}, so the entrance is not in what ships`).toBe(1);
  expect(carrying, 'the built CSS still carries the loop or a text-shadow').toEqual([]);

  const sources = new Map([...stylesheetsUnder(join(REPO_ROOT, 'app')), ...stylesheetsUnder(join(REPO_ROOT, 'components'))]);
  expect(sources.size, 'no stylesheet was read under app/ or components/').toBeGreaterThan(10);
  expect([...sources.keys()], 'GlitchText.scss is not beside its component').toContain('components/molecules/GlitchText/GlitchText.scss');
  expect([...sources.keys()], 'glitch-text.scss is still on disk').not.toContain('components/molecules/GlitchText/glitch-text.scss');
  const traced = [...sources].flatMap(([path, text]) => LOOP_TRACES.filter((trace) => text.includes(trace)).map((trace) => `${path} carries ${trace}`));
  expect(traced, 'a stylesheet under app/ or components/ still names the loop or one of its two hues').toEqual([]);

  // The scans, on planted text, before their empty results are read as good news.
  expect(LOOP_TRACES.filter((trace) => '.x{text-shadow:1px 0 rgba(255, 0, 80, .75);animation:glitch-loop 6s infinite}'.includes(trace))).toEqual(['glitch-loop', 'rgba(255, 0, 80']);
});
