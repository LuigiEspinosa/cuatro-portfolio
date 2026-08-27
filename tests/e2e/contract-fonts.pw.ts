import { test, expect, type Page } from '@playwright/test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue } from './harness';

/**
 * The font contract, verified where it is actually consumed (Story 1-12).
 *
 * Three things a unit test over the file text cannot establish, and this can:
 *
 *  1. **Depth independence.** A Satellite vendors `contracts/` under the fixed
 *     name `cuatro-contracts/` (AD-14) into `assets/css/`, `src/styles/` or
 *     `src/`. The folder is copied to a deliberately deep scratch path here and
 *     served over HTTP, so a `url()` that assumed a document root 404s instead
 *     of resolving by luck.
 *  2. **That the faces actually load.** `RESTYLE-SPEC.md:648` (F-2) is the trap
 *     this avoids: `getComputedStyle().fontFamily` returns the declared stack
 *     and passes identically when every woff2 has 404'd. The check is the HTTP
 *     status plus `document.fonts.check` per family.
 *  3. **That the swap does not shift layout.** Measured, not assumed from the
 *     presence of the descriptors.
 *
 * **Why this is a geometry comparison and not a screenshot.** A pixel
 * comparison across a font swap fails by construction: different outlines are
 * different pixels, and that is the intended change. What must not move is the
 * layout. So the same page is measured with the woff2 requests aborted and then
 * allowed, which is exactly what a visitor experiences under
 * `font-display: swap`. The committed screenshot baseline is a different
 * instrument, it belongs to `/work`, and nothing here touches it.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to
// CommonJS, and the repository declares no `"type": "module"`, so `import.meta`
// is a syntax error at run time here even though TypeScript accepts it.
const REPO_ROOT = resolve(__dirname, '..', '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');
const METRICS = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages', 'fonts', 'fallback-metrics.json'), 'utf8')
) as {
  provenance: { sampleString: string; pixelSize: number };
  families: Record<string, { token: string; fallbackStack: string }>;
};
const FACES = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', 'fonts', 'faces.json'), 'utf8')) as {
  faces: { family: string; role: string; file: string }[];
};

/**
 * The tolerances, stated as numbers with their margins and recorded in
 * `ops/font-contract.md` rather than left as an opinion. Each is a share of the
 * fallback measurement, so none depends on the pixel size a sample uses.
 *
 * Four numbers rather than one, because the four kinds of row measure different
 * things and one number would have to be the loosest of them:
 *
 *  - `height` covers every block. This is where `ascent-override`,
 *    `descent-override` and `line-gap-override` land, and it is
 *    text-independent. Observed 0.00% on all twelve height rows in the pinned
 *    image; the smallest breach the stripped-overrides probe produces is 2.96%.
 *  - `widthLarge` covers the block set at the pixel size the descriptors were
 *    measured at, where per-glyph rounding is a rounding error rather than a
 *    term. Observed max 0.25%; smallest probe breach 5.05%.
 *  - `widthSmall` covers the same pinned string at 16px, where each glyph's
 *    advance is rounded at a size-adjusted em and the errors accumulate over
 *    the string. Observed max 1.66%; smallest probe breach 7.84%. Both sides of
 *    the comparison are deterministic in the pinned image, so 1.66% is a stable
 *    figure and not noise to be absorbed.
 *  - `widthContainer` covers the prose block, whose width is its container's by
 *    construction. That row is an invariant rather than a measurement: the
 *    prose block earns its place through its height, which is what wrapping
 *    moves.
 *
 * `size-adjust` is one scalar fitted to one string. A different string's advance
 * moves by whatever the two faces' relative glyph widths differ by, and claiming
 * otherwise would be claiming the two faces are metric-compatible, which they
 * are not and are not meant to be. That is why the prose block is measured on
 * height and not on width.
 */
const TOLERANCE = {
  height: 0.01,
  widthLarge: 0.01,
  widthSmall: 0.03,
  widthContainer: 0.005,
} as const;

