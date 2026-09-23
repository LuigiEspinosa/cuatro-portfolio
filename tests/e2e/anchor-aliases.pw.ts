import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue, rootCustomPropertyValue } from './harness';

/**
 * The alias layer, measured in a real browser (Story 1-18, Anchor migration step 2).
 *
 * `app/app.scss` redefines thirteen of the Hub's fourteen custom properties as `var()` references
 * to token roles, and the fifteen component stylesheets go on reading the old names. That is a
 * claim about what the Hub *resolves*, and almost none of it is visible to a screenshot:
 *
 *  1. **An alias that resolves to the wrong role** paints a plausible violet either way.
 *  2. **`--accent-dim` doing two jobs.** It is ornament at ten of its twelve call sites and
 *     a boundary a person reads state from at the other two, so a single global alias drops the
 *     boundary uses below the 3:1 floor AD-19 asserts while looking entirely reasonable. Each of
 *     the twelve is read on its real element here, for the property that call site declares.
 *  3. **The alias trap.** `--monument-bold` baked its weight into the family name
 *     `MonumentExtended-Bold`. A family alias cannot carry that, so `font-weight` is set by hand
 *     beside `font-family` at the four call sites **in the same commit**, and only then read.
 *     Read against a tree where the weight was not set, the weight assertion is green and
 *     meaningless (`tests/e2e/harness.ts`, and `ops/rendered-output-harness.md` § "The finding
 *     Story 1-18 inherits").
 *  4. **The base `body` rule.** `/work` never shows it, because `body#work` overrides it. Nor
 *     does `/cv`, which `next.config.js` redirects to a PDF, which is a correction to what
 *     `ops/anchor-token-adoption.md` § "A second finding" concluded by reading stylesheets
 *     rather than by rendering. The 404 surface does, and that is where the body ground and body
 *     copy are read.
 *
 * **Since 2026-09-23 the second and third have nothing left to read, and the fourth has company.**
 * Story 2-33 rebuilt `WorkHero.scss`, whose section divider was the last `--accent-dim` call site and
 * whose heading the last `--monument-bold` one, and deleted `body#work`, so `/work` paints the base
 * rule too. Both call-site tables and their per-site cases left with their last rows; both aliases are
 * pinned at zero call sites below, in the shape `--monument-regular` and `--confillia-normal` already
 * had, and `app/__tests__/anchor-contract.test.ts` holds every stylesheet but `app/app.scss` to reading
 * none of the Hub's fourteen properties (FR-37). What is still measured here is the layer itself: every
 * alias resolves to its role, the one literal holds, and the base rule's ground and copy are the roles.
 *
 * **Nothing here is restated.** The alias map is parsed out of `app/app.scss`, the roles are read
 * back in the same page, and every expected colour is put through a probe element rather than
 * written down as a literal, because a computed colour and a custom property's token stream do
 * not serialise the same way.
 *
 * Every predicate this file introduces is shown firing on a planted control, and every parsed
 * list is asserted non-empty and carrying a known member, so a case cannot pass over nothing.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to CommonJS and the
// repository declares no `"type": "module"`, so `import.meta` is a syntax error at run time here
// even though TypeScript accepts it. Same as `tests/e2e/contract-anchor.pw.ts`.
const REPO_ROOT = resolve(__dirname, '..', '..');

const APP_SCSS = readFileSync(join(REPO_ROOT, 'app', 'app.scss'), 'utf8');
const TOKENS_CSS = readFileSync(join(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');

/**
 * Every component stylesheet on disk, by basename, with its contents.
 *
 * **The call-site tables below were pinned against themselves**, comparing their own length to a
 * literal declared beside them and reading no stylesheet at all. A sixteenth `var(--accent-dim)`
 * call site, or a fifth `var(--monument-bold)` one, was invisible to every check in this story: it
 * would silently take the ornament role, or lose its weight, with the whole suite green. This is
 * what makes the count a measurement of the tree rather than of the table.
 */
const COMPONENT_STYLESHEETS = ((): Map<string, string> => {
  const found = new Map<string, string>();
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(path);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.scss')) {
        // **Keyed by basename, so a repeat would overwrite rather than add.** The table rows are
        // written `basename.scss:line` and are compared against these keys, so the key has to be
        // the basename. A second stylesheet with the same name in another directory would drop
        // one file's call sites out of the count with nothing failing, which is the hole this
        // whole map exists to close, so the collision is refused rather than resolved.
        if (found.has(entry.name)) {
          throw new Error(
            `two component stylesheets are named ${entry.name}. The call-site counts below are keyed ` +
              `by basename, so one of them would be counted and the other silently dropped`
          );
        }
        found.set(entry.name, readFileSync(path, 'utf8'));
      }
    }
  };
  walk(join(REPO_ROOT, 'components'));
  return found;
})();

