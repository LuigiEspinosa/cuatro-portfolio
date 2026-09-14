// The Hub's two eyeball renders and the accent share (Story 2-26, AD-19).
//
// Two of the four manual checks `EXPERIENCE.md:777-779` fixes need a person
// looking at a render: the greyscale render with the Status taxonomy still
// readable, and the keyboard traversal. A check that leaves no re-runnable
// command cannot be re-run against a regression (`ops/status-mark-axes.md`),
// so this file produces the renders the Operator looks at, and beside them the
// one figure `epics.md:3058-3059` asks for that no Playwright case can gate:
// the share of the rendered homepage's viewport that is accent, which
// `RESTYLE-SPEC.md:654` (RESTYLE-SPEC F-8) says has no defined denominator and
// is therefore Observed here with one stated rather than asserted.
//
// What it does, against a RUNNING production server, at 360x800 and 1280x800:
//   * opens `/` on a context that has asked for reduced motion, so the render is
//     the flat front door and the same on every run (the 3D door's canvas is
//     animated and never renders the same frame twice), and refuses to go on if
//     the entrance selector matches nothing, since an empty `every` settles at once;
//   * reads `--token-accent`, `--token-accent-hover` and `--token-accent-muted`
//     off the page and rasterises each to sRGB through a canvas, with two
//     sentinels so an unparsed value is refused rather than read as the last one;
//   * screenshots the viewport at scroll top, decodes the PNG with `sharp`, and
//     counts the pixels within `ACCENT_DISTANCE` of any of the three, over the
//     viewport's pixel count as the denominator;
//   * then plants the four Status values across the Directory's marks, one of
//     each in turn with the dot removed from the three that do not carry one and
//     given to a planted `Live` (only `Live` reaches the shipped page,
//     `ops/status-mark-axes.md:254-259`), applies `html { filter: grayscale(1) }`
//     and writes a full-page desaturated PNG to the `--out` directory, which is
//     what the Operator's greyscale confirmation is read on. The share is
//     counted before the plant, on the page as shipped.
//
// **Nothing here is a gate.** It needs a browser and a server and neither is
// asserted on in CI; `tests/e2e/accessibility-floor.pw.ts` is the gate. The pure
// parts, the argument parser and the share count, are exported and covered by
// `ops/__tests__/hub-accessibility-probe.test.ts` under the blocking `test` job.
//
// Usage: node ops/hub-accessibility-probe.mjs --base-url http://127.0.0.1:3100 --out <dir>
//   --base-url  the running server's origin (default http://127.0.0.1:3100)
//   --out       where the two PNGs are written (required)
//
// Exit codes: 0 the transcript was printed; 2 a defect in this file; 3 nothing
// could be observed (no server, no browser, no output directory, bad arguments).

import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

const require_ = createRequire(import.meta.url);

export const DEFAULT_BASE_URL = 'http://127.0.0.1:3100';

/** The two viewports the share is read at, AD-19's width and a desktop one. */
export const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 1280, height: 800 },
];

/** The three accent roles a pixel is counted against. */
export const ACCENT_TOKENS = ['--token-accent', '--token-accent-hover', '--token-accent-muted'];

/** The Status taxonomy, planted across the Directory's marks before the greyscale render (`contracts/registry.schema.json`). */
export const STATUS_VALUES = ['Live', 'Complete', 'In progress', 'Archived'];

/** The entrance the reduced-motion door settles at opacity 1, same selector as `tests/e2e/accessibility-floor.pw.ts`. */
export const ENTRANCE_SELECTOR = '.nav-link, .contact-container a';

/**
 * The RGB distance within which a pixel counts as accent, in 0 to 255 units,
 * Euclidean over the three channels. Stated rather than tuned: antialiased
 * text and the muted role's dark value both sit near other colours, so the
 * figure is an approximation whose denominator and tolerance are both written
 * down. A tighter distance under-counts edges; a looser one starts counting
 * the ground beneath the muted role.
 */
export const ACCENT_DISTANCE = 32;

export class BlockedError extends Error {}

/**
 * The two arguments, parsed off `argv` (without `node` and the script). Throws
 * naming the flag on anything it does not understand, so a typo is never a
 * default silently taken; the base URL has to be a bare http(s) origin, since
 * `/` is appended to it.
 */
export function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: Array.isArray(argv) ? argv : [],
    options: { 'base-url': { type: 'string', default: DEFAULT_BASE_URL }, out: { type: 'string' } },
    strict: true,
  });
  if (values.out === undefined) throw new Error('--out <dir> is required: the two renders have to land somewhere');
  const url = URL.canParse(values['base-url']) ? new URL(values['base-url']) : null;
  if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:') || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(`--base-url ${values['base-url']} is not a bare http(s) origin`);
  }
  return { baseUrl: values['base-url'].replace(/\/$/, ''), out: values.out };
}

