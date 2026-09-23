import { test, expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { RENDERED_VIEWPORT } from './harness';

/**
 * The Plate mark and the work item, as rendered (Story 2-31).
 *
 * The story folded `HudLabel` into the Plate mark as its annotated and side-ruled variants and rebuilt
 * `WorkItem` against the token contract. `components/molecules/PlateMark/__tests__/PlateMark.test.tsx`
 * and `components/atoms/WorkItem/__tests__/WorkItem.test.tsx` read the markup and the stylesheets as
 * they compile. What neither can see is what a browser paints: the rules as pixels, the type as
 * computed, the accessibility tree with and without the sheets, a pointer's hover and a finger's tap,
 * the ring's reach under a real Tab, and the timeline at the width AD-19 measures. That is this file.
 *
 * **Every reading is watched producing the other answer before its clean result is believed.** Each
 * control is planted through the browser (a style tag, a node, a removed attribute), so nothing is
 * left in the tree.
 *
 * **No screenshot is compared.** Viewport captures are decoded in the page to read pixels, and none is
 * written, so `keeps exactly one committed baseline` in `tests/e2e/rendered-output.pw.ts` stays true.
 */

/** A path the Hub does not route, which renders `app/not-found.tsx`. Same as `hit-target-floor.pw.ts`. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/** The width at which the home readout panel is a corner mark rather than omitted. */
const WIDE_VIEWPORT = { width: 1024, height: 800 } as const;

/** The two routes that render the timeline. */
const TIMELINE_ROUTES = ['/work', '/cv'] as const;

/** Navigate, refuse anything but the status expected, and wait for the faces. */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // `/work`'s torus mounts after hydration and widens the hero's column when it does, which moves
  // every row below it. A box read before the mount and a pixel read after it would disagree.
  if (route === '/work') await page.locator('.work-hero__canvas-wrap canvas').waitFor({ state: 'attached', timeout: 20_000 });
};

