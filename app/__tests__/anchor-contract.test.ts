// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * The source half of the Anchor's two migration steps (Stories 1-17 and 1-18).
 *
 * No browser and no network. `tests/e2e/contract-anchor.pw.ts` and `tests/e2e/anchor-alias.pw.ts`
 * are the other half and assert what the built Hub actually resolves; this file asserts four
 * things about the sources that a rendered check cannot see:
 *
 *  1. **The contract is loaded by `@use`, never by `@import`.** That is the rule, and the
 *     extension is not. **Observed 2026-08-26** against this repository's own Dart Sass 1.98.0
 *     on four one-line fixtures: `@use './t'` and `@use './t.css'` both inline the plain CSS
 *     file and emit byte-identical output, a bare `@import './t'` also inlines it (with a
 *     deprecation warning), and only `@import './t.css'`, the pair of the old rule with an
 *     explicit extension, passes through as a runtime `@import` for the browser to resolve.
 *     A runtime `@import` would fetch the contract from a URL Next never emits and would break
 *     the relative `url("./fonts/<file>.woff2")` resolution. The `@use` assertion is what holds
 *     that shut; the no-extension assertion below is a convention check and says so.
 *  2. **No name collides.** All fifteen of the Hub's custom properties are declared in
 *     `app/app.scss`, none of the eighty-nine contract names is among them, and both counts are
 *     pinned so the intersection cannot be empty because a list was. The alias layer references
 *     contract names without declaring any, so this claim survives Story 1-18 unchanged.
 *  3. **The contract is consumed through one alias layer and seven named call sites.** Story
 *     1-17 asserted that nothing consumed the contract at all. Story 1-18 spends that invariant
 *     deliberately, and it is **replaced by the narrower one that succeeds it** rather than
 *     deleted into a gap: every reference to a contract name from a shipped source root is
 *     either in `app/app.scss` or is one of the per-call-site resolutions enumerated below, the
 *     fifteen-row alias mapping is the one `DESIGN.md` section The mapping decided, and
 *     `--accent-glow` is declared nowhere and referenced nowhere.
 *  4. **There is no second authored copy.** The Anchor is the publisher, not a Satellite
 *     (AD-1, AD-4), so it loads `contracts/` directly and vendors nothing. The listing is
 *     `git ls-files` rather than the working tree, because `pnpm build` writes the generated,
 *     gitignored served copy into `public/contracts/` (Story 1-16) and a working-tree scan
 *     would read that as an authored file.
 */

// Vitest runs from the repository root, and `import.meta.url` under Vitest is a vite URL
// rather than a `file:` one. Same treatment as `ops/__tests__/contract-purity.test.ts:31`.
const REPO_ROOT = process.cwd();
const HERE = 'app/__tests__/anchor-contract.test.ts';

const INDEX_SCSS = resolve(REPO_ROOT, 'app/scss/_index.scss');
const APP_SCSS = resolve(REPO_ROOT, 'app/app.scss');
const TOKENS_CSS = resolve(REPO_ROOT, 'contracts/tokens.css');
const FONTS_CSS = resolve(REPO_ROOT, 'contracts/fonts.css');
const LOCAL_FONTS_SCSS = resolve(REPO_ROOT, 'app/scss/_fonts.scss');

/**
 * Ten local `@font-face` blocks, three published ones. Pinned so an empty list cannot pass.
 *
 * **Ten, not nine.** `app/scss/_fonts.scss:19-121` declares five General Sans weights, three
 * Monument Extended weights and two Confillia faces. Observed 2026-08-26 by counting the
 * `@font-face` openers; the earlier prose said nine.
 */
const LOCAL_FACE_COUNT = 10;
const CONTRACT_FACE_COUNT = 3;

