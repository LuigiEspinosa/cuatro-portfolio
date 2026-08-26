import { test, expect, type Page } from '@playwright/test';
import { computedStyleValue, rootCustomPropertyValue } from './harness';
import {
  CONTRACT_FAMILIES,
  DECLARED,
  DISPLAY_FAMILY,
  HUB_DECLARED,
  WOFF2_SIGNATURE,
  compareWithControls,
  faceBlocksIn,
  firstFamily,
  type ComparisonEntry,
} from './contract-values';

/**
 * The Anchor renders the contract (Story 1-18, Anchor migration step 2).
 *
 * `tests/e2e/contract-anchor.pw.ts` proved the contract was in the stylesheet graph and that its
 * eighty-nine values arrive meaning what the contract declares, while nothing consumed them. This
 * file is the half that turns on the aliases actually painting: every one of the Hub's own
 * properties resolving to the role it was mapped onto, the ground and the copy leaving pure black
 * and pure white behind, the four `--monument-bold` call sites computing bold rather than 400, the
 * display face really loading, and every route still answering.
 *
 * **Three things this file deliberately does not do.**
 *
 *  1. It does not write a second comparator. The parsers, the canvas-guarded value comparison and
 *     the fourteen controls all come from `./contract-values`, which
 *     `tests/e2e/contract-anchor.pw.ts` uses too, so a comparator that started agreeing with
 *     everything fails in both files at once rather than in neither.
 *  2. It does not compare a colour against a hex literal typed here. The build downlevels every
 *     `oklch()` to a `#rrggbb` sRGB fallback plus a `lab()` override (recorded in
 *     `ops/anchor-token-adoption.md` under "The finding"), so a text comparison against the
 *     authored value is wrong and a text comparison against the emitted value pins a minifier.
 *     Every colour claim is canonicalised through the browser's own parser, and every one is made
 *     in **both** directions: against the role the alias points at, and against the literal the
 *     alias used to carry.
 *  3. It does not restate the mapping. Which role each property points at is pinned by
 *     `app/__tests__/anchor-contract.test.ts` against the table `DESIGN.md` section The mapping
 *     decided. Here the pairs are read out of `app/app.scss` itself, so this file measures whether
 *     the browser agrees with the file rather than whether two hand-written tables agree.
 *
 * **Why the weight is asserted at all.** `--monument-bold` maps to `--f-display` **plus**
 * `--w-black`, and a custom property carrying a family cannot carry a weight. Three of the four
 * call sites set the family alone before this story, so their computed weight was `400` both
 * before and after a family-only alias: the regression is invisible to a screenshot and to a
 * reading of the CSS, which is the whole reason this is a computed-value check. The note at
 * `tests/e2e/harness.ts:31-39` is the one this file answers.
 */

/**
 * The four routes that render HTML, and the two that do not.
 *
 * **`/cv` and `/recommendation` are 308 redirects to PDFs**, declared in `next.config.js` under
 * `redirects()`. They answer, and NFR-2's "every route still renders" covers them, but nothing in
 * the Hub's stylesheet graph paints them. Observed 2026-08-26 by following both from the built
 * Hub, and it corrects `ops/anchor-token-adoption.md` under "A second finding", which listed them
 * as the two surfaces the base `body` rule paints.
 */
const HTML_ROUTES = ['/', '/work', '/projects', '/celeste'] as const;
const PDF_ROUTES = ['/cv', '/recommendation'] as const;
const HEALTH = '/api/health';

/** A path no route matches, so `app/not-found.tsx` renders through the same root layout. */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * The one surface whose `body` is painted by the base rule rather than by an override.
 *
 * `body#work` and `body#projects` (`app/app.scss:53-55`), `body[id='']` for `/`
 * (`HomeLayout.scss:1-2`) and `#celeste` for `/celeste` (`celeste.scss:1-2`) all override the base
 * `background: var(--black-color)`, and the two remaining routes redirect to PDFs. The 404 surface
 * matches none of the three overrides, because `components/atoms/Container/Container.tsx:13-15`
 * derives `<body id>` from the stripped path, so it is the **only** place in the Hub where the
 * ground alias is observable at all. `error-page.scss:7` paints its own `#0a000f` on the error
 * container, not on `body`.
 */
const GROUND_ROUTE = NOT_FOUND;
const GROUND_STATUS = 404;

/**
 * The four live `--monument-bold` call sites, each on a route that renders it.
 *
 * `.work-hero__heading` (`WorkHero.scss:19`), `.projects-hero__heading` (`ProjectsHero.scss:19`)
 * and `.error-page__code` (`error-page.scss:24`) set the family alone before Story 1-18.
 * `.glitch-text__inner` (`glitch-text.scss:5`) carried a literal `font-weight: 700`, which became
 * `var(--w-black)` in the same commit. All four are visited, because a weight set at three of the
 * four sites is exactly the failure a single-site check cannot see.
 */