/** A context that differs from the project's in the options given and in nothing else. */
const contextWith = (browser: Browser, options: BrowserContextOptions) =>
  browser.newContext({
    viewport: { ...RENDERED_VIEWPORT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    ...options,
  });

/** Plant a style for one page, which is how every control here is made. */
const plantStyle = async (page: Page, css: string): Promise<void> => {
  await page.addStyleTag({ content: css });
};

/**
 * What a set of declarations computes to on a probe, read for the properties named.
 *
 * Tokens are resolved here rather than restated, so every expectation below is the contract's value
 * as this browser resolves it.
 */
const probe = (page: Page, style: Record<string, string>, read: readonly string[]): Promise<Record<string, string>> =>
  page.evaluate(
    ({ declared, wanted }) => {
      const node = document.createElement('span');
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

/** A length token in px. */
const length = async (page: Page, name: string): Promise<string> => (await probe(page, { width: `var(${name})` }, ['width'])).width;

/** A tracking token in px, resolved at a size token, which is what an `em` tracking needs. */
const tracking = async (page: Page, name: string, size: string): Promise<string> =>
  (await probe(page, { 'font-size': `var(${size})`, 'letter-spacing': `var(${name})` }, ['letter-spacing']))['letter-spacing'];

/**
 * Colours as four 8-bit sRGB channels, through a 1 by 1 canvas, the same pipeline the screenshot is
 * decoded through below. Two sentinels, so a value the canvas refuses is reported rather than read
 * as the colour before it (`tests/e2e/anchor-aliases.pw.ts`).
 */
const rasterise = async (page: Page, colours: readonly string[]): Promise<string[]> => {
  const read = await page.evaluate((list: string[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return list.map(() => 'no-2d-context');
    context.globalCompositeOperation = 'copy';
    return list.map((value) => {
      const refused = ['#123456', '#654321'].every((sentinel) => {
        context.fillStyle = sentinel;
        context.fillStyle = value;
        return context.fillStyle === sentinel;
      });
      if (refused) return `unparsed:${value}`;
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return `${r},${g},${b},${a}`;
    });
  }, [...colours]);
  for (const [index, answer] of read.entries()) {
    if (answer === 'no-2d-context' || answer.startsWith('unparsed:')) {
      throw new Error(`${colours[index]} could not be rasterised (${answer}), so no pixel can be compared with it`);
    }
  }
  return read;
};

/** A box in viewport pixels, which is image pixels too at `deviceScaleFactor: 1`. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The pixels of one box of the viewport, as rows of `r,g,b,a`, decoded in the page so no image
 * decoder is added for this (the `tests/e2e/accessibility-floor.pw.ts` shape).
 */
const pixels = async (page: Page, box: Box): Promise<string[][]> => {
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
      const x = Math.max(0, Math.round(area.x));
      const y = Math.max(0, Math.round(area.y));
      const width = Math.max(1, Math.min(Math.round(area.width), canvas.width - x));
      const height = Math.max(1, Math.min(Math.round(area.height), canvas.height - y));
      const { data } = context.getImageData(x, y, width, height);
      const rows: string[][] = [];
      for (let row = 0; row < height; row += 1) {
        const line: string[] = [];
        for (let column = 0; column < width; column += 1) {
          const at = (row * width + column) * 4;
          line.push(`${data[at]},${data[at + 1]},${data[at + 2]},${data[at + 3]}`);
        }
        rows.push(line);
      }
      return rows;
    },
    { dataUrl: `data:image/png;base64,${shot.toString('base64')}`, area: { ...box } }
  );
};

/** The indices of the rows in a grid whose every pixel is `colour`. */
const uniformRows = (grid: readonly string[][], colour: string): number[] =>
  grid.flatMap((row, index) => (row.length > 0 && row.every((pixel) => pixel === colour) ? [index] : []));

/** The indices of the columns in a grid whose every pixel is `colour`. */
const uniformColumns = (grid: readonly string[][], colour: string): number[] =>
  (grid[0] ?? []).flatMap((_, column) => (grid.every((row) => row[column] === colour) ? [column] : []));

/**
 * The part of an element's box a visitor can see, in viewport coordinates: its border box cut by
 * every ancestor that clips its overflow, and by the viewport.
 *
 * **Cut rather than whole, because `/work` clips.** The hero's text column measures 300px inside a
 * 216px box at 360 and `.work-hero` hides the overflow, so the annotated mark's rule is painted from
 * its leading edge to the hero's and no further (KV-5's hero half, Story 2-33's). A strip read over
 * the whole border box would sample the ground beyond the clip and call the rule broken.
 */
const boxOf = (page: Page, selector: string, index = 0): Promise<Box> =>
  page.evaluate(
    ({ target, at }) => {
      const node = document.querySelectorAll(target)[at];
      if (!node) throw new Error(`${target} [${at}] is not on the page`);
      const rect = node.getBoundingClientRect();
      let [left, top, right, bottom] = [rect.left, rect.top, rect.right, rect.bottom];
      for (let ancestor = node.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const clip = ancestor.getBoundingClientRect();
        left = Math.max(left, clip.left + Number.parseFloat(style.borderLeftWidth));
        right = Math.min(right, clip.right - Number.parseFloat(style.borderRightWidth));
        top = Math.max(top, clip.top + Number.parseFloat(style.borderTopWidth));
        bottom = Math.min(bottom, clip.bottom - Number.parseFloat(style.borderBottomWidth));
      }
      [left, right] = [Math.max(left, 0), Math.min(right, window.innerWidth)];
      return { x: left, y: top, width: right - left, height: bottom - top };
    },
    { target: selector, at: index }
  );

/**
 * Scroll so a vertical position inside an element sits mid-viewport, clear of the sticky header, and
 * answer the element's box afterwards.
 */
/**
 * Wait until nothing on the page is moving: no CSS transition or animation running, and no timeline
 * row part-way through `WorkTimeLine.tsx`'s scroll entrance.
 *
 * **That entrance is why this exists.** GSAP drives it from script, so the Web Animations API cannot
 * see it, and it reads no motion preference (review A-3, Story 2-33's to delete): a row scrolled into
 * view fades up from 40px below over 0.6s, and a pixel read inside the fade reads a blend of the rule
 * and the ground, which is how the first run of this file read every rule on the timeline.
 */
const settled = async (page: Page): Promise<void> => {
  // **Still, and still twice in a row.** A scroll reaches GSAP's `ScrollTrigger` on a later frame
  // than the one the scroll happened in, so a single read straight after it can find every row at
  // rest a moment before the entrance starts; and `/work`'s torus widens the hero's column after it
  // mounts, which moves every row below it without animating anything. So each read waits two frames
  // and carries a layout fingerprint (every row's top and the document's height), and the page is
  // settled only when nothing is moving and two reads in a row agree. The second run of this file
  // lost a separator to exactly that race.
  let previous = '';
  await expect
    .poll(
      async () => {
        const reading = await page.evaluate(
          () =>
            new Promise<string>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const running = document.getAnimations().filter((animation) => animation.playState === 'running').length;
                  const rows = [...document.querySelectorAll('.work-item')];
                  const moving = rows.filter((row) => {
                    const style = getComputedStyle(row);
                    return style.opacity !== '1' || !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform);
                  }).length;
                  const layout = rows.map((row) => row.getBoundingClientRect().top.toFixed(2)).join(',');
                  resolve(`${running + moving}|${layout}|${document.documentElement.scrollHeight}|${window.scrollY}`);
                })
              );
            })
        );
        const still = reading.startsWith('0|') && reading === previous;
        previous = reading;
        return still;
      },
      { timeout: 10_000, intervals: [100, 150, 200, 250], message: 'the page never stopped moving, so no pixel read on it is stable' }
    )
    .toBe(true);
};

const centre = async (page: Page, selector: string, index = 0, at: 'top' | 'bottom' = 'top'): Promise<Box> => {
  await page.evaluate(
    ({ target, which, edge }) => {
      const node = document.querySelectorAll(target)[which];
      if (!node) throw new Error(`${target} [${which}] is not on the page`);
      const rect = node.getBoundingClientRect();
      const y = edge === 'bottom' ? rect.bottom : rect.top;
      window.scrollTo({ top: Math.round(window.scrollY + y - window.innerHeight / 2), behavior: 'instant' });
    },
    { target: selector, which: index, edge: at }
  );
  await settled(page);
  return boxOf(page, selector, index);
};

/** A grid summarised for a failure message: each row's distinct pixels, three at most. */
const summary = (grid: readonly string[][]): string =>
  grid.map((row, index) => `${index}: ${[...new Set(row)].slice(0, 3).join(' | ')}${new Set(row).size > 3 ? ' | ...' : ''}`).join('\n');

/** What a strip read found, and what it saw, so a failure says why. */
interface StripRead {
  readonly found: number[];
  readonly seen: string;
}

/** The one-pixel rule beneath a box, searched for in a thin strip around its bottom edge. */
const ruleBeneath = async (page: Page, box: Box, colour: string, inset = 4): Promise<StripRead> => {
  const grid = await pixels(page, { x: box.x + inset, y: Math.floor(box.y + box.height) - 3, width: box.width - 2 * inset, height: 6 });
  return { found: uniformRows(grid, colour), seen: `looking for ${colour}\n${summary(grid)}` };
};

/** The columns of one colour in a thin strip around a box's leading edge, over part of its height. */
const columnsAt = async (page: Page, edge: number, top: number, height: number, colour: string): Promise<StripRead> => {
  const grid = await pixels(page, { x: Math.floor(edge) - 2, y: top, width: 7, height });
  const columns = (grid[0] ?? []).map((_, column) => grid.map((row) => row[column]));
  return { found: uniformColumns(grid, colour), seen: `looking for ${colour}\n${summary(columns)}` };
};

