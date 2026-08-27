// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * The source half of Anchor migration step 1 (Story 1-17).
 *
 * No browser and no network. `tests/e2e/contract-anchor.pw.ts` is the other half and asserts
 * what the built Hub actually resolves; this file asserts four things about the sources that a
 * rendered check cannot see:
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
 *  2. **No name collides.** All sixteen of the Hub's custom properties are declared in
 *     `app/app.scss`, none of the eighty-nine contract names is among them, and both counts are
 *     pinned so the intersection cannot be empty because a list was.
 *  3. **The contract is consumed by the alias layer and by nothing else.** Story 1-17 asserted
 *     that nothing consumed it at all; Story 1-18 wrote the alias layer, so the case is
 *     **inverted rather than deleted**. Every name `contracts/tokens.css` declares is looked for
 *     in every scanned file under every shipped source root, `app/`, `components/`, `hooks/` and
 *     `content/`, and the count of files read is asserted so the scan cannot pass over an empty
 *     selection. `app/app.scss` must reference exactly the pinned set of roles the mapping names,
 *     the four `--monument-bold` call sites exactly `--w-black`, and every other scanned file
 *     none, so a component stylesheet reaching for a role and an alias silently retargeted both
 *     fail.
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

/** The Hub's own custom properties, all sixteen of them, all in one file. */
const HUB_PROPERTY_COUNT = 16;

/**
 * **The mapping, property by property**, which is the whole content of Story 1-18's first
 * acceptance criterion. `epics.md:1821-1836` and `DESIGN.md` § The mapping, whose value-by-value
 * half for the cybercore properties is `rebaseline-2026-08-15.md` § O-10.
 *
 * **Pairwise, not as a set.** An earlier version of this file pinned only the set of roles the
 * alias layer references and then asserted that each aliased property named *some* member of it.
 * Swapping `--light-gray-color` and `--gray-color` onto each other's roles leaves that set
 * unchanged and passed every gate in both halves of the story, while turning the Hub's secondary
 * text into a border colour and its borders into text. The row is what this criterion is about,
 * so the row is what is pinned.
 *
 * `--accent-dim` maps to two roles, which is the point of it: `--token-accent-muted` is the
 * `:root` value and the eleven ornament call sites, and `--token-border-interactive` arrives
 * through the three scoped redefinitions for the four boundary call sites
 * (`epics.md:1831-1834`). It is the only row with a second role, and that is asserted below.
 */
const MAPPING: ReadonlyArray<readonly [property: string, roles: readonly string[]]> = [
  ['--white-color', ['--token-text']],
  ['--black-color', ['--token-bg']],
  ['--light-gray-color', ['--token-text-secondary']],
  ['--gray-color', ['--token-border-interactive']],
  ['--accent', ['--token-accent']],
  ['--accent-dim', ['--token-accent-muted', '--token-border-interactive']],
  ['--page-padding', ['--page-pad']],
  ['--font-regular', ['--f-body']],
  ['--font-bold', ['--f-body']],
  ['--monument-regular', ['--f-display']],
  ['--monument-bold', ['--f-display']],
  ['--font-mono', ['--f-mono']],
];

/** The role the alias layer declares a property as on `:root`, which is the first of its row. */
const ROLE_ON_ROOT = new Map(MAPPING.map(([property, roles]) => [property, roles[0]]));

/** The twelve Hub properties the alias layer redefines as `var()` references, from the map. */
const ALIASED_PROPERTIES = MAPPING.map(([property]) => property);

/**
 * The roles the alias layer references, **derived from the map** rather than restated beside it.
 *
 * A second list would be a second place to keep in step, and the failure it would hide is a row
 * changed in one and not the other.
 */
const ALIAS_ROLES = [...new Set(MAPPING.flatMap(([, roles]) => roles))];

/**
 * The four the alias layer deliberately leaves authored as literals.
 *
 * Not an oversight, and each is held by something open: `--accent-glow` by O-11, `--hero-height`
 * by being a layout constant the contract carries no role for, and the two Confillia names by the
 * type swap (UX-DR12) and O-6.
 */
const LITERAL_PROPERTIES = ['--accent-glow', '--hero-height', '--confillia-normal', '--confillia-bold'] as const;

