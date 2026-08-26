import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/**
 * The published surface served over HTTP (Story 1-16, AD-1, AD-4).
 *
 * This spec runs against the harness's own server, which
 * `playwright.config.ts` starts with `pnpm build && pnpm start`. The publish
 * step is the first half of `build`, so the tree under test is the one a deploy
 * ships rather than a scratch copy this file assembled: `docker/Dockerfile`
 * runs the same `pnpm build` in its builder stage and copies `public` into the
 * runner stage, which `docker/__tests__/runner-stage.test.ts` holds.
 *
 * Two things a unit test over the copied files cannot establish, and this can:
 *
 *  1. **What the running server actually sends.** The content type is read off
 *     the response rather than assumed from the extension. AD-1's whole claim
 *     is that a consumer in any estate language gets the contract with an HTTP
 *     GET and a parser, and a stylesheet served as `application/octet-stream`
 *     satisfies the file-list check and fails that claim.
 *  2. **That the relative `url()` paths resolve against the served location.**
 *     `contracts/fonts.css` carries `url("./fonts/<file>.woff2")`, which is
 *     what lets a vendored folder resolve at any depth. Served at
 *     `/contracts/fonts.css` those must resolve to
 *     `/contracts/fonts/<file>.woff2`.
 *
 * **Why the face check is an HTTP status and not a computed style.** A stack
 * reads identically when every face has 404'd, which is the trap
 * `tests/e2e/contract-fonts.pw.ts` records against `RESTYLE-SPEC.md:648` (F-2).
 * `document.fonts.check` has the mirror-image weakness: it answers `true` for a
 * family with no matching `@font-face` rule at all, because an unmatched family
 * resolves to a system font the browser considers available. Neither covers the
 * other, so the assertion is the status of each face request by URL, plus
 * availability per family.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to
// CommonJS and the repository declares no `"type": "module"`, so `import.meta`
// is a syntax error at run time here even though TypeScript accepts it.
const REPO_ROOT = resolve(__dirname, '..', '..');

/** The one authored location. The served tree is compared against this, never the other way round. */
const CONTRACTS = join(REPO_ROOT, 'contracts');

/**
 * The public path `packages/contracts-serve/publish.mjs` publishes to, spelled
 * exactly as that module exports it, trailing slash included. A case in
 * `packages/contracts-serve/__tests__/contracts-serve.test.ts` pins this
 * literal equal to the module's own `SERVED_AT`, so the one path the module's
 * `SURFACE` comment argues must be derived once cannot come to be spelled two
 * ways across the two suites that assert it.
 */
const SERVED_AT = '/contracts/';

const FACES = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', 'fonts', 'faces.json'), 'utf8')) as {
  faces: { family: string; role: string; file: string; axisLimits: { wght: number | [number, number] } }[];
};

/**
 * The content type each extension in the published surface must be served as,
 * **observed** on 2026-08-26 against Next 16.2.1 and recorded in
 * `ops/contract-serving.md`. Next resolves these itself and no `headers()`
 * entry in `next.config.js` was needed, so this table is what makes the absence
 * of that entry a checked fact rather than a lucky default: a Next version that
 * started serving a stylesheet as `application/octet-stream` fails here.
 *
 * `.json` is listed before anything publishes one. `contracts/registry.json`
 * arrives in Story 2-5 (AD-4), and without the row the first case would fail
 * with "carries an extension this spec has no expected type for", which is the
 * right failure for an unknown format and the wrong one for the file this whole
 * mechanism exists to serve.
 *
 * Compared on the essence, so the `; charset=UTF-8` parameter Next appends to
 * the text types is not pinned as a value this story decided.
 */
const EXPECTED_TYPE: Record<string, string> = {
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

/** Latin, so it is inside the `unicode-range` every published face declares. */
const SAMPLE = 'The quick brown fox jumps over the lazy dog 0123456789';

/** Every file under `contracts/`, as sorted relative paths with forward slashes. */
const surfaceFiles = (directory: string, prefix = '', found: string[] = []): string[] => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) surfaceFiles(join(directory, entry.name), `${prefix}${entry.name}/`, found);
    else if (entry.isFile()) found.push(`${prefix}${entry.name}`);
  }
  found.sort();
  return found;
};