// ---------------------------------------------------------------------------
// The Plate mark
// ---------------------------------------------------------------------------

/** Where each variant renders, and the side its rule sits on. */
const MARKS = [
  { variant: 'section', route: '/cv', status: 200, selector: '.cv-intro .plate-mark', rule: 'bottom', wide: false },
  { variant: 'annotated', route: '/work', status: 200, selector: '.work-hero .plate-mark', rule: 'bottom', wide: false },
  { variant: 'annotated', route: NOT_FOUND, status: 404, selector: '.error-page .plate-mark', rule: 'bottom', wide: false },
  { variant: 'side-ruled end', route: '/', status: 200, selector: '.home-panel--sys .plate-mark', rule: 'right', wide: true },
] as const;

/** How many marks each surface carries: one per genuine domain, never one per heading. */
const MARKS_PER_ROUTE = [
  { route: '/', status: 200, count: 2 },
  { route: '/work', status: 200, count: 1 },
  { route: '/cv', status: 200, count: 1 },
  { route: NOT_FOUND, status: 404, count: 1 },
  { route: '/celeste', status: 200, count: 0 },
] as const;

/**
 * The home readout at 1024, on the animated door, where it is a corner mark. The project's context
 * asks for reduced motion, which is the flat door, and the flat door omits the readout.
 */
const withReadout = async <T>(browser: Browser, read: (page: Page) => Promise<T>): Promise<T> => {
  const context = await contextWith(browser, { viewport: { ...WIDE_VIEWPORT }, reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await goTo(page, '/');
    // Visible first: on the flat door the panel is `display: none`, which still computes an opacity
    // of 1 and would let every read below run against a mark nobody sees.
    await expect(page.locator('.home-panel--sys'), 'the default door did not render the readout panel').toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.home-panel--sys') as Element).opacity), {
        timeout: 20_000,
        message: 'the readout panel never finished arriving, so the default door did not render it',
      })
      .toBe('1');
    return await read(page);
  } finally {
    await context.close();
  }
};

/** Everything the label treatment decides, read off one mark. */
const markStyle = (page: Page, selector: string) =>
  page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) throw new Error(`${target} is not on the page`);
    const style = getComputedStyle(node);
    const side = (name: 'top' | 'right' | 'bottom' | 'left') => ({
      width: style.getPropertyValue(`border-${name}-width`),
      style: style.getPropertyValue(`border-${name}-style`),
      colour: style.getPropertyValue(`border-${name}-color`),
    });
    return {
      family: style.fontFamily,
      size: style.fontSize,
      transform: style.textTransform,
      tracking: style.letterSpacing,
      colour: style.color,
      numerals: style.fontVariantNumeric,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      borders: { top: side('top'), right: side('right'), bottom: side('bottom'), left: side('left') },
    };
  }, selector);