/**
 * How many times `name` is read as `var(--name)`, per stylesheet basename, over the whole file.
 *
 * Raw text, comments included, which is the same method the recorded count used
 * (`git grep -o -- "var(--accent-dim)" -- components`) and the same rule Story 1-17 set for the
 * consumer scan: a call site inside a comment is a call site waiting to be uncommented.
 *
 * **The fallback form counts too.** `var(--accent-dim, #fff)` reads the property exactly as the
 * bare form does, so a call site authored that way is a call site. Matching only the bare form
 * would let one escape the table and take the `:root` ornament role in silence, which is the
 * failure this counter exists to make loud. The name is still bounded, so `--accent-dimmer` does
 * not match.
 */
const callSitesOf = (name: string, sources: Map<string, string> = COMPONENT_STYLESHEETS): Map<string, number> => {
  const pattern = new RegExp(`var\\(\\s*${name}\\s*[,)]`, 'g');
  const counted = new Map<string, number>();
  for (const [file, source] of sources) {
    const hits = source.match(pattern)?.length ?? 0;
    if (hits > 0) counted.set(file, hits);
  }
  return counted;
};

const sortedEntries = (counted: Map<string, number>): [string, number][] =>
  [...counted].sort(([a], [b]) => a.localeCompare(b));

/**
 * Every route the Hub serves. NFR-2 binds every migration step, so all five are swept.
 *
 * **Seven until 2026-09-07.** Story 2-14 replaced `/projects` with a 301 to `/#suite`, so the
 * route no longer answers a document of its own: left in this list it would land on `/`, fail the
 * redirect pin at the end of this file, which named exactly the PDF routes, and duplicate what
 * `tests/e2e/projects-redirect.pw.ts` asserts far more precisely.
 *
 * **Six until 2026-09-11.** Story 2-17 retired `/recommendation`, the last route in this list that
 * redirected: it answers 404 now, which the sweep below refuses, and its retirement is asserted in
 * `tests/e2e/secondary-surfaces.pw.ts`. The redirect pin at the end of this file reads empty.
 */
const ROUTES = ['/', '/cv', '/work', '/celeste', '/api/health'] as const;

/**
 * A path the Hub does not route, which renders `app/not-found.tsx` through the same root layout
 * and the same `Body`, and the surface the base rule's ground and copy are read on below. It carried
 * an `--accent-dim` and a `--monument-bold` call site of its own until Story 2-30 rebuilt the 404 on
 * 2026-09-23, and no route carries either since Story 2-33 later the same day.
 */
const NOT_FOUND = '/a-route-that-does-not-exist';

/**
 * The Hub declares fourteen custom properties: thirteen aliased onto roles, one left as a literal.
 *
 * **Sixteen, twelve and four until 2026-09-12.** Story 2-20 retargeted `--confillia-normal` onto
 * the display role and deleted `--confillia-bold`, which had zero call sites. The same three
 * counts moved in `app/__tests__/anchor-contract.test.ts` in the same commit. **Fifteen and two
 * until 2026-09-23.** Story 2-34 deleted `--accent-glow`, a colour literal with zero call sites that
 * the FR-17 conformance gate refuses outside `contracts/`, and the same counts moved in
 * `app/__tests__/anchor-contract.test.ts` and `tests/e2e/contract-anchor.pw.ts`.
 */
const HUB_PROPERTY_COUNT = 14;
const ALIASED_COUNT = 13;
const LITERAL_COUNT = 1;

/** The one this story must not move, and the reason that holds it. */
const LITERAL_PROPERTIES = ['--hero-height'] as const;

/**
 * None of them is a colour since Story 2-34 deleted `--accent-glow`, the one that was, so none takes
 * the colour route below; a colour literal written back here would fail the FR-17 gate as well.
 */
const LITERAL_COLOUR_COUNT = 0;

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');

/** The `--name: value` pairs in one declaration block, in source order. */
const declarationsIn = (block: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const raw of block.split(';')) {
    const at = raw.indexOf(':');
    if (at === -1) continue;
    const name = raw.slice(0, at).trim();
    if (!name.startsWith('--')) continue;
    found.set(name, raw.slice(at + 1).trim());
  }
  return found;
};

/** The Hub's fourteen, as `app/app.scss` authors them. */
const HUB = declarationsIn(/:root\s*\{([^}]*)\}/.exec(withoutComments(APP_SCSS))?.[1] ?? '');

/** Every custom property `contracts/tokens.css` puts on `:root` outside a media query. */
const CONTRACT = declarationsIn(
  /:root\s*\{([^}]*)\}/.exec(
    withoutComments(TOKENS_CSS).replace(
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*:root\s*\{[^}]*\}\s*\}/,
      ''
    )
  )?.[1] ?? ''
);

