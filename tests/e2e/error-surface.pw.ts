import { test, expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { RENDERED_VIEWPORT, rootCustomPropertyValue } from './harness';

/**
 * The 404 surface, as rendered (Story 2-30).
 *
 * The story rebuilt `Error404` on the structure the design documents give an error surface: a
 * section Plate mark, the display line as the page's one `<h1>`, one supporting line and the
 * header's exits as controls, with the numeral kept as ornament. `Error404.test.tsx` reads the
 * server markup and the stylesheet as it compiles. What neither can read is what a browser makes of
 * them: the accessible output top to bottom with the numeral taken out of it, the page title beside
 * it, the ground as pixels, the type as computed, a pointer's hover and a finger's tap, the ring
 * under a real Tab, and the entrance as the browser runs it on each motion preference and with no
 * script at all. That is this file.
 *
 * **The redundancy test is run here, not assumed** (`epics.md` Story 2.30, O-12 item 3): with the
 * numeral removed from the accessibility tree, the title, the heading and the message are read
 * together and each has to say the page was not found. It does, so branch A holds and the numeral is
 * ornament; the reading is logged, and the same predicate is watched reporting branch B on a page
 * planted to say none of it.
 *
 * **Everything keys on the surface's markup, never on `<body id>`.** On this route alone the id is
 * a hydration artifact: `usePathname()` answers `/_not-found` during the prerender and the requested
 * path on the client (`AGENTS.md` pitfalls, `tests/e2e/celeste-header.pw.ts`).
 *
 * **Every reading is watched producing the other answer before its clean result is believed.** Each
 * control is planted through the browser, so nothing is left in the tree.
 *
 * **No screenshot is compared.** Viewport captures are decoded in the page to read pixels and none is
 * written, so `keeps exactly one committed baseline` in `tests/e2e/rendered-output.pw.ts` stays true.
 */

/** A path the Hub does not route, which renders `app/not-found.tsx`. Same as `hit-target-floor.pw.ts`. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/** The route Story 2-17 retired, which answers the same document. */
const RETIRED = '/recommendation';

const SURFACE = '.error-page';
const NUMERAL = '.error-page__code';
const LINE = '.error-page__sub';
const EXIT = '.error-page__exit';

/** The three elements the surface's own keyframe animates, in the order of their delays. */
const ANIMATED = ['.error-page__code', '.error-page__sub', '.error-page__exits'] as const;

/** The keyframe `Error404.scss` declares, and the one `GlitchText.scss` declares for the heading. */
const KEYFRAME = 'error-page-enter';
const HEADING_KEYFRAME = 'glitch-text-arrive';

/** The delays the three tweens had and the keyframe keeps, in seconds: numeral, message, exits. */
const DELAYS = [0.1, 0.3, 0.5] as const;

/** What saying the page was not found looks like in plain words, in the title, heading or message. */
const SAYS_NOT_FOUND = /\bnot found\b|\bdoes not exist\b/i;

/** A label cell in plain words: capitals separated by single spaces, no marker and no underscore. */
const WORDS = /^[A-Z]+(?: [A-Z]+)*$/;

/** Navigate, refuse anything but the status expected, and wait for the faces. */
const goTo = async (page: Page, route: string = NOT_FOUND, expected = 404): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
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

/**
 * What a set of declarations computes to on a probe, read for the properties named. Tokens are
 * resolved here rather than restated, so every expectation below is the contract's value as this
 * browser resolves it. `inside` puts the probe in an element, for a value that depends on its font.
 */
const probe = (page: Page, style: Record<string, string>, read: readonly string[], inside = 'body'): Promise<Record<string, string>> =>
  page.evaluate(
    ({ declared, wanted, host }) => {
      const node = document.createElement('span');
      node.style.display = 'block';
      for (const [property, value] of Object.entries(declared)) node.style.setProperty(property, value);
      const parent = document.querySelector(host);
      if (!parent) throw new Error(`${host} is not on the page`);
      parent.append(node);
      const computed = getComputedStyle(node);
      const out = Object.fromEntries(wanted.map((name) => [name, computed.getPropertyValue(name)]));
      node.remove();
      return out;
    },
    { declared: style, wanted: [...read], host: inside }
  );

/** A colour role as a computed colour string. */
const role = async (page: Page, name: string): Promise<string> => (await probe(page, { color: `var(${name})` }, ['color'])).color;

/** A length token in px. */
const length = async (page: Page, name: string): Promise<string> => (await probe(page, { width: `var(${name})` }, ['width'])).width;

/** A size token in px. */
const size = async (page: Page, name: string): Promise<string> => (await probe(page, { 'font-size': `var(${name})` }, ['font-size']))['font-size'];

/** A tracking token in px, resolved at a size token, which is what an `em` tracking needs. */
const tracking = async (page: Page, name: string, at: string): Promise<string> =>
  (await probe(page, { 'font-size': `var(${at})`, 'letter-spacing': `var(${name})` }, ['letter-spacing']))['letter-spacing'];

/**
 * Colours as four 8-bit sRGB channels, through a 1 by 1 canvas, the pipeline the screenshot is
 * decoded through below. Two sentinels, so a value the canvas refuses is reported rather than read
 * as the colour before it (`tests/e2e/plate-mark-and-work-item.pw.ts`).
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

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The pixels of a viewport region as `r,g,b,a` strings, row by row, decoded from a screenshot in the page. */
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
    { dataUrl: `data:image/png;base64,${shot.toString('base64')}`, area: box }
  );
};