/** Prose the descriptors were not fitted to, so the wrapped-height rows measure something real. */
const PROSE = 'The quick brown fox jumps over the lazy dog while nine wizards vex.';

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

interface Geometry {
  width: number;
  height: number;
}

/**
 * The vendored tree: `contracts/` copied to a path five directories deep under
 * the fixed folder name, with the two pages that consume it at the server root.
 * Nothing here is written into the repository, which is what keeps the probe
 * stylesheet out of the closing commit.
 */
const VENDORED_AT = ['assets', 'static', 'vendor', 'third-party', 'design', 'cuatro-contracts'];

const buildTree = (): { root: string; vendored: string } => {
  const root = mkdtempSync(join(tmpdir(), 'cuatro-vendored-'));
  const vendored = join(root, ...VENDORED_AT);
  mkdirSync(dirname(vendored), { recursive: true });
  cpSync(CONTRACTS, vendored, { recursive: true });

  const href = `./${VENDORED_AT.join('/')}`;
  const samples = FACES.faces
    .map(
      (face) => `
    <div class="row" data-role="${face.role}">
      <span data-sample="${face.role}-pinned" class="pinned">${METRICS.provenance.sampleString}</span>
      <span data-sample="${face.role}-large" class="large">${METRICS.provenance.sampleString}</span>
      <span data-sample="${face.role}-lines" class="lines">${[1, 2, 3, 4]
        .map(() => METRICS.provenance.sampleString)
        .join('<br>')}</span>
      <div data-sample="${face.role}-prose" class="prose">${PROSE}</div>
    </div>`
    )
    .join('\n');

  const page = (stylesheet: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>contract fonts</title>
<link rel="stylesheet" href="${href}/tokens.css">
<link rel="stylesheet" href="${href}/${stylesheet}">
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${RENDERED_VIEWPORT.width}px; }
  .row { padding: 0; }
  /* Every block that is measured on its width is inline-block, so the width is
     the text's and not the container's. A block-level element would report the
     container width on both passes and pass over nothing. */
  .pinned { display: inline-block; white-space: nowrap; font-size: 16px; line-height: normal; }
  .large { display: inline-block; white-space: nowrap; font-size: ${METRICS.provenance.pixelSize}px; line-height: normal; }
  .lines { display: inline-block; font-size: 16px; line-height: normal; white-space: nowrap; }
  .prose { width: 320px; font-size: 16px; line-height: normal; }
  [data-role="display"] * { font-family: var(--f-display); font-weight: 700; }
  [data-role="body"] * { font-family: var(--f-body); font-weight: 400; }
  [data-role="mono"] * { font-family: var(--f-mono); font-weight: 400; }
</style>
</head>
<body>
${samples}
</body>
</html>
`;

  writeFileSync(join(root, 'index.html'), page('fonts.css'));

  // The probe stylesheet: the published contract with every metric override
  // stripped and nothing else changed. This is what "published without their
  // overrides" means, and the standing test below asserts the comparison
  // rejects it.
  const stripped = readFileSync(join(vendored, 'fonts.css'), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(size-adjust|ascent-override|descent-override|line-gap-override)\s*:/.test(line))
    .join('\n');
  writeFileSync(join(vendored, 'fonts-no-overrides.css'), stripped);
  writeFileSync(join(root, 'probe.html'), page('fonts-no-overrides.css'));

  return { root, vendored };
};

const serve = (root: string): Promise<Server> =>
  new Promise((done) => {
    const server = createServer((request, response) => {
      const requested = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      const target = normalize(join(root, requested === '/' ? '/index.html' : requested));
      if (!target.startsWith(root + sep) || !existsSync(target) || statSync(target).isDirectory()) {
        response.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
      response.end(readFileSync(target));
    });
    server.listen(0, '127.0.0.1', () => done(server));
  });

const geometryOf = (page: Page): Promise<Record<string, Geometry>> =>
  page.evaluate(() => {
    const found: Record<string, { width: number; height: number }> = {};
    for (const element of document.querySelectorAll<HTMLElement>('[data-sample]')) {
      const box = element.getBoundingClientRect();
      found[element.dataset.sample as string] = { width: box.width, height: box.height };
    }
    return found;
  });

/**
 * Loads `url` twice: once with every woff2 request aborted, which is what a
 * visitor sees while the face is in flight, and once with them allowed. Returns
 * both geometries plus what the browser reported about the faces.
 */
const measureSwap = async (
  page: Page,
  url: string
): Promise<{
  fallback: Record<string, Geometry>;
  face: Record<string, Geometry>;
  statuses: Map<string, number>;
  available: Record<string, boolean>;
}> => {
  await page.route('**/*.woff2', (route) => route.abort());
  const blocked = await page.goto(url, { waitUntil: 'load' });
  if (!blocked || !blocked.ok()) {
    throw new Error(`the vendored page at ${url} answered HTTP ${blocked ? blocked.status() : 'nothing'}`);
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const fallback = await geometryOf(page);
  await page.unroute('**/*.woff2');

  const statuses = new Map<string, number>();
  const record = (response: { url: () => string; status: () => number }) => {
    if (response.url().endsWith('.woff2')) statuses.set(response.url(), response.status());
  };
  page.on('response', record);

  const allowed = await page.goto(`${url}?faces=1`, { waitUntil: 'load' });
  if (!allowed || !allowed.ok()) {
    throw new Error(`the vendored page at ${url} answered HTTP ${allowed ? allowed.status() : 'nothing'}`);
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  const available = await page.evaluate(
    (families) => Object.fromEntries(families.map((family) => [family, document.fonts.check(`16px "${family}"`)])),
    FACES.faces.map((face) => face.family)
  );

  const face = await geometryOf(page);
  page.off('response', record);
  return { fallback, face, statuses, available };
};

const deltas = (
  fallback: Record<string, Geometry>,
  face: Record<string, Geometry>
): { sample: string; axis: 'width' | 'height'; before: number; after: number; share: number }[] => {
  const rows: { sample: string; axis: 'width' | 'height'; before: number; after: number; share: number }[] = [];
  for (const [sample, before] of Object.entries(fallback)) {
    const after = face[sample];
    if (!after) throw new Error(`the sample block "${sample}" is missing from the second measurement`);
    for (const axis of ['width', 'height'] as const) {
      rows.push({
        sample,
        axis,
        before: before[axis],
        after: after[axis],
        share: before[axis] === 0 ? Number.POSITIVE_INFINITY : Math.abs(after[axis] - before[axis]) / before[axis],
      });
    }
  }
  return rows;
};

const toleranceFor = (sample: string, axis: 'width' | 'height'): number => {
  if (axis === 'height') return TOLERANCE.height;
  if (sample.endsWith('-prose')) return TOLERANCE.widthContainer;
  if (sample.endsWith('-large')) return TOLERANCE.widthLarge;
  return TOLERANCE.widthSmall;
};

let tree: { root: string; vendored: string };
let server: Server;
let origin: string;

test.beforeAll(async () => {
  tree = buildTree();
  server = await serve(tree.root);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('the scratch server did not report a port');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(tree.root, { recursive: true, force: true });
});

test('resolves every face from a folder vendored at an arbitrary depth', async ({ page }) => {
  const statuses = new Map<string, number>();
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2')) statuses.set(response.url(), response.status());
  });

  const response = await page.goto(`${origin}/`, { waitUntil: 'load' });
  expect(response?.status(), 'the vendored page did not answer 200').toBe(200);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  for (const face of FACES.faces) {
    const url = `${origin}/${VENDORED_AT.join('/')}/fonts/${face.file}`;
    expect(statuses.get(url), `${face.family}: ${url} did not answer HTTP 200`).toBe(200);
  }

  const available = await page.evaluate(
    (families) => Object.fromEntries(families.map((family) => [family, document.fonts.check(`16px "${family}"`)])),
    FACES.faces.map((face) => face.family)
  );
  for (const face of FACES.faces) {
    // The check that F-2 says the computed-style read cannot make. A stack
    // reads identically when every woff2 has 404'd.
    expect(available[face.family], `${face.family} is not available to the document`).toBe(true);
  }

  // `computedStyleValue` from the Story 1-10 harness, on the same page, so the
  // declared stack is asserted as well as the loaded face. Neither covers the
  // other.
  const declared = await computedStyleValue(page, '[data-role="body"] .pinned', 'font-family');
  expect(declared).toContain('Geist');
});

test('every url() in the published contract is relative to the stylesheet itself', async () => {
  const css = readFileSync(join(tree.vendored, 'fonts.css'), 'utf8');
  const urls = [...css.matchAll(/url\(\s*"([^"]*)"\s*\)/g)].map((match) => match[1]);
  expect(urls.length, 'the published contract declares no url()').toBe(FACES.faces.length);
  for (const url of urls) {
    expect(url.startsWith('/'), `${url} begins with a slash`).toBe(false);
    expect(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url), `${url} carries a scheme`).toBe(false);
    expect(url.startsWith('./'), `${url} is not relative to fonts.css`).toBe(true);
  }
});

test('the fallback-to-face swap moves no sample block beyond the recorded tolerance', async ({ page }) => {
  const { fallback, face, statuses, available } = await measureSwap(page, `${origin}/`);

  expect([...statuses.values()], 'a face did not answer 200 on the measured load').toEqual(
    FACES.faces.map(() => 200)
  );
  for (const entry of FACES.faces) {
    expect(available[entry.family], `${entry.family} never loaded, so the comparison measured nothing`).toBe(true);
  }

  const rows = deltas(fallback, face);
  expect(rows.length, 'no sample block was measured, so this test would pass over nothing').toBe(
    FACES.faces.length * 4 * 2
  );

  const report = rows
    .map(
      (row) =>
        `${row.sample} ${row.axis}: ${row.before.toFixed(2)} -> ${row.after.toFixed(2)} ` +
        `(${(row.share * 100).toFixed(2)}%, tolerance ${(toleranceFor(row.sample, row.axis) * 100).toFixed(2)}%)`
    )
    .join('\n');
  console.log(`contract-fonts swap deltas:\n${report}`);

  for (const row of rows) {
    expect(
      row.share,
      `${row.sample} ${row.axis} moved ${(row.share * 100).toFixed(2)}% across the swap ` +
        `(${row.before.toFixed(2)} to ${row.after.toFixed(2)}). Tolerance is ` +
        `${(toleranceFor(row.sample, row.axis) * 100).toFixed(2)}%, recorded in ops/font-contract.md.`
    ).toBeLessThanOrEqual(toleranceFor(row.sample, row.axis));
  }
});

test('the same comparison rejects faces published without their overrides', async ({ page }) => {
  const { fallback, face, available } = await measureSwap(page, `${origin}/probe.html`);
  for (const entry of FACES.faces) {
    expect(available[entry.family], `${entry.family} never loaded, so the probe measured nothing`).toBe(true);
  }

  const rows = deltas(fallback, face);
  const breached = rows.filter((row) => row.share > toleranceFor(row.sample, row.axis));

  const report = breached
    .map(
      (row) =>
        `${row.sample} ${row.axis}: ${row.before.toFixed(2)} -> ${row.after.toFixed(2)} ` +
        `(${(row.share * 100).toFixed(2)}%, tolerance ${(toleranceFor(row.sample, row.axis) * 100).toFixed(2)}%)`
    )
    .join('\n');
  console.log(`contract-fonts probe breaches:\n${report || 'none'}`);

  // A gate never observed to fail is not known to work. This is the standing
  // half of that: the one-time demonstration and its output live in
  // `ops/font-contract.md`, and this keeps the suite honest after someone
  // widens a tolerance.
  expect(
    breached.length,
    'a stylesheet with every metric override stripped passed the swap comparison, so the comparison ' +
      'is not measuring what it claims to measure'
  ).toBeGreaterThan(0);
});