const IS_VAR_REFERENCE = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/;

/** The token role a Hub property is aliased onto, or `null` while it is authored as a literal. */
const aliasRole = (name: string): string | null => IS_VAR_REFERENCE.exec(HUB.get(name) ?? '')?.[1] ?? null;

/** The thirteen aliased properties, derived from the file rather than restated. */
const ALIASES = [...HUB.keys()].filter((name) => aliasRole(name) !== null);

const normaliseQuotes = (value: string): string => value.replace(/'/g, '"');

/**
 * The computed colour of a throwaway element painted `background-color: var(<name>)`.
 *
 * A computed `border-left-color` and a custom property's token stream do not serialise the same
 * way, so an expected role is put through a real element in the same page rather than compared
 * as text or written down as a literal.
 */
const probeRoleColours = async (page: Page, names: readonly string[]): Promise<Record<string, string>> => {
  const read = await page.evaluate((properties: string[]) => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const answers: Record<string, string> = {};
    for (const property of properties) {
      // `cssText` rather than `style.backgroundColor = 'var(...)'`: a whole declaration block is
      // the shape a `var()` reference is unambiguously accepted in, and it is the shape
      // `tests/e2e/contract-anchor.pw.ts` already reads its probe through.
      probe.style.cssText =
        `position:absolute;left:-99999px;top:0;width:1px;height:1px;background-color:var(${property});`;
      answers[property] = window.getComputedStyle(probe).backgroundColor;
    }
    probe.remove();
    return answers;
  }, [...names]);

  // `background-color` falls back to the initial transparent when the reference does not resolve,
  // and two unresolved roles would then compare equal to each other and to nothing meaningful.
  for (const name of names) {
    expect(read[name], `var(${name}) did not resolve to a colour on the probe`).not.toBe('rgba(0, 0, 0, 0)');
  }
  return read;
};

/**
 * **`computedPseudoValue` was removed on 2026-09-23 with the last row that read a pseudo-element.**
 *
 * It read a property off `::before`, with the harness's two rules (name what was asked for in any
 * failure, never return a value that could compare equal when the thing asked for is absent), because
 * two call sites declared there: `WorkItem.scss`'s open-state bar and its `//` highlight marker. Story
 * 2-31 rebuilt that stylesheet against the contract, so neither reads `--accent-dim` any more, and the
 * helper, the `pseudo` field on `CallSite` and the planted control that proved the read was of the
 * pseudo-element and not the element beside it had nothing left to do. Kept as a note in the
 * `inWideContext` shape below, so a later row on a pseudo-element knows this was built once and why it
 * left.
 */

/**
 * A colour rasterised to four 8-bit sRGB channels through a 1 x 1 canvas.
 *
 * The build rewrites `rgba(139, 92, 246, 0.4)` to `#8b5cf666` on the way to the browser, so a
 * text comparison against the authored literal would report a drift the pipeline did not cause.
 * The canvas is the browser's own parser, and `globalCompositeOperation = 'copy'` keeps the alpha
 * rather than compositing it away. A `fillStyle` the context cannot parse is specified to be
 * *ignored*, leaving the previous colour in place, so a sentinel write proves the assignment took
 * and an unparsed value is reported rather than swallowed.
 */