/** A box as the page reports it, refusing an element with none. */
const boxOf = async (page: Page, selector: string, index = 0): Promise<Box> => {
  const box = await page.locator(selector).nth(index).boundingBox();
  if (!box) throw new Error(`${selector} [${index}] has no box`);
  return box;
};

/** The top-level roles of an aria snapshot, in order: one per line that is not indented. */
const topLevelRoles = (snapshot: string): string[] =>
  snapshot
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => /^- ([a-z]+)/.exec(line)?.[1] ?? line);

/** What the page says, read the way a screen reader meets it: the title, then the tree top to bottom. */
interface AccessibleOutput {
  readonly title: string;
  readonly heading: string;
  readonly message: string;
  readonly tree: string;
}

/**
 * The redundancy test's verdict on one reading. Branch A when the title, the heading or the message
 * already says the page was not found, branch B when none does and the numeral would be the only
 * place the 404 exists. The carriers are named, so the record says which of the three carry it.
 */
const branchOf = (output: AccessibleOutput): { branch: 'A' | 'B'; carriers: string[] } => {
  const carriers = (['title', 'heading', 'message'] as const).filter((part) => SAYS_NOT_FOUND.test(output[part]));
  return { branch: carriers.length > 0 ? 'A' : 'B', carriers };
};

/** Take the numeral out of the document entirely, then read the page's accessible output. */
const outputWithoutNumeral = async (page: Page): Promise<AccessibleOutput> => {
  await page.evaluate((numeral) => document.querySelector(numeral)?.remove(), NUMERAL);
  const headings = page.getByRole('heading', { level: 1 });
  await expect(headings, 'the page does not carry exactly one level-1 heading to read').toHaveCount(1);
  return {
    title: await page.title(),
    heading: ((await headings.textContent()) ?? '').replace(/\s+/g, ' ').trim(),
    message: ((await page.locator(LINE).textContent()) ?? '').trim(),
    tree: await page.locator('body').ariaSnapshot(),
  };
};

// ---------------------------------------------------------------------------
// The structure
// ---------------------------------------------------------------------------