test.describe('the Plate mark sets every variant as one label treatment', () => {
  for (const mark of MARKS) {
    test(`the ${mark.variant} mark on ${mark.route} is mono, uppercase, tracked, secondary and tabular, ruled on its ${mark.rule}`, async ({
      page,
      browser,
    }) => {
      const read = async (target: Page) => {
        if (!mark.wide) await goTo(target, mark.route, mark.status);
        const expected = {
          size: (await probe(target, { 'font-size': 'var(--t-3xs)' }, ['font-size']))['font-size'],
          tracking: await tracking(target, '--tr-label', '--t-3xs'),
          colour: await role(target, '--token-text-secondary'),
          border: await role(target, '--token-border'),
          hair: await length(target, '--stroke-hair'),
          small: await length(target, '--s-sm'),
        };
        return { expected, drawn: await markStyle(target, mark.selector) };
      };
      const { expected, drawn } = mark.wide ? await withReadout(browser, read) : await read(page);

      expect(drawn.family, 'the mark is not set in the mono family').toContain('Geist Mono');
      expect(drawn.size, 'the mark is not at --t-3xs').toBe(expected.size);
      expect(drawn.transform, 'the mark is not uppercase').toBe('uppercase');
      expect(drawn.tracking, 'the mark is not tracked at --tr-label').toBe(expected.tracking);
      expect(drawn.colour, 'the mark is not secondary text').toBe(expected.colour);
      expect(drawn.numerals, 'the mark does not carry tabular numerals').toContain('tabular-nums');

      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const border = drawn.borders[side];
        if (side === mark.rule) {
          expect(border.style, `the ${mark.variant} mark has no rule on its ${side}`).toBe('solid');
          expect(border.width, `the ${mark.variant} rule is not a hairline`).toBe(expected.hair);
          expect(border.colour, `the ${mark.variant} rule is not the border role`).toBe(expected.border);
        } else {
          expect(border.width, `the ${mark.variant} mark draws a second rule, on its ${side}`).toBe('0px');
        }
      }
      if (mark.rule === 'right') {
        expect(drawn.paddingRight, 'the side-ruled mirror does not sit --s-sm inside its rule').toBe(expected.small);
        expect(drawn.paddingLeft, 'the side-ruled mirror keeps the leading padding it moved').toBe('0px');
      }
    });
  }

  test('a side-ruled mark at the leading edge rules its left and pads inside it', async ({ page }) => {
    // No call site renders the leading-edge form today, so it is planted: the variant exists and a
    // component that drew it wrongly would otherwise ship it the first time a call site asked.
    await goTo(page, '/cv');
    await page.evaluate(() => {
      const planted = document.createElement('div');
      planted.id = 'planted-side-ruled';
      planted.className = 'plate-mark plate-mark--side-ruled';
      const label = document.createElement('span');
      label.className = 'plate-mark__label';
      label.textContent = 'PLANTED';
      planted.append(label);
      document.querySelector('.cv-intro')?.append(planted);
    });
    const drawn = await markStyle(page, '#planted-side-ruled');
    expect(drawn.borders.left.width).toBe(await length(page, '--stroke-hair'));
    expect(drawn.borders.left.colour).toBe(await role(page, '--token-border'));
    expect(drawn.paddingLeft).toBe(await length(page, '--s-sm'));
    expect(drawn.borders.bottom.width, 'the side-ruled mark kept the rule beneath as well').toBe('0px');
  });

  for (const route of ['/work', NOT_FOUND] as const) {
    test(`the subordinate line on ${route} is the muted accent at meta tracking, and never read`, async ({ page }) => {
      await goTo(page, route, route === NOT_FOUND ? 404 : 200);
      const sub = page.locator('.plate-mark__sub');
      await expect(sub, `${route} draws no subordinate line`).toHaveCount(1);
      const drawn = await sub.evaluate((node) => {
        const style = getComputedStyle(node);
        return { family: style.fontFamily, size: style.fontSize, colour: style.color, tracking: style.letterSpacing, hidden: node.getAttribute('aria-hidden') };
      });
      expect(drawn.family).toContain('Geist Mono');
      expect(drawn.size).toBe((await probe(page, { 'font-size': 'var(--t-3xs)' }, ['font-size']))['font-size']);
      expect(drawn.colour, 'the subordinate line is not the muted accent').toBe(await role(page, '--token-accent-muted'));
      expect(drawn.tracking, 'the subordinate line is not at --tr-meta').toBe(await tracking(page, '--tr-meta', '--t-3xs'));
      expect(drawn.hidden, 'the subordinate line is exposed to assistive technology').toBe('true');

      const text = (await sub.textContent()) ?? '';
      const tree = await page.locator('.plate-mark').ariaSnapshot();
      expect(tree, 'the mark is absent from the tree altogether, so the read below is of nothing').toContain(
        (await page.locator('.plate-mark__label').textContent()) ?? '\u0000'
      );
      expect(tree, 'the subordinate line is in the accessibility tree').not.toContain(text);

      // The control: the same line with its attribute taken off is read, so the absence above is the
      // attribute's doing and not a snapshot that cannot see the line.
      await sub.evaluate((node) => node.removeAttribute('aria-hidden'));
      expect(await page.locator('.plate-mark').ariaSnapshot(), 'the snapshot cannot see the line at all').toContain(text);
    });
  }

  test('draws each rule as one opaque pixel of the border role, on every ground it sits over', async ({ page, browser }) => {
    // `RESTYLE-SPEC.md` § 3's check: sample the rule and compare it with the computed border role.
    // An alpha rule or a sub-pixel one changes value with what is behind it and matches nothing.
    const found: string[] = [];
    for (const mark of MARKS.filter((candidate) => !candidate.wide)) {
      await goTo(page, mark.route, mark.status);
      const [border] = await rasterise(page, [await role(page, '--token-border')]);
      const box = await centre(page, mark.selector);
      const rows = await ruleBeneath(page, box, border);
      if (rows.found.length !== 1) found.push(`${mark.route} ${mark.variant}: ${rows.found.length} rows of the border role beneath the mark\n${rows.seen}`);
    }
    const side = await withReadout(browser, async (wide) => {
      const [border] = await rasterise(wide, [await role(wide, '--token-border')]);
      await settled(wide);
      const box = await boxOf(wide, '.home-panel--sys .plate-mark');
      const grid = await pixels(wide, { x: Math.floor(box.x + box.width) - 4, y: box.y + 2, width: 8, height: box.height - 4 });
      return { found: uniformColumns(grid, border), seen: summary((grid[0] ?? []).map((_, column) => grid.map((row) => row[column]))) };
    });
    if (side.found.length !== 1) found.push(`/ side-ruled end: ${side.found.length} columns of the border role beside the mark\n${side.seen}`);
    expect(found, `a mark's rule is not one opaque pixel of the border role:\n${found.join('\n')}`).toEqual([]);

    // The control: the same rule at half alpha over the same ground is found nowhere.
    await goTo(page, '/cv');
    await plantStyle(page, '.cv-intro .plate-mark { border-block-end-color: rgb(40 40 48 / 0.5) !important; }');
    const [border] = await rasterise(page, [await role(page, '--token-border')]);
    expect((await ruleBeneath(page, await centre(page, '.cv-intro .plate-mark'), border)).found, 'an alpha rule read as the border role').toEqual([]);
  });

  test('reads as short uppercase strings with the stylesheets off, and never reads a subordinate line', async ({ page }) => {
    // `RESTYLE-SPEC.md` § 7's check, run: turn off CSS, and every label still reads as a short
    // uppercase string and every subordinate line is absent from the accessibility tree. Every route,
    // with the mark count pinned per route, because a label on every section is the anti-pattern.
    const wrong: string[] = [];
    for (const surface of MARKS_PER_ROUTE) {
      await goTo(page, surface.route, surface.status);
      await expect(page.locator('.plate-mark'), `${surface.route} carries a different number of marks`).toHaveCount(surface.count);
      if (surface.count === 0) continue;

      await page.evaluate(() => {
        for (const sheet of Array.from(document.styleSheets)) sheet.disabled = true;
      });
      const cells = await page.evaluate(() =>
        [...document.querySelectorAll('.plate-mark > :not(.plate-mark__sub)')].map((cell) => (cell as HTMLElement).innerText.trim())
      );
      const subs = await page.evaluate(() => [...document.querySelectorAll('.plate-mark__sub')].map((line) => (line.textContent ?? '').trim()));
      const tree = await page.locator('body').ariaSnapshot();

      for (const cell of cells) {
        if (cell === '') wrong.push(`${surface.route}: an empty cell`);
        if (cell !== cell.toUpperCase()) wrong.push(`${surface.route}: "${cell}" is not uppercase with CSS off`);
        if (cell.length > 32 || cell.split(/\s+/).length > 4) wrong.push(`${surface.route}: "${cell}" is not a short string`);
        if (!tree.includes(cell)) wrong.push(`${surface.route}: "${cell}" is not in the accessibility tree, and the label is what is read`);
        // **No `//` inside a read cell** (`EXPERIENCE.md` § Plate mark): the marker is styling or the
        // label is plain words, because a screen reader speaks it. The 404 is the exception and this
        // read's control at once: its label is Story 2-30's wording, moved here verbatim, and it still
        // carries the marker, so the same read has to find it there. When that story lands its label,
        // the control fails and asks for a planted one.
        const marked = cell.includes('//');
        if (surface.route !== NOT_FOUND && marked) wrong.push(`${surface.route}: "${cell}" carries a // marker, which is read aloud`);
        if (surface.route === NOT_FOUND && !marked)
          wrong.push(`${surface.route}: "${cell}" carries no // marker, so Story 2-30 has landed its label and this read needs a planted control`);
      }
      for (const sub of subs) if (tree.includes(sub)) wrong.push(`${surface.route}: the subordinate line "${sub}" is in the accessibility tree`);
    }
    expect(wrong, wrong.join('\n')).toEqual([]);

    // The control: a planted mixed-case cell is reported, with the sheets off, by the same read.
    await goTo(page, '/cv');
    await page.evaluate(() => {
      const cell = document.querySelector('.plate-mark__label');
      if (cell) cell.textContent = 'Mixed Case';
      for (const sheet of Array.from(document.styleSheets)) sheet.disabled = true;
    });
    const planted = await page.evaluate(() => (document.querySelector('.plate-mark__label') as HTMLElement).innerText);
    expect(planted, 'a mixed-case cell reads uppercase with the sheets off, so the sheets are not off').not.toBe(planted.toUpperCase());
  });
});