const rasterise = async (page: Page, values: readonly string[]): Promise<string[]> => {
  const read = await page.evaluate((list: string[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    // A sentinel for every input, so a missing context cannot answer with a value that compares
    // equal to another missing context's. It is thrown on below rather than returned.
    if (!context) return list.map(() => 'no-2d-context');

    // **Two sentinels, not one.** With a single one, any input that happens to be another
    // spelling of it (`rgb(18, 52, 86)`, `#123456ff`) leaves `fillStyle` unchanged and would be
    // reported as unparseable, which is a measurement this helper never made. A value can equal
    // one of these two, never both, so an assignment that sticks to neither is the only thing
    // reported as refused.
    const SENTINELS = ['#123456', '#654321'] as const;
    context.globalCompositeOperation = 'copy';

    return list.map((value) => {
      const refused = SENTINELS.every((sentinel) => {
        context.fillStyle = sentinel;
        context.fillStyle = value;
        return context.fillStyle === sentinel;
      });
      if (refused) return `unparsed-by-canvas:${value}`;
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return `${r},${g},${b},${a}`;
    });
  }, [...values]);

  // **Thrown rather than returned.** A missing 2D context answered `no-2d-context` for every
  // input, so the drift comparison in "the four properties this story must not move" would have
  // compared two identical sentinels, found no drift, and reached its verdict over a measurement
  // that never happened. The controls at the end of that case fire only after the verdict.
  if (read.some((answer) => answer === 'no-2d-context')) {
    throw new Error(
      `Alias reads: the page gave no 2D canvas context, so none of ${values.join(', ')} was ` +
        `rasterised. A colour comparison cannot be made and is reported rather than assumed equal.`
    );
  }
  return read;
};

const PURE_BLACK = '0,0,0,255';
const PURE_WHITE = '255,255,255,255';

/**
 * **The two call-site tables left on 2026-09-23 with their last rows.**
 *
 * `CALL_SITES` read each `--accent-dim` call site on its real element against the role its use
 * earned, ornament or boundary (a declaration some selector repaints under `:hover`,
 * `:focus-visible` or a data-state attribute, or the only indicator of a component's state, was a
 * boundary; everything else ornament). Fifteen at Story 1-18, then twelve, eleven, eight, two and one
 * as Stories 2-9, 2-14, 2-29, 2-31 and 2-30 rebuilt or deleted the files that carried them.
 * `WEIGHT_SITES` read each `--monument-bold` call site's family and its hand-set weight, because a
 * family alias cannot carry the bold that lived in the name `MonumentExtended-Bold`: four at Story
 * 1-18, then three, two and one after Stories 2-14, 2-27 and 2-30.
 *
 * **Story 2-33 took the last row of each**, `WorkHero.scss:8`, the hero's section divider, and
 * `WorkHero.scss:19`, its heading, when it rebuilt that stylesheet against the contract. A table of no
 * rows, and a case looping over it, would pass whatever the tree held, so both went, with the
 * `CallSite` shape, the two roles `--accent-dim` split across and the weight role, and both aliases are
 * pinned at zero call sites in the first case below. The per-row reasoning stays in
 * `ops/anchor-token-adoption.md`, kept as each reading was taken.
 */

/**
 * **`--monument-regular` has had no call site since 2026-09-23**, and the precondition case that
 * checked the clamp its call sites relied on left with the last of them.
 *
 * `DESIGN.md` § The mapping assigns the alias `--f-display` plus `--w-bold`, and `app/app.scss` got
 * there without a hand edit by relying on the variable face clamping a request below its published
 * range up to the range's lower bound, a premise that lives in `contracts/fonts.css` and that a MINOR
 * bump is free to change. So the clamp was asserted as a precondition rather than argued, over a
 * table of the call sites it protected: **three at Story 1-18, two after Story 2-9, one after Story
 * 2-31**, and none since Story 2-30 deleted `error-page.scss`, whose `.error-page__title` at `:40`
 * was the last. The 404's heading is the display entrance now, which names the display roles
 * directly. With nothing left to clamp, a precondition over an empty table would pass whatever
 * the contract published, so it went, and the alias is pinned at zero call sites below in the shape
 * `--confillia-normal` has had since Story 2-29: a new call site would arrive relying on a clamp
 * nothing checks any more.
 */

/** Navigate, and refuse to read anything off a page that did not answer the status expected. */
const goTo = async (page: Page, route: string, expected = 200): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  expect(response, `navigating to ${route} produced no response`).toBeTruthy();
  expect(response?.status(), `${route} did not answer ${expected}`).toBe(expected);
};

/**
 * **Removed 2026-09-21 with the last row that needed it.**
 *
 * `inWideContext` opened a second context 1024 wide, because one `--accent-dim` call site was a
 * rule that only applied above 767px: `HomeLayout.scss`'s desktop `border-right-color` on the
 * contact links. Story 2-29 rebuilt that file against the contract and the row went with the other
 * two, leaving the helper, its `WIDE_VIEWPORT`, the `wide` field on `CallSite` and the loop that
 * read them with nothing to do. Every surviving row is read at the project's own 360, which is
 * AD-19's floor and the width the rest of this file measures at. Kept as a note rather than as
 * dead code, so a later row that needs a wide read knows this was tried and why it left.
 */