test.describe('the surface is a Plate mark, the display line, one line and the exits', () => {
  for (const route of [NOT_FOUND, RETIRED]) {
    test(`reads on ${route} as the mark, one level-1 heading, one line and two links, and nothing named`, async ({ page }) => {
      await goTo(page, route);
      const snapshot = await page.locator(SURFACE).ariaSnapshot();
      expect(topLevelRoles(snapshot), `the surface does not read as mark, heading, line and two exits:\n${snapshot}`).toEqual([
        'text',
        'heading',
        'paragraph',
        'link',
        'link',
      ]);
      expect(snapshot, 'the mark does not read ERROR first').toMatch(/^- text: ERROR$/m);
      expect(snapshot, 'the heading is not the level-1 display line').toContain('- heading "Page not found." [level=1]');
      expect(snapshot, 'the numeral reached the accessibility tree').not.toContain('404');

      const headings = page.getByRole('heading', { level: 1 });
      await expect(headings, `${route} does not carry exactly one level-1 heading`).toHaveCount(1);
      await expect(headings, 'the level-1 heading is not named by its own words').toHaveAccessibleName('Page not found.');

      // O-13, corrected as a pre-existing defect: no element on the surface carries a name by
      // attribute, on either branch, and the 2023 numeral's `aria-label` on a paragraph is gone.
      const named = page.locator(`${SURFACE} [aria-label], ${SURFACE} [aria-labelledby]`);
      await expect(named, 'an element on the 404 carries a name by attribute').toHaveCount(0);

      // The controls: a planted name is counted, and a planted second heading changes the roles.
      await page.evaluate((surface) => {
        const host = document.querySelector(surface);
        const named_ = document.createElement('p');
        named_.setAttribute('aria-label', 'Error 404');
        named_.textContent = 'planted';
        host?.append(named_);
        const second = document.createElement('h2');
        second.textContent = 'planted heading';
        host?.prepend(second);
      }, SURFACE);
      await expect(named, 'the name read does not see a planted aria-label').toHaveCount(1);
      expect(topLevelRoles(await page.locator(SURFACE).ariaSnapshot()), 'the role read does not see a planted heading').not.toEqual([
        'text',
        'heading',
        'paragraph',
        'link',
        'link',
      ]);
    });
  }

  test('labels the surface in a plain word, on the section variant, and reads it the same with the stylesheets off', async ({ page }) => {
    await goTo(page);
    const mark = page.locator(`${SURFACE} .plate-mark`);
    await expect(mark, 'the surface carries a number of marks other than one').toHaveCount(1);
    expect(await mark.getAttribute('class'), 'the mark is not the section variant').toBe('plate-mark');
    await expect(page.locator(`${SURFACE} .plate-mark__sub`), 'a subordinate line is back on the 404').toHaveCount(0);

    // `RESTYLE-SPEC.md` § 7's check, with the sheets off: the label still reads as plain words and
    // the numeral, hidden by attribute rather than by a stylesheet, is still out of the tree.
    const readOff = async (): Promise<{ cells: string[]; tree: string }> => {
      await page.evaluate(() => {
        for (const sheet of Array.from(document.styleSheets)) sheet.disabled = true;
      });
      return {
        cells: await mark.evaluate((node) => [...node.children].map((cell) => (cell as HTMLElement).innerText.trim())),
        tree: await page.locator('body').ariaSnapshot(),
      };
    };
    const off = await readOff();
    expect(off.cells, 'the label does not read ERROR with the sheets off').toEqual(['ERROR']);
    for (const cell of off.cells) expect(cell, `"${cell}" is not plain words`).toMatch(WORDS);
    expect(off.tree, 'the label is not read with the sheets off').toContain('ERROR');
    expect(off.tree, 'the numeral reaches the tree with the sheets off').not.toContain('404');

    // The control: the shipped label planted back into the same cell fails the same predicate.
    await goTo(page);
    await page.evaluate(() => {
      const cell = document.querySelector('.error-page .plate-mark__label');
      if (cell) cell.textContent = '// ERR_NOT_FOUND';
    });
    const planted = await readOff();
    expect(planted.cells, 'the plant did not land').toEqual(['// ERR_NOT_FOUND']);
    expect(WORDS.test(planted.cells[0]), 'the shipped label reads as plain words').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The redundancy test, O-12 item 3
// ---------------------------------------------------------------------------

test.describe('the redundancy test, run rather than assumed', () => {
  test('with the numeral removed from the tree, the title, the heading and the message each say the page was not found: branch A', async ({
    page,
  }) => {
    await goTo(page);
    const output = await outputWithoutNumeral(page);
    const verdict = branchOf(output);
    console.log(
      `error-surface: redundancy test, numeral removed: branch ${verdict.branch}, carried by ${verdict.carriers.join(', ') || 'nothing'}; ` +
        `title "${output.title}", heading "${output.heading}", message "${output.message}"`
    );
    expect(verdict, 'the page says it was not found in fewer places than the title, the heading and the message').toEqual({
      branch: 'A',
      carriers: ['title', 'heading', 'message'],
    });
    // Read top to bottom, not only by locator: the heading and the message are in the tree a screen
    // reader walks, and nothing left in it says 404 once the numeral is gone.
    expect(output.tree, 'the heading is not in the accessible output').toContain('Page not found.');
    expect(output.tree, 'the message is not in the accessible output').toContain(output.message);
    expect(output.tree, 'something other than the numeral says 404 in the tree').not.toContain('404');

    // The control: the same page planted to say nothing of it, read through the same function, is
    // branch B. Without this, a predicate that answered A for anything would pass above.
    await goTo(page);
    await page.evaluate(
      ({ line }) => {
        document.title = 'Planted | Luigi Espinosa';
        const heading = document.querySelector('h1');
        if (heading) heading.textContent = 'Planted heading';
        const message = document.querySelector(line);
        if (message) message.textContent = 'A planted sentence.';
      },
      { line: LINE }
    );
    const planted = await outputWithoutNumeral(page);
    expect(planted.title, 'the title plant did not land').toBe('Planted | Luigi Espinosa');
    expect(branchOf(planted), 'a page that says nothing of it still reads as branch A').toEqual({ branch: 'B', carriers: [] });
  });
});

// ---------------------------------------------------------------------------
// The type and the ground
// ---------------------------------------------------------------------------

test.describe('the numeral, the heading and the line are set in the roles the design names', () => {
  test('the numeral is ornament: hidden, unnamed, the muted accent, on the scale in the display face', async ({ page }) => {
    await goTo(page);
    const numeral = page.locator(NUMERAL);
    await expect(numeral).toHaveText('404');
    expect(await numeral.getAttribute('aria-hidden'), 'the numeral is exposed to assistive technology').toBe('true');
    expect(await numeral.getAttribute('aria-label'), 'the numeral carries a name').toBeNull();
    const drawn = await numeral.evaluate((node) => {
      const style = getComputedStyle(node);
      return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, colour: style.color };
    });
    const display = (await probe(page, { 'font-family': 'var(--f-display)' }, ['font-family']))['font-family'];
    expect(drawn.family, 'the numeral is not in the display family').toBe(display);
    expect(drawn.size, 'the numeral is not at --t-xl').toBe(await size(page, '--t-xl'));
    expect(drawn.weight, 'the numeral is not at --w-black').toBe((await probe(page, { 'font-weight': 'var(--w-black)' }, ['font-weight']))['font-weight']);
    expect(drawn.colour, 'the numeral is not the muted accent').toBe(await role(page, '--token-accent-muted'));
    // The reads discriminate: the step it sits on is not the display line's, and branch B's colour is
    // a different role.
    expect(await size(page, '--t-xl'), 'the numeral step and the display step resolve alike at 360').not.toBe(await size(page, '--t-display'));
    expect(await role(page, '--token-accent-muted')).not.toBe(await role(page, '--token-text-secondary'));
  });

  test('the heading computes the display roles and the line the secondary text at the body floor, within the measure', async ({ page }) => {
    await goTo(page);
    const heading = await page.locator(`${SURFACE} h1`).evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        family: style.fontFamily,
        size: style.fontSize,
        weight: style.fontWeight,
        leading: style.lineHeight,
        tracking: style.letterSpacing,
        transform: style.textTransform,
        colour: style.color,
      };
    });
    const displaySize = await size(page, '--t-display');
    expect(heading.family).toBe((await probe(page, { 'font-family': 'var(--f-display)' }, ['font-family']))['font-family']);
    expect(heading.size, 'the heading is not at --t-display').toBe(displaySize);
    expect(heading.weight).toBe((await probe(page, { 'font-weight': 'var(--w-black)' }, ['font-weight']))['font-weight']);
    expect(heading.leading, 'the heading is not at the display leading').toBe(
      (await probe(page, { 'font-size': 'var(--t-display)', 'line-height': 'var(--lh-display)' }, ['line-height']))['line-height']
    );
    expect(heading.tracking, 'the heading is not at the display tracking').toBe(await tracking(page, '--tr-display', '--t-display'));
    expect(heading.transform).toBe('uppercase');
    expect(heading.colour, 'the heading is not the text role').toBe(await role(page, '--token-text'));

    const line = await page.locator(LINE).evaluate((node) => {
      const style = getComputedStyle(node);
      return { size: style.fontSize, colour: style.color, measure: style.maxInlineSize, width: node.getBoundingClientRect().width };
    });
    expect(line.size, 'the line is not at the body floor').toBe(await size(page, '--t-sm'));
    expect(line.colour, 'the line is not the secondary text role').toBe(await role(page, '--token-text-secondary'));
    // The measure is in `ch`, which depends on the element's own face, so the probe is read inside it.
    expect(line.measure, 'the line is not capped at the measure').toBe(
      (await probe(page, { 'max-inline-size': 'var(--measure)' }, ['max-inline-size'], LINE))['max-inline-size']
    );
    expect(line.width).toBeLessThanOrEqual(Number.parseFloat(line.measure) + 0.5);
  });

  test('the ground is the paper role, with no grid and no scrim, sampled across the surface’s top padding', async ({ page }) => {
    await goTo(page);
    const [paper] = await rasterise(page, [await role(page, '--token-bg')]);
    const surface = await boxOf(page, SURFACE);
    const mark = await boxOf(page, `${SURFACE} .plate-mark`);
    const strip: Box = { x: surface.x, y: surface.y + 2, width: surface.width, height: Math.floor(mark.y - surface.y) - 4 };
    expect(strip.height, 'the surface has no top padding to sample').toBeGreaterThan(20);

    const other = (grid: string[][]) => [...new Set(grid.flat().filter((pixel) => pixel !== paper))];
    expect(other(await pixels(page, strip)), 'the ground under the surface is not the paper role throughout').toEqual([]);

    const images = await page.evaluate((selector) => {
      const found: string[] = [];
      for (let node = document.querySelector(selector); node; node = node.parentElement) {
        const image = getComputedStyle(node).backgroundImage;
        if (image !== 'none') found.push(`${node.tagName.toLowerCase()}: ${image}`);
      }
      return found;
    }, SURFACE);
    expect(images, 'the surface or an ancestor paints an image').toEqual([]);
    await expect(page.locator('.scanline-overlay'), 'a scrim is on the 404, where nothing moves behind the text').toHaveCount(0);

    // The control: the 2023 grid planted back is seen in the same strip.
    await page.addStyleTag({
      content:
        '.error-page { background-image: linear-gradient(rgba(140, 90, 210, 0.06) 1px, transparent 1px), ' +
        'linear-gradient(90deg, rgba(140, 90, 210, 0.06) 1px, transparent 1px) !important; background-size: 56px 56px !important; }',
    });
    expect(other(await pixels(page, strip)).length, 'the strip read does not see a planted grid').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The exits
// ---------------------------------------------------------------------------

/** Everything the control treatment decides, read off every exit. */
const exitStyles = (page: Page) =>
  page.locator(EXIT).evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        label: (node.textContent ?? '').trim(),
        ground: style.backgroundColor,
        widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        styles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
        colours: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor],
        radius: style.borderRadius,
        family: style.fontFamily,
        size: style.fontSize,
        transform: style.textTransform,
        tracking: style.letterSpacing,
        colour: style.color,
        decoration: style.textDecorationLine,
        width: rect.width,
        height: rect.height,
      };
    })
  );

