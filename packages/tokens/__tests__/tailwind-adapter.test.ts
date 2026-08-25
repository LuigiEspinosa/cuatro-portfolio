// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `contracts/tailwind.css`, the generated `@theme inline` adapter (Story 1-13).
 *
 * This file asserts every row of the spec's I/O and edge-case matrix that does
 * not need a browser. The row that does, "a real Tailwind build", is
 * `tests/e2e/contract-tailwind.pw.ts`, and it is the acceptance: the failure
 * mode here is a mapping that parses, publishes and mints nothing, which every
 * string assertion in this file passes.
 *
 * What this file is for is the other half, the part a browser cannot see: that
 * the two names across a `var()` differ (a cycle resolves to `transparent`
 * silently, so it has to be caught statically), that every referenced name is
 * one `contracts/tokens.css` actually declares, that the raw palette is never
 * reached for, that the import order is the fixed one, and that each of the
 * generator's refusals still refuses.
 *
 * Two kinds of case, on the precedent `tokens-contract.test.ts` set. The reads
 * assert what the committed file declares. The refusal cases run the real
 * generator against a corrupted copy of its inputs through
 * `CUATRO_TOKENS_SOURCE` and `CUATRO_TOKENS_OUTPUT`, so a guard that has quietly
 * stopped rejecting anything is caught by this suite rather than by the next
 * Satellite to vendor an adapter that mints nothing.
 */

/** The budget for a case that spawns `node packages/tokens/build.mjs` for real. */
const SPAWN_TIMEOUT = 120_000;

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');
const PUBLISHED = join(CONTRACTS, 'tailwind.css');
const TOKENS_CSS = join(CONTRACTS, 'tokens.css');
const BUILD = join(PACKAGE_ROOT, 'build.mjs');
const SOURCE_DIR = join(PACKAGE_ROOT, 'tokens');
const THEME_MAP_PATH = join(PACKAGE_ROOT, 'theme-map.json');
const DESIGN = join(
  REPO_ROOT,
  '_bmad-output',
  'planning-artifacts',
  'ux-designs',
  'ux-cuatro-portfolio-2026-08-15',
  'DESIGN.md'
);

/**
 * Reading a file this suite depends on, with the dependency named on failure.
 *
 * A bare `readFileSync` at module scope fails collection with an ENOENT and a
 * path, which says nothing about why this suite wanted the file or what to do
 * about it. The `DESIGN.md` coupling below already gets that treatment; these
 * four are the same kind of coupling and now get it too.
 */
const readOrExplain = (path: string, why: string): string => {
  if (!existsSync(path)) {
    throw new Error(`packages/tokens/__tests__/tailwind-adapter.test.ts: ${path} is missing. ${why}`);
  }
  return readFileSync(path, 'utf8');
};

const css = readOrExplain(
  PUBLISHED,
  'It is the published Tailwind adapter, and this whole suite asserts its contents. Run "pnpm tokens:build".'
);
const tokensCss = readOrExplain(
  TOKENS_CSS,
  'This suite reads it to check that every name the adapter references is one the token contract declares. Run "pnpm tokens:build".'
);
const packageVersion = (
  JSON.parse(
    readOrExplain(
      join(PACKAGE_ROOT, 'package.json'),
      'It carries the single source of the contract version that AD-16 has a scheduled job read out of the published header.'
    )
  ) as { version: string }
).version;

interface ThemeMap {
  sections: { title: string; entries: { key: string; token: string }[] }[];
}

const themeMap = JSON.parse(
  readOrExplain(
    THEME_MAP_PATH,
    'It is the translation table contracts/tailwind.css is generated from, and this suite checks the published file against it.'
  )
) as ThemeMap;
const mapEntries = themeMap.sections.flatMap((section) => section.entries);