test('parses a real alias layer, so every case below measures something', () => {
  expect(HUB.size, 'app/app.scss no longer declares fourteen custom properties on :root').toBe(HUB_PROPERTY_COUNT);
  expect(CONTRACT.size, 'no :root block was parsed out of contracts/tokens.css').toBeGreaterThan(0);
  for (const known of ['--token-bg', '--token-text', '--f-display', '--page-pad']) {
    expect([...CONTRACT.keys()], `contracts/tokens.css no longer declares ${known}`).toContain(known);
  }

  // The partition is pinned in both halves. Thirteen aliased and one literal, and the one named,
  // so an alias quietly written over it fails here rather than passing as thirteen of fourteen.
  expect(ALIASES.length, 'app/app.scss no longer aliases exactly thirteen properties onto token roles').toBe(
    ALIASED_COUNT
  );
  expect(
    [...HUB.keys()].filter((name) => aliasRole(name) === null).sort(),
    'the property the alias layer must not move is not the one still authored as a literal'
  ).toEqual([...LITERAL_PROPERTIES].sort());
  for (const name of ALIASES) {
    expect(
      [...CONTRACT.keys()],
      `${name} is aliased onto ${aliasRole(name)}, which contracts/tokens.css does not declare`
    ).toContain(aliasRole(name));
  }

  // **The stylesheets on disk, read whole**, which is what makes each zero below a measurement of the
  // tree rather than of a table. Non-empty and carrying the two files Story 2-33 took the last call
  // sites out of, rather than pinned at a literal count of stylesheets under `components/`, which
  // would have to move for any unrelated component added. A basename collision, which is what would
  // actually drop call sites out of these counts, is refused where the map is built.
  expect(COMPONENT_STYLESHEETS.size, 'no component stylesheet was read, so the counts below are vacuous').toBeGreaterThan(
    0
  );
  for (const named of ['WorkHero.scss', 'WorkTimeline.scss']) {
    expect([...COMPONENT_STYLESHEETS.keys()], `${named} was not read off disk`).toContain(named);
  }

  // The counter, on planted controls, before any agreement is read as good news. Two occurrences
  // in one fixture, a bounded name that does not match a longer one, a whitespace form, and the
  // fallback form, which reads the property exactly as the bare form does.
  const control = new Map([
    ['a.scss', '.x { border-left: 1px solid var(--accent-dim); background: var( --accent-dim ); }'],
    ['b.scss', '.y { color: var(--accent); border: 1px solid var(--accent-dimmer); }'],
    ['c.scss', '.z { background: var(--accent-dim, #fff); }'],
  ]);
  expect([...callSitesOf('--accent-dim', control)], 'the call-site counter no longer fires').toEqual([
    ['a.scss', 2],
    ['c.scss', 1],
  ]);
  expect([...callSitesOf('--monument-bold', control)], 'the counter matches a name it should not').toEqual([]);

  // **Zero call sites since 2026-09-23, both of them.** Story 2-33 rebuilt `WorkHero.scss`, whose
  // section divider and heading were the last `--accent-dim` and `--monument-bold` call sites (see
  // the note where the two tables were). Pinned at zero rather than deleted, in the shape the two
  // below have: a new `--accent-dim` call site would take the `:root` ornament role whatever its use,
  // and a new `--monument-bold` one would lose the weight that lived in the family name.
  expect(
    sortedEntries(callSitesOf('--accent-dim')),
    'an --accent-dim call site is back, and it takes the :root ornament role whatever its use earns'
  ).toEqual([]);
  expect(
    sortedEntries(callSitesOf('--monument-bold')),
    'a --monument-bold call site is back, and a family alias drops the weight that lived in the name'
  ).toEqual([]);

  // **Zero call sites since 2026-09-23**, the shape `--confillia-normal` below has had since Story
  // 2-29: Story 2-30 deleted `error-page.scss`, whose heading was the last call site, and the clamp
  // case that protected the alias's call sites left with it (see the note where the table was).
  // Pinned at zero rather than deleted, because a new call site would rely on a clamp nothing checks.
  expect(
    sortedEntries(callSitesOf('--monument-regular')),
    'a --monument-regular call site is back, and nothing checks the clamp it relies on any more'
  ).toEqual([]);

  // **Zero call sites since 2026-09-21**, the shape `--hero-height` has had since Story 1-18: a
  // property the alias layer still declares with nothing left reading it. Story 2-20 retargeted
  // `--confillia-normal` onto the display family and each of its two call sites set
  // `font-stretch: 75%` by hand on the line after `font-family`, because a family alias cannot
  // carry width any more than it can carry weight; Story 2-29 rebuilt `HomeLayout.scss` against the
  // contract, so the two hero link groups name the display family directly and take the published
  // face at its default width. Pinned at zero rather than deleted, because a new call site would
  // arrive without that hand-set width and nothing else would say so.
  expect(
    sortedEntries(callSitesOf('--confillia-normal')),
    'a --confillia-normal call site is back, and a family alias carries no width'
  ).toEqual([]);

  // The parsers, on planted controls, before any empty or agreeing result is read as good news.
  expect(aliasRole('--white-color'), '--white-color is no longer aliased onto a role').toBe('--token-text');
  expect(IS_VAR_REFERENCE.test('var(--token-bg)')).toBe(true);
  expect(IS_VAR_REFERENCE.test('rgba(139, 92, 246, 0.4)')).toBe(false);
  expect(IS_VAR_REFERENCE.test('var(--token-bg) 1px')).toBe(false);
  expect(normaliseQuotes("'Confillia'")).toBe('"Confillia"');
  expect([...declarationsIn('  --a: 1px; --b: var(--c);').entries()]).toEqual([
    ['--a', '1px'],
    ['--b', 'var(--c)'],
  ]);
  expect([...declarationsIn('.btn--primary:hover { color: red; }').keys()]).toEqual([]);
});