/**
 * The four `--monument-bold` call sites, the only component stylesheets this story edits.
 *
 * A family alias cannot carry the weight that lived in the family name `MonumentExtended-Bold`,
 * so each of these sets `font-weight` alongside `font-family` by hand. That makes each of them a
 * second, named consumer of the contract, which is why the scan below allows exactly one role
 * from exactly these four paths rather than allowing none from anywhere but `app/app.scss`.
 */
const WEIGHT_CALL_SITES = [
  'components/molecules/GlitchText/glitch-text.scss',
  'components/organisms/ErrorPage/error-page.scss',
  'components/organisms/ProjectsHero/ProjectsHero.scss',
  'components/organisms/WorkHero/WorkHero.scss',
] as const;

/** The one role those four are allowed to name, per `DESIGN.md` § The mapping. */
const WEIGHT_ROLE = '--w-black';

/** The one file that carries the alias layer. */
const ALIAS_LAYER = 'app/app.scss';

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

/** Every `--name` `app/app.scss` declares. All sixteen of the Hub's own live in that one file. */
const HUB_NAMES = atCollection('could not parse app/app.scss:', () => {
  const source = withoutComments(readFileSync(APP_SCSS, 'utf8'));
  return [...new Set([...source.matchAll(DECLARATION)].map((found) => found[1]))];
});

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
  it('found all sixteen of the Hub own custom properties in app/app.scss', () => {
    // The "identical by construction" argument rests on this count. If the Hub declared a
    // seventeenth somewhere else, the intersection below would be empty for the wrong reason.
    expect(HUB_NAMES.length, 'app/app.scss no longer declares exactly sixteen custom properties').toBe(
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

describe('the Anchor consumes the contract through the alias layer and nowhere else', () => {
  const files = atCollection(`could not scan ${SCANNED.join(', ')}:`, () =>
    SCANNED.flatMap((directory) => scannedUnder(directory)).sort()
  );

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

  it('is consumed by the alias layer in app/app.scss and by nothing else', () => {
    // Story 1-17's case asserted zero references from every scanned file, and its failure
    // message said a consumer "is Story 1-18's act and not this one's". This is that act, so the
    // case is inverted rather than deleted: the same scan, over the same files, now says exactly
    // where a contract name is allowed to appear and exactly which names are allowed there.
    const referencesBy = new Map<string, string[]>();
    let scanned = 0;

    for (const file of files) {
      const contents = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      scanned += 1;
      const found = TOKEN_NAMES.filter((name) => referenceTo(name).test(contents)).sort();
      if (found.length > 0) referencesBy.set(file, found);
    }

    expect(scanned, 'no file was read').toBe(files.length);
    expect(files, `${ALIAS_LAYER} was not among the scanned files, so the case below is vacuous`).toContain(ALIAS_LAYER);
    for (const site of WEIGHT_CALL_SITES) {
      expect(files, `${site} was not among the scanned files`).toContain(site);
    }

    // The pinned lists are checked against the contract before they are compared against the
    // sources. A role renamed in `contracts/tokens.css` would otherwise make every list below
    // agree on a name the contract no longer declares, and a MAJOR bump is meant to be loud.
    for (const role of [...ALIAS_ROLES, WEIGHT_ROLE]) {
      expect(TOKEN_NAMES, `${role} is in the pinned mapping but the contract no longer declares it`).toContain(role);
    }

    // Claim one: the alias layer references exactly the roles the mapping names. An alias
    // silently retargeted to some other role fails here, and so does one dropped altogether.
    expect(
      referencesBy.get(ALIAS_LAYER) ?? [],
      `${ALIAS_LAYER} does not reference exactly the roles epics.md:1821-1836 maps onto. An alias ` +
        `retargeted to a different role, or dropped, changes what the whole site paints from one line.`
    ).toEqual([...ALIAS_ROLES].sort());

    // Claim two: the four `--monument-bold` call sites reference exactly `--w-black`, which is
    // the weight a family alias cannot carry, and nothing else.
    for (const site of WEIGHT_CALL_SITES) {
      expect(
        referencesBy.get(site) ?? [],
        `${site} is a --monument-bold call site and may name ${WEIGHT_ROLE} and no other contract name`
      ).toEqual([WEIGHT_ROLE]);
    }

    // Claim three: nothing else reaches for a role at all. A component stylesheet consuming a
    // token role directly is the Epic 2 rebuild, not this step, and it would leave the alias
    // layer no longer describing what the site reads.
    const allowed = new Set<string>([ALIAS_LAYER, ...WEIGHT_CALL_SITES]);
    const elsewhere = [...referencesBy]
      .filter(([file]) => !allowed.has(file))
      .map(([file, names]) => `${file} references ${names.join(', ')}`);
    expect(
      elsewhere,
      `a source outside the alias layer consumes the contract, so the migration no longer runs ` +
        `through one file:\n${elsewhere.join('\n')}`
    ).toEqual([]);

    // The scan, against planted control strings rather than against a file. A run that read
    // every file and matched nothing looks identical to a run whose matcher was broken, and this
    // is what separates the two. Both shapes a consumer could take, through the same predicate
    // the loop above calls.
    for (const planted of [
      `.control { color: var(${TOKEN_NAMES[0]}); }`,
      `element.style.setProperty('${TOKEN_NAMES[0]}', 'red');`,
    ]) {
      expect(
        TOKEN_NAMES.some((name) => referenceTo(name).test(planted)),
        `the scan does not fire on "${planted}", so its zero result means nothing`
      ).toBe(true);
    }
    expect(
      TOKEN_NAMES.some((name) => referenceTo(name).test('.control { color: var(--accent-dim); }')),
      'the scan fires on a Hub name, so the partition above cannot tell a role from an alias'
    ).toBe(false);
  });

  it('aliases each of the twelve onto the role the mapping assigns it, and leaves the other four as literals', () => {
    // The mapping is a whitelist in both directions, **row by row**. Twelve properties become
    // `var()` references to a named role; the other four stay literals because something open
    // holds each of them, and aliasing one anyway is a silent departure from the plan that no
    // rendered check would see as a defect. Read off `app/app.scss` rather than off the browser,
    // because what is being asserted is what the file authors.
    const source = withoutComments(readFileSync(APP_SCSS, 'utf8'));
    const root = /:root\s*\{([^}]*)\}/.exec(source);
    expect(root, 'no :root block was parsed out of app/app.scss, so this case measures nothing').not.toBeNull();

    const declarationsIn = (block: string): Map<string, string> => {
      const found = new Map<string, string>();
      for (const raw of block.split(';')) {
        const at = raw.indexOf(':');
        if (at === -1) continue;
        const name = raw.slice(0, at).trim();
        if (name.startsWith('--')) found.set(name, raw.slice(at + 1).trim());
      }
      return found;
    };

    const declared = declarationsIn(root?.[1] ?? '');

    expect(declared.size, 'app/app.scss no longer declares sixteen custom properties on :root').toBe(
      HUB_PROPERTY_COUNT
    );
    expect(
      [...declared.keys()].sort(),
      'the aliased and literal lists do not partition the Hub sixteen'
    ).toEqual([...ALIASED_PROPERTIES, ...LITERAL_PROPERTIES].sort());

    const IS_VAR_REFERENCE = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/;

    // The matcher, on a planted pair, before either verdict below is read as good news.
    expect(IS_VAR_REFERENCE.test('var(--token-bg)')).toBe(true);
    expect(IS_VAR_REFERENCE.test('rgba(139, 92, 246, 0.4)')).toBe(false);

    // **Row by row, not against the set.** `toContain` over `ALIAS_ROLES` would pass on any
    // permutation of the twelve across the ten roles, and swapping `--light-gray-color` with
    // `--gray-color` is a permutation that turns secondary text into a border colour with every
    // gate green.
    const wrong: string[] = [];
    for (const name of ALIASED_PROPERTIES) {
      const value = declared.get(name) ?? '';
      const reference = IS_VAR_REFERENCE.exec(value);
      expect(reference, `app/app.scss authors ${name} as "${value}" rather than as a var() reference`).not.toBeNull();
      const assigned = ROLE_ON_ROOT.get(name);
      if (reference?.[1] !== assigned) {
        wrong.push(`${name} references ${reference?.[1]}, and epics.md:1821-1836 assigns it ${assigned}`);
      }
    }
    expect(
      wrong,
      `an alias names a role the mapping does not assign it. A permutation of the twelve across ` +
        `the ten roles leaves every set-level check green and repaints the whole site:\n${wrong.join('\n')}`
    ).toEqual([]);

    // **The second half of the `--accent-dim` row**, which lives outside `:root` by design. The
    // scoped redefinitions are what make one property resolve per call site
    // (`epics.md:1831-1834`), and without this the boundary role would be pinned nowhere at
    // source: the `:root` parse above sees only the ornament value.
    //
    // Parsed by the declaration regex rather than by `declarationsIn`, because a selector list
    // carrying `::before` puts a colon ahead of the declaration in the same `;`-delimited chunk
    // and a first-colon split would read `.work-item:` as the property name and skip the row.
    const accentDim = MAPPING.find(([property]) => property === '--accent-dim');
    expect(accentDim?.[1].length, 'the --accent-dim row no longer carries two roles').toBe(2);
    const [ornamentRole, boundaryRole] = accentDim?.[1] ?? [];

    const afterRoot = source.slice((root?.index ?? 0) + (root?.[0].length ?? 0));
    const SCOPED = /(?:^|[;{])\s*--accent-dim\s*:\s*([^;}]+)/gm;
    const scopedValues = [...afterRoot.matchAll(SCOPED)].map((found) => found[1].trim());

    // The matcher, on a planted control in the shape that defeats a first-colon split.
    expect(
      [...'.work-item::before, .a { --accent-dim: var(--x); }'.matchAll(SCOPED)].map((found) => found[1].trim())
    ).toEqual(['var(--x)']);

    expect(
      scopedValues,
      `app/app.scss no longer redeclares --accent-dim outside :root in the two blocks the mapping ` +
        `needs: the boundary scope, without which the four boundary call sites fall below the 3:1 ` +
        `floor AD-19 asserts, and the counter-scope that takes the card's value back off its chips`
    ).toEqual([`var(${boundaryRole})`, `var(${ornamentRole})`]);

    // **The selector lists are parsed, not substring-matched.** `.project-card` is a substring of
    // `.project-card__tech li`, so asking whether the source contains it was satisfied by the
    // counter-scope alone: dropping the card out of the boundary block left this check green and
    // put the card's two borders on the ornament role, below the 3:1 floor AD-19 asserts.
    const SCOPED_BLOCK = /([^{}]*)\{[^{}]*--accent-dim\s*:[^{}]*\}/g;
    const selectorsOf = (text: string): string[] =>
      [...text.matchAll(SCOPED_BLOCK)].flatMap((found) =>
        found[1]
          .split(/\r?\n/)
          .filter((line) => !line.trim().startsWith('//'))
          .join(' ')
          .split(',')
          .map((one) => one.trim())
          .filter((one) => one !== '')
      );

    // The parser, on a planted control: a comment line in the prelude, a multi-selector list, and
    // a longer selector that must not stand in for the shorter one it contains.
    expect(
      selectorsOf('// note\n.project-card__tech li { --accent-dim: var(--x); }'),
      'the selector parser no longer separates a selector from a longer one containing it'
    ).toEqual(['.project-card__tech li']);
    expect(selectorsOf('.a::before,\n.b { --accent-dim: var(--x); }')).toEqual(['.a::before', '.b']);

    expect(
      selectorsOf(afterRoot).sort(),
      `app/app.scss no longer scopes --accent-dim on exactly the four selectors the mapping needs. ` +
        `A selector renamed in its component stylesheet silently stops matching, and that call site ` +
        `falls back to the :root value`
    ).toEqual(['.error-page__back', '.project-card', '.project-card__tech li', '.work-item::before'].sort());

    expect(
      MAPPING.filter(([, roles]) => roles.length > 1).map(([property]) => property),
      'a property other than --accent-dim now maps to more than one role, which the story does not do'
    ).toEqual(['--accent-dim']);

    for (const name of LITERAL_PROPERTIES) {
      const value = declared.get(name) ?? '';
      expect(value, `app/app.scss no longer declares ${name}`).not.toBe('');
      expect(
        IS_VAR_REFERENCE.test(value),
        `app/app.scss authors ${name} as "${value}", a var() reference. It is held by an open ` +
          `question (O-11 for --accent-glow, O-6 and UX-DR12 for the two Confillia names) or, for ` +
          `--hero-height, by the contract carrying no viewport height at all.`
      ).toBe(false);
      for (const role of TOKEN_NAMES) {
        expect(
          referenceTo(role).test(value),
          `app/app.scss authors ${name} as "${value}", which names the contract role ${role}`
        ).toBe(false);
      }
    }
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

  it('mentions contracts/ in the wiring file and nowhere else', () => {
    const mentions = files.filter((file) => /contracts\//.test(readFileSync(resolve(REPO_ROOT, file), 'utf8')));
    expect(
      mentions,
      'contracts/ is mentioned by a source other than the one file this story wires it into'
    ).toEqual(['app/scss/_index.scss']);
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
