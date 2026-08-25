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

const css = readFileSync(PUBLISHED, 'utf8');
const tokensCss = readFileSync(TOKENS_CSS, 'utf8');
const packageVersion = (JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string })
  .version;

interface ThemeMap {
  sections: { title: string; entries: { key: string; token: string }[] }[];
}

const themeMap = JSON.parse(readFileSync(THEME_MAP_PATH, 'utf8')) as ThemeMap;
const mapEntries = themeMap.sections.flatMap((section) => section.entries);

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

describe('what every mapping must be', () => {
  it('publishes exactly the mappings theme-map.json declares, in its order', () => {
    expect(mappings).toEqual(mapEntries.map((entry) => [entry.key, `var(${entry.token})`]));
    expect(mappings.length, 'the map is empty, so every assertion below would pass over nothing').toBeGreaterThan(0);
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
 * A copy of both build inputs with the map mutated. Nothing here touches the
 * real `packages/tokens/tokens/` or the real `contracts/`.
 */
const corrupted = (label: string, mutate: (map: ThemeMap) => void): string => {
  const root = scratch(label);
  cpSync(SOURCE_DIR, join(root, 'tokens'), { recursive: true });
  const map = JSON.parse(readFileSync(THEME_MAP_PATH, 'utf8')) as ThemeMap;
  mutate(map);
  writeFileSync(join(root, 'theme-map.json'), JSON.stringify(map, null, 2), 'utf8');
  return root;
};

/** Runs the generator against a corrupted input tree and returns what it said. */
const refusal = (label: string, mutate: (map: ThemeMap) => void) => {
  const inputs = corrupted(label, mutate);
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
      const inputs = corrupted('relocated', () => undefined);
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
  const cases: {
    label: string;
    title: string;
    mutate: (map: ThemeMap) => void;
    expected: (string | RegExp)[];
  }[] = [
    {
      label: 'missing-token',
      title: 'refuses a mapping that names a token the dictionary does not publish',
      mutate: (map) => {
        map.sections[0].entries[0].token = '--token-brand';
      },
      expected: ['--color-bg', '--token-brand', 'Nothing was published'],
    },
    {
      label: 'cycle',
      title: 'refuses a mapping that carries the same name on both sides of its var(), citing AD-14',
      mutate: (map) => {
        map.sections[0].entries.push({ key: '--color-accent-cycle', token: '--color-accent-cycle' });
      },
      expected: ['--color-accent-cycle', 'AD-14', 'transparent', 'Nothing was published'],
    },
    {
      label: 'palette',
      title: 'refuses a mapping that reads the raw --c-* palette',
      mutate: (map) => {
        map.sections[0].entries[0].token = '--c-accent';
      },
      expected: ['--color-bg', '--c-accent', 'AD-14', 'Nothing was published'],
    },
    {
      label: 'namespace',
      title: 'refuses a key in a namespace Tailwind v4 does not theme, naming the permitted ones',
      mutate: (map) => {
        map.sections[0].entries[0].key = '--colour-bg';
      },
      expected: ['--colour-bg', 'mint no utility', '--color-', '--spacing-', 'Nothing was published'],
    },
    {
      label: 'empty-section',
      title: 'refuses a section that names no entries',
      mutate: (map) => {
        map.sections = [{ title: 'nothing', entries: [] }];
      },
      expected: ['names no entries', 'Nothing was published'],
    },
    {
      label: 'empty-map',
      title: 'refuses a map with no mappings rather than publishing an empty @theme block',
      mutate: (map) => {
        map.sections = [];
      },
      expected: ['declares no mappings', 'mint no utility at all', 'Nothing was published'],
    },
    {
      label: 'no-sections',
      title: 'refuses a map with no sections at all',
      mutate: (map) => {
        delete (map as { sections?: unknown }).sections;
      },
      expected: ['no "sections" array', 'Nothing was published'],
    },
    {
      label: 'duplicate',
      title: 'refuses the same Tailwind key declared twice, because one of the two is discarded silently',
      mutate: (map) => {
        map.sections[0].entries.push({ key: '--color-bg', token: '--token-text' });
      },
      expected: ['--color-bg', 'appears twice', 'Nothing was published'],
    },
    {
      label: 'malformed',
      title: 'refuses a key that is not a plain custom property name',
      mutate: (map) => {
        map.sections[0].entries[0].key = '--color-bg; } body { display: none';
      },
      expected: ['not a custom property name', 'Nothing was published'],
    },
    {
      label: 'delimiter',
      title: 'refuses a section title carrying a CSS comment delimiter',
      mutate: (map) => {
        map.sections[0].title = 'colour */ body { display: none } /*';
      },
      expected: ['CSS comment delimiter', 'Nothing was published'],
    },
  ];

  for (const testCase of cases) {
    it(
      testCase.title,
      () => {
        const { result, published } = refusal(testCase.label, testCase.mutate);
        const said = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        expect(result.status, `the generator exited 0 and said:\n${said}`).not.toBe(0);
        for (const fragment of testCase.expected) {
          expect(said, `the refusal did not name ${fragment}:\n${said}`).toContain(fragment);
        }
        // "Nothing published" is the column the matrix actually cares about: a
        // refusal that has already rewritten `tokens.css` is not a refusal.
        expect(published, `the generator wrote ${published.join(', ')} while refusing`).toEqual([]);
      },
      SPAWN_TIMEOUT
    );
  }

  it(
    'refuses a missing map file, naming the path it looked at',
    () => {
      const inputs = corrupted('absent', () => undefined);
      const output = scratch('absent-out');
      try {
        rmSync(join(inputs, 'theme-map.json'), { force: true });
        const result = runBuild({
          CUATRO_TOKENS_SOURCE: join(inputs, 'tokens'),
          CUATRO_TOKENS_OUTPUT: output,
        });
        const said = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        expect(result.status, said).not.toBe(0);
        expect(said).toContain('theme map is missing');
        expect(readdirSync(output)).toEqual([]);
      } finally {
        rmSync(inputs, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'refuses a map that is not readable JSON',
    () => {
      const inputs = corrupted('unreadable', () => undefined);
      const output = scratch('unreadable-out');
      try {
        writeFileSync(join(inputs, 'theme-map.json'), '{ not json', 'utf8');
        const result = runBuild({
          CUATRO_TOKENS_SOURCE: join(inputs, 'tokens'),
          CUATRO_TOKENS_OUTPUT: output,
        });
        const said = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        expect(result.status, said).not.toBe(0);
        expect(said).toContain('not readable JSON');
        expect(readdirSync(output)).toEqual([]);
      } finally {
        rmSync(inputs, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );
});