const BOLD_SITES = [
  { route: '/work', selector: '.work-hero__heading', source: 'components/organisms/WorkHero/WorkHero.scss:19' },
  { route: '/projects', selector: '.projects-hero__heading', source: 'components/organisms/ProjectsHero/ProjectsHero.scss:19' },
  { route: '/', selector: '.glitch-text__inner', source: 'components/molecules/GlitchText/glitch-text.scss:5' },
  { route: NOT_FOUND, selector: '.error-page__code', source: 'components/organisms/ErrorPage/error-page.scss:24' },
] as const;

/** The weight `--w-black` names, read from the contract rather than typed. */
const BLACK_WEIGHT = DECLARED.get('--w-black') ?? '';

/** The literals the aliased properties carried before Story 1-18, kept as negative controls. */
const RETIRED = {
  text: 'rgb(255, 255, 255)',
  ground: 'rgb(0, 0, 0)',
  secondary: '#b4b4cc',
} as const;

/** `#0a000f`, the cybercore ground on `/work` and `/projects`, which Story 2.29 owns and this story leaves. */
const WORK_GROUND = 'rgb(10, 0, 15)';

/**
 * Every `--name: var(--role)` pair `app/app.scss` declares, and the two that stay literal.
 *
 * Read from the file rather than restated. `app/__tests__/anchor-contract.test.ts` is where the
 * table itself is pinned against `DESIGN.md`; what this file adds is whether the browser resolves
 * each pair to one value.
 */
const ALIAS_PAIRS = [...HUB_DECLARED].flatMap(([alias, value]) => {
  const role = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(value)?.[1];
  return role ? [{ alias, role }] : [];
});
const LOCAL_LITERALS = [...HUB_DECLARED].filter(([, value]) => !/^var\(\s*--[A-Za-z0-9_-]+\s*\)$/.test(value));

/** Thirteen aliases and two literals, pinned, so a shortened list cannot make the loop vacuous. */
const ALIAS_COUNT = 13;
const LITERAL_COUNT = 2;

/** Navigate, require the status, and settle the web fonts before anything is read. */
const visit = async (page: Page, route: string, status = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response?.status(), `${route} did not answer ${status}`).toBe(status);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

test('app/app.scss declares thirteen aliases and two local literals', () => {
  // The list every loop below is driven by, asserted before it is used. A parse that returned
  // nothing would otherwise make this whole file green over an empty selection.
  expect(HUB_DECLARED.size, 'app/app.scss no longer declares fifteen custom properties').toBe(
    ALIAS_COUNT + LITERAL_COUNT
  );
  expect(ALIAS_PAIRS.length, 'app/app.scss no longer carries thirteen var() aliases').toBe(ALIAS_COUNT);
  expect(LOCAL_LITERALS.length, 'app/app.scss no longer carries exactly two local literals').toBe(LITERAL_COUNT);

  // Known members, spelled out, so a parser that silently returned a short list cannot satisfy
  // the loops. These four are the ones every visible claim in this file rests on.
  for (const name of ['--white-color', '--black-color', '--light-gray-color', '--monument-bold']) {
    expect(
      ALIAS_PAIRS.map((pair) => pair.alias),
      `app/app.scss no longer aliases ${name}`
    ).toContain(name);
  }
  for (const { alias, role } of ALIAS_PAIRS) {
    expect([...DECLARED.keys()], `${alias} points at ${role}, which contracts/tokens.css does not declare`).toContain(
      role
    );
    expect(role, `${alias} points at the raw palette, which AD-14 bars a consumer from reading`).not.toMatch(/^--c-[a-z]/);
  }

  expect(DISPLAY_FAMILY, 'contracts/tokens.css declares no --f-display').not.toBe('');
  expect(CONTRACT_FAMILIES, `--f-display names ${DISPLAY_FAMILY}, which contracts/fonts.css does not publish`).toContain(
    DISPLAY_FAMILY
  );
  expect(BLACK_WEIGHT, 'contracts/tokens.css no longer declares --w-black').not.toBe('');
});