/**
 * **Every mapping the adapter publishes, written out.**
 *
 * This list exists because `theme-map.json` cannot be its own oracle. The case
 * below that compares the published block against the map proves the generator
 * copied the map faithfully, and proves nothing about whether the map is right:
 * deleting `--spacing-tap` from it, or re-pointing `--color-accent-muted` at
 * `--token-focus`, would keep that case, the namespace counts and the browser
 * probe all green, because every one of them is derived from the same map. The
 * comparison against `DESIGN.md`'s authored block pins only 14 of the 55 rows,
 * so it does not close the gap either.
 *
 * So the 55 pairs are literal here, in published order, on the same reasoning
 * and in the same shape as `EXPECTED_NAMES` in `tokens-contract.test.ts`. A
 * mapping added, dropped or re-pointed fails this list and has to be changed in
 * two places by someone who meant it.
 */
const EXPECTED_MAPPINGS: [key: string, token: string][] = [
  ['--color-bg', '--token-bg'],
  ['--color-surface', '--token-bg-raised'],
  ['--color-surface-2', '--token-bg-raised-2'],
  ['--color-ink', '--token-text'],
  ['--color-muted', '--token-text-secondary'],
  ['--color-line', '--token-border'],
  ['--color-line-strong', '--token-border-interactive'],
  ['--color-accent', '--token-accent'],
  ['--color-accent-hover', '--token-accent-hover'],
  ['--color-accent-muted', '--token-accent-muted'],
  ['--color-focus', '--token-focus'],
  ['--color-scrim', '--token-scrim'],
  ['--font-display', '--f-display'],
  ['--font-sans', '--f-body'],
  ['--font-mono', '--f-mono'],
  ['--text-3xs', '--t-3xs'],
  ['--text-2xs', '--t-2xs'],
  ['--text-xs', '--t-xs'],
  ['--text-sm', '--t-sm'],
  ['--text-base', '--t-base'],
  ['--text-md', '--t-md'],
  ['--text-lg', '--t-lg'],
  ['--text-xl', '--t-xl'],
  ['--text-2xl', '--t-2xl'],
  ['--text-display', '--t-display'],
  ['--font-weight-light', '--w-light'],
  ['--font-weight-regular', '--w-regular'],
  ['--font-weight-medium', '--w-medium'],
  ['--font-weight-bold', '--w-bold'],
  ['--font-weight-black', '--w-black'],
  ['--leading-display', '--lh-display'],
  ['--leading-heading', '--lh-heading'],
  ['--leading-lede', '--lh-lede'],
  ['--leading-body', '--lh-body'],
  ['--leading-label', '--lh-label'],
  ['--tracking-display', '--tr-display'],
  ['--tracking-heading', '--tr-heading'],
  ['--tracking-name', '--tr-name'],
  ['--tracking-body', '--tr-body'],
  ['--tracking-meta', '--tr-meta'],
  ['--tracking-label', '--tr-label'],
  ['--spacing-2xs', '--s-2xs'],
  ['--spacing-xs', '--s-xs'],
  ['--spacing-sm', '--s-sm'],
  ['--spacing-md', '--s-md'],
  ['--spacing-lg', '--s-lg'],
  ['--spacing-xl', '--s-xl'],
  ['--spacing-2xl', '--s-2xl'],
  ['--spacing-3xl', '--s-3xl'],
  ['--spacing-page-pad', '--page-pad'],
  ['--spacing-tap', '--tap'],
  ['--radius-none', '--r-none'],
  ['--radius-hair', '--r-hair'],
  ['--radius-pill', '--r-pill'],
  ['--container-measure', '--measure'],
];

// ---------------------------------------------------------------------------
// Parsing. The same deliberately dumb approach `tokens-contract.test.ts` takes:
// the contract's whole value is that a consumer in any language reads it with a
// file read and a parser.
// ---------------------------------------------------------------------------

type Declaration = [name: string, value: string];

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '');

const declarationsIn = (text: string): Declaration[] => {
  const found: Declaration[] = [];
  const pattern = /(--[^\s:;{}()]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) found.push([match[1], match[2].trim()]);
  return found;
};

/** The body of the one `@theme` block, by brace counting rather than by regex. */
const themeBlockBody = (text: string): string => {
  const open = text.indexOf('{', text.indexOf('@theme'));
  if (open === -1) throw new Error('the published adapter carries no @theme block');
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  throw new Error('the published adapter has an @theme block with no closing brace');
};