test('every aliased Hub property resolves to exactly the token role it names', async ({ page }) => {
  await goTo(page, '/');

  // Both sides are custom property token streams read on `:root` in the same page, so this
  // comparison is exact rather than canonicalised. A role read in a different page, or a value
  // restated here as a literal, would compare against a build rewrite rather than against the
  // contract.
  const drift: string[] = [];
  let compared = 0;
  for (const name of ALIASES) {
    const role = aliasRole(name) ?? '';
    const aliased = await rootCustomPropertyValue(page, name);
    const direct = await rootCustomPropertyValue(page, role);
    compared += 1;
    if (aliased !== direct) drift.push(`${name} aliases ${role}: read "${aliased}", ${role} reads "${direct}"`);
  }

  expect(compared, 'no alias was compared').toBe(ALIASED_COUNT);
  expect(drift, `an alias no longer resolves to the role it names:\n${drift.join('\n')}`).toEqual([]);

  // The comparison, on a planted control through the same two reads. An equality that held for
  // every pair would look identical to one that could not tell two roles apart.
  expect(
    await rootCustomPropertyValue(page, '--white-color'),
    '--white-color and --token-bg resolve to the same value, so the comparison above discriminates nothing'
  ).not.toBe(await rootCustomPropertyValue(page, '--token-bg'));
});

test('the property the alias layer must not move still holds its authored literal', async ({ page }) => {
  await goTo(page, '/');

  expect(LITERAL_PROPERTIES.length, 'the list of untouched properties is empty').toBe(LITERAL_COUNT);

  // Two comparison routes, because a literal may be a colour and the build rewrites colours on the
  // way to the browser. The colour route read `--accent-glow`, authored `rgba(139, 92, 246, 0.4)` and
  // arriving as `#8b5cf666`, until Story 2-34 deleted it; it stays, with its planted controls below,
  // because the body-ground case reads through the same `rasterise`. The text route read the two
  // single-quoted Confillia literals until Story 2-20 retargeted one and deleted the other; it
  // reads `--hero-height` now, and stays because a literal that is not a colour still needs a
  // route that compares it.
  const isColour = await page.evaluate(
    (values: string[]) => values.map((value) => CSS.supports('color', value)),
    LITERAL_PROPERTIES.map((name) => HUB.get(name) ?? '')
  );
  expect(isColour.filter(Boolean).length, 'a literal the alias layer keeps is a colour again, which the FR-17 gate refuses').toBe(
    LITERAL_COLOUR_COUNT
  );
  expect(isColour.filter((taken) => !taken).length, 'the text route is no longer exercised').toBe(
    LITERAL_COUNT - LITERAL_COLOUR_COUNT
  );

  const drift: string[] = [];
  for (const [index, name] of LITERAL_PROPERTIES.entries()) {
    const authored = HUB.get(name) ?? '';
    expect(authored, `app/app.scss no longer declares ${name}`).not.toBe('');
    expect(
      IS_VAR_REFERENCE.test(authored),
      `app/app.scss authors ${name} as "${authored}", a var() reference. The contract carries no ` +
        `viewport height for --hero-height.`
    ).toBe(false);

    const read = await rootCustomPropertyValue(page, name);
    if (isColour[index]) {
      const [expected, actual] = await rasterise(page, [authored, read]);
      expect(expected, `the canvas could not parse the authored value of ${name}`).not.toMatch(/^unparsed-by-canvas:/);
      if (expected !== actual) drift.push(`${name}: app/app.scss authors "${authored}" (${expected}), read "${read}" (${actual})`);
    } else if (normaliseQuotes(authored) !== read) {
      drift.push(`${name}: app/app.scss authors "${authored}", expected "${normaliseQuotes(authored)}", read "${read}"`);
    }
  }
  expect(drift, `a property this story must not move has drifted:\n${drift.join('\n')}`).toEqual([]);

  // The colour route, on planted controls through the same helper: two spellings of one colour
  // compare equal, a different alpha compares unequal, and a different hue compares unequal.
  //
  // **The resolution is coarser than 1/255 once alpha is involved**, and that is recorded rather
  // than papered over. The canvas stores premultiplied and `getImageData` unpremultiplies, so at
  // alpha 0.4 a channel round-trips through a step of about 1/0.4, and `#8b5cf666` and
  // `#8c5cf666` both read back as `140,92,245,102`. A rewrite that shifted a channel by one
  // 8-bit step under alpha would pass here. That is a real ceiling on this route, and it is the
  // same shape of ceiling `ops/anchor-token-adoption.md` records for the opaque colour route.
  const [equivalentA, equivalentB, otherAlpha, otherHue] = await rasterise(page, [
    'rgba(139, 92, 246, 0.4)',
    '#8b5cf666',
    '#8b5cf6ff',
    '#5b21b666',
  ]);
  expect(equivalentA, 'the colour route no longer treats two spellings of one colour as equal').toBe(equivalentB);
  expect(equivalentA, 'the colour route no longer separates two alphas').not.toBe(otherAlpha);
  expect(equivalentA, 'the colour route no longer separates two hues').not.toBe(otherHue);
  const [refused] = await rasterise(page, ['not-a-colour-at-all']);
  expect(refused, 'the canvas guard no longer reports a value it could not parse').toBe(
    'unparsed-by-canvas:not-a-colour-at-all'
  );
});

