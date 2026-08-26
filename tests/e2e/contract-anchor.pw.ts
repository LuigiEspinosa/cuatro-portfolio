import { test, expect, type Browser, type Page } from '@playwright/test';
import { join } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue, rootCustomPropertyValue } from './harness';
import {
  BASE_MATCH,
  CONTRACTS,
  CONTRACT_FACES,
  CONTRACT_FACE_COUNT,
  CONTRACT_FAMILIES,
  DECLARED,
  DECLARED_COUNT,
  FLAT_NAMES,
  HUB_DECLARED,
  REDUCED,
  REDUCED_COUNT,
  REDUCED_MATCH,
  TYPED_ROUTES,
  WOFF2_SIGNATURE,
  compareInPage,
  compareWithControls,
  expandVars,
  expectCanvasControl,
  faceBlocksIn,
  type ComparisonEntry,
  type ComparisonResult,
} from './contract-values';

/**
 * The Anchor's stylesheet graph carries the published contract (Story 1-17, Anchor migration
 * step 1), and Story 1-18 then consumed it through the alias layer in `app/app.scss`.
 *
 * This file is the browser half of proving that the contract is really in the graph and that its
 * values arrive meaning what the contract declares. `tests/e2e/anchor-alias.pw.ts` is the browser
 * half of Story 1-18 and asserts what the aliases paint; the last case here is the narrow one this
 * file owns, which is that the four properties it probed before the alias layer landed now resolve
 * to the roles rather than to the literals they used to carry.
 *
 * Four things a unit test over the source text cannot establish, and this can:
 *
 *  1. **That the contract inlined rather than deferring.** The rule that decides it is `@use`
 *     against `@import`, not the extension: **observed 2026-08-26** against Dart Sass 1.98.0,
 *     `@use './t'` and `@use './t.css'` both inline a plain CSS file and emit identical output,
 *     a bare `@import './t'` also inlines it, and only `@import './t.css'` passes through as a
 *     runtime `@import`. `app/__tests__/anchor-contract.test.ts` pins the rule at source; this
 *     file measures the consequence, by requiring the contract's own declarations to appear in
 *     a stylesheet the page links and no `@import` to survive anywhere in one.
 *
 * The parsers and the value comparator live in `./contract-values`, which is not a spec and is
 * therefore importable. Story 1-18 moved them there so its own spec reuses this comparison rather
 * than writing a second one; two comparators would drift, and the drifted one would be the one
 * reporting green.
 *  2. **That the face URLs survive the build.** `contracts/fonts.css` carries
 *     `url("./fonts/<file>.woff2")` relative to itself. Whether Next's SCSS pipeline rewrites
 *     those correctly is a claim about a build pipeline, so it is measured: the emitted URL is
 *     fetched, and its status, its length and its `wOF2` signature are asserted.
 *     `document.fonts.check` cannot do this job, because it answers `true` for a family with no
 *     matching `@font-face` rule at all (`tests/e2e/contract-serving.pw.ts:28-35`), and a
 *     computed `font-family` read passes identically when every face has 404'd
 *     (`RESTYLE-SPEC.md:648`).
 *  3. **That the Hub's own values did not move.** Read in the browser, and compared against
 *     `app/app.scss` itself rather than against a literal restated here.
 *  4. **That the values still mean what the contract declares.** See below.
 *
 * **The compiled stylesheet is not the contract byte for byte, and this file measures the
 * difference rather than assuming it away.** Next 16's Turbopack pipeline minifies the CSS it
 * emits: `oklch(12% 0.011 288)` becomes a `#rrggbb` fallback plus a `lab()` override behind
 * `@supports (color: lab(0% 0 0))`, `120ms` becomes `.12s`, and `0.6875rem` becomes
 * `.6875rem`. Every one of those is a semantics-preserving rewrite, so the assertion below is
 * that each declared value still *means* what the contract declares, canonicalised through the
 * browser's own parser. The transform table is recorded in `ops/anchor-token-adoption.md`.
 *
 * **Comparator routes are not URL routes.** The comparator picks one of six typed routes per
 * value (colour, time, easing, length, family, number) plus a text route for anything carrying
 * an unresolvable `var()`. Every browser assertion in this file is made against one URL,
 * `/work`, except where a second browser context is opened deliberately and says why.
 */

/** The only URL any assertion in this file visits. */
const ROUTE = '/work';