/** The differing pixels of two captures of one region, as `[x, y]` in the region. */
const moved = (before: string[][], after: string[][]): [number, number][] =>
  after.flatMap((row, y) => row.flatMap((pixel, x) => (pixel !== before[y]?.[x] ? [[x, y] as [number, number]] : [])));

test.describe('the exits are controls', () => {
  test('transparent, square, bordered in the interactive role on four sides, mono uppercase at the smallest control step, at the floor', async ({
    page,
  }) => {
    await goTo(page);
    const floor = Number.parseFloat(await rootCustomPropertyValue(page, '--tap'));
    const expected = {
      width: await length(page, '--stroke-boundary'),
      colour: await role(page, '--token-border-interactive'),
      size: await size(page, '--t-2xs'),
      tracking: await tracking(page, '--tr-label', '--t-2xs'),
      text: await role(page, '--token-text'),
      mono: (await probe(page, { 'font-family': 'var(--f-mono)' }, ['font-family']))['font-family'],
    };
    const read = await exitStyles(page);
    expect(read.map((exit) => exit.label), 'the exits are not the header’s two').toEqual(['Suite', 'CV']);
    for (const exit of read) {
      expect(exit.ground, `${exit.label} paints a ground`).toBe('rgba(0, 0, 0, 0)');
      expect(exit.widths, `${exit.label} is not bordered on every side at the boundary stroke`).toEqual(Array(4).fill(expected.width));
      expect(exit.styles, `${exit.label} is not solid`).toEqual(Array(4).fill('solid'));
      expect(exit.colours, `${exit.label} is not the interactive border role`).toEqual(Array(4).fill(expected.colour));
      expect(exit.radius, `${exit.label} is rounded`).toBe('0px');
      expect(exit.family, `${exit.label} is not in the mono family`).toBe(expected.mono);
      expect(exit.size, `${exit.label} is not at --t-2xs`).toBe(expected.size);
      expect(exit.transform, `${exit.label} is not uppercase`).toBe('uppercase');
      expect(exit.tracking, `${exit.label} is not at --tr-label`).toBe(expected.tracking);
      expect(exit.colour, `${exit.label} is not the text role`).toBe(expected.text);
      expect(exit.decoration, `${exit.label} is underlined like a link`).toBe('none');
      expect(Math.min(exit.width, exit.height), `${exit.label} is under the floor`).toBeGreaterThanOrEqual(floor);
    }

    // The control: a filled, rounded exit is what the same reader reports.
    await page.addStyleTag({ content: '.error-page__exit { background-color: rgb(255, 0, 255) !important; border-radius: 8px !important; }' });
    const planted = (await exitStyles(page))[0];
    expect(planted.ground, 'the ground read does not see a planted fill').not.toBe('rgba(0, 0, 0, 0)');
    expect(planted.radius, 'the radius read does not see a planted radius').not.toBe('0px');
  });

  test('a fine pointer’s hover recolours the border and changes no other pixel', async ({ page }) => {
    await goTo(page);
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches), 'the project context cannot hover').toBe(true);
    const [hover] = await rasterise(page, [await role(page, '--token-accent-hover')]);
    const exit = page.locator(EXIT).first();
    const box = await boxOf(page, EXIT);
    const margin = 6;
    const region: Box = { x: Math.floor(box.x) - margin, y: Math.floor(box.y) - margin, width: Math.ceil(box.width) + 2 * margin, height: Math.ceil(box.height) + 2 * margin };

    /** A differing pixel off the border's ring: more than 2px inside the box, or more than 1px outside it. */
    const offTheRing = (points: [number, number][]) =>
      points.filter(([x, y]) => {
        const [left, top] = [region.x + x - box.x, region.y + y - box.y];
        const inside = left > 2 && top > 2 && left < box.width - 3 && top < box.height - 3;
        const outside = left < -1 || top < -1 || left > box.width || top > box.height;
        return inside || outside;
      });

    const capture = async (hovered: boolean): Promise<string[][]> => {
      if (hovered) await exit.hover();
      else await page.mouse.move(RENDERED_VIEWPORT.width - 2, RENDERED_VIEWPORT.height - 2);
      await expect
        .poll(async () => (await rasterise(page, [await exit.evaluate((node) => getComputedStyle(node).borderTopColor)]))[0] === hover, {
          message: hovered ? 'the border never took the hover role' : 'the border kept the hover role at rest',
        })
        .toBe(hovered);
      return pixels(page, region);
    };

    const rest = await capture(false);
    const lit = await capture(true);
    const changed = moved(rest, lit);
    expect(changed.length, 'hover changed no pixel at all, so the read below is of nothing').toBeGreaterThan(0);
    expect(offTheRing(changed), 'hover changed pixels off the border').toEqual([]);

    // The control: a hover that also recolours the label changes pixels inside the box, and the same
    // read reports them.
    await page.addStyleTag({ content: '@media (hover: hover) { .error-page__exit:hover { color: rgb(255, 0, 255) !important; } }' });
    const plantedRest = await capture(false);
    const plantedLit = await capture(true);
    expect(offTheRing(moved(plantedRest, plantedLit)).length, 'the read does not see a label recoloured on hover').toBeGreaterThan(0);
  });

  test('a finger taps an exit without its border ever starting towards the hover colour', async ({ browser }) => {
    // Read as transitions, because a tap's hover is transient in this emulation: every exit
    // transitions `border-color`, so a hover that reached it for any time at all starts one, and the
    // gate means none starts (the shape `tests/e2e/plate-mark-and-work-item.pw.ts` set).
    const context = await contextWith(browser, { hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      await goTo(page);
      expect(await page.evaluate(() => matchMedia('(hover: hover)').matches), 'the touch context reports a hover-capable pointer').toBe(false);
      await page.evaluate(() => {
        const seen: string[] = [];
        (window as unknown as { exitTransitions: string[] }).exitTransitions = seen;
        document.addEventListener('transitionrun', (event) => {
          const target = event.target as Element;
          if (target.classList?.contains('error-page__exit') && /border/.test(event.propertyName)) seen.push(event.propertyName);
        });
        // A tap on a link navigates; the capture listener keeps the page, as the accessibility floor's
        // prevented click does.
        document.addEventListener('click', (event) => event.preventDefault(), true);
      });
      const transitions = () => page.evaluate(() => [...(window as unknown as { exitTransitions: string[] }).exitTransitions]);
      const [hover] = await rasterise(page, [await role(page, '--token-accent-hover')]);

      await page.locator(EXIT).nth(0).tap();
      await page.waitForTimeout(200);
      expect(new URL(page.url()).pathname, 'the prevented tap navigated anyway').toBe(NOT_FOUND);
      expect(await transitions(), 'a tap started the border towards a hover colour').toEqual([]);
      const tapped = await page.locator(EXIT).nth(0).evaluate((node) => getComputedStyle(node).borderTopColor);
      expect((await rasterise(page, [tapped]))[0], 'a tap left the hover colour on the border').not.toBe(hover);

      // The control: the same rule ungated, and the same tap starts it changing.
      await page.addStyleTag({ content: '.error-page__exit:hover { border-color: rgb(255, 0, 255); }' });
      await page.locator(EXIT).nth(1).tap();
      await expect
        .poll(async () => (await transitions()).length, { message: 'a tap does not reach :hover here, so the empty read above proves nothing' })
        .toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test('Tab paints the standard ring on each exit the frame focus lands, and a click paints none', async ({ page }) => {
    await goTo(page);
    const expected = {
      width: await length(page, '--stroke-focus'),
      colour: await role(page, '--token-focus'),
      offset: await length(page, '--focus-offset'),
    };
    const ringOf = () =>
      page.evaluate(() => {
        const node = document.activeElement as HTMLElement;
        const style = getComputedStyle(node);
        const properties = style.transitionProperty.split(',').map((one) => one.trim());
        const durations = style.transitionDuration.split(',').map((one) => Number.parseFloat(one));
        return {
          exit: node.classList.contains('error-page__exit') ? (node.textContent ?? '').trim() : null,
          visible: node.matches(':focus-visible'),
          style: style.outlineStyle,
          width: style.outlineWidth,
          colour: style.outlineColor,
          offset: style.outlineOffset,
          animated: properties.filter((property, index) => /outline|^all$/.test(property) && (durations[index % durations.length] ?? 0) > 0),
        };
      });

    const rings: Awaited<ReturnType<typeof ringOf>>[] = [];
    for (let press = 0; press < 12 && rings.length < 2; press += 1) {
      await page.keyboard.press('Tab');
      const ring = await ringOf();
      if (ring.exit) rings.push(ring);
    }
    expect(rings.map((ring) => ring.exit), 'Tab did not reach both exits in order').toEqual(['Suite', 'CV']);
    for (const ring of rings) {
      expect(ring.visible, `${ring.exit} does not match :focus-visible under Tab`).toBe(true);
      expect(ring.style, `${ring.exit} paints no solid ring`).toBe('solid');
      expect(ring.width, `${ring.exit}'s ring is not --stroke-focus`).toBe(expected.width);
      expect(ring.colour, `${ring.exit}'s ring is not the focus role`).toBe(expected.colour);
      expect(ring.offset, `${ring.exit}'s ring is not at --focus-offset`).toBe(expected.offset);
      expect(ring.animated, `${ring.exit}'s ring is transitioned`).toEqual([]);
    }

    // A click with navigation prevented lands focus and paints nothing.
    await page.evaluate(() => document.addEventListener('click', (event) => event.preventDefault(), true));
    await page.locator(EXIT).nth(0).click();
    const clicked = await ringOf();
    expect(clicked.exit, 'the click left focus somewhere else').toBe('Suite');
    expect(clicked.visible, 'a mouse click matches :focus-visible').toBe(false);
    expect(clicked.style, 'a mouse click paints a ring').toBe('none');

    // The control: the ring taken off the exits is what the same read reports under Tab.
    await page.addStyleTag({ content: '.error-page__exit:focus-visible { outline: none !important; }' });
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const removed = await ringOf();
    expect(removed.exit, 'the control did not land on an exit').not.toBeNull();
    expect(removed.style, 'the ring read does not see a removed ring').toBe('none');
  });
});

// ---------------------------------------------------------------------------
// The entrance
// ---------------------------------------------------------------------------

/**
 * Resolves once every animation on the surface has finished. Only the surface's: an animation
 * elsewhere on the page that never ends (none today, and the design bars loops) would otherwise
 * hold the wait until the test timed out rather than fail naming anything.
 */
const finishedOnSurface = () =>
  Promise.all(
    document
      .getAnimations()
      .filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('.error-page'))
      .map((animation) => animation.finished)
  ).then(() => undefined);

/** The animation each named element computes, and the heading's first character's. */
const entranceOf = (page: Page) =>
  page.evaluate((selectors) => {
    const read = (node: Element | null) => {
      if (!node) throw new Error('an animated element is not on the page');
      const style = getComputedStyle(node);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        timing: style.animationTimingFunction,
        delay: style.animationDelay,
        fill: style.animationFillMode,
        count: style.animationIterationCount,
        opacity: style.opacity,
      };
    };
    return {
      elements: selectors.map((selector) => ({ selector, ...read(document.querySelector(selector)) })),
      heading: [...document.querySelectorAll('.error-page .glitch-text__char')].map((node) => read(node)),
    };
  }, [...ANIMATED]);