// ---------------------------------------------------------------------------
// The work item
// ---------------------------------------------------------------------------

/** Everything the row's box decides, read off every row on a page. */
const rowBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.work-item')].map((node) => {
      const style = getComputedStyle(node);
      return {
        ground: style.backgroundColor,
        radius: style.borderRadius,
        shadow: style.boxShadow,
        top: style.borderTopWidth,
        left: style.borderLeftWidth,
        right: style.borderRightWidth,
        bottom: `${style.borderBottomWidth} ${style.borderBottomStyle} ${style.borderBottomColor}`,
      };
    })
  );

test.describe('the work item is a row, not a card', () => {
  for (const route of TIMELINE_ROUTES) {
    test(`draws no box, no ground, no radius and no shadow on ${route}, only its separator`, async ({ page }) => {
      await goTo(page, route);
      const hair = await length(page, '--stroke-hair');
      const border = await role(page, '--token-border');
      const rows = await rowBoxes(page);
      expect(rows.length, `${route} renders no row`).toBeGreaterThan(0);
      for (const [index, row] of rows.entries()) {
        expect(row.ground, `row ${index} paints a ground`).toBe('rgba(0, 0, 0, 0)');
        expect(row.radius, `row ${index} is rounded`).toBe('0px');
        expect(row.shadow, `row ${index} casts a shadow`).toBe('none');
        expect([row.top, row.left, row.right], `row ${index} draws a box`).toEqual(['0px', '0px', '0px']);
        expect(row.bottom, `row ${index}'s separator is not a solid hairline in the border role`).toBe(`${hair} solid ${border}`);
      }
    });

    test(`paints its separator and leading rules as exact pixels of their roles on ${route}`, async ({ page }) => {
      // On `/work` the ground is the 2023 literal with its grid, and on `/cv` it is the token ground,
      // so the two routes are the two grounds the rules sit over.
      await goTo(page, route);
      const [border, accent] = await rasterise(page, [await role(page, '--token-border'), await role(page, '--token-accent')]);

      const closed = await centre(page, '.work-item', 1, 'bottom');
      const separator = await ruleBeneath(page, closed, border, 24);
      expect(separator.found, `the separator is not one row of the border role\n${separator.seen}`).toHaveLength(1);

      const header = await centre(page, '.work-item', 1);
      const hairline = await columnsAt(page, header.x, header.y + 8, 40, border);
      expect(hairline.found, `a closed row's leading rule is not one column of the border role\n${hairline.seen}`).toHaveLength(1);

      const open = await centre(page, '.work-item', 0);
      const emphasis = await columnsAt(page, open.x, open.y + 8, 40, accent);
      expect(emphasis.found, `the open row's leading rule is not two adjacent columns of the accent\n${emphasis.seen}`).toHaveLength(2);
      expect(emphasis.found[1] - emphasis.found[0], 'the two accent columns are not adjacent').toBe(1);

      // The control: the separator at half alpha over the same ground matches the role nowhere.
      await plantStyle(page, '.work-item { border-block-end-color: rgb(40 40 48 / 0.5) !important; }');
      expect((await ruleBeneath(page, await centre(page, '.work-item', 1, 'bottom'), border, 24)).found, 'an alpha separator read as the role').toEqual([]);
    });
  }
});