/**
 * The share of `width * height` RGBA pixels within `distance` of any target.
 *
 * `raw` is the decoded buffer `sharp(...).raw()` hands back, four bytes per
 * pixel, row-major. `targets` are `[r, g, b]` triples. Throws when the buffer
 * is not the size the dimensions promise, so a truncated decode is never a
 * small share.
 */
export function accentShare(raw, width, height, targets, distance = ACCENT_DISTANCE) {
  const total = width * height;
  if (!Buffer.isBuffer(raw) && !(raw instanceof Uint8Array)) throw new Error('accentShare needs a byte buffer');
  if (raw.length !== total * 4) throw new Error(`accentShare: ${raw.length} bytes for ${width}x${height} pixels, expected ${total * 4}`);
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('accentShare: no target colour');
  const limit = distance * distance;
  let accent = 0;
  for (let offset = 0; offset < raw.length; offset += 4) {
    const r = raw[offset];
    const g = raw[offset + 1];
    const b = raw[offset + 2];
    for (const [tr, tg, tb] of targets) {
      const dr = r - tr;
      const dg = g - tg;
      const db = b - tb;
      if (dr * dr + dg * dg + db * db <= limit) {
        accent += 1;
        break;
      }
    }
  }
  return { accent, total, share: total === 0 ? 0 : accent / total };
}

/**
 * `r,g,b,a` off the page's canvas into an `[r, g, b]` triple: exactly four
 * integer channels in 0 to 255, the alpha fully opaque, or it is refused. An
 * empty channel would otherwise coerce to 0 and read as black.
 */
export function tripleOf(rasterised) {
  const parts = String(rasterised ?? '').split(',');
  const channels = parts.map((part) => (/^\s*\d+\s*$/.test(part) ? Number(part) : Number.NaN));
  if (channels.length !== 4 || channels.some((part) => !Number.isInteger(part) || part < 0 || part > 255) || channels[3] !== 255) {
    throw new Error(`"${rasterised}" is not an opaque r,g,b,a reading`);
  }
  return channels.slice(0, 3);
}

