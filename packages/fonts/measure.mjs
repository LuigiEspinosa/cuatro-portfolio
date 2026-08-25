// Measures the numbers `packages/fonts/build.mjs` turns into `size-adjust`,
// `ascent-override`, `descent-override` and `line-gap-override`, and writes them
// to `packages/fonts/fallback-metrics.json` with the provenance of the
// instrument that produced them.
//
//   corepack pnpm fonts:measure
//
// **Run this inside `mcr.microsoft.com/playwright:v1.62.1-noble` and nowhere
// else.** The exact `docker run` line is in `ops/font-contract.md`. The whole
// point of the file it writes is that both sides of every ratio come from one
// browser, one pixel size and one string, and that the fallback half is
// whatever that pinned Linux image resolves for each `--f-*` stack. Measured on
// the Windows host it would tune the faces against Segoe UI, which no CI runner
// and no Linux visitor has.
//
// AD-1: `packages/` only, never published.
//
// Why the measurement is committed rather than run at build time: `fonts:build`
// then stays deterministic arithmetic that a runner with no browser reproduces
// byte for byte, which is what makes the drift gate a real gate. The cost is
// that this file can go stale, and the empirical check in
// `tests/e2e/contract-fonts.pw.ts` is what catches that.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');
const FACES_JSON = join(HERE, 'faces.json');
const TOKENS_CSS = join(CONTRACTS, 'tokens.css');
const OUTPUT = join(HERE, 'fallback-metrics.json');

/**
 * One pixel size and one string for every measurement on both sides of every
 * ratio. 100 is chosen so a printed figure reads directly as a percentage of
 * the em, which makes the derived descriptors checkable by hand.
 */
const PIXEL_SIZE = 100;

/**
 * The sample string. Caps, ascenders, descenders, a space and digits, so the
 * advance it measures is not dominated by one glyph class. Pinned: changing it
 * changes every `size-adjust` in the published contract.
 */
const SAMPLE = 'Handgloves ABCxyz 0123';

/**
 * The image this must run in. Recorded into the output rather than assumed, and
 * overridable so the recorded digest is observed on the host that pulled it
 * rather than copied from prose. `ops/rendered-output-harness.md` carries the
 * same tag for the rendered-output harness, deliberately: one image for every
 * browser measurement in this repository.
 */
const IMAGE = process.env.CUATRO_FONTS_IMAGE || 'mcr.microsoft.com/playwright:v1.62.1-noble';
const IMAGE_DIGEST = process.env.CUATRO_FONTS_IMAGE_DIGEST || 'not recorded';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const fail = (message) => {
  console.error(`packages/fonts/measure.mjs: ${message}`);
  process.exit(1);
};

/**
 * The three `--f-*` stacks, read out of the published `contracts/tokens.css`
 * rather than restated here. The contract family is then removed from the front
 * of its own stack, and what is left is exactly what a browser paints while the
 * woff2 is still in flight under `font-display: swap`.
 */
const stacksFromTokens = () => {
  const css = readFileSync(TOKENS_CSS, 'utf8');
  const stacks = new Map();
  for (const token of ['--f-display', '--f-body', '--f-mono']) {
    const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(css);
    if (!match) {
      fail(`contracts/tokens.css declares no ${token}, so its fallback stack cannot be read.`);
    }
    stacks.set(token, match[1].trim());
  }
  return stacks;
};