/** The row's leading rule and the trigger's text box, which is what "nothing reflows" is about. */
const ruleState = (page: Page, index: number) =>
  page.evaluate((at) => {
    const row = document.querySelectorAll('.work-item')[at];
    const name = row?.querySelector('.work-item__company');
    if (!row || !name) throw new Error(`row ${at} is not on the page`);
    const after = getComputedStyle(row, '::after');
    const before = getComputedStyle(row, '::before');
    const text = name.getBoundingClientRect();
    return {
      open: row.getAttribute('data-open'),
      afterWidth: after.borderLeftWidth,
      afterTransform: after.transform,
      beforeWidth: before.borderLeftWidth,
      beforeColour: before.borderLeftColor,
      afterColour: after.borderLeftColor,
      text: { x: text.x, width: text.width },
    };
  }, index);

test.describe('the open indicator changes width and colour together, on transform alone', () => {
  test('switches the rule by transform, reserving its widest state, with nothing reflowing', async ({ page }) => {
    await goTo(page, '/cv');
    const [border, accent] = await rasterise(page, [await role(page, '--token-border'), await role(page, '--token-accent')]);
    const emphasis = await length(page, '--stroke-emphasis');

    const before = await ruleState(page, 1);
    expect(before.open, 'the second row is not closed on arrival').toBe('false');
    await page.locator('.work-item__header').nth(1).click();
    await expect(page.locator('.work-item').nth(1)).toHaveAttribute('data-open', 'true');
    // The click leaves the pointer over the trigger, which is a hover and recolours the rule it is
    // about to read, so the pointer is parked in the page margin before any colour is taken.
    await page.mouse.move(2, 400);
    const after = await ruleState(page, 1);

    expect([before.afterWidth, after.afterWidth], 'the open rule does not reserve its widest state in both').toEqual([emphasis, emphasis]);
    expect(before.afterTransform, 'the closed row shows its open rule').not.toBe('none');
    expect(after.afterTransform, 'the open row hides its open rule').toBe('none');
    expect(after.text, "the trigger's text moved when the row opened, so the rule reflowed it").toEqual(before.text);

    // And the pixels, read after the switch: the row that opened shows two accent columns, and the
    // row that closed shows one of the border role. Scrolling moves the rows under a parked pointer,
    // so it is parked again after each scroll.
    const opened = await centre(page, '.work-item', 1);
    await page.mouse.move(2, 400);
    await settled(page);
    const lit = await columnsAt(page, opened.x, opened.y + 8, 40, accent);
    expect(lit.found, `the row that opened shows no emphasis rule\n${lit.seen}`).toHaveLength(2);
    const closed = await centre(page, '.work-item', 0);
    await page.mouse.move(2, 400);
    await settled(page);
    const hairline = await columnsAt(page, closed.x, closed.y + 8, 40, border);
    expect(hairline.found, `the row that closed shows no hairline\n${hairline.seen}`).toHaveLength(1);
    expect((await columnsAt(page, closed.x, closed.y + 8, 40, accent)).found, 'the row that closed still shows its accent').toEqual([]);
  });
});