const stripped = stripComments(css);
const mappings = declarationsIn(themeBlockBody(stripped));
const publishedByKey = new Map(mappings);
const tokensDeclared = new Set(declarationsIn(stripComments(tokensCss)).map(([name]) => name));

/** Every statement in the file with the comments and the blank lines removed. */
const statements = stripped
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// The fixed shape: the header, then three imports, then one @theme inline block.
// ---------------------------------------------------------------------------

describe('the shape the adapter is required to have', () => {
  it('leads with the generated header comment and nothing else', () => {
    expect(css.startsWith('/* Cuatro Ecosystem, Tailwind v4 Adapter')).toBe(true);
    const headerEnd = css.indexOf('*/');
    expect(headerEnd, 'the header comment is never closed').toBeGreaterThan(0);
    expect(css.slice(headerEnd + 2).trimStart().startsWith('@import "tailwindcss";')).toBe(true);
    expect(css, 'the adapter is hand-editable only by mistake').toContain('Never edit this file by hand');
  });

  it('imports tailwindcss, then tokens.css, then fonts.css, in that order and before anything else', () => {
    expect(statements.slice(0, 3)).toEqual([
      '@import "tailwindcss";',
      '@import "./tokens.css";',
      '@import "./fonts.css";',
    ]);
  });

  it('opens exactly one @theme block, and it carries the mandatory inline keyword', () => {
    expect(statements[3]).toBe('@theme inline {');
    expect((stripped.match(/@theme\b/g) ?? []).length, 'more than one @theme block').toBe(1);
    // AD-14 and `DESIGN.md:1012-1016`: without `inline` a var() resolves where
    // the theme variable is defined rather than where it is used, and it fails
    // silently the moment a [data-theme] override is added.
    expect(/@theme\s+inline\s*\{/.test(stripped)).toBe(true);
  });

  it('declares no @import beyond the three, and nothing outside the theme block', () => {
    expect((stripped.match(/@import\b/g) ?? []).length).toBe(3);
    // Every declaration in the file sits inside the one @theme block.
    expect(declarationsIn(stripped).length).toBe(mappings.length);
  });

  it('imports fonts.css, which is the whole reason the cluster gets faces and not family names', () => {
    // `DESIGN.md:1006-1010`. An adapter pulling in only tokens.css hands the
    // cluster three named families with no @font-face for any of them.
    expect(statements).toContain('@import "./fonts.css";');
  });
});

// ---------------------------------------------------------------------------
// AD-14: the two namespaces, and every reference resolving.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The published mapping set, pinned literally. `theme-map.json` cannot be its
// own oracle, so this is the list that a dropped or re-pointed mapping fails.
// ---------------------------------------------------------------------------

describe('the published mapping set', () => {
  // Every member list is filtered out of the parsed published file, never
  // appended as a literal, so a mapping deleted from the map fails its namespace
  // count here rather than quietly making the count smaller on both sides.
  const keysMatching = (namespace: string): string[] =>
    mappings.map(([key]) => key).filter((key) => key.startsWith(namespace));

  const namespaces: Array<[label: string, keys: string[], expected: number]> = [
    ['colour', keysMatching('--color-'), 12],
    ['family', keysMatching('--font-').filter((key) => !key.startsWith('--font-weight-')), 3],
    ['type scale', keysMatching('--text-'), 10],
    ['weight', keysMatching('--font-weight-'), 5],
    ['line-height', keysMatching('--leading-'), 5],
    ['tracking', keysMatching('--tracking-'), 6],
    ['spacing', keysMatching('--spacing-'), 10],
    ['radius', keysMatching('--radius-'), 3],
    ['container', keysMatching('--container-'), 1],
  ];

  for (const [label, keys, expected] of namespaces) {
    it(`mints exactly ${expected} ${label} mappings`, () => {
      expect(keys).toHaveLength(expected);
    });
  }

  it('publishes 55 mappings in total and no key twice', () => {
    // The hard total, so a mapping moved out of one namespace and into another
    // cannot net out across the nine counts above.
    expect(mappings).toHaveLength(55);
    expect(new Set(mappings.map(([key]) => key)).size).toBe(55);
    expect(namespaces.reduce((total, [, keys]) => total + keys.length, 0)).toBe(55);
  });

  it('declares exactly the expected mappings, in the expected order', () => {
    expect(mappings).toEqual(EXPECTED_MAPPINGS.map(([key, token]) => [key, `var(${token})`]));
  });

  it('keeps every key and token inside the naming convention', () => {
    for (const [key, value] of mappings) {
      expect(key, `${key} is not a lowercase kebab custom property`).toMatch(/^--[a-z][a-z0-9-]*$/);
      const target = /^var\((--[^\s,)]+)\)$/.exec(value)?.[1] as string;
      expect(target, `${target} is not a lowercase kebab custom property`).toMatch(/^--[a-z][a-z0-9-]*$/);
    }
  });
});