async function probe({ baseUrl, out }) {
  console.log('# Hub accessibility probe, Story 2-26, AD-19');
  console.log(`# started ${new Date().toISOString()}`);
  console.log(`# base url: ${baseUrl}`);
  console.log(`# out:      ${resolve(out)}`);
  console.log(`# accent distance: ${ACCENT_DISTANCE} (Euclidean RGB, 0 to 255)`);
  try {
    mkdirSync(out, { recursive: true });
  } catch (error) {
    throw new BlockedError(`${out} could not be created: ${error instanceof Error ? error.message : String(error)}`);
  }

  let chromium;
  try {
    ({ chromium } = require_('@playwright/test'));
  } catch (error) {
    throw new BlockedError(`@playwright/test could not be loaded. Run corepack pnpm install. ${error instanceof Error ? error.message : String(error)}`);
  }
  let sharp;
  try {
    sharp = require_('sharp');
  } catch (error) {
    throw new BlockedError(`sharp could not be loaded. Run corepack pnpm install. ${error instanceof Error ? error.message : String(error)}`);
  }

  let browser = null;
  try {
    try {
      browser = await chromium.launch();
    } catch (error) {
      throw new BlockedError(`no Chromium could be launched. Run corepack pnpm exec playwright install chromium. ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`# chromium: ${browser.version()}`);

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
      const page = await context.newPage();
      let response;
      try {
        response = await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
      } catch (error) {
        throw new BlockedError(`nothing answered at ${baseUrl}. Start the server with corepack pnpm build && corepack pnpm start --port 3100. ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!response || response.status() !== 200) throw new BlockedError(`${baseUrl}/ answered ${response ? response.status() : 'nothing'}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      // The settle waits on the entrance's opacity; over an empty NodeList `every` is true at
      // once, so a renamed class would read as settled before hydration.
      const animated = await page.locator(ENTRANCE_SELECTOR).count();
      if (animated === 0) throw new Error(`"${ENTRANCE_SELECTOR}" matches nothing on ${baseUrl}/, so the settle would wait on nothing`);
      await page.waitForFunction(
        (selector) => [...document.querySelectorAll(selector)].every((node) => window.getComputedStyle(node).opacity === '1'),
        ENTRANCE_SELECTOR,
        { timeout: 15_000 }
      );

      const rasterised = await page.evaluate((tokens) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const context2d = canvas.getContext('2d');
        if (!context2d) throw new Error('no 2d context');
        context2d.globalCompositeOperation = 'copy';
        // Two sentinels, not one (`tests/e2e/anchor-aliases.pw.ts:293-336`): a value that is
        // another spelling of a single sentinel would read as refused.
        const SENTINELS = ['#123456', '#654321'];
        return tokens.map((token) => {
          const probeNode = document.createElement('div');
          probeNode.style.color = `var(${token})`;
          document.body.append(probeNode);
          const colour = window.getComputedStyle(probeNode).color;
          probeNode.remove();
          const refused = SENTINELS.every((sentinel) => {
            context2d.fillStyle = sentinel;
            context2d.fillStyle = colour;
            return context2d.fillStyle === sentinel;
          });
          if (refused) throw new Error(`the canvas could not parse ${token} as "${colour}"`);
          context2d.fillStyle = colour;
          context2d.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = context2d.getImageData(0, 0, 1, 1).data;
          return `${r},${g},${b},${a}`;
        });
      }, ACCENT_TOKENS);
      const targets = rasterised.map(tripleOf);
      console.log('');
      console.log(`# viewport ${viewport.width}x${viewport.height}, scroll top, reduced-motion door`);
      ACCENT_TOKENS.forEach((token, index) => console.log(`  ${token} = rgb(${targets[index].join(', ')})`));

      const png = await page.screenshot({ type: 'png' });
      // `ensureAlpha`, because a screenshot with no transparency decodes to three channels and the
      // count below walks four bytes per pixel.
      const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (decoded.info.channels !== 4) throw new Error(`the screenshot decoded to ${decoded.info.channels} channels, not RGBA`);
      const share = accentShare(decoded.data, decoded.info.width, decoded.info.height, targets);
      console.log(
        `  accent share = ${share.accent} of ${share.total} viewport pixels (${decoded.info.width}x${decoded.info.height}) = ` +
          `${(share.share * 100).toFixed(2)}%`
      );

      // The greyscale render is what O-9's human check is read on, and only `Live` reaches the
      // shipped page (`ops/status-mark-axes.md:254-259`). So the four values are planted across the
      // rendered marks the way Story 2-10's check planted them, one of each in turn, the dot
      // removed from the three that do not carry one and given to a planted `Live`, so what is
      // read is the taxonomy as it would ship.
      const plantedMarks = await page.evaluate((values) => {
        const marks = [...document.querySelectorAll('.suite-directory__status')];
        if (marks.length === 0) throw new Error('the Directory renders no Status mark, so nothing can be planted');
        marks.forEach((mark, index) => {
          const value = values[index % values.length];
          mark.setAttribute('data-status', value);
          const dot = mark.querySelector('.suite-directory__dot');
          if (value !== 'Live' && dot) dot.remove();
          if (value === 'Live' && !dot) {
            const planted = document.createElement('span');
            planted.className = 'suite-directory__dot';
            planted.setAttribute('aria-hidden', 'true');
            mark.prepend(planted);
          }
          mark.lastChild.textContent = value;
        });
        return marks.map((mark) => mark.getAttribute('data-status'));
      }, STATUS_VALUES);
      console.log(`  status values planted across the ${plantedMarks.length} marks, in order: ${plantedMarks.join(', ')}`);
      await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
      const file = join(out, `home-greyscale-${viewport.width}x${viewport.height}.png`);
      writeFileSync(file, await page.screenshot({ type: 'png', fullPage: true }));
      console.log(`  greyscale render written to ${file}`);
      await context.close();
    }
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
  }
  console.log('');
  console.log(`# finished ${new Date().toISOString()}`);
}

function thisFile() {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return null;
  }
}

function realpathOrSelf(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** Two paths name one file, compared after resolution and case-insensitively (`ops/cs-tracker-accessibility-probe.mjs:201-214`). */
export function samePath(a, b) {
  const norm = (p) => resolve(String(p ?? '').replace(/\\/g, '/')).replace(/\\/g, '/').toLowerCase();
  return norm(a) === norm(b);
}

const entry = thisFile();
const invokedDirectly = entry !== null && typeof process.argv[1] === 'string' && samePath(realpathOrSelf(process.argv[1]), realpathOrSelf(entry));

if (invokedDirectly) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`hub-accessibility-probe: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 3;
  }
  if (args) {
    probe(args).then(
      () => {
        process.exitCode = 0;
      },
      (error) => {
        const blocked = error instanceof BlockedError;
        const text = blocked ? error.message : error instanceof Error ? error.stack : String(error);
        console.log(`# ${blocked ? 'BLOCKED' : 'PROBE DEFECT'}: ${text}`);
        process.stderr.write(`hub-accessibility-probe: ${text}\n`);
        process.exitCode = blocked ? 3 : 2;
      }
    );
  }
}