test.describe('hover recolours the leading rule, and only where a pointer can hover', () => {
  test('a fine pointer lights the rule and nothing else', async ({ page }) => {
    await goTo(page, '/cv');
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches), 'the project context cannot hover').toBe(true);
    const hover = await role(page, '--token-accent-hover');
    const box = await centre(page, '.work-item', 1);
    const trigger = page.locator('.work-item__header').nth(1);
    const region = { x: box.x - 2, y: box.y, width: box.width + 2, height: 60 };

    const [hoverRgb] = await rasterise(page, [hover]);
    await page.mouse.move(2, 400);
    await settled(page);
    const rest = await pixels(page, region);
    const triggerBox = await trigger.boundingBox();
    if (!triggerBox) throw new Error('the trigger has no box');
    await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
    await settled(page);
    expect((await rasterise(page, [(await ruleState(page, 1)).beforeColour]))[0], 'the rule did not take the hover role').toBe(hoverRgb);
    expect(await trigger.evaluate((node) => getComputedStyle(node).backgroundColor), 'hover painted a ground').toBe('rgba(0, 0, 0, 0)');

    const lit = await pixels(page, region);
    const moved: string[] = [];
    for (const [y, line] of lit.entries()) {
      for (const [x, pixel] of line.entries()) if (pixel !== rest[y]?.[x]) moved.push(`${x},${y}`);
    }
    expect(moved.length, 'hover changed no pixel at all, so the read below is of nothing').toBeGreaterThan(0);
    const outsideTheRule = moved.filter((at) => Number(at.split(',')[0]) > 4);
    expect(outsideTheRule, 'hover changed pixels beyond the leading rule').toEqual([]);
  });

  test('a finger taps without the rule ever taking a hover colour', async ({ browser }) => {
    // **Read as transitions, because a tap's hover is transient in this emulation.** On a phone a
    // tap leaves `:hover` painted until the next tap lands elsewhere, which is the sticky hover the
    // gate exists to prevent. Chromium's touch emulation applies the hover for the tap and takes it
    // off afterwards, so a colour read once the page settles sees nothing either way. What does
    // discriminate is whether the rule's colour ever starts to change: every rule here transitions
    // `border-color`, so a hover that reached it for any length of time starts a transition, and
    // the gate means none starts.
    const context = await contextWith(browser, { hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      await goTo(page, '/cv');
      expect(await page.evaluate(() => matchMedia('(hover: hover)').matches), 'the touch context reports a hover-capable pointer').toBe(false);
      await page.evaluate(() => {
        (window as unknown as { ruleTransitions: string[] }).ruleTransitions = [];
        document.addEventListener('transitionrun', (event) => {
          if (event.pseudoElement && event.propertyName.includes('color')) {
            (window as unknown as { ruleTransitions: string[] }).ruleTransitions.push(`${event.pseudoElement} ${event.propertyName}`);
          }
        });
      });
      const transitions = () => page.evaluate(() => [...(window as unknown as { ruleTransitions: string[] }).ruleTransitions]);

      await page.locator('.work-item__header').nth(1).tap();
      await expect(page.locator('.work-item').nth(1)).toHaveAttribute('data-open', 'true');
      await settled(page);
      expect(await transitions(), 'a tap started the rule towards a hover colour').toEqual([]);
      const [hoverRgb] = await rasterise(page, [await role(page, '--token-accent-hover')]);
      const tapped = await ruleState(page, 1);
      expect(await rasterise(page, [tapped.beforeColour, tapped.afterColour]), 'a tap left the hover colour on the rule').not.toContain(hoverRgb);

      // The control: the same rule ungated, and the same tap starts it changing, so an empty list
      // above is the gate's doing and not a tap that never hovers.
      await plantStyle(page, '.work-item:has(> .work-item__header:hover)::before { border-inline-start-color: rgb(255, 0, 255); }');
      await page.locator('.work-item__header').nth(2).tap();
      await settled(page);
      expect((await transitions()).length, 'a tap does not reach :hover in this context, so the empty read above proves nothing').toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('chips, markers, lists and the region are what the design names', () => {
  test('outlines the chips in the interactive border, square, unfilled, in mono at the smallest step', async ({ page }) => {
    await goTo(page, '/cv');
    const expected = {
      width: await length(page, '--stroke-hair'),
      colour: await role(page, '--token-border-interactive'),
      size: (await probe(page, { 'font-size': 'var(--t-3xs)' }, ['font-size']))['font-size'],
    };
    const chips = await page.locator('.work-item').first().locator('.work-item__tech li').evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return {
          borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
          styles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
          colour: style.borderTopColor,
          ground: style.backgroundColor,
          radius: style.borderRadius,
          family: style.fontFamily,
          size: style.fontSize,
          focusable: (node as HTMLElement).tabIndex >= 0,
        };
      })
    );
    expect(chips.length, 'the open row renders no chip').toBeGreaterThan(0);
    for (const [index, chip] of chips.entries()) {
      expect(chip.borders, `chip ${index} is not outlined on every side`).toEqual(Array(4).fill(expected.width));
      expect(chip.styles, `chip ${index} is not solid`).toEqual(Array(4).fill('solid'));
      expect(chip.colour, `chip ${index} is not the interactive border role`).toBe(expected.colour);
      expect(chip.ground, `chip ${index} is filled`).toBe('rgba(0, 0, 0, 0)');
      expect(chip.radius, `chip ${index} is rounded`).toBe('0px');
      expect(chip.family, `chip ${index} is not mono`).toContain('Geist Mono');
      expect(chip.size, `chip ${index} is not at --t-3xs`).toBe(expected.size);
      expect(chip.focusable, `chip ${index} takes focus`).toBe(false);
    }
  });

  test('marks each highlight with a generated // in the secondary role that the tree never reads', async ({ page }) => {
    await goTo(page, '/cv');
    const secondary = await role(page, '--token-text-secondary');
    const list = page.locator('.work-item').first().locator('.work-item__highlights');
    const marker = await list.locator('li').first().evaluate((node) => {
      const style = getComputedStyle(node, '::before');
      return { content: style.content, colour: style.color };
    });
    expect(marker.content, 'the marker is not the generated //').toContain('"//"');
    expect(marker.colour, 'the marker is not the secondary role').toBe(secondary);

    const tree = await list.ariaSnapshot();
    expect(tree, 'the highlights are not exposed as a list').toMatch(/^- list/m);
    expect(tree, 'the highlights are not list items').toContain('- listitem');
    expect(tree, 'the marker is read as part of an item').not.toContain('//');
    expect(await page.locator('.work-item').first().locator('.work-item__tech').ariaSnapshot(), 'the chips are not a list').toMatch(/^- list/m);

    // The control: the same marker without its empty alternative text is read, so the absence above
    // is the alternative text's doing and not a snapshot blind to generated content.
    await plantStyle(page, '.work-item__highlights li::before { content: "//" !important; }');
    expect(await list.ariaSnapshot(), 'the snapshot cannot see generated content at all').toContain('//');
  });

  test('sets the row in the contract type, which is what closes F-3, F-4, F-5 and F-9', async ({ page }) => {
    // The four findings `ops/hub-accessibility-pass.md` booked to this story, each read where it
    // was observed: the meta line fell back to the user agent's button face (F-3), the initiative
    // asked Geist Mono for a weight it does not publish (F-4), the highlights sat in a border role at
    // 3.49:1 (F-5), and the description carried a leading off the scale (F-9).
    await goTo(page, '/cv');
    const first = page.locator('.work-item').first();
    const read = (selector: string) =>
      first
        .locator(selector)
        .first()
        .evaluate((node) => {
          const style = getComputedStyle(node);
          return { family: style.fontFamily, weight: style.fontWeight, colour: style.color, leading: style.lineHeight };
        });
    const secondary = await role(page, '--token-text-secondary');
    const bodyLeading = (await probe(page, { 'font-size': 'var(--t-sm)', 'line-height': 'var(--lh-body)' }, ['line-height']))['line-height'];

    expect((await read('.work-item__sub span')).family, 'the meta line is not in the mono family (F-3)').toContain('Geist Mono');
    const initiative = await read('.work-item__initiative');
    expect(initiative.family, 'the initiative line is not in the mono family').toContain('Geist Mono');
    expect(initiative.weight, 'the initiative line asks for a weight the face does not publish (F-4)').toBe('400');
    expect((await read('.work-item__highlights li')).colour, 'the highlights are not the secondary role (F-5)').toBe(secondary);
    const description = await read('.work-item__description');
    expect(description.leading, 'the description is not at the body leading (F-9)').toBe(bodyLeading);
    expect(description.colour, 'the description is not the secondary role').toBe(secondary);

    // The control: the border role the highlights used to take reads as something else.
    await plantStyle(page, '.work-item__highlights li { color: var(--token-border-interactive) !important; }');
    expect((await read('.work-item__highlights li')).colour, 'the colour read does not see a planted role').not.toBe(secondary);
  });

  test('exposes each panel as a region named by its company', async ({ page }) => {
    await goTo(page, '/cv');
    const companies = await page.locator('.work-item__company').allTextContents();
    expect(companies.length, 'no company rendered').toBeGreaterThan(0);
    for (const company of companies) {
      await expect(page.getByRole('region', { name: company.trim(), exact: true }), `${company} has no region`).toHaveCount(1);
    }
  });
});

test.describe('the keyboard moves through the triggers and out, each ring inside its own row', () => {
  test('tabs the triggers in DOM order, rings each clear of the rule and its neighbours, and leaves', async ({ page }) => {
    // F-19 (`ops/hub-accessibility-pass.md`): the ring used to paint over the row's own rule and into
    // the rows above and below. Its reach is its offset plus its width, read off the focused trigger.
    await goTo(page, '/cv');
    const count = await page.locator('.work-item__header').count();
    expect(count, 'no trigger rendered').toBeGreaterThan(0);

    let presses = 0;
    while (!(await page.evaluate(() => document.activeElement?.matches('.work-item__header') ?? false))) {
      await page.keyboard.press('Tab');
      presses += 1;
      if (presses > 30) throw new Error('thirty Tabs never reached a trigger');
    }

    const wrong: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const read = await page.evaluate(() => {
        const trigger = document.activeElement as HTMLElement;
        const row = trigger.closest('.work-item');
        if (!row) return null;
        const style = getComputedStyle(trigger);
        const reach = Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth);
        const box = trigger.getBoundingClientRect();
        const outer = row.getBoundingClientRect();
        const rule = Number.parseFloat(getComputedStyle(row, '::after').borderLeftWidth);
        return {
          at: [...document.querySelectorAll('.work-item__header')].indexOf(trigger),
          visible: trigger.matches(':focus-visible'),
          ring: { left: box.left - reach, top: box.top - reach, right: box.right + reach, bottom: box.bottom + reach },
          row: { left: outer.left, top: outer.top, right: outer.right, bottom: outer.bottom },
          ruleRight: outer.left + rule,
        };
      });
      if (read === null) throw new Error('focus left the timeline early');
      if (read.at !== index) wrong.push(`Tab ${index} landed on trigger ${read.at}`);
      if (!read.visible) wrong.push(`trigger ${index} holds focus without :focus-visible`);
      if (read.ring.top < read.row.top - 0.5 || read.ring.bottom > read.row.bottom + 0.5) wrong.push(`trigger ${index}'s ring reaches a neighbouring row`);
      if (read.ring.right > read.row.right + 0.5) wrong.push(`trigger ${index}'s ring reaches past its row's end`);
      if (read.ring.left < read.ruleRight - 0.5) wrong.push(`trigger ${index}'s ring paints over the leading rule`);
      await page.keyboard.press('Tab');
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest('.work-timeline'))),
      'focus is held inside the timeline after its last trigger'
    ).toBe(false);
  });
});