describe('what every mapping must be', () => {
  it('publishes exactly the mappings theme-map.json declares, in its order', () => {
    // This proves the generator copied the map faithfully. It does not prove the
    // map is right, which is what EXPECTED_MAPPINGS above is for.
    expect(mappings).toEqual(mapEntries.map((entry) => [entry.key, `var(${entry.token})`]));
    expect(mappings.length, 'the map is empty, so every assertion below would pass over nothing').toBeGreaterThan(0);
  });

  it('reads a token of the right kind for its namespace, so a length cannot sit in a colour slot', () => {
    // The same table `packages/tokens/build.mjs` refuses on, asserted against the
    // published file as well as against the map the generator read.
    const permitted: [namespace: string, allowed: string[]][] = [
      ['--color-', ['--token-']],
      ['--font-weight-', ['--w-']],
      ['--font-', ['--f-']],
      ['--text-', ['--t-']],
      ['--tracking-', ['--tr-']],
      ['--leading-', ['--lh-']],
      ['--spacing-', ['--s-', '--page-pad', '--tap']],
      ['--radius-', ['--r-']],
      ['--container-', ['--measure']],
    ];
    for (const [key, value] of mappings) {
      const target = /^var\((--[^\s,)]+)\)$/.exec(value)?.[1] as string;
      // Longest prefix first: `--font-` is a prefix of `--font-weight-`.
      const rule = [...permitted]
        .sort((left, right) => right[0].length - left[0].length)
        .find(([namespace]) => key.startsWith(namespace));
      expect(rule, `${key} is in no namespace this adapter mints into`).toBeDefined();
      expect(
        (rule as [string, string[]])[1].some((allowed) =>
          allowed.endsWith('-') ? target.startsWith(allowed) : target === allowed
        ),
        `${key} reads ${target}, which is not a token the ${(rule as [string, string[]])[0]} namespace may read`
      ).toBe(true);
    }
  });

  it('never carries the same name on both sides of its var()', () => {
    for (const [key, value] of mappings) {
      const target = /^var\((--[^\s,)]+)\)$/.exec(value);
      expect(target, `${key} reads ${value}, which is not a plain var() reference`).not.toBeNull();
      expect(
        target?.[1],
        `${key} references itself, which resolves to transparent once a bundler flattens the imports (AD-14)`
      ).not.toBe(key);
    }
  });

  it('references only names contracts/tokens.css actually declares', () => {
    expect(tokensDeclared.size, 'contracts/tokens.css parsed to nothing').toBeGreaterThan(80);
    for (const [key, value] of mappings) {
      const target = /^var\((--[^\s,)]+)\)$/.exec(value)?.[1] as string;
      expect(tokensDeclared.has(target), `${key} references ${target}, which contracts/tokens.css does not declare`).toBe(
        true
      );
    }
  });

  it('never reaches for the raw --c-* palette', () => {
    // AD-14: the semantic role layer is the only thing a consumer reads, and the
    // palette is never consumed outside contracts/.
    for (const [key, value] of mappings) {
      expect(value.includes('var(--c-'), `${key} reads the raw palette: ${value}`).toBe(false);
    }
    expect(stripped).not.toContain('--c-');
  });

  it('maps every key out of a contract namespace and into a Tailwind one', () => {
    const CONTRACT = /^--(token|f|t|w|lh|tr|s|r|measure|page-pad|tap)(-|$)/;
    const TAILWIND = /^--(color|font|font-weight|text|tracking|leading|container|spacing|radius)-/;
    for (const [key, value] of mappings) {
      const target = /^var\((--[^\s,)]+)\)$/.exec(value)?.[1] as string;
      expect(TAILWIND.test(key), `${key} is not in a Tailwind v4 theme namespace`).toBe(true);
      expect(CONTRACT.test(target), `${key} reads ${target}, which is not a contract token name`).toBe(true);
    }
  });

  it('names each Tailwind key once', () => {
    expect(publishedByKey.size).toBe(mappings.length);
  });

  it('leaves the --ease-* easings out, because a mapping there would be a cycle', () => {
    // The contract's motion easings are `--ease-entrance`, `--ease-exit` and
    // `--ease-toggle`, and Tailwind v4's easing namespace is also `--ease-*`, so
    // a mapping would put the identical name on both sides of its var(). AD-14
    // forbids it and renaming a contract token is a MAJOR bump. Recorded in
    // `ops/tailwind-adapter.md`.
    expect(stripped).not.toContain('--ease-');
  });
});