/**
 * The four properties this file probed before Story 1-18, now as alias-to-role pairs.
 *
 * Story 1-17 pinned these four against the literals `app/app.scss` authored, which was the whole
 * content of "add the contract, change nothing". Story 1-18 spends that: the pins are now the
 * thing that must **not** be true, so each name is carried forward against the role it was mapped
 * onto and against the literal it used to hold, and both directions are asserted. The role is
 * named here and **valued from the running browser**, so nothing in this table is a colour typed
 * by hand.
 */
const ALIAS_PROBES = [
  { alias: '--white-color', role: '--token-text', retired: '#fff' },
  { alias: '--black-color', role: '--token-bg', retired: '#000' },
  { alias: '--accent', role: '--token-accent', retired: '#5b21b6' },
  { alias: '--monument-bold', role: '--f-display', retired: "'MonumentExtended-Bold'" },
] as const;

/**
 * Three names from three different scales, spelled out so a parser that silently returned a
 * short list cannot satisfy the loop below. `--tap` earns its place twice: it is the one
 * length in the contract authored as a physical-size guarantee.
 */
const KNOWN_MEMBERS = ['--token-bg', '--f-body', '--tap'] as const;

/** The two fluid tokens, and the width at which their middle term is the winning one. */
const FLUID_NAMES = ['--t-display', '--page-pad'] as const;

/**
 * 600 rather than the harness's 360. At 360 the `9vw` in `--t-display` is 32.4px and the `5vw`
 * in `--page-pad` is 18px, and both lose to their minimum term, so the fluid middle term is
 * inert and a rewrite of it would compare equal to anything. At 600 both middle terms win.
 */
const FLUID_VIEWPORT = { width: 600, height: 800 } as const;

/** Names only the contract declares, so finding one in a stylesheet is evidence of the inlining. */
const CONTRACT_MARKERS = ['--c-paper', '--token-scrim'] as const;

/**
 * Every runtime `@import` in `css`. Named rather than inlined, so the planted control beside the
 * assertion calls the same function the assertion calls: an absence check whose matcher stopped
 * firing reads exactly like a clean build.
 *
 * `\s*` rather than `\s+`, and the distinction is the whole value of the check. This matcher runs
 * over **minified** build output, where `@import"/x.css";` with no separating space is the ordinary
 * emission and the spaced form is the unlikely one. Requiring the space would have let the exact
 * failure this assertion exists to catch pass unseen, with both planted controls green because both
 * were written spaced. `loadsIn` in `app/__tests__/anchor-contract.test.ts` already reads `\s*` for
 * the same reason on the source side; the two halves now agree.
 */
const importsIn = (css: string): string[] => [...css.matchAll(/@import\s*[^;]+;/g)].map((found) => found[0]);

/**
 * A context matching the one `playwright.config.ts` builds, with the named overrides applied.
 *
 * Used twice, and only where the project's own settings are the thing under test: once with
 * `reducedMotion: 'no-preference'`, because the project pins `reduce` and the contract's four
 * base `--dur-*` values are otherwise never compared to anything, and once at a wider viewport,
 * because the two `clamp()` tokens are pinned to their minimum term at 360.
 */
const inContext = async <T>(
  browser: Browser,
  baseURL: string | undefined,
  overrides: { reducedMotion?: 'reduce' | 'no-preference'; viewport?: { width: number; height: number } },
  use: (page: Page) => Promise<T>
): Promise<T> => {
  if (!baseURL) throw new Error('contract-anchor: playwright.config.ts provided no baseURL, so no server was started.');
  const context = await browser.newContext({
    baseURL,
    viewport: { ...RENDERED_VIEWPORT, ...(overrides.viewport ?? {}) },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: overrides.reducedMotion ?? 'reduce',
  });
  try {
    const page = await context.newPage();
    const response = await page.goto(ROUTE, { waitUntil: 'load' });
    expect(response?.status(), `${ROUTE} did not answer 200`).toBe(200);
    return await use(page);
  } finally {
    await context.close();
  }
};