test.describe('the timeline stays inside the 360 viewport', () => {
  for (const route of TIMELINE_ROUTES) {
    test(`no element of the timeline sits past either edge on ${route}`, async ({ page }) => {
      // KV-5's component half: the meta line was `nowrap` in a column that could not shrink, which
      // pushed 28 elements on `/work` past the right edge at 360. The whole page is counted as well and
      // printed, because that census is what the register records (DW-67, DW-72).
      await goTo(page, route);
      const census = (scope: string) =>
        page.evaluate((selector) => {
          const out: string[] = [];
          for (const node of document.querySelectorAll(selector)) {
            const rect = node.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.right > window.innerWidth + 0.5 || rect.left < -0.5) {
              out.push(`${node.tagName.toLowerCase()}.${[...node.classList].join('.')} [${rect.left.toFixed(2)}, ${rect.right.toFixed(2)}]`);
            }
          }
          return out;
        }, scope);

      const page360 = await census('body *');
      console.log(`plate-mark-and-work-item: ${route} at 360, ${page360.length} element(s) past an edge on the whole page${page360.length ? `:\n  ${page360.join('\n  ')}` : ''}`);
      expect(await census('.work-timeline, .work-timeline *'), `an element of the timeline sits past an edge on ${route}`).toEqual([]);

      // The control: a meta line that cannot wrap again is reported by the same census.
      await page.evaluate(() => {
        const planted = document.createElement('span');
        planted.style.whiteSpace = 'nowrap';
        planted.textContent = 'A META LINE THAT WILL NOT WRAP AT ANY WIDTH THIS SIDE OF A DESKTOP';
        document.querySelector('.work-item__sub')?.append(planted);
      });
      expect((await census('.work-timeline, .work-timeline *')).length, 'the census does not see a planted overflow').toBeGreaterThan(0);
    });
  }
});

test.describe('a printed CV carries every company', () => {
  test('prints every panel expanded, while the screen keeps its disclosure (DW-73)', async ({ page }) => {
    await goTo(page, '/cv');
    const heights = () =>
      page.locator('.work-item__content').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));

    await page.emulateMedia({ media: 'print' });
    const printed = await heights();
    expect(printed.length, 'no panel rendered').toBeGreaterThan(1);
    expect(printed.filter((height) => height === 0), 'a panel prints collapsed').toEqual([]);

    // The control: the screen medium, the same page, keeps three of the four at zero.
    await page.emulateMedia({ media: 'screen' });
    const screen = await heights();
    expect(screen[0], 'the open entry has no height on screen').toBeGreaterThan(0);
    expect(screen.slice(1), 'the screen stopped collapsing the closed entries, so the print read is not about print').toEqual(
      Array(screen.length - 1).fill(0)
    );
  });
});