// ---------------------------------------------------------------------------
// What the adapter must never carry, plus the AD-16 header.
// ---------------------------------------------------------------------------

describe('what the adapter must never carry', () => {
  it('has no @font-face rule and no url() of its own', () => {
    // The faces arrive through the fonts.css import. A url() here would resolve
    // relative to this file, and this file is compiled into somewhere else.
    //
    // Read off the comment-free text, because the header explains both rules in
    // prose and those words are not declarations.
    expect(stripped).not.toContain('@font-face');
    expect(stripped).not.toContain('url(');
  });

  it('carries the AD-16 header version, and it equals packages/tokens/package.json', () => {
    const header = /Contract v(\d+\.\d+\.\d+)/.exec(css);
    expect(header, 'the adapter carries no "Contract vX.Y.Z" line for AD-16 to read').not.toBeNull();
    expect(
      header?.[1],
      `the header and packages/tokens/package.json disagree: ${header?.[1]} against ${packageVersion}`
    ).toBe(packageVersion);
  });

  it('uses LF endings and exactly one trailing newline', () => {
    expect(css.includes('\r'), 'contracts/tailwind.css carries a CR').toBe(false);
    expect(css.endsWith('\n')).toBe(true);
    expect(css.endsWith('\n\n')).toBe(false);
  });

  it('is not executable, and neither is anything else under contracts/', () => {
    const walk = (directory: string): string[] =>
      readdirSync(directory).flatMap((entry) => {
        const full = join(directory, entry);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
    for (const file of walk(CONTRACTS)) {
      expect(file, `${file} is executable and contracts/ is the published surface (AD-1)`).not.toMatch(
        /\.(ts|js|tsx|jsx|mjs|cjs)$/
      );
    }
    expect(existsSync(join(CONTRACTS, 'theme-map.json')), 'the theme map reached the published surface').toBe(false);
    expect(existsSync(THEME_MAP_PATH), 'the theme map is not under packages/tokens').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The authored block in DESIGN.md. A count assertion cannot catch
// `--color-surface` reading `--token-surface` instead of `--token-bg-raised`.
// ---------------------------------------------------------------------------

describe('against the authored adapter block in DESIGN.md', () => {
  /**
   * Every way this coupling can break throws with the coupling named, rather
   * than throwing ENOENT during collection or locking onto the wrong fenced
   * block. `ops/tailwind-adapter.md` carries it as a stated limit.
   */
  const designBlock = (): string => {
    if (!existsSync(DESIGN)) {
      throw new Error(
        `the design source is not at ${DESIGN}. This suite reads it to compare the published adapter ` +
          `mapping by mapping; see ops/tailwind-adapter.md, "Stated limits".`
      );
    }
    const design = readFileSync(DESIGN, 'utf8');
    const heading = design.indexOf('### `tailwind.css`, the generated adapter');
    if (heading === -1) {
      throw new Error('DESIGN.md carries no "### `tailwind.css`, the generated adapter" heading.');
    }
    const fence = design.indexOf('```css', heading);
    if (fence === -1) throw new Error('DESIGN.md has no fenced css block under its tailwind.css heading.');
    const end = design.indexOf('```', fence + 6);
    if (end === -1) throw new Error('DESIGN.md has an unterminated css fence under its tailwind.css heading.');
    return design.slice(fence + 6, end);
  };

  /**
   * The one key the authored block names that this adapter deliberately does not
   * publish. Observed 2026-08-25 against the pinned CLI: `--radius-DEFAULT`
   * mints `.rounded-DEFAULT` in Tailwind v4, not the bare `.rounded`, which
   * keeps its own hardcoded `0.25rem`. It is also a second key for `--r-none`,
   * which `--radius-none` already carries. Recorded in `ops/tailwind-adapter.md`.
   */
  const NOT_PUBLISHED = new Set(['--radius-DEFAULT']);

  it('finds the block, so a moved heading fails here rather than passing vacuously', () => {
    expect(() => designBlock()).not.toThrow();
    expect(declarationsIn(themeBlockBody(stripComments(designBlock()))).length).toBeGreaterThan(10);
  });

  it('imports what the authored block imports, in the authored order', () => {
    const authored = stripComments(designBlock())
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('@import'));
    expect(statements.slice(0, 3)).toEqual(authored);
  });

  it('reads the same token for every key the authored block names', () => {
    const authored = declarationsIn(themeBlockBody(stripComments(designBlock())));
    const compared = authored.filter(([key]) => !NOT_PUBLISHED.has(key));
    expect(compared.length, 'nothing was compared, so this case would pass over nothing').toBeGreaterThan(10);
    for (const [key, value] of compared) {
      expect(publishedByKey.get(key), `${key} is not published, and DESIGN.md's adapter block names it`).toBe(value);
    }
    for (const key of NOT_PUBLISHED) {
      expect(publishedByKey.has(key), `${key} is published, and it is recorded as deliberately not mapped`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Building from source, and every refusal the generator makes.
// ---------------------------------------------------------------------------

const runBuild = (environment: Record<string, string | undefined>) => {
  const child = { ...process.env, ...environment };
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete child[name];
  }
  // `timeout` on the spawn itself: `spawnSync` blocks the worker thread, so
  // Vitest's per-case budget cannot interrupt it.
  return spawnSync(process.execPath, [BUILD], { encoding: 'utf8', env: child, timeout: SPAWN_TIMEOUT });
};

const scratch = (label: string): string => mkdtempSync(join(tmpdir(), `cuatro-tailwind-${label}-`));

/**
 * How a case corrupts the map: mutate the parsed object, replace the file with
 * raw text that may not be valid JSON, or delete it outright.
 */
type Corruption = { mutate: (map: ThemeMap) => void } | { raw: string } | { absent: true };

/**
 * A copy of both build inputs with the map corrupted. Nothing here touches the
 * real `packages/tokens/tokens/` or the real `contracts/`.
 */
const corrupted = (label: string, corruption: Corruption): string => {
  const root = scratch(label);
  cpSync(SOURCE_DIR, join(root, 'tokens'), { recursive: true });
  const target = join(root, 'theme-map.json');
  if ('absent' in corruption) return root;
  if ('raw' in corruption) {
    writeFileSync(target, corruption.raw, 'utf8');
    return root;
  }
  const map = JSON.parse(readFileSync(THEME_MAP_PATH, 'utf8')) as ThemeMap;
  corruption.mutate(map);
  writeFileSync(target, JSON.stringify(map, null, 2), 'utf8');
  return root;
};

/** Runs the generator against a corrupted input tree and returns what it said. */
const refusal = (label: string, corruption: Corruption) => {
  const inputs = corrupted(label, corruption);
  const output = scratch(`${label}-out`);
  try {
    const result = runBuild({
      CUATRO_TOKENS_SOURCE: join(inputs, 'tokens'),
      CUATRO_TOKENS_OUTPUT: output,
    });
    return { result, published: readdirSync(output) };
  } finally {
    rmSync(inputs, { recursive: true, force: true });
    rmSync(output, { recursive: true, force: true });
  }
};

describe('building the adapter from source', () => {
  it(
    'reproduces the committed file byte for byte, so the committed file is never hand-maintained',
    () => {
      const output = scratch('build');
      try {
        const result = runBuild({ CUATRO_TOKENS_SOURCE: SOURCE_DIR, CUATRO_TOKENS_OUTPUT: output });
        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(join(output, 'tailwind.css'), 'utf8')).toBe(css);
        // The story adds one file to the published surface and changes none.
        expect(readFileSync(join(output, 'tokens.css'), 'utf8')).toBe(tokensCss);
      } finally {
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'emits the same bytes twice, so the drift gate compares against a stable output',
    () => {
      const first = scratch('first');
      const second = scratch('second');
      try {
        expect(runBuild({ CUATRO_TOKENS_SOURCE: SOURCE_DIR, CUATRO_TOKENS_OUTPUT: first }).status).toBe(0);
        expect(runBuild({ CUATRO_TOKENS_SOURCE: SOURCE_DIR, CUATRO_TOKENS_OUTPUT: second }).status).toBe(0);
        expect(readFileSync(join(first, 'tailwind.css'), 'utf8')).toBe(
          readFileSync(join(second, 'tailwind.css'), 'utf8')
        );
      } finally {
        rmSync(first, { recursive: true, force: true });
        rmSync(second, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'reads its map from beside the source directory, so a scratch run needs no third build input',
    () => {
      const inputs = corrupted('relocated', { mutate: () => undefined });
      const output = scratch('relocated-out');
      try {
        const result = runBuild({
          CUATRO_TOKENS_SOURCE: join(inputs, 'tokens'),
          CUATRO_TOKENS_OUTPUT: output,
        });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout, 'the generator did not say which map it read').toContain('theme-map.json');
        expect(readFileSync(join(output, 'tailwind.css'), 'utf8')).toBe(css);
      } finally {
        rmSync(inputs, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );
});

describe('the refusals, each run against a corrupted copy of the inputs', () => {
  /**
   * The clause `refuseAdapter` appends to every message. `ops/tailwind-adapter.md`
   * states it as a property of the whole set, so it is asserted on every case
   * rather than left to whichever message happened to be written with it. Two
   * refusals used to end differently, one in lower case and one with a raw
   * `error.message` and no clause at all.
   */
  const CLAUSE = 'Nothing was published.';

  const cases: {
    label: string;
    title: string;
    corruption: Corruption;
    expected: string[];
  }[] = [
    {
      label: 'missing-token',
      title: 'refuses a mapping that names a token the dictionary does not publish',
      corruption: {
        mutate: (map) => {
          map.sections[0].entries[0].token = '--token-brand';
        },
      },
      expected: ['--color-bg', '--token-brand'],
    },
    {
      label: 'cycle',
      title: 'refuses a mapping that carries the same name on both sides of its var(), citing AD-14',
      corruption: {
        mutate: (map) => {
          map.sections[0].entries.push({ key: '--color-accent-cycle', token: '--color-accent-cycle' });
        },
      },
      expected: ['--color-accent-cycle', 'AD-14', 'transparent'],
    },
    {
      label: 'palette',
      title: 'refuses a mapping that reads the raw --c-* palette',
      corruption: {
        mutate: (map) => {
          map.sections[0].entries[0].token = '--c-accent';
        },
      },
      expected: ['--color-bg', '--c-accent', 'AD-14'],
    },
    {
      label: 'crossing',
      title: 'refuses a mapping whose token is the wrong kind for its namespace',
      corruption: {
        mutate: (map) => {
          // A length in a colour slot. It parses, publishes and mints, and the
          // browser probe compares it equal because the control element reads
          // the same wrong token. This refusal is the only thing that sees it.
          map.sections[0].entries[0].token = '--s-md';
        },
      },
      expected: ['--color-bg', '--s-md', '--token-', 'may read'],
    },
    {
      label: 'namespace',
      title: 'refuses a key in a namespace Tailwind v4 does not theme, naming the permitted ones',
      corruption: {
        mutate: (map) => {
          map.sections[0].entries[0].key = '--colour-bg';
        },
      },
      expected: ['--colour-bg', 'mint no utility', '--color-', '--spacing-'],
    },
    {
      label: 'unfed-namespace',
      title: 'refuses a key in a Tailwind namespace this adapter feeds no token into',
      corruption: {
        mutate: (map) => {
          map.sections[0].entries[0].key = '--shadow-raised';
        },
      },
      expected: ['--shadow-raised', '--shadow-', 'NAMESPACE_TOKENS'],
    },
    {
      label: 'bare-namespace',
      title: 'refuses a key that is a bare namespace with nothing after it',
      corruption: {
        mutate: (map) => {
          // Tailwind stores `--font-weight-` and mints nothing from it. Matched
          // by shortest prefix this would read as the `--font-` namespace and be
          // refused for the wrong reason, which is why the generator matches by
          // longest.
          map.sections[3].entries[0].key = '--font-weight-';
        },
      },
      expected: ['--font-weight-', 'bare', 'mint no utility'],
    },
    {
      label: 'empty-section',
      title: 'refuses a section that names no entries',
      corruption: {
        mutate: (map) => {
          map.sections = [{ title: 'nothing', entries: [] }];
        },
      },
      expected: ['names no entries'],
    },
    {
      label: 'empty-map',
      title: 'refuses a map with no mappings rather than publishing an empty @theme block',
      corruption: {
        mutate: (map) => {
          map.sections = [];
        },
      },
      expected: ['declares no mappings', 'mint no utility at all'],
    },
    {
      label: 'no-sections',
      title: 'refuses a map with no sections at all',
      corruption: {
        mutate: (map) => {
          delete (map as { sections?: unknown }).sections;
        },
      },
      expected: ['no "sections" array'],
    },
    {
      label: 'duplicate',
      title: 'refuses the same Tailwind key declared twice, because one of the two is discarded silently',
      corruption: {
        mutate: (map) => {
          map.sections[0].entries.push({ key: '--color-bg', token: '--token-text' });
        },
      },
      expected: ['--color-bg', 'appears twice'],
    },
    {
      label: 'malformed',
      title: 'refuses a key that is not a plain custom property name',
      corruption: {
        mutate: (map) => {
          map.sections[0].entries[0].key = '--color-bg; } body { display: none';
        },
      },
      expected: ['not a custom property name'],
    },
    {
      label: 'delimiter',
      title: 'refuses a section title carrying a CSS comment delimiter',
      corruption: {
        mutate: (map) => {
          map.sections[0].title = 'colour */ body { display: none } /*';
        },
      },
      expected: ['CSS comment delimiter'],
    },
    {
      label: 'absent',
      title: 'refuses a missing map file, naming the path it looked at',
      corruption: { absent: true },
      expected: ['theme map is missing', 'theme-map.json'],
    },
    {
      label: 'unreadable',
      title: 'refuses a map that is not readable JSON',
      corruption: { raw: '{ not json' },
      expected: ['not readable JSON'],
    },
    {
      label: 'not-an-object',
      title: 'refuses a map that parses to null rather than throwing a raw TypeError',
      // `null`, a number and a string are all valid JSON and all used to reach
      // `parsed.sections` and throw a TypeError naming no file and no key.
      corruption: { raw: 'null' },
      expected: ['parses to null', '"sections" array'],
    },
    {
      label: 'an-array',
      title: 'refuses a map that parses to an array',
      corruption: { raw: '[]' },
      expected: ['parses to an array', '"sections" array'],
    },
  ];

  for (const testCase of cases) {
    it(
      testCase.title,
      () => {
        const { result, published } = refusal(testCase.label, testCase.corruption);
        const said = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        expect(result.status, `the generator exited 0 and said:\n${said}`).not.toBe(0);
        for (const fragment of testCase.expected) {
          expect(said, `the refusal did not name ${fragment}:\n${said}`).toContain(fragment);
        }
        expect(said, `the refusal did not end with "${CLAUSE}":\n${said}`).toContain(CLAUSE);
        // "Nothing published" is the column the matrix actually cares about: a
        // refusal that has already rewritten `tokens.css` is not a refusal.
        expect(published, `the generator wrote ${published.join(', ')} while refusing`).toEqual([]);
      },
      SPAWN_TIMEOUT
    );
  }
});