test('every alias resolves on :root to the same value as the role it points at', async ({ page }) => {
  await visit(page, '/work');

  const entries: ComparisonEntry[] = [];
  for (const { alias, role } of ALIAS_PAIRS) {
    // Both reads go through the harness, which throws naming the property when it is undeclared
    // or empty. `getPropertyValue` answers an undeclared custom property with an empty string,
    // and two empty strings compare equal, so this is the difference between a measurement and a
    // pair of blanks agreeing.
    entries.push({
      name: `${alias} against ${role}`,
      declared: await rootCustomPropertyValue(page, role),
      observed: await rootCustomPropertyValue(page, alias),
    });
  }

  const compared = await compareWithControls(page, entries, 'anchor-alias :root');
  console.log(
    `anchor-alias :root resolution:\n` +
      compared.map((r) => `  ${r.name}: "${r.observed}" against "${r.declared}" -> ${r.equal} (${r.route})`).join('\n')
  );

  expect(compared.length, 'the comparator returned a different number of results than it was given').toBe(
    entries.length
  );

  const wrong = compared.filter((result) => !result.equal);
  expect(
    wrong.map(
      (result) =>
        `${result.name}: :root resolves the alias to "${result.observed}" and the role to "${result.declared}" ` +
        `(${result.route}: ${result.observedCanonical} against ${result.declaredCanonical})`
    ),
    'an alias does not resolve to the role app/app.scss points it at'
  ).toEqual([]);

  // The two local literals really did stay local: neither resolves to anything the contract
  // declares, which is the other half of the claim and the half a loop over the aliases cannot
  // make.
  for (const [name, authored] of LOCAL_LITERALS) {
    const resolved = await rootCustomPropertyValue(page, name);
    expect(resolved, `${name} no longer carries the literal app/app.scss authors`).toBe(
      authored.replace(/'/g, '"')
    );
  }
});

test('the ground and the copy leave pure black and pure white behind', async ({ page }) => {
  // The 404 surface rather than `/work`. The base `body` rule is the one that paints there, and
  // its `background: var(--black-color)` is the only place in the Hub where the ground alias is
  // observable at all. The 404 status is the status this surface is meant to answer, so it is
  // required rather than waved through.
  await visit(page, GROUND_ROUTE, GROUND_STATUS);

  const ground = await computedStyleValue(page, 'body', 'background-color');
  const copy = await computedStyleValue(page, 'body', 'color');

  const entries: ComparisonEntry[] = [
    { name: 'ground against --token-bg', declared: await rootCustomPropertyValue(page, '--token-bg'), observed: ground },
    { name: 'ground against retired pure black', declared: RETIRED.ground, observed: ground },
    { name: 'copy against --token-text', declared: await rootCustomPropertyValue(page, '--token-text'), observed: copy },
    { name: 'copy against retired pure white', declared: RETIRED.text, observed: copy },
  ];

  const onCv = new Map(
    (await compareWithControls(page, entries, `anchor-alias ${GROUND_ROUTE}`)).map((r) => [r.name, r])
  );
  console.log(
    `anchor-alias ${GROUND_ROUTE}: body background "${ground}", body color "${copy}"`
  );

  // Both directions on both properties. Against the role, so the value is the contract's; against
  // the retired literal, so a comparator that agreed with everything cannot pass.
  expect(onCv.get('ground against --token-bg')?.equal, `body on ${GROUND_ROUTE} does not compute --token-bg`).toBe(true);
  expect(
    onCv.get('ground against retired pure black')?.equal,
    `body on ${GROUND_ROUTE} still computes ${RETIRED.ground}, so the ground alias did not land`
  ).toBe(false);
  expect(onCv.get('copy against --token-text')?.equal, `body on ${GROUND_ROUTE} does not compute --token-text`).toBe(
    true
  );
  expect(
    onCv.get('copy against retired pure white')?.equal,
    `body on ${GROUND_ROUTE} still computes ${RETIRED.text}, so the copy alias did not land`
  ).toBe(false);

  // The copy claim again on `/work`, and the `/work` ground left as the `#0a000f` override it
  // still is. That literal is Story 2.29 and Story 2.34's work, and AD-20 forbids this story
  // carrying it, so the assertion is that it is **unchanged** rather than that it moved.
  await visit(page, '/work');
  const workCopy = await computedStyleValue(page, 'body', 'color');
  expect(
    await computedStyleValue(page, 'body', 'background-color'),
    'the cybercore ground on /work moved, and Story 1-18 is not the story that owns it'
  ).toBe(WORK_GROUND);

  // The secondary text role, on a real `--light-gray-color` call site rather than on `:root`.
  // `#b4b4cc` is what the Hub inherited from the cybercore rebrand and what the mapping retires.
  const secondary = await computedStyleValue(page, '.work-hero__heading', 'color');

  const onWork = new Map(
    (
      await compareWithControls(
        page,
        [
          { name: 'copy against --token-text', declared: await rootCustomPropertyValue(page, '--token-text'), observed: workCopy },
          { name: 'copy against retired pure white', declared: RETIRED.text, observed: workCopy },
          {
            name: 'secondary against --token-text-secondary',
            declared: await rootCustomPropertyValue(page, '--token-text-secondary'),
            observed: secondary,
          },
          { name: 'secondary against its retired literal', declared: RETIRED.secondary, observed: secondary },
        ],
        'anchor-alias /work'
      )
    ).map((r) => [r.name, r])
  );
  console.log(`anchor-alias /work: body color "${workCopy}", .work-hero__heading color "${secondary}"`);

  expect(onWork.get('copy against --token-text')?.equal, 'body on /work does not compute --token-text').toBe(true);
  expect(
    onWork.get('copy against retired pure white')?.equal,
    `body on /work still computes ${RETIRED.text}`
  ).toBe(false);
  expect(
    onWork.get('secondary against --token-text-secondary')?.equal,
    '.work-hero__heading does not compute --token-text-secondary'
  ).toBe(true);
  expect(
    onWork.get('secondary against its retired literal')?.equal,
    `.work-hero__heading still computes the inherited ${RETIRED.secondary}`
  ).toBe(false);
});

test('all four --monument-bold call sites compute bold in the contract display family', async ({ page }) => {
  // The alias trap. A family-only alias leaves three of these four at `400`, which no screenshot
  // and no reading of the CSS would report, so both halves are read: the family catches an alias
  // that retargeted the wrong way and the weight catches a weight never set, or set at only three
  // of the four sites.
  expect(BOLD_SITES.length, 'the four --monument-bold call sites are no longer four').toBe(4);

  const read: string[] = [];
  const wrong: string[] = [];

  for (const { route, selector, source } of BOLD_SITES) {
    // The 404 surface answers 404 by design, and that is the status this story wants it to keep.
    await visit(page, route, route === NOT_FOUND ? 404 : 200);

    const weight = await computedStyleValue(page, selector, 'font-weight');
    const family = await computedStyleValue(page, selector, 'font-family');
    read.push(`  ${route} ${selector}: font-weight ${weight}, font-family ${family} (${source})`);

    if (weight !== BLACK_WEIGHT) {
      wrong.push(
        `${source} on ${route} computes font-weight ${weight}, not --w-black (${BLACK_WEIGHT}). ` +
          `This is the alias trap firing: a family alias cannot carry the weight half of the mapping.`
      );
    }
    if (firstFamily(family) !== DISPLAY_FAMILY) {
      wrong.push(
        `${source} on ${route} asks for "${firstFamily(family)}" first, not the contract's ` +
          `display family "${DISPLAY_FAMILY}"`
      );
    }
    if (/MonumentExtended/.test(family)) {
      wrong.push(`${source} on ${route} still names the retired local face: ${family}`);
    }
  }

  console.log(`anchor-alias --monument-bold call sites:\n${read.join('\n')}`);
  expect(read.length, 'no call site was read at all').toBe(BOLD_SITES.length);
  expect(wrong, `a --monument-bold call site does not render bold in the contract's display face:\n${wrong.join('\n')}`).toEqual(
    []
  );
});

test('the contract display face is loaded rather than merely declared', async ({ page, request }) => {
  // An alias nothing renders is not an adoption. Story 1-17 recorded all three faces as
  // `unloaded`, correctly, because nothing used them. `--monument-bold` and `--monument-regular`
  // now do, so the display face must actually download.
  await visit(page, '/work');

  const faces = await page.evaluate(() =>
    [...document.fonts].map((face) => ({ family: face.family.replace(/^["']|["']$/g, ''), status: face.status }))
  );
  console.log(
    `anchor-alias document.fonts:\n` +
      faces.filter((face) => CONTRACT_FAMILIES.includes(face.family)).map((f) => `  ${f.family}: ${f.status}`).join('\n')
  );

  const display = faces.filter((face) => face.family === DISPLAY_FAMILY);
  expect(display.length, `${DISPLAY_FAMILY} never reached document.fonts on /work`).toBeGreaterThan(0);
  expect(
    display.map((face) => face.status),
    `${DISPLAY_FAMILY} is declared but still unloaded, so the alias is not rendered anywhere on /work`
  ).toContain('loaded');

  // And the bytes behind it. `document.fonts` reporting `loaded` and the URL answering a real
  // woff2 are different claims: the first is the browser's view of a face it resolved, the second
  // is what the build actually emitted and what the server actually serves.
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')].map((link) => link.href)
  );
  expect(hrefs.length, '/work linked no stylesheet, so nothing below measures the build').toBeGreaterThan(0);

  const urls: { url: string; from: string }[] = [];
  for (const href of hrefs) {
    const sheet = await request.get(href);
    expect(sheet.status(), `${href} did not answer 200`).toBe(200);
    for (const block of faceBlocksIn(await sheet.text())) {
      if (block.family !== DISPLAY_FAMILY) continue;
      for (const url of block.urls) urls.push({ url, from: href });
    }
  }

  expect(urls.length, `no @font-face for ${DISPLAY_FAMILY} appears in any stylesheet /work links`).toBeGreaterThan(0);

  const broken: string[] = [];
  for (const { url, from } of urls) {
    const absolute = new URL(url, from).toString();
    const face = await request.get(absolute);
    const body = await face.body();
    const signature = body.subarray(0, 4).toString('latin1');
    const type = (face.headers()['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    console.log(`anchor-alias face: ${face.status()} ${body.length} ${type || '(none)'} ${signature} ${absolute}`);

    if (face.status() !== 200) broken.push(`${absolute} answered HTTP ${face.status()}, not 200`);
    // A 200 with a body is what an error page is too, so the four-byte signature is what makes
    // this a check that a font arrived.
    else if (signature !== WOFF2_SIGNATURE) {
      broken.push(`${absolute} answered 200 with ${body.length} bytes beginning "${signature}", not "${WOFF2_SIGNATURE}"`);
    } else if (type !== 'font/woff2') {
      broken.push(`${absolute} was served as "${type || '(no content-type)'}", not font/woff2`);
    }
  }
  expect(broken, `the display face does not resolve from the built Hub:\n${broken.join('\n')}`).toEqual([]);
});

test('every route still answers', async ({ page, request }) => {
  // NFR-2 binds every migration step, and this is the step that changes how the site looks. A
  // route that stopped rendering is a Block If rather than a finding to note.
  expect(HTML_ROUTES.length + PDF_ROUTES.length, 'the route list is not the six AC4 names').toBe(6);

  const answered: string[] = [];
  const broken: string[] = [];

  for (const route of HTML_ROUTES) {
    const response = await page.goto(route, { waitUntil: 'load' });
    const status = response?.status();
    answered.push(`  ${route}: ${status}`);
    if (status !== 200) broken.push(`${route} answered HTTP ${status}, not 200`);
  }

  // The two PDF routes, asserted as what they are rather than as pages. `next.config.js` redirects
  // both permanently, so a `page.goto` starts a download rather than a navigation and a browser
  // check of them is a check of Chromium's download handling. What NFR-2 wants to know is that
  // they still answer, and that is a request-level question.
  for (const route of PDF_ROUTES) {
    const hop = await request.get(route, { maxRedirects: 0 });
    const followed = await request.get(route);
    const type = (followed.headers()['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    answered.push(`  ${route}: ${hop.status()} to ${hop.headers()['location']}, then ${followed.status()} ${type}`);

    if (hop.status() !== 308) broken.push(`${route} answered HTTP ${hop.status()}, not the 308 next.config.js declares`);
    if (followed.status() !== 200) broken.push(`${route} followed to HTTP ${followed.status()}, not 200`);
    if (type !== 'application/pdf') broken.push(`${route} followed to "${type || '(no content-type)'}", not a PDF`);
  }

  // The 404 surface answers 404 on purpose, and it is asserted rather than skipped: it is one of
  // the three places the base `body` rule paints, and it carries a `--monument-bold` call site.
  const missing = await page.goto(NOT_FOUND, { waitUntil: 'load' });
  answered.push(`  ${NOT_FOUND}: ${missing?.status()}`);
  if (missing?.status() !== 404) broken.push(`${NOT_FOUND} answered HTTP ${missing?.status()}, not 404`);

  const health = await request.get(HEALTH);
  answered.push(`  ${HEALTH}: ${health.status()}`);
  if (health.status() !== 200) broken.push(`${HEALTH} answered HTTP ${health.status()}, not 200`);

  console.log(`anchor-alias routes:\n${answered.join('\n')}`);
  expect(broken, `a route stopped answering, which NFR-2 makes a Block If:\n${broken.join('\n')}`).toEqual([]);

  // The documented shape, not just the status. A 200 carrying an error page is still a 200.
  const body = (await health.json()) as { status?: string; version?: string; uptime?: number };
  expect(body.status, `${HEALTH} does not answer its documented status`).toBe('ok');
  expect(typeof body.version, `${HEALTH} does not answer a version`).toBe('string');
  expect(typeof body.uptime, `${HEALTH} does not answer an uptime`).toBe('number');
});