// **The per-call-site case left on 2026-09-23 with the last row it read.** It read each `--accent-dim`
// call site on its real element against the ornament or boundary role, through a probe in the same
// page, on every route the table named. Story 2-33 rebuilt `WorkHero.scss`, whose divider was the one
// row left, and the alias is pinned at zero call sites in the first case of this file.
//
// **The pseudo-element read's planted control left on 2026-09-23 with the helper it proved**, when
// Story 2-31 rebuilt the last stylesheet that declared an `--accent-dim` call site on `::before`. See
// the note above `rasterise`.

// **The weight case left on 2026-09-23 with the last `--monument-bold` call site.** It read each site's
// computed family and weight, in that order and after Story 1-18 had set the weight by hand, because a
// family alias drops the bold that lived in `MonumentExtended-Bold` and a weight read against a tree
// where it was never set is green and meaningless. Story 2-33 rebuilt `WorkHero.scss`, whose heading
// names the display family and the heaviest weight by their roles, and `tests/e2e/work-hero.pw.ts`
// reads that heading's computed face and weight now.

// **The clamp case left on 2026-09-23 with the last call site it protected.** It asserted that the
// display face publishes a weight range whose lower bound sits above what the `--monument-regular`
// call sites request, which is what made them bold without a hand-set weight. Story 2-30 deleted
// `error-page.scss` and the last of them with it, and a precondition over no call site passes
// whatever `contracts/fonts.css` publishes, so the case and its range parser went, and the alias is
// pinned at zero call sites in the first case of this file. See the note where the table was.

test('the body ground and body copy where the base rule paints are the token roles, and neither is pure', async ({
  page,
}) => {
  // **The 404, and it stopped being the only choice on 2026-09-10.** Story 1-17 concluded from the
  // stylesheets that `/cv` and `/recommendation` were the two routes where the base `body` rule
  // paints, and said so while recording that it had not rendered them
  // (`ops/anchor-token-adoption.md` § "A second finding"). Story 1-18 falsified that by navigating:
  // `next.config.js` redirected both, permanently, to a PDF under `/pdf/`, so a browser asked for
  // either started a download and painted no Hub page, and the 404 was the one surface left.
  //
  // **Story 2-16 built `/cv`**, which removes that redirect, so `body#cv` is now a second surface
  // where nothing overrides the base rule. **Story 2-17 retired `/recommendation`** on 2026-09-11,
  // so that route is the 404 document now rather than a third surface. The reading stays on the
  // 404 deliberately: it is the surface every earlier reading in this file was taken on, and
  // moving it would change what the comparison below is a re-measurement of. `tests/e2e/cv.pw.ts`
  // is where the other surface's ground is asserted.
  //
  // `Container.tsx` sets `<body id={route}>` from the stripped, hyphenated pathname, and an
  // unrouted path's id matches none of `body[id='']` (`HomeLayout.scss`) or `#celeste`
  // (`celeste.scss`), so nothing overrides `background: var(--black-color)` there. It matched none
  // of `body#work` either, in `app/app.scss` with `body#projects` beside it until Story 2-14, until
  // Story 2-33 deleted that rule on 2026-09-23 and `/work` took the base rule as well.
  // `error-page.scss:7` painted its own `#0a000f` on the error container, not on `body`, until Story
  // 2-30 replaced the file on 2026-09-23 with `Error404.scss`, which paints no ground at all: this
  // base rule is the ground a visitor sees on the 404 now, as `tests/e2e/error-surface.pw.ts` samples.
  await goTo(page, NOT_FOUND, 404);

  // The guard, saying what it actually covers. The three rules that overrode the base ground on
  // the other routes all painted a grid **image** as well as a colour, so an image on `body` here
  // meant one of them had started matching the 404's id; none is left since Story 2-33, and an image
  // here now means a new one arrived. It does not cover a colour-only override,
  // which is why it is not the assertion this case rests on: the comparison against `--token-bg`
  // below is, and a colour-only override fails there naming both values.
  expect(
    await computedStyleValue(page, 'body', 'background-image'),
    'body on the 404 surface paints a background image, so one of the grid-ground rules now matches ' +
      'it and the base rule is no longer what this case reads'
  ).toBe('none');

  const roles = await probeRoleColours(page, ['--token-bg', '--token-text']);
  expect(roles['--token-bg'], '--token-bg and --token-text resolve to the same colour').not.toBe(roles['--token-text']);

  const background = await computedStyleValue(page, 'body', 'background-color');
  const colour = await computedStyleValue(page, 'body', 'color');

  expect(background, 'the body ground where the base rule paints is not --token-bg').toBe(roles['--token-bg']);
  expect(colour, 'body copy where the base rule paints is not --token-text').toBe(roles['--token-text']);

  // And neither is pure, compared as pixels rather than as strings, because a colour can be
  // written several ways and the build writes it in one of them.
  const [groundPixel, copyPixel, blackPixel, whitePixel] = await rasterise(page, [
    background,
    colour,
    'rgb(0, 0, 0)',
    'rgb(255, 255, 255)',
  ]);
  expect(blackPixel, 'the raster control for pure black no longer holds').toBe(PURE_BLACK);
  expect(whitePixel, 'the raster control for pure white no longer holds').toBe(PURE_WHITE);
  expect(groundPixel, 'the body ground is pure black, which the contract retires').not.toBe(PURE_BLACK);
  expect(copyPixel, 'body copy is pure white, which the contract retires').not.toBe(PURE_WHITE);
});