test.describe('the entrance is one opacity keyframe, and nothing under reduced motion', () => {
  test('with motion allowed, the numeral, the line and the exits fade in order at the minor duration on the entrance curve', async ({ browser }) => {
    const context = await contextWith(browser, { reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage();
      await goTo(page);
      // Both roles resolved through a probe, so each compares in the serialisation the element's own
      // computed value takes (`0.22s`, not the token stream's `220ms`).
      const role_ = await probe(page, { 'animation-duration': 'var(--dur-minor)', 'animation-timing-function': 'var(--ease-entrance)' }, [
        'animation-duration',
        'animation-timing-function',
      ]);
      const read = await entranceOf(page);
      expect(role_['animation-duration'], 'the minor duration is collapsed on a context that allows motion').not.toBe('0.001s');
      for (const [index, element] of read.elements.entries()) {
        expect(element.name, `${element.selector} does not run the surface's keyframe`).toBe(KEYFRAME);
        expect(element.duration, `${element.selector} is not at --dur-minor`).toBe(role_['animation-duration']);
        expect(element.timing, `${element.selector} is not on --ease-entrance`).toBe(role_['animation-timing-function']);
        expect(Number.parseFloat(element.delay), `${element.selector} is out of the shipped order`).toBeCloseTo(DELAYS[index], 3);
        expect(element.fill).toBe('both');
        expect(element.count, `${element.selector} repeats`).toBe('1');
      }
      expect(read.heading.length, 'the heading renders no characters').toBeGreaterThan(0);
      expect(read.heading.every((character) => character.name === HEADING_KEYFRAME), 'the heading does not run the display entrance').toBe(true);
      expect(Number.parseFloat(read.heading[0].delay), 'the heading does not begin with the message').toBeCloseTo(DELAYS[1], 3);

      // Opacity and nothing else, on every animation the surface runs.
      const properties = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('.error-page'))
          .flatMap((animation) =>
            ((animation.effect as KeyframeEffect).getKeyframes() as Record<string, unknown>[]).flatMap((frame) =>
              Object.keys(frame).filter((key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key))
            )
          )
      );
      expect(properties.length, 'no animation was read on the surface').toBeGreaterThan(0);
      expect([...new Set(properties)], 'the entrance animates something other than opacity').toEqual(['opacity']);

      // And it ends: every animated element at full opacity once the animations finish.
      await page.evaluate(finishedOnSurface);
      const after = await entranceOf(page);
      expect([...after.elements, ...after.heading].every((element) => element.opacity === '1'), 'the surface did not finish at full opacity').toBe(true);
    } finally {
      await context.close();
    }
  });

  test('under reduced motion nothing animates, and the whole surface is present at the first read', async ({ page, browser }) => {
    // The project's own context asks for reduced motion (`playwright.config.ts`), so this is the
    // reading a visitor who asked for stillness gets: `animation: none`, not a 1ms run that would
    // still wait out its delay.
    await goTo(page);
    const read = await entranceOf(page);
    for (const element of [...read.elements, ...read.heading]) {
      expect(element.name, 'an element animates under reduced motion').toBe('none');
      expect(element.opacity, 'an element is not present at full opacity').toBe('1');
    }
    expect(
      await page.evaluate(
        () => document.getAnimations().filter((animation) => (animation.effect as KeyframeEffect | null)?.target?.closest('.error-page')).length
      ),
      'an animation runs on the surface under reduced motion'
    ).toBe(0);

    // The control: the same read, on a context that allows motion, sees the keyframe.
    const context = await contextWith(browser, { reducedMotion: 'no-preference' });
    try {
      const moving = await context.newPage();
      await goTo(moving);
      expect((await entranceOf(moving)).elements.map((element) => element.name), 'the read cannot see the keyframe at all').toEqual(
        ANIMATED.map(() => KEYFRAME)
      );
    } finally {
      await context.close();
    }
  });

  test('with every script aborted, the surface is whole and ends at full opacity', async ({ browser }) => {
    const context = await contextWith(browser, { reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage();
      let aborted = 0;
      await page.route('**/_next/static/chunks/*.js', async (route) => {
        aborted += 1;
        await route.abort();
      });
      await goTo(page);
      expect(aborted, 'no script was aborted, so this is not the no-script reading').toBeGreaterThan(0);
      await expect(page.locator(`${SURFACE} > *`), 'the served surface is not whole').toHaveCount(5);
      await expect(page.locator(EXIT), 'the exits are not in the served markup').toHaveCount(2);
      await page.evaluate(finishedOnSurface);
      const read = await entranceOf(page);
      expect([...read.elements, ...read.heading].every((element) => element.opacity === '1'), 'with no script, something stays hidden').toBe(true);
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// The width AD-19 measures at
// ---------------------------------------------------------------------------

test.describe('at 360', () => {
  test('nothing on the 404 sits past either viewport edge, and the exits share a line or wrap', async ({ page }) => {
    await goTo(page);
    const outside = () =>
      page.evaluate(() => {
        const width = window.innerWidth;
        return [...document.querySelectorAll('body *')]
          .filter((node) => node.getClientRects().length > 0)
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && (rect.right > width + 0.5 || rect.left < -0.5);
          })
          .map((node) => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`);
      });
    expect(page.viewportSize()?.width).toBe(RENDERED_VIEWPORT.width);
    expect(await outside(), 'an element on the 404 sits past a viewport edge at 360').toEqual([]);

    // The control: a planted element wider than the viewport is reported.
    await page.evaluate(() => {
      const wide = document.createElement('div');
      wide.id = 'planted-wide';
      wide.style.width = '480px';
      wide.style.height = '4px';
      document.querySelector('.error-page')?.append(wide);
    });
    expect(await outside(), 'the edge read does not see a planted wide element').toContain('div.');
  });
});