const withoutLeadingFamily = (stack, family) => {
  const parts = stack.split(',').map((part) => part.trim());
  const head = parts[0].replace(/^["']|["']$/g, '');
  if (head !== family) {
    fail(
      `the first family in the stack is "${head}" but faces.json publishes "${family}". ` +
        `contracts/tokens.css and packages/fonts/faces.json have to name the same family, ` +
        `byte for byte, or the overrides are tuned against the wrong fallback.`
    );
  }
  const rest = parts.slice(1);
  if (rest.length === 0) {
    fail(`the stack for "${family}" has no fallback after the contract family, so there is nothing to measure against.`);
  }
  return rest.join(', ');
};

const serve = (root) =>
  new Promise((resolveServer) => {
    const server = createServer((request, response) => {
      const requested = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      // The measuring page is served from this origin rather than through
      // `setContent`, so the `FontFace` fetches below are same-origin ordinary
      // requests rather than cross-origin ones from `about:blank`.
      if (requested === '/') {
        response.writeHead(200, { 'content-type': MIME['.html'] });
        response.end('<!doctype html><meta charset="utf-8"><title>fallback metrics</title><body></body>');
        return;
      }
      const target = normalize(join(root, requested));
      if (!target.startsWith(root + sep) || !existsSync(target) || statSync(target).isDirectory()) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
      response.end(readFileSync(target));
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });

const main = async () => {
  if (!existsSync(FACES_JSON)) {
    fail('packages/fonts/faces.json is missing. Run "pnpm fonts:prepare" first.');
  }
  const faces = JSON.parse(readFileSync(FACES_JSON, 'utf8'));
  const stacks = stacksFromTokens();
  const tokenFor = { display: '--f-display', body: '--f-body', mono: '--f-mono' };

  const server = await serve(CONTRACTS);
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const session = await page.context().newCDPSession(page);
  await session.send('DOM.enable');
  await session.send('CSS.enable');

  const request = [];
  for (const face of faces.faces) {
    const token = tokenFor[face.role];
    if (!token) fail(`faces.json gives "${face.family}" the role "${face.role}", which maps to no --f-* token.`);
    request.push({
      family: face.family,
      token,
      file: `${origin}/fonts/${face.file}`,
      stack: withoutLeadingFamily(stacks.get(token), face.family),
    });
  }

  const response = await page.goto(`${origin}/`, { waitUntil: 'load' });
  if (!response || !response.ok()) {
    fail(`the measuring page at ${origin}/ answered HTTP ${response ? response.status() : 'nothing'}.`);
  }

  // Bare faces, no overrides at all. Measuring a face through a rule that
  // already carries `ascent-override` would measure the override rather than
  // the font, which is the circular reading this whole step exists to avoid.
  const measured = await page.evaluate(
    async ({ request, pixelSize, sample, origin }) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      const measure = (fontStack) => {
        context.font = `${pixelSize}px ${fontStack}`;
        const metrics = context.measureText(sample);

        const probe = document.createElement('div');
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;line-height:normal;font:${pixelSize}px ${fontStack}`;
        probe.textContent = sample;
        document.body.appendChild(probe);
        const normalLineHeight = probe.getBoundingClientRect().height;
        document.body.removeChild(probe);

        const ascent = metrics.fontBoundingBoxAscent;
        const descent = metrics.fontBoundingBoxDescent;
        return {
          advance: metrics.width,
          ascent,
          descent,
          normalLineHeight,
          // Canvas exposes no line gap, so it is what the browser's own
          // `line-height: normal` box holds beyond the ascent and descent. A
          // sub-pixel residue is rounding, not a gap, so it is floored.
          lineGap: Math.max(0, Math.round((normalLineHeight - (ascent + descent)) * 1000) / 1000),
        };
      };

      const results = {};
      for (const entry of request) {
        const face = new FontFace(entry.family, `url("${entry.file}") format("woff2")`);
        await face.load();
        document.fonts.add(face);

        // The measured face has to be the loaded one rather than a system font
        // of the same name. A quoted single family with no fallback is what
        // makes that checkable, and `document.fonts.check` says whether the
        // browser would actually use it.
        if (!document.fonts.check(`${pixelSize}px "${entry.family}"`)) {
          throw new Error(`the browser reports "${entry.family}" unavailable after loading ${entry.file}`);
        }

        results[entry.family] = {
          token: entry.token,
          file: entry.file.slice(origin.length + 1),
          fallbackStack: entry.stack,
          face: measure(`"${entry.family}"`),
          fallback: measure(entry.stack),
        };
      }
      return results;
    },
    { request, pixelSize: PIXEL_SIZE, sample: SAMPLE, origin }
  );

  // What the fallback stacks actually resolved to in this image, read from the
  // renderer rather than guessed from the stack text. A stated limit in
  // `ops/font-contract.md` turns on these names.
  for (const entry of request) {
    await page.evaluate(
      ({ stack, id, sample }) => {
        const probe = document.createElement('div');
        probe.id = id;
        // Painted rather than hidden. `CSS.getPlatformFontsForNode` reports the
        // faces the renderer actually used for the laid-out glyphs, and a node
        // it never painted answers with an empty list, which reads as "no
        // fallback" when the truth is "not measured".
        probe.style.cssText = `position:absolute;top:0;left:0;font-family:${stack};font-size:100px`;
        probe.textContent = sample;
        document.body.appendChild(probe);
      },
      { stack: entry.stack, id: `probe-${entry.token.slice(2)}`, sample: SAMPLE }
    );
  }

  // `CSS.getPlatformFontsForNode` answers from what the renderer recorded while
  // painting, so a node that has been appended but not yet painted comes back
  // with an empty list. One forced layout plus a frame is what turns that into
  // the real answer.
  await page.evaluate(() => {
    document.body.getBoundingClientRect();
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  await page.waitForTimeout(250);

  // The document is fetched after the probes exist, not before: a tree read
  // ahead of them has no node to find.
  const { root } = await session.send('DOM.getDocument', { depth: -1 });
  for (const entry of request) {
    const { nodeId } = await session.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: `#probe-${entry.token.slice(2)}`,
    });
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
    const named = fonts.map((font) => font.familyName).filter(Boolean);
    if (named.length === 0) {
      fail(
        `the renderer named no platform font for the fallback stack "${entry.stack}". ` +
          `The stated limit in ops/font-contract.md turns on which face this image resolves, ` +
          `so an unnamed one is a refusal rather than a blank in the record.`
      );
    }
    measured[entry.family].fallback.resolvedFonts = named;
  }

  const chromiumVersion = browser.version();
  await browser.close();
  server.close();

  const output = {
    $description:
      'Written by packages/fonts/measure.mjs inside the pinned Playwright image. ' +
      'packages/fonts/build.mjs derives every size-adjust, ascent-override, descent-override and ' +
      'line-gap-override in contracts/fonts.css from these numbers. Both sides of every ratio come ' +
      'from one browser, one pixel size and one string, on purpose. Never hand-edited: ' +
      'tests/e2e/contract-fonts.pw.ts is what catches this file going stale.',
    provenance: {
      image: IMAGE,
      imageDigest: IMAGE_DIGEST,
      chromium: chromiumVersion,
      measuredUtc: new Date().toISOString(),
      pixelSize: PIXEL_SIZE,
      sampleString: SAMPLE,
    },
    families: measured,
  };

  writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  for (const [family, entry] of Object.entries(measured)) {
    console.log(
      `packages/fonts: ${family} fallback "${entry.fallbackStack}" resolved to ` +
        `${entry.fallback.resolvedFonts?.join(', ') || 'nothing the renderer named'}`
    );
    console.log(
      `packages/fonts:   face     advance ${entry.face.advance} ascent ${entry.face.ascent} descent ${entry.face.descent} lineGap ${entry.face.lineGap}`
    );
    console.log(
      `packages/fonts:   fallback advance ${entry.fallback.advance} ascent ${entry.fallback.ascent} descent ${entry.fallback.descent} lineGap ${entry.fallback.lineGap}`
    );
  }
  console.log(`packages/fonts: wrote ${OUTPUT.replace(/\\/g, '/')}`);
};

main().catch((error) => fail(error.stack ?? String(error)));