test('every route the Hub serves still answers 2xx', async ({ page }) => {
  // NFR-2 binds every migration step, so this is measured rather than assumed.
  //
  // **`page.request` and not `page.goto`.** Until 2026-09-11 one of the routes, `/recommendation`,
  // was a permanent redirect to a PDF (`next.config.js`), so a browser asked for it started a
  // download rather than a navigation and `page.goto` rejected with "Download is starting". The
  // request context follows a redirect and reports the status the visitor ends on, which is what
  // NFR-2 is about. Whether anything redirects is pinned below rather than absorbed, because a
  // redirect is the fact that moved this story's body-ground read onto the 404 surface. **`/cv`
  // redirected until 2026-09-10**, when Story 2-16 built the page behind it, and `/recommendation`
  // until Story 2-17 retired the route; the method is unchanged and only the set moved, to empty.
  const failures: string[] = [];
  const landedOn = new Map<string, string>();

  for (const route of ROUTES) {
    const response = await page.request.get(route);
    landedOn.set(route, new URL(response.url()).pathname);
    if (!response.ok()) failures.push(`${route} answered ${response.status()}`);
  }

  const notFound = await page.request.get(NOT_FOUND);
  if (notFound.status() !== 404) failures.push(`${NOT_FOUND} answered ${notFound.status()}, expected 404`);

  expect(landedOn.size, 'no route was visited').toBe(ROUTES.length);
  expect(failures, `a route stopped answering:\n${failures.join('\n')}`).toEqual([]);

  // The set of routes that redirect, pinned so a redirect quietly added or removed shows up here
  // rather than as a puzzling download three stories later.
  //
  // **This pin deliberately did not widen when Story 2-14 added a third redirect.** Operator ruling
  // of 2026-09-07: `/projects` answers a 301 that lands on `/`, which is a Hub document rather than
  // a PDF, so it would have failed the `/pdf/` assertion this pin used to carry and said nothing
  // this file is about. It left `ROUTES` instead, and `tests/e2e/projects-redirect.pw.ts` asserts
  // the status code and the `Location` header without following either.
  //
  // **It narrowed on 2026-09-10 and emptied on 2026-09-11.** Story 2-16 built `/cv` as a page, so
  // the route answers its own document and lands where it was asked; it stays in `ROUTES` and
  // stopped appearing here. Story 2-17 retired `/recommendation`, the last route that landed on a
  // PDF, and it left `ROUTES` because it answers 404 now. The pin reads `[]` and stays: it is the
  // direction this pin is allowed to move in, and a redirect added back would fail it. The loop
  // that asserted each redirected route landed under `/pdf/` went with the last member rather than
  // being left iterating nothing.
  const redirected = [...landedOn].filter(([route, landing]) => route !== landing).map(([route]) => route);
  expect(redirected.sort(), 'the set of routes that redirect away from the Hub has changed').toEqual([]);

  // The viewport the whole file reads at, asserted rather than assumed from the config.
  expect(page.viewportSize()).toEqual({ ...RENDERED_VIEWPORT });
});