const PUBLISHED = surfaceFiles(CONTRACTS);

/** The distinct woff2 files the published faces name. Two faces may share one binary. */
const FACE_FILES = [...new Set(FACES.faces.map((face) => face.file))];

/** The type parameters stripped, lowercased, so `text/css; charset=UTF-8` compares as `text/css`. */
const essence = (contentType: string | undefined): string => (contentType ?? '').split(';')[0].trim().toLowerCase();

/**
 * The weight the fixture sets on a face, and the weight its availability is
 * then queried at. Refuses rather than emitting `font-weight: undefined`, which
 * the browser drops back to 400 and which would make the query below ask about
 * a weight no published face declares.
 */
const weightOf = (face: { family: string; axisLimits: { wght: number | [number, number] } }): number => {
  const limit = face.axisLimits?.wght;
  const weight = Array.isArray(limit) ? limit[0] : limit;
  if (typeof weight !== 'number' || !Number.isFinite(weight)) {
    throw new Error(
      `contract-serving: packages/fonts/faces.json declares no numeric wght for "${face.family}" ` +
        `(${JSON.stringify(limit)}), so the fixture cannot set a weight the published face declares.`
    );
  }
  return weight;
};

/**
 * The harness's own origin. Guarded, because an undefined `baseURL` would send
 * every request below to `undefined/contracts/...` and the failure would read
 * as a serving defect rather than as a harness that started no server.
 */
const originFrom = (baseURL: string | undefined): string => {
  if (!baseURL) {
    throw new Error(
      'contract-serving: playwright.config.ts provided no baseURL, so no server was started and nothing ' +
        'below is measuring the published surface.'
    );
  }
  return baseURL.replace(/\/+$/, '');
};

test('the published surface and the face list are both non-empty, so every case below measures something', () => {
  // A surface that failed to enumerate would make every loop in this file pass
  // over zero paths, which is the one way this spec can be green while
  // /contracts/ serves nothing at all.
  expect(PUBLISHED.length, `no files were found under ${CONTRACTS}`).toBeGreaterThan(0);
  expect(FACES.faces.length, 'packages/fonts/faces.json declares no faces').toBeGreaterThan(0);
  expect(FACE_FILES.length, 'the published faces name no woff2 file').toBeGreaterThan(0);
  for (const file of PUBLISHED) {
    expect(EXPECTED_TYPE[extname(file)], `${file} carries an extension this spec has no expected type for`).toBeTruthy();
  }
  for (const face of FACES.faces) expect(() => weightOf(face), `${face.family}`).not.toThrow();
});

test('every published file answers 200 at /contracts/ with its recorded content type', async ({ request, baseURL }) => {
  const origin = originFrom(baseURL);
  const observed: string[] = [];
  const wrong: string[] = [];

  for (const file of PUBLISHED) {
    const path = `${SERVED_AT}${file}`;
    const response = await request.get(`${origin}${path}`);
    const status = response.status();
    const contentType = response.headers()['content-type'];
    observed.push(`${status} ${essence(contentType) || '(none)'} ${path}`);

    if (status !== 200) {
      wrong.push(`${path} answered HTTP ${status}, not 200`);
      continue;
    }

    const expected = EXPECTED_TYPE[extname(file)];
    if (essence(contentType) !== expected) {
      wrong.push(`${path} was served as "${contentType ?? '(no content-type)'}", not ${expected}`);
    }

    // The bytes as well as the status. A served copy that is truncated, or that
    // is a stale copy of an earlier build, answers 200 with the right type and
    // hands a consumer a contract nobody published.
    const body = await response.body();
    if (!body.equals(readFileSync(join(CONTRACTS, ...file.split('/'))))) {
      wrong.push(`${path} was served ${body.length} bytes that are not the authored file's`);
    }
  }

  // Logged so `ops/contract-serving.md` can quote a run rather than assert one.
  console.log(`contract-serving observed (${observed.length} paths):\n${observed.join('\n')}`);

  expect(wrong, `the served published surface is wrong at:\n${wrong.join('\n')}`).toEqual([]);
});