/** The family name of every `@font-face` block in `source`, unquoted, in source order. */
const familiesIn = (source: string): string[] =>
  [...withoutComments(source).matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*([^;]+)/g)].map((found) =>
    found[1].trim().replace(/^["']|["']$/g, '')
  );

/**
 * Every directory the Hub compiles shipped source from.
 *
 * `app/` and `components/` are the two the story's own matrix names. `hooks/` and `content/` are
 * here because the claim being made is about the Anchor and not about two of its four source
 * roots: `hooks/useGsapContext.ts` and `hooks/useReduceMotion.ts` are imported by eight
 * components, and a GSAP hook is the most likely place in this repository for a
 * `setProperty('--token-...')` or a token-driven duration to arrive. A scan that stopped at two
 * roots would report "nothing consumes the contract" about a file it never opened.
 */
const SCANNED = ['app', 'components', 'hooks', 'content'] as const;

/**
 * The extensions a consumer could arrive in: a stylesheet, or a `setProperty('--token-...')`.
 *
 * `.css` is here because Next compiles a plain global stylesheet imported from a component exactly
 * as it compiles a `.scss` one, and the `.js` family because nothing stops a shipped source being
 * written without types. None of the five exist under a scanned root today, which is the reason
 * they were missing and the reason they cost nothing to add: the scan below and the root pin above
 * it both filter on this list, so an extension absent from it is invisible to both.
 */
const SCANNED_EXTENSIONS = ['.scss', '.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/** The three of those that a scanned root actually carries today, so "at least one was read" means something. */
const PRESENT_EXTENSIONS = ['.scss', '.ts', '.tsx'] as const;

/**
 * Top-level directories that carry sources in a scanned extension but ship nothing to the browser,
 * so the root pin does not demand they be scanned for consumers.
 *
 * `tests/` is the browser suite, excluded for the same reason `__tests__` is. `contracts/` is the
 * contract itself: it declares the names, it does not consume them, and requiring it to be scanned
 * would ask the publisher to not mention its own tokens. `packages/` generates and publishes the
 * contract at build time and `ops/` is record tooling; neither is compiled into a page. Each is
 * named rather than pattern-matched, so a genuinely new source root still fails the pin.
 */
const NOT_SHIPPED_ROOTS = ['tests', 'contracts', 'packages', 'ops'] as const;

/**
 * Four `.scss` under `app/` and fifteen under `components/`, counted at `b984ca7`, plus the
 * thirty-six non-test `.ts` and `.tsx` files beside them and the four under `hooks/` and
 * `content/`. Asserted as a floor rather than as an equality so a later story adding a component
 * does not fail this file, while a scan that read nothing, or lost a root, or lost an extension,
 * does.
 */
const MINIMUM_SCANNED_FILES = 59;

/** Nineteen of those must be stylesheets, which is the count the story's own matrix names. */
const MINIMUM_SCSS_FILES = 19;

/**
 * The counts `contracts/tokens.css` publishes at v1.0.0, pinned rather than bounded.
 *
 * A floor (`toBeGreaterThan(50)`) cannot see a removed name: the loop that reads each one back
 * simply gets shorter and stays green. Pinning is what makes a removal fail here, and a
 * removal is a MAJOR bump under the contract's own rules, so it is meant to be loud.
 */
const DECLARED_COUNT = 89;
const REDUCED_COUNT = 4;

/**
 * The Hub's own custom properties, all fifteen of them, all in one file.
 *
 * Sixteen before Story 1-18. `--accent-glow` is the one that left: O-11 was closed on 2026-08-15
 * with evidence, and this file re-verifies that evidence rather than trusting it.
 */
const HUB_PROPERTY_COUNT = 15;

/**
 * The alias mapping as decided, one row per property that becomes a `var()` reference.
 *
 * Derived from `DESIGN.md` section The mapping and `rebaseline-2026-08-15.md` section O-10, and
 * pinned here rather than read back out of `app/app.scss`, because a table read from the file it
 * is checking asserts nothing. Thirteen rows here plus the two local literals below are the
 * fifteen properties the Hub declares.
 */
const ALIAS_MAPPING: Record<string, string> = {
  '--white-color': '--token-text',
  '--black-color': '--token-bg',
  '--light-gray-color': '--token-text-secondary',
  '--gray-color': '--token-border-interactive',
  '--accent': '--token-accent',
  '--accent-dim': '--token-accent-muted',
  '--page-padding': '--page-pad',
  '--font-regular': '--f-body',
  '--font-bold': '--f-body',
  '--confillia-normal': '--f-display',
  '--monument-regular': '--f-display',
  '--monument-bold': '--f-display',
  '--font-mono': '--f-mono',
};

/**
 * The two properties that stay literal, and why each one does.
 *
 * `--hero-height` is a layout constant and the contract carries no viewport heights.
 * `--confillia-bold` is Story 2.20's to retarget and delete, alongside the `--confillia-normal`
 * move to `wdth 75` that O-6 still gates, so Story 1-18 leaves it exactly as it was.
 */
const LOCAL_LITERALS: Record<string, string> = {
  '--hero-height': '40vh',
  '--confillia-bold': "'Confillia'",
};

/**
 * The property O-11 closed and Story 1-18 deleted. Named once, so every case about it agrees.
 */
const DELETED_PROPERTY = '--accent-glow';

/**
 * The alias layer, and every per-call-site resolution beside it.
 *
 * This is the invariant that succeeds Story 1-17's "nothing consumes the contract". A contract
 * name may be referenced from `app/app.scss`, where the aliases live, and from these six
 * stylesheets, where a family alias could not carry the weight half of the font mapping and where
 * an ornament alias would have dropped a state-bearing boundary below AD-19's 3:1 floor. Anywhere
 * else is a component reaching past the alias layer, which is Epic 2's act and not this story's.
 */
const CALL_SITE_RESOLUTIONS: Record<string, string[]> = {
  'components/atoms/WorkItem/WorkItem.scss': ['--token-border-interactive'],
  'components/molecules/ProjectCard/ProjectCard.scss': ['--token-border-interactive'],
  'components/organisms/ErrorPage/error-page.scss': ['--token-border-interactive', '--w-black'],
  'components/molecules/GlitchText/glitch-text.scss': ['--w-black'],
  'components/organisms/ProjectsHero/ProjectsHero.scss': ['--w-black'],
  'components/organisms/WorkHero/WorkHero.scss': ['--w-black'],
};

/**
 * All fifteen `--accent-dim` call sites, classified.
 *
 * **The rule that decided each one, stated so it can be re-derived rather than re-judged:** a call
 * site is a boundary a person reads state from when a sibling rule rewrites that same property
 * under `:hover`, `:focus-visible` or a state attribute. Everything else is ornament. The three
 * boundary rows are the three sites that now read `var(--token-border-interactive)` directly; the
 * twelve ornament rows still read `var(--accent-dim)`, which resolves to `--token-accent-muted`.
 *
 * Pinned by file and declared property rather than by line number, so a comment added above a rule
 * does not fail the case while a site moving between the two lists does. The failure message
 * carries the line.
 */
const BOUNDARY_SITES = [
  'components/atoms/WorkItem/WorkItem.scss background',
  'components/molecules/ProjectCard/ProjectCard.scss border-left',
  'components/organisms/ErrorPage/error-page.scss border-left',
] as const;

const ORNAMENT_SITES = [
  'components/atoms/HudLabel/hud-label.scss border-left',
  'components/atoms/HudLabel/hud-label.scss border-right',
  'components/atoms/WorkItem/WorkItem.scss background',
  'components/atoms/WorkItem/WorkItem.scss border-bottom',
  'components/atoms/WorkItem/WorkItem.scss color',
  'components/molecules/ProjectCard/ProjectCard.scss background',
  'components/molecules/ProjectCard/ProjectCard.scss border',
  'components/organisms/HomeLayout/HomeLayout.scss border-left',
  'components/organisms/HomeLayout/HomeLayout.scss border-left',
  'components/organisms/HomeLayout/HomeLayout.scss border-right',
  'components/organisms/ProjectsHero/ProjectsHero.scss border-bottom',
  'components/organisms/WorkHero/WorkHero.scss border-bottom',
] as const;

/** The two halves of the resolution, pinned rather than counted from the lists above. */
const BOUNDARY_COUNT = 3;
const ORNAMENT_COUNT = 12;

/**
 * One tracked file under each pathspec the copy check lists, so an empty `git ls-files` cannot read
 * as "nothing found" and, more to the point, so a *partly* empty one cannot either. Each of these
 * is load-bearing to the Hub and is not going anywhere without a story of its own.
 */
const KNOWN_TRACKED = [
  'app/app.scss',
  'components/atoms/Container/Container.tsx',
  'public/fonts/ConfilliaBold-Regular.woff',
] as const;

/** The three basenames a vendored copy would arrive under (AD-14). */
const CONTRACT_BASENAMES = ['tokens.css', 'fonts.css', 'tailwind.css'];

/** The one fixed folder name a Satellite vendors the contract under (AD-14, AD-16). */
const VENDORED_FOLDER = 'cuatro-contracts';

const atCollection = <T>(why: string, build: () => T): T => {
  try {
    return build();
  } catch (error) {
    throw new Error(`${HERE}: ${why} ${error instanceof Error ? error.message : String(error)}`);
  }
};

// `spawnSync` reports a failure to start in `error` and leaves `status` null, so an unguarded
// `run.status` turns a broken harness into what reads as a finding.
const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

/**
 * `git ls-files` over `paths`, as repository-relative paths with forward slashes.
 *
 * `-z` with `core.quotePath=false` rather than plain stdout: by default git C-quotes any path
 * carrying a non-ASCII or unusual byte, wrapping it in quotes and escaping it. A vendored copy
 * under such a path would then match neither the basename filter nor the path-segment filter
 * below, and the check would report "nothing found" about a file that is right there.
 */
const gitLsFiles = (paths: string[]): string[] => {
  const run = spawned(
    spawnSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-z', '--', ...paths], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  );
  if (run.status !== 0) {
    throw new Error(`${HERE}: git ls-files -- ${paths.join(' ')} exited ${run.status}: ${run.stderr}`);
  }
  return run.stdout.split('\0').filter((line) => line !== '');
};

/**
 * Sass and CSS comments removed, so a discussion of a rule is never read as the rule.
 *
 * The `//` strip is guarded on the preceding character against both `:` and `(`, which is what
 * `tests/e2e/contract-anchor.pw.ts` uses. `[^:]` alone covers `url(https://...)` but not a
 * protocol-relative `url(//host/face.woff2)`, which would take the rest of its line with it here
 * and not there. The previous pass corrected the browser half and left this one, so the two halves
 * still parsed the same files by two different rules while a comment in the other file said they
 * had been made to agree. They agree now.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');

/**
 * A custom property **declaration**, anchored on the character that can open one.
 *
 * `--name:` on its own is not enough: a BEM modifier carrying a pseudo-class, `.btn--primary:hover`,
 * is `--name:` too. Reading that as a declaration would inflate the Hub's pinned count of sixteen
 * and fail the collision argument for a reason unrelated to the contract. Anchoring on `;`, `{` or
 * a line start is what separates the two. The same expression is used by every place in this file
 * that counts declarations, so the three cannot drift apart.
 */
const DECLARATION = /(?:^|[;{])\s*(--[A-Za-z0-9_-]+)\s*:/gm;

const INDEX_SOURCE = atCollection('could not read app/scss/_index.scss:', () => readFileSync(INDEX_SCSS, 'utf8'));

/**
 * Every `--name` `contracts/tokens.css` declares, by two independent parsers that must agree.
 *
 * `flat` scans the whole comment-stripped file for a declaration. `structured` takes the
 * `:root` block and the `prefers-reduced-motion` block separately, which is what the browser
 * half needs in order to know which value is expected under which media query. They are
 * cross-checked against each other because they fail differently: the flat parser cannot tell
 * the two blocks apart, and the structured one would silently truncate its list if a second
 * `:root`, an `@layer` wrapper or any nested brace appeared.
 */
const CONTRACT = atCollection('could not parse contracts/tokens.css:', () => {
  const source = withoutComments(readFileSync(TOKENS_CSS, 'utf8'));

  const namesIn = (text: string): string[] => [...text.matchAll(DECLARATION)].map((found) => found[1]);

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

  const reducedMatch = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(source);
  const baseMatch = /:root\s*\{([^}]*)\}/.exec(reducedMatch ? source.replace(reducedMatch[0], '') : source);
  if (!reducedMatch || !baseMatch) throw new Error('no :root block or no reduced-motion block was found');

  return {
    flat: namesIn(source),
    base: declarationsIn(baseMatch[1]),
    reduced: declarationsIn(reducedMatch[1]),
  };
});

const TOKEN_NAMES = [...new Set([...CONTRACT.base.keys(), ...CONTRACT.reduced.keys()])];

/** Every `--name` `app/app.scss` declares. All fifteen of the Hub's own live in that one file. */
const HUB_NAMES = atCollection('could not parse app/app.scss:', () => {
  const source = withoutComments(readFileSync(APP_SCSS, 'utf8'));
  return [...new Set([...source.matchAll(DECLARATION)].map((found) => found[1]))];
});

/**
 * Every `--name: value` pair `app/app.scss` declares on `:root`, in source order.
 *
 * The names alone were enough while the Hub's properties were literals nothing else read. The
 * alias layer makes the **value** the thing under test, so it is parsed as well. Same shape as the
 * structured parse of `contracts/tokens.css` above and as `HUB_DECLARED` in
 * `tests/e2e/contract-anchor.pw.ts`, so the three cannot drift into three different readings of
 * the same file.
 */
const HUB_DECLARED = atCollection('could not parse the :root block of app/app.scss:', () => {
  const block = /:root\s*\{([^}]*)\}/.exec(withoutComments(readFileSync(APP_SCSS, 'utf8')))?.[1];
  if (block === undefined) throw new Error('no :root block was found');
  const found = new Map<string, string>();
  for (const raw of block.split(';')) {
    const at = raw.indexOf(':');
    if (at === -1) continue;
    const name = raw.slice(0, at).trim();
    if (!name.startsWith('--')) continue;
    found.set(name, raw.slice(at + 1).trim());
  }
  return found;
});

/**
 * The single custom property a value is a `var()` reference to, or `null` if it is not one.
 *
 * Deliberately anchored end to end. `var(--a) var(--b)` and `var(--a, #fff)` are both values that
 * *contain* a reference without *being* one, and an alias layer whose whole claim is "this
 * property is that role" must not accept either. Named rather than inlined, so the controls beside
 * the assertion call the same function the assertion calls.
 */
const aliasTarget = (value: string): string | null =>
  /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(value.trim())?.[1] ?? null;

/** A raw palette name, which AD-14 bars a consumer from reading. */
const isPaletteName = (name: string): boolean => /^--c-[a-z]/.test(name);

/**
 * The property a declaration line declares, or `null` if the line declares nothing.
 *
 * Used to classify the `--accent-dim` call sites by the property they set, which is what the
 * ornament-or-boundary rule turns on.
 */
const declaredProperty = (line: string): string | null =>
  /^\s*([a-z-]+)\s*:/.exec(line.split('//')[0])?.[1] ?? null;

/**
 * A Sass load, as it is written in the source: the rule, the quoted path, and where it sits.
 * `@forward` is collected too, because the contract loads' position relative to
 * `@forward './fonts'` decides emission order and therefore `@font-face` precedence.
 */
interface Load {
  rule: '@use' | '@import' | '@forward';
  path: string;
  at: number;
}

// `\s*` and not `\s+`: Sass accepts `@use'../../contracts/tokens';` with no space before the
// string, so a `\s+` parser would look straight past a load written that way and let the
// `@use`-never-`@import` assertion below pass over a runtime `@import`.
const loadsIn = (scss: string): Load[] =>
  [...withoutComments(scss).matchAll(/@(use|import|forward)\s*(['"])([^'"]+)\2/g)].map((found) => ({
    rule: `@${found[1]}` as Load['rule'],
    path: found[3],
    at: found.index ?? 0,
  }));

/** A load that reaches something under `contracts/`, whichever rule it uses. */
const isContractLoad = (load: Load): boolean => /(^|\/)contracts\//.test(load.path);

/**
 * The file a load points at, as an absolute path.
 *
 * The `.css` is appended only when the path does not already carry it. Appending it
 * unconditionally turned an explicit-extension load into `tokens.css.css`, so the case that
 * exists to name that mistake reported a file that does not exist instead.
 */
const resolvedTarget = (load: Load): string =>
  resolve(dirname(INDEX_SCSS), load.path.endsWith('.css') ? load.path : `${load.path}.css`);

/** Every scanned source file under `directory`, recursively, as repository-relative paths. */
const scannedUnder = (directory: string, found: string[] = []): string[] => {
  const absolute = resolve(REPO_ROOT, directory);
  if (!existsSync(absolute)) return found;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    // A test that asserts about a token name is not a consumer of it, and this very file names
    // several. Excluding `__tests__` is what keeps the scan measuring the shipped sources.
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') scannedUnder(join(directory, entry.name), found);
      continue;
    }
    if (entry.isFile() && SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      found.push(join(directory, entry.name).split('\\').join('/'));
    }
  }
  return found;
};

/**
 * A reference to `name`, bounded so `--token-bg` does not match inside `--token-bg-raised`.
 * The name is escaped rather than interpolated raw, because a custom property name is not a
 * regular expression and a future one carrying a `.` would quietly match anything.
 */
const referenceTo = (name: string): RegExp =>
  new RegExp(`(?<![A-Za-z0-9_-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`);

/** A tracked path whose final segment is one of the three published contract files. */
const isContractCopy = (path: string): boolean => CONTRACT_BASENAMES.includes(path.split('/').pop() ?? '');

/** A tracked path with `cuatro-contracts` as one of its segments. */
const isVendoredPath = (path: string): boolean => path.split('/').includes(VENDORED_FOLDER);

describe('the token contract is wired into the Anchor stylesheet graph', () => {
  it('reads a real contract by two agreeing parsers, so every case below measures something', () => {
    expect(INDEX_SOURCE.trim(), 'app/scss/_index.scss is empty').not.toBe('');
    expect(existsSync(TOKENS_CSS), `${TOKENS_CSS} does not exist`).toBe(true);
    expect(existsSync(FONTS_CSS), `${FONTS_CSS} does not exist`).toBe(true);

    // Pinned, not bounded. A removed name shortens every loop in both halves of this story and
    // would otherwise pass in silence, which is what made the record's "fails naming the
    // property" claim untrue before this case existed.
    expect(CONTRACT.base.size, 'contracts/tokens.css no longer declares 89 custom properties on :root').toBe(
      DECLARED_COUNT
    );
    expect(CONTRACT.reduced.size, 'the reduced-motion block no longer redefines 4 values').toBe(REDUCED_COUNT);

    // The two parsers, against each other. They truncate differently, so agreement is evidence
    // that neither did.
    expect(
      [...new Set(CONTRACT.flat)].sort(),
      'the flat and the structured parse of contracts/tokens.css disagree, so one of them truncated'
    ).toEqual([...TOKEN_NAMES].sort());
    expect(
      CONTRACT.flat.length,
      'contracts/tokens.css does not carry 93 declarations in total, 89 on :root and 4 under reduced motion'
    ).toBe(DECLARED_COUNT + REDUCED_COUNT);

    for (const name of ['--token-bg', '--f-body', '--tap']) {
      expect(TOKEN_NAMES, `contracts/tokens.css no longer declares ${name}`).toContain(name);
    }
    for (const [name, value] of CONTRACT.base) expect(value, `${name} parsed to an empty value`).not.toBe('');
    for (const [name, value] of CONTRACT.reduced) {
      expect(value, `${name} parsed to an empty value under reduced motion`).not.toBe('');
      expect(TOKEN_NAMES, `${name} is redefined under reduced motion but never declared`).toContain(name);
    }

    // The matcher, on a planted positive control. A scan whose regex had stopped firing would
    // otherwise report zero references from a file full of them.
    expect(referenceTo('--token-bg').test('  color: var(--token-bg);')).toBe(true);
    expect(referenceTo('--token-bg').test('  color: var(--token-bg-raised);')).toBe(false);
    expect(referenceTo('--tap').test('min-height: var(--tap);')).toBe(true);

    // The load parser, likewise, including the comment stripping a commented-out load needs.
    expect(loadsIn(`@use '../../contracts/tokens';`)).toEqual([
      { rule: '@use', path: '../../contracts/tokens', at: 0 },
    ]);
    expect(loadsIn('/* nothing here */')).toEqual([]);
    expect(loadsIn(`// @use '../../contracts/tokens';`), 'a commented-out load is counted as live wiring').toEqual([]);
    expect(loadsIn(`/* @use '../../contracts/tokens'; */`), 'a block-commented load is counted').toEqual([]);
    expect(loadsIn(`@use 'https://example.test/x';`).length, 'comment stripping ate a protocol slash').toBe(1);
    expect(
      loadsIn(`@use'../../contracts/tokens';`),
      'a load written with no space before the string is invisible to the parser'
    ).toEqual([{ rule: '@use', path: '../../contracts/tokens', at: 0 }]);

    // The path resolver, on the shape that used to double the extension.
    expect(resolvedTarget({ rule: '@use', path: '../../contracts/tokens.css', at: 0 })).toBe(TOKENS_CSS);
    expect(resolvedTarget({ rule: '@use', path: '../../contracts/tokens', at: 0 })).toBe(TOKENS_CSS);
  });

  it('loads the contract by @use, never by @import, which is the rule that keeps it inlined', () => {
    const contractLoads = loadsIn(INDEX_SOURCE).filter(isContractLoad);
    expect(contractLoads.length, 'app/scss/_index.scss loads nothing under contracts/').toBeGreaterThan(0);

    for (const load of contractLoads) {
      // The assertion that actually holds the failure mode shut. Observed against Dart Sass
      // 1.98.0: `@use` inlines a plain CSS file with or without the extension, and only
      // `@import` with an explicit `.css` extension becomes a runtime `@import`.
      expect(
        load.rule,
        `${load.rule} '${load.path}' loads the contract. Only @use is safe here: @import with an ` +
          `explicit .css extension compiles to a runtime @import, which fetches the contract from a ` +
          `URL Next never emits and breaks the relative url() resolution in contracts/fonts.css.`
      ).toBe('@use');
    }

    // The convention check, stated as one. The extensionless spelling is not what makes the
    // load inline, it is what makes it unambiguous, and the message says so rather than
    // repeating a rule that is not true of `@use`.
    for (const load of contractLoads) {
      expect(
        load.path.endsWith('.css'),
        `@use '${load.path}' carries an explicit .css extension. Sass inlines it either way, so this ` +
          `is a convention check and not a correctness one: the house spelling is extensionless.`
      ).toBe(false);
    }

    // The planted controls for both matchers, so neither can pass because it stopped looking.
    expect(loadsIn(`@import '../../contracts/tokens.css';`).filter(isContractLoad).map((load) => load.rule)).toEqual([
      '@import',
    ]);
    expect(loadsIn(`@use '../../contracts/tokens.css';`).filter((load) => load.path.endsWith('.css')).length).toBe(1);

    // And no plain CSS `@import` written by hand anywhere in the file, with the matcher shown
    // firing first: an absence check whose regex stopped matching reads exactly like a clean
    // file, which is the one way this assertion could be green over the failure it names.
    const RAW_IMPORT = /@import\s*url\(/;
    expect(RAW_IMPORT.test(`@import url('../../contracts/tokens.css');`), 'the raw @import matcher no longer fires').toBe(
      true
    );
    expect(RAW_IMPORT.test(`@use '../../contracts/tokens';`)).toBe(false);
    expect(INDEX_SOURCE, 'app/scss/_index.scss carries a raw url() @import').not.toMatch(RAW_IMPORT);
  });

  it('loads both contract files, each resolving to the one authored copy', () => {
    const contractLoads = loadsIn(INDEX_SOURCE).filter(isContractLoad);

    // Claim one: both files are loaded, identified by what the path resolves to on disk rather
    // than by how it is spelled, so this is not a check on `../../`.
    const resolved = contractLoads.map(resolvedTarget);
    expect(resolved, 'app/scss/_index.scss does not load both contracts/tokens.css and contracts/fonts.css').toEqual(
      expect.arrayContaining([TOKENS_CSS, FONTS_CSS])
    );
    expect(resolved.length, 'app/scss/_index.scss loads something under contracts/ beyond the two files').toBe(2);

    // Claim two: every one of them lands inside `contracts/` and nowhere else.
    for (const target of resolved) {
      expect(existsSync(target), `a contract load resolves to ${target}, which does not exist`).toBe(true);
      expect(
        relative(resolve(REPO_ROOT, 'contracts'), target).split('\\').join('/'),
        `a contract load resolves outside contracts/, to ${target}`
      ).not.toMatch(/^\.\./);
    }
  });

  it('loads tokens before fonts, and both before the local font faces', () => {
    const loads = loadsIn(INDEX_SOURCE);
    const at = (target: string): number => {
      const found = loads.find((load) => resolvedTarget(load) === target);
      if (!found) throw new Error(`${HERE}: nothing in app/scss/_index.scss loads ${target}`);
      return found.at;
    };

    // Claim three, on its own, and falsifiable on its own: AD-14's file order.
    expect(at(TOKENS_CSS), 'contracts/fonts.css is loaded before contracts/tokens.css').toBeLessThan(at(FONTS_CSS));

    // Claim four: position against the local forwards. Dart Sass emits module CSS in source
    // order, so a contract load moved below `@forward './fonts'` would put the contract's three
    // `@font-face` blocks after the Anchor's ten. Nothing else in the repository notices.
    const localFonts = loads.find((load) => load.rule === '@forward' && load.path === './fonts');
    expect(localFonts, `app/scss/_index.scss no longer forwards './fonts'`).toBeTruthy();
    expect(
      at(FONTS_CSS),
      `the contract loads sit below @forward './fonts', so the contract's @font-face blocks are ` +
        `emitted after the Anchor's own`
    ).toBeLessThan(localFonts?.at ?? -1);
  });

  it('shares no @font-face family with the local faces, which is what makes the order above safe', () => {
    // The order pinned above only matters if two blocks could compete, and two blocks compete
    // only when they name the same family. That premise is stated in the story's Code Map and
    // in `ops/anchor-token-adoption.md` and was asserted nowhere: if a local face ever took a
    // contract family name, emission order would silently decide which one wins and the order
    // case above would be pinning a spelling rather than a behaviour.
    const local = familiesIn(readFileSync(LOCAL_FONTS_SCSS, 'utf8'));
    const published = familiesIn(readFileSync(FONTS_CSS, 'utf8'));

    expect(local.length, 'app/scss/_fonts.scss declares no @font-face, so this case measures nothing').toBe(
      LOCAL_FACE_COUNT
    );
    expect(published.length, 'contracts/fonts.css no longer declares three @font-face blocks').toBe(
      CONTRACT_FACE_COUNT
    );

    const shared = local.filter((family) => published.includes(family));
    expect(
      shared,
      `a local @font-face and a published one declare the same family, so which one wins is decided by ` +
        `emission order:\n${shared.join('\n')}`
    ).toEqual([]);

    // The intersection, on a planted control through the same comparison.
    expect([...local, published[0]].filter((family) => published.includes(family))).toEqual([published[0]]);
  });
});

describe('no contract name collides with a name the Hub already declares', () => {
  it('found all fifteen of the Hub own custom properties in app/app.scss', () => {
    // The no-collision argument rests on this count. If the Hub declared a sixteenth somewhere
    // else, the intersection below would be empty for the wrong reason. It matters more after
    // Story 1-18, not less: the alias layer references contract names without declaring any, so
    // a component declaring its own `--token-*` would shadow a role for its whole subtree.
    expect(HUB_NAMES.length, 'app/app.scss no longer declares exactly fifteen custom properties').toBe(
      HUB_PROPERTY_COUNT
    );
    for (const name of ['--white-color', '--black-color', '--accent', '--monument-bold']) {
      expect(HUB_NAMES, `app/app.scss no longer declares ${name}`).toContain(name);
    }

    // No component stylesheet declares one, which is the other half of the same argument.
    //
    // `DECLARATION` anchors on the character that opens a declaration rather than matching any
    // `--name:` text, because a BEM modifier carrying a pseudo-class (`.btn--primary:hover`) is
    // `--name:` too and would be counted as a declared custom property, failing the count above
    // for a reason that has nothing to do with the contract. No such selector exists in this
    // repository today, which is why the loose form has cost nothing so far.
    const elsewhere: string[] = [];
    for (const file of SCANNED.flatMap((directory) => scannedUnder(directory))) {
      if (file === 'app/app.scss' || !file.endsWith('.scss')) continue;
      const declared = [...withoutComments(readFileSync(resolve(REPO_ROOT, file), 'utf8')).matchAll(DECLARATION)];
      for (const found of declared) elsewhere.push(`${file} declares ${found[1]}`);
    }

    // The matcher, on a planted pair, before its empty result is read as good news.
    expect([...'.a { --x: 1px; }'.matchAll(DECLARATION)].map((found) => found[1])).toEqual(['--x']);
    expect([...'.btn--primary:hover { color: red; }'.matchAll(DECLARATION)]).toEqual([]);
    expect(
      elsewhere,
      `a stylesheet other than app/app.scss declares a custom property, so the collision check above ` +
        `no longer covers every name the Hub has:\n${elsewhere.join('\n')}`
    ).toEqual([]);
  });

  it('shares no name with the contract, in either direction', () => {
    // Both sides of the intersection are pinned. An empty intersection means nothing if either
    // list could have been empty, and this is the argument the whole story rests on.
    expect(TOKEN_NAMES.length, 'the contract declares a different number of distinct names').toBe(DECLARED_COUNT);
    expect(HUB_NAMES.length, 'app/app.scss declares a different number of custom properties').toBe(HUB_PROPERTY_COUNT);

    const collisions = HUB_NAMES.filter((name) => TOKEN_NAMES.includes(name));
    expect(
      collisions,
      `the contract and app/app.scss declare the same custom property, so wiring the contract in is ` +
        `not appearance-neutral:\n${collisions.join('\n')}`
    ).toEqual([]);

    // The intersection, on a planted control. An empty result means nothing unless the
    // predicate is seen to fire.
    expect([...HUB_NAMES, '--tap'].filter((name) => TOKEN_NAMES.includes(name))).toEqual(['--tap']);
  });
});

describe('the Anchor consumes the contract through one alias layer', () => {
  const files = atCollection(`could not scan ${SCANNED.join(', ')}:`, () =>
    SCANNED.flatMap((directory) => scannedUnder(directory)).sort()
  );

  /**
   * A stylesheet with its comments removed; anything else raw.
   *
   * The alias layer's own comment names half the contract, and a comment discussing a role is not
   * a consumer of it. Only `.scss` and `.css` are stripped: the `//` rule that is safe over CSS is
   * not safe over arbitrary TypeScript, and nothing under a scanned root may reference a contract
   * name from a `.ts` or `.tsx` at all, so those are read raw and the stricter reading is the
   * right one there.
   */
  const readFor = (file: string): string => {
    const contents = readFileSync(resolve(REPO_ROOT, file), 'utf8');
    return file.endsWith('.scss') || file.endsWith('.css') ? withoutComments(contents) : contents;
  };

  /** Every contract name referenced from each scanned file, as `file` to sorted names. */
  const referencesByFile = (): Map<string, string[]> => {
    const found = new Map<string, string[]>();
    for (const file of files) {
      const contents = readFor(file);
      const names = TOKEN_NAMES.filter((name) => referenceTo(name).test(contents)).sort();
      if (names.length > 0) found.set(file, names);
    }
    return found;
  };

  it('scanned every stylesheet and every shipped source under every source root', () => {
    // The root list is pinned against the tracked tree rather than trusted. `SCANNED` was two
    // entries while `hooks/` and `content/` shipped unread, and nothing failed: every other
    // guard in this file checks the scanned roots against themselves and so cannot see a
    // missing one. This is the guard that can. A new top-level source directory fails here
    // rather than silently escaping the scan below.
    const roots = new Set(
      gitLsFiles(['.'])
        .filter((path) => path.includes('/'))
        .filter((path) => SCANNED_EXTENSIONS.some((extension) => path.endsWith(extension)))
        .filter((path) => !path.split('/').includes('__tests__'))
        .map((path) => path.split('/')[0])
        // Not shipped sources, each named in `NOT_SHIPPED_ROOTS` with its reason. A leading `.`
        // or `_` is tooling or BMad output.
        .filter(
          (root) =>
            !NOT_SHIPPED_ROOTS.includes(root as (typeof NOT_SHIPPED_ROOTS)[number]) &&
            !root.startsWith('.') &&
            !root.startsWith('_')
        )
    );
    expect(roots.size, 'no tracked source root was found, so the comparison below is vacuous').toBeGreaterThan(0);
    const unscanned = [...roots].filter((root) => !SCANNED.includes(root as (typeof SCANNED)[number])).sort();
    expect(
      unscanned,
      `a top-level directory carries shipped ${SCANNED_EXTENSIONS.join('/')} sources and is not in SCANNED, so a ` +
        `consumer arriving there would be invisible to the check below:\n${unscanned.join('\n')}`
    ).toEqual([]);

    expect(
      files.length,
      `only ${files.length} scanned files were found under ${SCANNED.join(', ')}, so the scan below ` +
        `would pass over almost nothing`
    ).toBeGreaterThanOrEqual(MINIMUM_SCANNED_FILES);
    expect(
      files.filter((file) => file.endsWith('.scss')).length,
      'fewer than nineteen stylesheets were scanned'
    ).toBeGreaterThanOrEqual(MINIMUM_SCSS_FILES);

    // Two different claims, because the list holds two different kinds of extension.
    //
    // `PRESENT_EXTENSIONS` exist under a scanned root today, so "at least one was read" is a real
    // measurement and losing one is loud. The rest are anticipatory: a `.css`, `.js`, `.jsx`,
    // `.mjs` or `.cjs` consumer is a shape nothing in the Anchor takes yet, and demanding a file
    // that does not exist would fail the run for the wrong reason. What is asserted for those is
    // that the scan's own filter would pick them up, which is the property that was actually
    // missing while the list read `.scss`, `.ts`, `.tsx` and the scan claimed to cover consumers.
    for (const extension of PRESENT_EXTENSIONS) {
      expect(
        files.some((file) => file.endsWith(extension)),
        `no ${extension} file was scanned, so a consumer arriving in one would be invisible`
      ).toBe(true);
    }
    for (const extension of SCANNED_EXTENSIONS) {
      expect(
        SCANNED_EXTENSIONS.some((candidate) => `consumer${extension}`.endsWith(candidate)),
        `the scan filter does not accept ${extension}, so a consumer arriving in one would be skipped`
      ).toBe(true);
    }
    for (const directory of SCANNED) {
      expect(
        files.some((file) => file.startsWith(`${directory}/`)),
        `nothing under ${directory}/ was scanned`
      ).toBe(true);
    }
    expect(files, 'app/app.scss was not among the scanned files').toContain('app/app.scss');
    for (const file of files) {
      expect(statSync(resolve(REPO_ROOT, file)).size, `${file} is empty`).toBeGreaterThan(0);
    }
  });

  it('redefines all fifteen of its own properties as the decided mapping, and points none at the palette', () => {
    // Both sides of the comparison are pinned, so a table that lost a row cannot agree with a
    // stylesheet that lost the same one.
    expect(HUB_DECLARED.size, 'app/app.scss no longer declares exactly fifteen custom properties').toBe(
      HUB_PROPERTY_COUNT
    );
    expect(
      Object.keys(ALIAS_MAPPING).length + Object.keys(LOCAL_LITERALS).length,
      'the pinned mapping table no longer covers fifteen properties'
    ).toBe(HUB_PROPERTY_COUNT);
    expect(
      [...HUB_DECLARED.keys()].sort(),
      'app/app.scss declares a different set of properties from the one DESIGN.md section The mapping decided'
    ).toEqual([...Object.keys(ALIAS_MAPPING), ...Object.keys(LOCAL_LITERALS)].sort());

    // The parser, on a planted pair, through the same function the assertions below call. A
    // value that merely contains a reference is not an alias, and reading it as one would let
    // `var(--token-text) var(--token-bg)` or a `var(--x, #fff)` fallback pass as the mapping.
    expect(aliasTarget('var(--token-text)')).toBe('--token-text');
    expect(aliasTarget(' var( --f-display ) ')).toBe('--f-display');
    expect(aliasTarget('#fff')).toBeNull();
    expect(aliasTarget('var(--token-text) var(--token-bg)')).toBeNull();
    expect(aliasTarget('var(--token-text, #fff)')).toBeNull();
    expect(isPaletteName('--c-paper')).toBe(true);
    expect(isPaletteName('--token-bg')).toBe(false);

    const wrong: string[] = [];
    for (const [property, role] of Object.entries(ALIAS_MAPPING)) {
      const value = HUB_DECLARED.get(property) ?? '';
      const target = aliasTarget(value);

      if (target === null) {
        wrong.push(`${property}: expected var(${role}) but app/app.scss declares "${value}"`);
        continue;
      }
      if (target !== role) {
        wrong.push(`${property}: expected ${role} but app/app.scss points it at ${target}`);
        continue;
      }
      // AD-14: the raw palette is not consumed outside `contracts/`, so an alias may only ever
      // land on a semantic role, a family or a spacing name.
      if (isPaletteName(target)) {
        wrong.push(`${property}: ${target} is a raw palette name, which AD-14 bars a consumer from reading`);
        continue;
      }
      if (!TOKEN_NAMES.includes(target)) {
        wrong.push(`${property}: ${target} is not declared by contracts/tokens.css`);
      }
    }

    for (const [property, literal] of Object.entries(LOCAL_LITERALS)) {
      const value = HUB_DECLARED.get(property) ?? '';
      if (value !== literal) wrong.push(`${property}: expected the literal ${literal} but app/app.scss declares "${value}"`);
      if (aliasTarget(value) !== null) {
        wrong.push(`${property}: is now a var() reference, and it is meant to stay local`);
      }
    }

    expect(
      wrong,
      `the alias layer does not match the mapping DESIGN.md section The mapping decided:\n${wrong.join('\n')}`
    ).toEqual([]);

    // The mapping is not vacuous in the other direction either: it really does reach the roles
    // the story claims, and a role list that shrank to nothing would fail here.
    const targets = new Set(Object.values(ALIAS_MAPPING));
    expect(targets.size, 'the mapping points at fewer than ten distinct roles').toBeGreaterThanOrEqual(10);
    for (const known of ['--token-bg', '--token-text', '--f-display', '--page-pad']) {
      expect([...targets], `the mapping no longer points anything at ${known}`).toContain(known);
    }
  });

  it(`has deleted ${DELETED_PROPERTY}, which is declared nowhere and referenced nowhere`, () => {
    // O-11 was closed on 2026-08-15 with exactly this evidence, and it is re-verified here rather
    // than trusted, because a deletion asserted only by a record is a deletion nobody can see.
    const everywhere = atCollection('could not list the repository:', () => gitLsFiles(['.']))
      .filter((path) => SCANNED_EXTENSIONS.some((extension) => path.endsWith(extension)))
      // A test that names the property is not a call site of it, and this very case names it.
      .filter((path) => !path.split('/').includes('__tests__') && path.split('/')[0] !== 'tests');

    expect(everywhere.length, 'no source file was listed, so the search below is vacuous').toBeGreaterThan(
      MINIMUM_SCANNED_FILES
    );
    expect(everywhere, 'app/app.scss was not searched').toContain('app/app.scss');

    expect(HUB_NAMES, `app/app.scss still declares ${DELETED_PROPERTY}`).not.toContain(DELETED_PROPERTY);

    const survivors: string[] = [];
    for (const path of everywhere) {
      const contents = readFileSync(resolve(REPO_ROOT, path), 'utf8');
      if (referenceTo(DELETED_PROPERTY).test(contents)) survivors.push(path);
    }
    expect(
      survivors,
      `${DELETED_PROPERTY} survives in a shipped source, so O-11's closure evidence no longer holds:\n` +
        survivors.join('\n')
    ).toEqual([]);

    // The same search, run for a property that **is** there, so an empty result cannot mean the
    // search stopped working. `--accent-dim` has twelve live call sites and its own declaration.
    const alive = everywhere.filter((path) =>
      referenceTo('--accent-dim').test(readFileSync(resolve(REPO_ROOT, path), 'utf8'))
    );
    expect(
      alive.length,
      `the repository-wide search found no file mentioning --accent-dim, so its zero result for ` +
        `${DELETED_PROPERTY} means nothing`
    ).toBeGreaterThan(1);
  });

  it('references a contract name only from the alias layer and the named call sites', () => {
    const observed = referencesByFile();

    // The scan fires. Both shapes a consumer could take, through the same predicate the scan
    // calls, before any empty or short result is read as good news.
    for (const planted of [
      `.control { color: var(${TOKEN_NAMES[0]}); }`,
      `element.style.setProperty('${TOKEN_NAMES[0]}', 'red');`,
    ]) {
      expect(
        TOKEN_NAMES.some((name) => referenceTo(name).test(planted)),
        `the scan does not fire on "${planted}", so its result means nothing`
      ).toBe(true);
    }
    expect(
      TOKEN_NAMES.some((name) => referenceTo(name).test('.control { color: var(--accent); }')),
      'the scan fires on a stylesheet that reads only the Hub own aliases'
    ).toBe(false);

    const expected = new Map<string, string[]>([
      ['app/app.scss', [...new Set(Object.values(ALIAS_MAPPING))].sort()],
      ...Object.entries(CALL_SITE_RESOLUTIONS).map(
        ([file, names]) => [file, [...names].sort()] as [string, string[]]
      ),
    ]);

    // The alias layer really is doing the work: ten distinct roles reached from one file.
    expect(
      observed.get('app/app.scss') ?? [],
      'app/app.scss references no contract name, so the alias layer is not there'
    ).toEqual(expected.get('app/app.scss'));

    const drift: string[] = [];
    for (const [file, names] of observed) {
      const want = expected.get(file);
      if (!want) {
        drift.push(`${file} reaches past the alias layer and references ${names.join(', ')}`);
        continue;
      }
      if (names.join(',') !== want.join(',')) {
        drift.push(`${file} references ${names.join(', ')} but the enumerated resolution is ${want.join(', ')}`);
      }
    }
    for (const file of expected.keys()) {
      if (!observed.has(file)) drift.push(`${file} no longer references any contract name at all`);
    }

    expect(
      drift,
      `the contract is referenced from somewhere other than app/app.scss and the enumerated ` +
        `per-call-site resolutions:\n${drift.join('\n')}`
    ).toEqual([]);

    // Seven resolutions across six stylesheets, pinned, so a call site quietly joining or leaving
    // the list fails rather than widening the invariant.
    expect(observed.size, 'a different number of files reference the contract').toBe(expected.size);
    expect(
      Object.values(CALL_SITE_RESOLUTIONS).flat().length,
      'the enumerated per-call-site resolutions are no longer seven'
    ).toBe(BOUNDARY_COUNT + 4);
  });

  it('splits the fifteen --accent-dim call sites into three boundaries and twelve ornaments', () => {
    // The rule, restated where it is applied: a call site is a boundary when a sibling rule
    // rewrites that same property under `:hover`, `:focus-visible` or a state attribute. The
    // three that satisfy it read `var(--token-border-interactive)`; the twelve that do not still
    // read `var(--accent-dim)`. Both lists are pinned by file and property, and the failure
    // message carries the line, so a site moving between them names itself.
    expect(BOUNDARY_SITES.length, 'the pinned boundary list is no longer three sites').toBe(BOUNDARY_COUNT);
    expect(ORNAMENT_SITES.length, 'the pinned ornament list is no longer twelve sites').toBe(ORNAMENT_COUNT);

    // The line parser, on a planted pair, before its results are trusted.
    expect(declaredProperty('  border-left: 3px solid var(--token-border-interactive);')).toBe('border-left');
    expect(declaredProperty('    background: var(--accent-dim);')).toBe('background');
    expect(declaredProperty('  &:hover {')).toBeNull();

    const boundary: string[] = [];
    const ornament: string[] = [];
    const where: string[] = [];

    for (const file of files.filter((candidate) => candidate.endsWith('.scss') && candidate !== 'app/app.scss')) {
      const lines = withoutComments(readFileSync(resolve(REPO_ROOT, file), 'utf8')).split(/\r?\n/);
      lines.forEach((line, index) => {
        const property = declaredProperty(line);
        if (property === null) return;
        if (referenceTo('--token-border-interactive').test(line)) {
          boundary.push(`${file} ${property}`);
          where.push(`${file}:${index + 1} ${property} boundary`);
        } else if (referenceTo('--accent-dim').test(line)) {
          ornament.push(`${file} ${property}`);
          where.push(`${file}:${index + 1} ${property} ornament`);
        }
      });
    }

    expect(
      boundary.sort(),
      `the sites reading var(--token-border-interactive) are not the three the resolution names:\n` +
        where.join('\n')
    ).toEqual([...BOUNDARY_SITES].sort());
    expect(
      ornament.sort(),
      `the sites still reading var(--accent-dim) are not the twelve the resolution names:\n${where.join('\n')}`
    ).toEqual([...ORNAMENT_SITES].sort());

    // Fifteen in total, pinned, because two lists that each lost the same site would still agree.
    expect(boundary.length + ornament.length, '--accent-dim no longer resolves across fifteen call sites').toBe(
      BOUNDARY_COUNT + ORNAMENT_COUNT
    );
  });

  it('names none of the three families the font contract publishes, from any of them', () => {
    // The token half of "consumed by nothing" was asserted name by name; the font half was not
    // asserted at all. It carries the same weight: "an unused `@font-face` is never downloaded"
    // is one of the two pillars the appearance-neutrality argument rests on, and the other
    // (no custom property collides) was already pinned on both sides. A Hub stylesheet adding
    // `font-family: Geist` would start a download and paint different glyphs while the token
    // scan, the face-URL check and `document.fonts` all stayed green, because none of them asks
    // whether anything in the Hub *uses* a published family.
    const published = familiesIn(readFileSync(FONTS_CSS, 'utf8'));
    expect(published.length, 'contracts/fonts.css declares no family, so the scan below is vacuous').toBe(
      CONTRACT_FACE_COUNT
    );

    const references: string[] = [];
    for (const file of files) {
      const contents = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      for (const family of published) {
        if (referenceTo(family).test(contents)) references.push(`${file} names ${family}`);
      }
    }
    expect(
      references,
      `a source already sets a published contract family, which would download the face and change ` +
        `what the Hub paints:\n${references.join('\n')}`
    ).toEqual([]);

    // The matcher, through the same predicate the scan calls, on both shapes a use could take.
    for (const planted of [
      `.control { font-family: ${published[0]}, sans-serif; }`,
      `element.style.fontFamily = '"${published[0]}", sans-serif';`,
    ]) {
      expect(
        published.some((family) => referenceTo(family).test(planted)),
        `the family scan does not fire on "${planted}", so its zero result means nothing`
      ).toBe(true);
    }
    expect(
      published.some((family) => referenceTo(family).test('.control { font-family: system-ui; }')),
      'the family scan fires on a stylesheet naming no contract family'
    ).toBe(false);
  });

  it('mentions contracts/ in the wiring file and the alias layer, and nowhere else', () => {
    // Two files now, not one. `app/scss/_index.scss` loads the contract and `app/app.scss` names
    // it in the comment that explains the alias layer, which is the one place a reader arrives at
    // asking where these roles come from. Any third mention is a component reaching for the
    // published surface by path, which is a different failure from reading a token name and is
    // reported separately from it.
    const mentions = files.filter((file) => /contracts\//.test(readFileSync(resolve(REPO_ROOT, file), 'utf8')));
    expect(
      mentions.sort(),
      'contracts/ is mentioned by a source other than the wiring file and the alias layer'
    ).toEqual(['app/app.scss', 'app/scss/_index.scss']);
  });
});

describe('the Anchor holds no second authored copy of the contract', () => {
  const tracked = atCollection('could not list app, components and public:', () =>
    gitLsFiles(['app', 'components', 'public'])
  );

  it('listed a real tree, so an empty listing cannot read as nothing found', () => {
    expect(tracked.length, 'git ls-files over app, components and public returned nothing').toBeGreaterThan(0);

    // One sentinel per pathspec, not one for all three. `app/app.scss` alone proved only that
    // `app/` was read: if `components/` or `public/` ever left the listing, by a rename, a move or
    // an over-broad ignore rule, the case below would have stayed green over a directory it never
    // opened. That is the same fail-open shape every count in this file is pinned to prevent.
    for (const sentinel of KNOWN_TRACKED) {
      expect(tracked, `${sentinel} is not in the listing, so its pathspec contributed nothing`).toContain(sentinel);
    }
  });

  it('tracks no tokens.css, fonts.css or tailwind.css under app/, components/ or public/', () => {
    const copies = tracked.filter(isContractCopy);
    expect(
      copies,
      `a contract file is authored a second time outside contracts/, which AD-4 forbids:\n${copies.join('\n')}`
    ).toEqual([]);

    // The same predicate the assertion uses, on a planted control. Duplicating the expression
    // here instead would let a change to the real filter leave the control green.
    expect(['public/css/tokens.css', 'public/logo.png'].filter(isContractCopy)).toEqual(['public/css/tokens.css']);
  });

  it('has no cuatro-contracts directory anywhere in the repository', () => {
    const everything = atCollection('could not list the repository:', () => gitLsFiles(['.']));
    expect(everything.length, 'git ls-files over the repository returned nothing').toBeGreaterThan(tracked.length);
    expect(everything, 'package.json is not in the listing').toContain('package.json');

    const vendored = everything.filter(isVendoredPath);
    expect(
      vendored,
      `${VENDORED_FOLDER}/ is the name a Satellite vendors the contract under. The Anchor is the ` +
        `publisher and loads contracts/ directly:\n${vendored.join('\n')}`
    ).toEqual([]);

    expect([`assets/${VENDORED_FOLDER}/tokens.css`, 'assets/design/tokens.css'].filter(isVendoredPath)).toEqual([
      `assets/${VENDORED_FOLDER}/tokens.css`,
    ]);
  });
});