test('the token contract declares a real list of names', () => {
  // Every loop in this file is driven by this list. A parser that returned nothing, or that
  // returned two entries because the file's shape changed, would make the rest of the suite
  // green over almost nothing, so the list is asserted before it is used.
  expect(BASE_MATCH, `no :root block was parsed out of ${join(CONTRACTS, 'tokens.css')}`).not.toBeNull();
  expect(REDUCED_MATCH, 'no prefers-reduced-motion block was parsed out of contracts/tokens.css').not.toBeNull();

  // Pinned, not bounded. A removed name shortens every loop below and would otherwise pass in
  // silence, which is the one way this file can be green while the contract has lost a role.
  expect(DECLARED.size, 'contracts/tokens.css no longer declares 89 custom properties on :root').toBe(DECLARED_COUNT);
  expect(REDUCED.size, 'the reduced-motion block no longer redefines 4 values').toBe(REDUCED_COUNT);

  // The structured parse against the flat one. They truncate differently, so agreement is
  // evidence that neither did.
  expect(
    [...new Set(FLAT_NAMES)].sort(),
    'the flat and the structured parse of contracts/tokens.css disagree, so one of them truncated'
  ).toEqual([...DECLARED.keys()].sort());
  expect(FLAT_NAMES.length, 'contracts/tokens.css does not carry 93 declarations in total').toBe(
    DECLARED_COUNT + REDUCED_COUNT
  );

  for (const name of KNOWN_MEMBERS) {
    expect([...DECLARED.keys()], `contracts/tokens.css no longer declares ${name}`).toContain(name);
  }
  for (const name of FLUID_NAMES) {
    expect([...DECLARED.keys()], `contracts/tokens.css no longer declares ${name}`).toContain(name);
    expect(DECLARED.get(name), `${name} is no longer a clamp(), so the wide-viewport case measures nothing`).toMatch(
      /clamp\(/
    );
  }
  for (const [name, value] of DECLARED) {
    expect(value, `${name} parsed to an empty value`).not.toBe('');
  }
  for (const [name, value] of REDUCED) {
    expect(value, `${name} parsed to an empty value under reduced motion`).not.toBe('');
    expect([...DECLARED.keys()], `${name} is redefined under reduced motion but never declared`).toContain(name);
  }

  // The substitution the value comparison depends on, against a name the contract declares and
  // a name it does not. Without the first the semantic layer compares against the wrong side;
  // without the second an unresolvable reference would vanish rather than fail.
  expect(expandVars('var(--c-paper)')).toBe(DECLARED.get('--c-paper'));
  expect(expandVars('var(--not-a-name-in-the-contract)')).toBe('var(--not-a-name-in-the-contract)');
  expect(expandVars('44px')).toBe('44px');

  // The role-through-palette case, with the palette entry **read from the role** rather than
  // named here. Which entry `--token-bg` points at is the contract's business and a MINOR bump
  // is free to change it; that a role resolves through to whatever it points at is this story's.
  const roleTarget = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(DECLARED.get('--token-bg') ?? '');
  expect(roleTarget, '--token-bg is no longer a single var() reference, so this case measures nothing').not.toBeNull();
  expect(expandVars('var(--token-bg)')).toBe(DECLARED.get(roleTarget?.[1] ?? ''));
  expect(expandVars('var(--token-bg)'), '--token-bg still carries a var() after substitution').not.toMatch(/var\(/);

  // The Hub's own fifteen, read from `app/app.scss` so the alias expectations below are not
  // literals restated here. `app/__tests__/anchor-contract.test.ts` holds the count, the mapping
  // table and the no-collision claim; this is the part this file depends on. Sixteen before
  // Story 1-18, which deleted the one property O-11 closed.
  expect(HUB_DECLARED.size, 'app/app.scss no longer declares fifteen custom properties').toBe(15);
  for (const { alias, role } of ALIAS_PROBES) {
    expect([...HUB_DECLARED.keys()], `app/app.scss no longer declares ${alias}`).toContain(alias);
    expect([...DECLARED.keys()], `${alias} is now declared by the contract as well as by the Hub`).not.toContain(alias);
    // The alias layer, read from the file rather than assumed: each of the four really is a
    // reference to the role this file goes on to compare it against, so a probe that agreed with
    // a role the property does not point at cannot pass.
    expect([...DECLARED.keys()], `contracts/tokens.css no longer declares ${role}`).toContain(role);
    expect(HUB_DECLARED.get(alias), `app/app.scss no longer aliases ${alias} onto ${role}`).toBe(`var(${role})`);
  }

  // The font half of the contract, on the same rule as the counts above: **pinned** at three,
  // not bounded. Every face assertion in this file loops over `CONTRACT_FAMILIES`, so a contract
  // that dropped to one face would shorten all of them and stay green.
  expect(CONTRACT_FAMILIES.length, 'contracts/fonts.css no longer declares three @font-face blocks').toBe(
    CONTRACT_FACE_COUNT
  );
  expect(new Set(CONTRACT_FAMILIES).size, 'two published faces share a family name').toBe(CONTRACT_FACE_COUNT);
  for (const face of CONTRACT_FACES) {
    expect(face.family, 'a published @font-face declares no family').not.toBe('');
    expect(face.urls.length, `${face.family} declares no url()`).toBeGreaterThan(0);
  }
});

test('every custom property the token contract declares resolves on :root in the browser', async ({ page }) => {
  const response = await page.goto(ROUTE, { waitUntil: 'load' });
  expect(response?.status(), `${ROUTE} did not answer 200`).toBe(200);

  // The harness runs with `reducedMotion: 'reduce'` (`playwright.config.ts:79`), so the four
  // `--dur-*` values the contract redefines under that query are the ones that resolve here.
  // Read from the browser rather than assumed from the config, so the expectation follows the
  // context the test actually ran in. The base four are measured by the next case, in a context
  // opened for exactly that reason.
  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const expected = new Map(DECLARED);
  if (reduced) for (const [name, value] of REDUCED) expected.set(name, value);

  const entries: ComparisonEntry[] = [];
  let substituted = 0;
  for (const [name, declared] of expected) {
    const resolved = expandVars(declared, expected);
    if (resolved !== declared) substituted += 1;
    // Throws naming the property when it is absent or empty, which is the whole reason the
    // read goes through the harness rather than through `getPropertyValue` directly.
    entries.push({ name, declared: resolved, observed: await rootCustomPropertyValue(page, name) });
  }

  // The count, not just the loop. An `expected` map that shrank would otherwise pass over
  // whatever was left.
  expect(entries.length, 'fewer properties were read than the contract declares').toBe(expected.size);
  expect(entries.length).toBe(DECLARED_COUNT);

  // The substitution really ran. The contract's whole shape is a raw palette consumed only by a
  // semantic layer, so a run in which nothing was substituted is a run comparing the wrong side.
  expect(substituted, 'no declared value carried a var() reference, so the substitution did nothing').toBeGreaterThan(
    10
  );

  /**
   * Controls, run through the same comparator in the same page and in the same call. Seven
   * pairs of them, fourteen in all: one pair on each of the six typed routes and one on the
   * `text (var)` route. They live in `./contract-values` beside the comparator they probe, so
   * `tests/e2e/anchor-alias.pw.ts` runs the same fourteen rather than a second set that could
   * drift from this one.
   *
   * **Neither text route is meant to be reached by a contract value**, and the case asserts
   * below that neither is. They differ in what reaching them would mean, which is why one
   * carries a control and the other does not. `text (var)` is a **failure** route: a value
   * arrives there when the substitution did not resolve, so its control is a claim about what
   * the comparator does with the failure, and that is worth pinning. The plain `text` route is
   * unreachable rather than merely unused, since a value with no `var()` and no typed route
   * would have to be a shape CSS has no property for, so a control there would be a claim about
   * the comparator alone.
   *
   * A fifteenth control rides back from inside `compareInPage` itself: `expectCanvasControl`
   * asserts the colour route own fail-open guard fired on this call.
   */
  const compared = await compareWithControls(page, entries, 'contract-anchor');
  const wrong = compared.filter((result) => !result.equal);

  // Each of the six typed routes is exercised by at least one real token, so a route that
  // silently stopped matching would take its values to the text comparison and be caught here
  // rather than pass as an unchanged string.
  const exercised = new Set(compared.map((result) => result.route));
  for (const route of TYPED_ROUTES) {
    expect(
      [...exercised],
      `no custom property was compared through the ${route} route, so its control proves nothing`
    ).toContain(route);
  }

  // And the other direction, which the loop above cannot see. A whole scale could drop to the
  // uncontrolled string comparison while one surviving value kept its route in `exercised`. No
  // contract value belongs on either text route once `var()` has been substituted: the plain
  // one carries no control by design, and reaching `text (var)` means the substitution failed.
  expect(
    compared.filter((result) => result.route.startsWith('text')).map((result) => `${result.name} (${result.route})`),
    'a contract value fell through to a string comparison instead of a typed route, where a rewrite ' +
      'of it would read as drift and a real drift would read as a rewrite'
  ).toEqual([]);

  // Logged so `ops/anchor-token-adoption.md` can quote a run rather than assert one. Only the
  // names the pipeline rewrote, because the other forty-odd are unchanged and saying so once
  // is more use than printing them.
  const rewritten = compared.filter(
    (result) => result.equal && result.declared.replace(/\s+/g, ' ').trim() !== result.observed.replace(/\s+/g, ' ').trim()
  );
  console.log(
    `contract-anchor: ${compared.length} custom properties on :root, ${rewritten.length} rewritten by the ` +
      `build and equivalent:\n` +
      rewritten.map((r) => `  ${r.name}: "${r.declared}" -> "${r.observed}" (${r.route})`).join('\n')
  );

  expect(
    wrong.map(
      (result) =>
        `${result.name}: contracts/tokens.css declares "${expected.get(result.name)}" ` +
        `(substituted: "${result.declared}") but :root resolves "${result.observed}" ` +
        `(${result.route}: ${result.declaredCanonical} against ${result.observedCanonical})`
    ),
    'the contract reached :root carrying values it does not declare'
  ).toEqual([]);

  // The read answers about the contract rather than about everything. A name the contract does
  // not declare must throw, or the loop above proves nothing.
  await expect(rootCustomPropertyValue(page, '--a-name-the-contract-does-not-declare')).rejects.toThrow(
    /not declared on :root/
  );
});

test('the four base motion durations resolve where reduced motion is not preferred', async ({ browser, baseURL }) => {
  // `playwright.config.ts:79` pins `reducedMotion: 'reduce'` on the single project, so the case
  // above only ever compares `1ms` against `1ms` for these four and the contract's base motion
  // scale is never measured at all. This context is opened for exactly that, and closes after.
  const declared: [string, string][] = [...REDUCED.keys()].map((name) => [name, DECLARED.get(name) ?? '']);
  expect(declared.length, 'the reduced-motion block names nothing, so there is nothing to measure here').toBe(
    REDUCED_COUNT
  );

  const { entries, results, preference } = await inContext(
    browser,
    baseURL,
    { reducedMotion: 'no-preference' },
    async (page) => {
      const matched = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const read: ComparisonEntry[] = [];
      for (const [name, value] of declared) {
        read.push({ name, declared: value, observed: await rootCustomPropertyValue(page, name) });
      }
      return { entries: read, results: expectCanvasControl(await compareInPage(page, read)), preference: matched };
    }
  );

  // The context really is the other one. Without this the case could run under `reduce` and
  // compare `1ms` against `1ms` exactly as the case above already does.
  expect(preference, 'the second context still prefers reduced motion, so it measures the same thing').toBe(false);
  for (const entry of entries) {
    expect(
      entry.observed,
      `${entry.name} still resolves to the reduced-motion value, so the media query did not lift`
    ).not.toBe(REDUCED.get(entry.name));
  }

  const wrong = results.filter((result) => !result.equal);
  console.log(
    `contract-anchor base motion scale:\n` +
      results.map((r) => `  ${r.name}: "${r.declared}" -> "${r.observed}" (${r.route})`).join('\n')
  );
  expect(
    wrong.map((r) => `${r.name}: declared "${r.declared}" but :root resolves "${r.observed}"`),
    'a base motion duration reached :root carrying a value the contract does not declare'
  ).toEqual([]);
  for (const result of results) {
    expect(result.route, `${result.name} was not compared as a time`).toBe('time');
  }
});

test('the fluid tokens resolve their middle term at a width where it wins', async ({ browser, baseURL }) => {
  const declared = FLUID_NAMES.map((name) => ({ name, value: DECLARED.get(name) ?? '' }));

  const read = async (viewport: { width: number; height: number }) =>
    inContext(browser, baseURL, { viewport }, async (page) => {
      const entries: ComparisonEntry[] = [];
      for (const { name, value } of declared) {
        entries.push({ name, declared: value, observed: await rootCustomPropertyValue(page, name) });
      }
      // A control pair whose middle terms differ. At 360 both clamp to their minimum and the
      // pair is equal, which is the blind spot this case exists to close; at 600 the middle
      // terms win and the pair must be reported unequal.
      entries.push({
        name: 'control: a different fluid middle term',
        declared: 'clamp(2.25rem, 9vw, 4.5rem)',
        observed: 'clamp(2.25rem, 8vw, 4.5rem)',
      });
      return expectCanvasControl(await compareInPage(page, entries));
    });

  const atNarrow = new Map((await read(RENDERED_VIEWPORT)).map((result) => [result.name, result]));
  const atWide = new Map((await read(FLUID_VIEWPORT)).map((result) => [result.name, result]));

  for (const { name } of declared) {
    const narrow = atNarrow.get(name);
    const wide = atWide.get(name);
    expect(narrow?.equal, `${name} does not resolve to its declared value at ${RENDERED_VIEWPORT.width}px`).toBe(true);
    expect(wide?.equal, `${name} does not resolve to its declared value at ${FLUID_VIEWPORT.width}px`).toBe(true);
    expect(wide?.route, `${name} was not compared as a length`).toBe('length');

    // The middle term is live at the wider width. Without this the wide reading could be the
    // same clamped minimum and the case would add nothing.
    expect(
      wide?.declaredCanonical,
      `${name} canonicalises to ${wide?.declaredCanonical} at both widths, so its fluid middle term ` +
        `is inert and a rewrite of it would compare equal`
    ).not.toBe(narrow?.declaredCanonical);
  }

  const control = 'control: a different fluid middle term';
  console.log(
    `contract-anchor fluid tokens:\n` +
      [...declared.map(({ name }) => name), control]
        .map(
          (name) =>
            `  ${name}: ${RENDERED_VIEWPORT.width}px ${atNarrow.get(name)?.declaredCanonical} against ` +
            `${atNarrow.get(name)?.observedCanonical}, ${FLUID_VIEWPORT.width}px ` +
            `${atWide.get(name)?.declaredCanonical} against ${atWide.get(name)?.observedCanonical}`
        )
        .join('\n')
  );

  expect(
    atNarrow.get(control)?.equal,
    'two clamp() values with different middle terms already differ at 360px, so the wide reading below ' +
      'is not measuring the middle term'
  ).toBe(true);
  expect(
    atWide.get(control)?.equal,
    `two clamp() values with different middle terms compare equal at ${FLUID_VIEWPORT.width}px, so the ` +
      `comparator is not reading the middle term there either`
  ).toBe(false);
});

test('the compiled stylesheet carries the contract faces and every face URL answers 200', async ({ page, request }) => {
  const response = await page.goto(ROUTE, { waitUntil: 'load' });
  expect(response?.status(), `${ROUTE} did not answer 200`).toBe(200);

  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')].map((link) => link.href)
  );
  expect(hrefs.length, `${ROUTE} linked no stylesheet at all, so nothing below is measuring the build`).toBeGreaterThan(
    0
  );

  // A runtime `@import` is the failure mode `@use` exists to avoid: the contract would be
  // fetched by the browser from a URL nothing in this repository emits. Asserted over the
  // stylesheets the page actually links, not over the source.
  const found: { family: string; url: string; from: string }[] = [];
  const imports: string[] = [];
  const markers = new Map<string, string[]>();

  for (const href of hrefs) {
    const sheet = await request.get(href);
    expect(sheet.status(), `${href} did not answer 200`).toBe(200);
    const css = await sheet.text();

    for (const raw of importsIn(css)) imports.push(`${href}: ${raw}`);

    // The token half, inlined. The value comparison reads computed styles, which would pass
    // whatever route the names arrived by; this is the evidence that they arrived in a
    // stylesheet the page links, from the contract, as text.
    for (const marker of CONTRACT_MARKERS) {
      if (css.includes(`${marker}:`)) markers.set(marker, [...(markers.get(marker) ?? []), href]);
    }

    for (const block of faceBlocksIn(css)) {
      if (!CONTRACT_FAMILIES.includes(block.family)) continue;
      for (const url of block.urls) found.push({ family: block.family, url, from: href });
    }
  }

  // The matcher, on planted positive controls, before the empty result is read as good news.
  // The unspaced form is listed first because it is the one minified output actually emits, and
  // because the matcher used to require the space and so could not see it.
  expect(
    importsIn('@font-face{}@import url("/x.css");.a{color:red}'),
    'the @import matcher no longer fires, so the empty result below means nothing'
  ).toEqual(['@import url("/x.css");']);
  expect(
    importsIn('.a{color:red}@import"/x.css";.b{color:blue}').length,
    'the @import matcher missed the unspaced form a minifier emits, which is the form most likely to appear'
  ).toBe(1);
  expect(importsIn(`@import'/x.css';`).length, 'the @import matcher missed the unspaced single-quoted form').toBe(1);
  expect(importsIn(`@import '../../contracts/tokens.css';`).length, 'the @import matcher missed a quoted form').toBe(1);

  expect(imports, 'the compiled stylesheet leaves an @import for the browser to resolve').toEqual([]);

  for (const marker of CONTRACT_MARKERS) {
    const carrying = markers.get(marker) ?? [];
    expect(
      carrying.length,
      `${marker} is declared only by contracts/tokens.css and appears in no stylesheet ${ROUTE} links ` +
        `(${hrefs.join(', ')}). The token contract is not inlined into the build.`
    ).toBeGreaterThan(0);
    // Pinned at one, on the same rule as every other count in this story. Two stylesheets both
    // carrying the contract would mean the 89 declarations and the three `@font-face` blocks ship
    // twice, which is a payload defect the "is it inlined at all" check above cannot see.
    expect(
      carrying,
      `${marker} appears in more than one stylesheet ${ROUTE} links, so the contract is inlined twice`
    ).toHaveLength(1);
  }

  // "Not wired" and "wired and broken" are different findings and are reported as such. A
  // stylesheet carrying no contract face at all means the Sass load did not land, and saying
  // "a font URL 404'd" about that would send the next reader to the wrong place.
  expect(
    found.length,
    `no @font-face for any of ${CONTRACT_FAMILIES.join(', ')} appears in any stylesheet ${ROUTE} links ` +
      `(${hrefs.join(', ')}). The contract is not wired into the stylesheet graph.`
  ).toBeGreaterThan(0);

  for (const family of CONTRACT_FAMILIES) {
    expect(
      found.map((entry) => entry.family),
      `${family} is declared in contracts/fonts.css but appears in no stylesheet ${ROUTE} links`
    ).toContain(family);
  }

  const observed: string[] = [];
  const broken: string[] = [];

  for (const entry of found) {
    const absolute = new URL(entry.url, entry.from).toString();
    const face = await request.get(absolute);
    const body = await face.body();
    const signature = body.subarray(0, 4).toString('latin1');
    const type = (face.headers()['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    observed.push(`${face.status()} ${body.length} ${type || '(none)'} ${signature} ${entry.family} ${absolute}`);

    if (face.status() !== 200) broken.push(`${entry.family}: ${absolute} answered HTTP ${face.status()}, not 200`);
    else if (body.length === 0) broken.push(`${entry.family}: ${absolute} answered 200 with a zero-length body`);
    // A 200 with a body is what an error page is too. The four-byte signature is what makes
    // this a check that a font arrived, which is the whole stated reason the check exists.
    else if (signature !== WOFF2_SIGNATURE) {
      broken.push(
        `${entry.family}: ${absolute} answered 200 with ${body.length} bytes beginning "${signature}", ` +
          `not "${WOFF2_SIGNATURE}", so what was served is not a woff2`
      );
    } else if (type !== 'font/woff2') {
      broken.push(`${entry.family}: ${absolute} was served as "${type || '(no content-type)'}", not font/woff2`);
    }
  }

  console.log(`contract-anchor face requests:\n${observed.join('\n')}`);

  expect(broken, `a contract face does not resolve from the built Hub:\n${broken.join('\n')}`).toEqual([]);

  // Reaching the document's font set is a different claim from appearing in a stylesheet the
  // page fetched, and both are asserted because neither covers the other: text found in a
  // response body proves the bytes arrived, and `document.fonts` proves the browser parsed
  // them into real `@font-face` rules on this page.
  //
  // **Not `document.fonts.check`.** Nothing in the Hub sets a contract family on anything, so
  // an unused face is never downloaded and `check` correctly answers `false`. That absence is
  // this story's whole point rather than a defect, so the check here is declaration and the
  // load status is logged rather than asserted. `tests/e2e/contract-serving.pw.ts` is where
  // availability is asserted, on a fixture that actually uses the families, and at each face's
  // own weight, because `Bricolage Grotesque` publishes `font-weight: 700 800` and a bare
  // `16px "Bricolage Grotesque"` asks about a weight no published face declares.
  const declaredToDocument = await page.evaluate(() =>
    [...document.fonts].map((face) => ({ family: face.family.replace(/^["']|["']$/g, ''), status: face.status }))
  );
  console.log(
    `contract-anchor faces in document.fonts:\n` +
      declaredToDocument
        .filter((face) => CONTRACT_FAMILIES.includes(face.family))
        .map((face) => `  ${face.family}: ${face.status}`)
        .join('\n')
  );
  for (const family of CONTRACT_FAMILIES) {
    expect(
      declaredToDocument.map((face) => face.family),
      `${family} is in a stylesheet ${ROUTE} links but never reached document.fonts`
    ).toContain(family);
  }
});

test('the Hub renders the roles it was aliased onto, not the values it rendered before', async ({ page }) => {
  const onWork = await page.goto(ROUTE, { waitUntil: 'load' });
  expect(onWork?.status(), `${ROUTE} did not answer 200`).toBe(200);

  // **This case is the inversion of Story 1-17's, not a new one.** It used to pin
  // `rgb(255, 255, 255)`, `rgb(0, 0, 0)` and `'MonumentExtended-Bold'` and assert nothing had
  // moved. Story 1-18 spends exactly that claim, so the old pins are now the values that must
  // **not** be read, and each one is asserted in both directions: against the role the alias
  // points at, and against the literal it used to carry. A comparator that silently agreed with
  // everything would fail the second direction.
  //
  // `body#work` (`app/app.scss:53-55`) still paints its own `#0a000f` over
  // `background: var(--black-color)` at a higher specificity, and that hardcoded value **stays**:
  // it is Story 2.29 and Story 2.34's work, not this story's. So the ground on this route is
  // unmoved and the copy colour on it is not.
  expect(await computedStyleValue(page, 'body', 'background-color')).toBe('rgb(10, 0, 15)');
  const bodyColour = await computedStyleValue(page, 'body', 'color');
  expect(bodyColour, 'body still computes pure white, so the alias layer did not land').not.toBe(
    'rgb(255, 255, 255)'
  );

  // The Hub's aliases against the roles they point at, read side by side off the same `:root` in
  // the same page. Nothing here is a colour typed by hand: the expectation is whatever the
  // contract resolves the role to, and the retired literal is the negative beside it.
  const entries: ComparisonEntry[] = [];
  for (const { alias, role, retired } of ALIAS_PROBES) {
    const observed = await rootCustomPropertyValue(page, alias);
    entries.push({ name: `${alias} against ${role}`, declared: await rootCustomPropertyValue(page, role), observed });
    entries.push({ name: `${alias} against its retired ${retired}`, declared: retired, observed });
  }
  entries.push({ name: 'body colour against --token-text', declared: await rootCustomPropertyValue(page, '--token-text'), observed: bodyColour });

  const compared = await compareWithControls(page, entries, 'contract-anchor alias probes');
  const byName = new Map(compared.map((result) => [result.name, result]));
  console.log(
    `contract-anchor alias probes:\n` +
      compared.map((r) => `  ${r.name}: "${r.declared}" against "${r.observed}" -> ${r.equal} (${r.route})`).join('\n')
  );

  const drift: string[] = [];
  for (const { alias, role, retired } of ALIAS_PROBES) {
    const onRole = byName.get(`${alias} against ${role}`);
    const onRetired = byName.get(`${alias} against its retired ${retired}`);
    if (!onRole?.equal) {
      drift.push(
        `${alias} does not resolve to ${role}: :root answers "${onRole?.observed}" where ${role} is ` +
          `"${onRole?.declared}" (${onRole?.route}: ${onRole?.declaredCanonical} against ${onRole?.observedCanonical})`
      );
    }
    if (onRetired?.equal) {
      drift.push(`${alias} still resolves to its retired value ${retired}, so the alias layer did not land`);
    }
  }
  const onBody = byName.get('body colour against --token-text');
  if (!onBody?.equal) {
    drift.push(`body computes "${onBody?.observed}" where --token-text is "${onBody?.declared}"`);
  }
  expect(drift, `the alias layer does not resolve to the contract:\n${drift.join('\n')}`).toEqual([]);

  // Every entry above really was compared, rather than quietly dropped by a comparator that
  // returned a shorter list than it was handed.
  expect(compared.length, 'the comparator returned a different number of results than it was given').toBe(
    entries.length
  );

  // None of the Hub's fifteen is a contract name, which is what lets the alias layer reference
  // the roles without shadowing them. `app/__tests__/anchor-contract.test.ts` is the
  // authoritative check with both counts pinned; this asserts the same thing where the values
  // were just read, so neither half can drift alone.
  const collisions = [...HUB_DECLARED.keys()].filter((name) => DECLARED.has(name));
  expect(collisions, `the contract and app/app.scss declare the same custom property`).toEqual([]);
  expect([...HUB_DECLARED.keys(), '--tap'].filter((name) => DECLARED.has(name))).toEqual(['--tap']);
});