test('the relative url() paths resolve against the served location and every face loads', async ({ page, baseURL }) => {
  const origin = originFrom(baseURL);

  // A same-origin fixture. It is fulfilled by the harness rather than written
  // into `public/`, deliberately: nothing under `public/` may hold an authored
  // file this story added, and a fixture written there during a run would be a
  // file in the served tree that no publish produced. What the check needs from
  // it is the document origin, because that is what `/contracts/fonts.css` and
  // in turn `./fonts/<file>.woff2` resolve against. Every request the page then
  // makes for the stylesheet and for the faces goes to the real server.
  const fixture = `${origin}/__contract-serving-fixture`;
  const samples = FACES.faces
    .map(
      (face) =>
        `<div class="sample" style="font-family: '${face.family}'; font-weight: ${weightOf(face)}">${SAMPLE}</div>`
    )
    .join('\n');

  await page.route(fixture, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>contract serving fixture</title>
<link rel="stylesheet" href="${SERVED_AT}fonts.css">
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  .sample { display: inline-block; font-size: 32px; line-height: normal; }
</style>
</head>
<body>
${samples}
</body>
</html>
`,
    })
  );

  // Every response, not only the ones that answered 200, so a face that 404'd
  // is reported by URL rather than showing up as an absent key.
  const requested = new Map<string, number>();
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2')) requested.set(response.url(), response.status());
  });

  const loaded = await page.goto(fixture, { waitUntil: 'load' });
  expect(loaded?.status(), 'the same-origin fixture did not load').toBe(200);

  // The stylesheet itself has to have arrived, or the faces were never declared
  // and the assertions below would be measuring an empty document.
  const stylesheet = await page.evaluate((at) => {
    const sheet = [...document.styleSheets].find((candidate) => (candidate.href ?? '').endsWith(`${at}fonts.css`));
    if (!sheet) return null;
    try {
      return [...sheet.cssRules].filter((rule) => rule instanceof CSSFontFaceRule).length;
    } catch {
      // A cross-origin stylesheet throws here. It cannot be one, and saying so
      // is more use than reporting zero rules.
      return -1;
    }
  }, SERVED_AT);
  expect(stylesheet, `${SERVED_AT}fonts.css did not reach the document as a readable stylesheet`).toBe(
    FACES.faces.length
  );

  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  console.log(
    `contract-serving face requests:\n${[...requested].map(([url, status]) => `${status} ${url}`).join('\n')}`
  );

  for (const file of FACE_FILES) {
    // The URL is asserted, not merely the status of whatever was fetched. A
    // face request that went to `/fonts/<file>.woff2` at the document root
    // would mean the relative `url()` had resolved against the wrong location,
    // and on this server that path exists for other files.
    const url = `${origin}${SERVED_AT}fonts/${file}`;
    expect(
      requested.get(url),
      `${url} was not requested, or did not answer 200. Requested: ` +
        `${[...requested.keys()].join(', ') || 'nothing'}`
    ).toBe(200);
  }

  // Against the number of distinct binaries, not the number of faces: two faces
  // sharing one woff2 would fail a run in which everything was served correctly.
  expect(requested.size, 'no woff2 was requested at all, so the loop above passed over nothing').toBe(
    FACE_FILES.length
  );

  // Queried at the weight the fixture sets, not at CSS's default 400.
  // `Bricolage Grotesque` publishes `font-weight: 700 800` and `Geist`
  // publishes `300 600`, so a bare `16px "family"` asks about a weight no
  // published face declares and passes only through font-matching fallback.
  const available = await page.evaluate(
    (queries) => Object.fromEntries(queries.map(([family, font]) => [family, document.fonts.check(font)])),
    FACES.faces.map((face) => [face.family, `${weightOf(face)} 16px "${face.family}"`] as [string, string])
  );
  for (const face of FACES.faces) {
    expect(
      available[face.family],
      `${face.family} is not available to the document at weight ${weightOf(face)}`
    ).toBe(true);
  }
});
