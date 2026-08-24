// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// `contracts/tokens.css` is a published artefact, not TypeScript, so
// `tsconfig.json:34-41` cannot typecheck it and no import can reach it. This
// file is where its contract is actually asserted, on the same precedent as
// `ops/__tests__/library-backup.test.ts`, which reads shell scripts off disk.
//
// Every `describe` below is one row of the spec's I/O and edge-case matrix,
// followed by the acceptance criteria that are not matrix rows.
//
// Two kinds of case. The reads assert what the committed file declares. The
// failure-path cases run the same assertion helpers against synthetic input, so
// a helper that has quietly stopped rejecting anything is caught by the suite
// rather than by the next Satellite to vendor a broken contract.

// Two cases spawn `node packages/tokens/build.mjs` for real. Vitest's 5 second
// default is a comfortable fit when this file runs alone and not when it runs
// beside seventeen others on a loaded machine, so the budget is raised here
// rather than in `vitest.config.ts`, where it would loosen the whole suite.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');
const PUBLISHED = join(CONTRACTS, 'tokens.css');
const BUILD = join(PACKAGE_ROOT, 'build.mjs');
const SOURCE_DIR = join(PACKAGE_ROOT, 'tokens');
const DESIGN = join(
  REPO_ROOT,
  '_bmad-output',
  'planning-artifacts',
  'ux-designs',
  'ux-cuatro-portfolio-2026-08-15',
  'DESIGN.md'
);

const css = readFileSync(PUBLISHED, 'utf8');
const packageVersion = (JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;

// ---------------------------------------------------------------------------
// Parsing. Deliberately dumb: a regex over the text, because the whole point of
// the contract is that a consumer in any language reads it with a file read and
// a parser rather than with a JavaScript toolchain.
// ---------------------------------------------------------------------------

type Declaration = [name: string, value: string];

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '');

const declarationsIn = (text: string): Declaration[] => {
  const found: Declaration[] = [];
  const pattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    found.push([match[1], match[2].trim()]);
  }
  return found;
};

/** The published file, split at the one `@media` rule it is allowed to carry. */
const split = (text: string) => {
  const stripped = stripComments(text);
  const index = stripped.indexOf('@media');
  return {
    root: index === -1 ? stripped : stripped.slice(0, index),
    media: index === -1 ? '' : stripped.slice(index),
  };
};

const parts = split(css);
const rootDeclarations = declarationsIn(parts.root);
const mediaDeclarations = declarationsIn(parts.media);
const rootValues = new Map(rootDeclarations);

const namesMatching = (prefix: string): string[] =>
  rootDeclarations.map(([name]) => name).filter((name) => name.startsWith(prefix));

// ---------------------------------------------------------------------------
// The three assertions that must be able to fail. Each is a function so the
// suite can run it against synthetic input as well as against the real file: a
// helper that has stopped rejecting anything would otherwise pass silently.
// ---------------------------------------------------------------------------

/**
 * Matrix rows "Role points at a missing palette entry" and "Role is
 * self-referential". AD-14: a self-reference resolves to `transparent` at
 * runtime with no error anywhere, so it has to be caught statically.
 */
const assertRolesResolve = (declarations: Declaration[]): void => {
  const declared = new Set(declarations.map(([name]) => name));
  for (const [name, value] of declarations) {
    if (!name.startsWith('--token-')) continue;
    const reference = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (!reference) {
      throw new Error(`${name} is not a plain var() reference to a palette value: ${value}`);
    }
    const target = reference[1];
    if (target === name) {
      throw new Error(`${name} references itself, which resolves to transparent once a bundler flattens it (AD-14)`);
    }
    if (!target.startsWith('--c-')) {
      throw new Error(`${name} references ${target}, which is not a --c-* palette value (AD-14)`);
    }
    if (!declared.has(target)) {
      throw new Error(`${name} references ${target}, which is not declared in this file`);
    }
  }
};

/**
 * Matrix row "Header version drifts". AD-16 has a scheduled job verify every
 * Satellite against this header, so a header that disagrees with the package
 * version breaks that check across seven repositories at once.
 */
const assertHeaderVersion = (text: string, version: string): void => {
  const header = /Contract v(\d+\.\d+\.\d+)/.exec(text);
  if (!header) {
    throw new Error('the file header carries no "Contract vX.Y.Z" line for AD-16 to read');
  }
  if (header[1] !== version) {
    throw new Error(
      `the header says Contract v${header[1]} and packages/tokens/package.json says ${version}; they must be the same version`
    );
  }
};

/** Acceptance criterion 2, and the standing AD-1 rule `AGENTS.md` states. */
const EXECUTABLE = /\.(ts|js|tsx|jsx|mjs|cjs)$/;

const filesUnder = (directory: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    // `node_modules` is the generator's own dependency tree, not a file this
    // repository authored, and `.gitignore:125` already ignores it.
    if (entry === 'node_modules') continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
};

// ---------------------------------------------------------------------------
// Matrix row 1: build from source, output rewritten byte-identically.
// ---------------------------------------------------------------------------

const runBuild = (source: string, output: string) =>
  spawnSync(process.execPath, [BUILD], {
    encoding: 'utf8',
    env: { ...process.env, CUATRO_TOKENS_SOURCE: source, CUATRO_TOKENS_OUTPUT: output },
  });

describe('building from source', () => {
  it('reproduces the committed file byte for byte, so the committed file is never hand-maintained', () => {
    const output = mkdtempSync(join(tmpdir(), 'cuatro-tokens-build-'));
    try {
      const result = runBuild(SOURCE_DIR, output);
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(join(output, 'tokens.css'), 'utf8')).toBe(css);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });

  it('emits the same bytes twice, so the drift gate is comparing against a stable output', () => {
    const first = mkdtempSync(join(tmpdir(), 'cuatro-tokens-first-'));
    const second = mkdtempSync(join(tmpdir(), 'cuatro-tokens-second-'));
    try {
      expect(runBuild(SOURCE_DIR, first).status).toBe(0);
      expect(runBuild(SOURCE_DIR, second).status).toBe(0);
      expect(readFileSync(join(first, 'tokens.css'), 'utf8')).toBe(readFileSync(join(second, 'tokens.css'), 'utf8'));
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix row 4: a token added without a section.
// ---------------------------------------------------------------------------

describe('a token whose group has no section', () => {
  it('fails the build naming the group, rather than emitting it into an arbitrary position or dropping it', () => {
    const source = mkdtempSync(join(tmpdir(), 'cuatro-tokens-unmapped-'));
    const output = mkdtempSync(join(tmpdir(), 'cuatro-tokens-unmapped-out-'));
    try {
      for (const entry of readdirSync(SOURCE_DIR)) {
        writeFileSync(join(source, entry), readFileSync(join(SOURCE_DIR, entry)));
      }
      writeFileSync(
        join(source, 'zzz-unmapped.json'),
        JSON.stringify({ shadow: { $type: 'dimension', soft: { $value: '4px' } } })
      );

      const result = runBuild(source, output);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('shadow');
      expect(result.stderr).toContain('has no section');
      expect(readdirSync(output), 'a file was written despite the unmapped group').toEqual([]);
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(output, { recursive: true, force: true });
    }
  });

  it('leaves the ungrouped tokens working, because their group key is the token name itself', () => {
    for (const name of ['--measure', '--page-pad', '--tap', '--focus-offset']) {
      expect(rootValues.has(name), `${name} is not declared`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 5 and 6: a role that does not resolve, and a role that resolves
// to itself.
// ---------------------------------------------------------------------------

describe('the semantic role layer', () => {
  it('is every --token-* as a plain var() reference to a --c-* value declared in the same file', () => {
    expect(() => assertRolesResolve(rootDeclarations)).not.toThrow();
  });

  it('fails naming the role and the target when a role points at a palette entry that is not declared', () => {
    expect(() =>
      assertRolesResolve([
        ['--c-paper', 'oklch(12% 0.011 288)'],
        ['--token-bg', 'var(--c-missing)'],
      ])
    ).toThrow(/--token-bg references --c-missing, which is not declared/);
  });

  it('fails naming the role when a role references itself, which is silently transparent at runtime', () => {
    expect(() => assertRolesResolve([['--token-bg', 'var(--token-bg)']])).toThrow(/--token-bg references itself/);
  });

  it('fails when a role is not a var() reference at all, so text that merely looks like one cannot pass', () => {
    expect(() => assertRolesResolve([['--token-bg', 'oklch(12% 0.011 288)']])).toThrow(
      /--token-bg is not a plain var\(\) reference/
    );
    expect(() => assertRolesResolve([['--token-bg', '/* var(--c-paper) */']])).toThrow(
      /--token-bg is not a plain var\(\) reference/
    );
  });

  it('refuses a role that reaches past the palette into another role', () => {
    expect(() =>
      assertRolesResolve([
        ['--token-bg', 'var(--c-paper)'],
        ['--c-paper', 'oklch(12% 0.011 288)'],
        ['--token-bg-raised', 'var(--token-bg)'],
      ])
    ).toThrow(/--token-bg-raised references --token-bg, which is not a --c-\* palette value/);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 7: the header version drifts from the package version.
// ---------------------------------------------------------------------------

describe('the contract version in the header', () => {
  it('equals the version in packages/tokens/package.json', () => {
    expect(() => assertHeaderVersion(css, packageVersion)).not.toThrow();
    expect(css).toContain(`Contract v${packageVersion}`);
    expect(packageVersion).toBe('1.0.0');
  });

  it('fails naming both values when the two disagree', () => {
    expect(() => assertHeaderVersion(css, '1.1.0')).toThrow(
      /the header says Contract v1\.0\.0 and packages\/tokens\/package\.json says 1\.1\.0/
    );
  });

  it('fails when the header carries no version line for AD-16 to read', () => {
    expect(() => assertHeaderVersion(':root { --c-paper: oklch(12% 0.011 288); }', '1.0.0')).toThrow(
      /no "Contract vX\.Y\.Z" line/
    );
  });

  it('states the versioning rule the header is the estate-wide statement of', () => {
    const header = css.slice(0, css.indexOf(':root'));
    expect(header).toContain('A value change or an addition is a MINOR bump.');
    expect(header).toContain('A rename, including fixing a');
    expect(header).toContain('typo in a token name, or a removal is MAJOR.');
    expect(header).toContain('dark only');
    expect(header).toContain('anchor hue 288');
    expect(header).toContain('fonts.css');
  });
});

// ---------------------------------------------------------------------------
// The acceptance criteria that are not matrix rows.
// ---------------------------------------------------------------------------

describe('the published property set', () => {
  // The counts `epics.md:1550` fixes, category by category, plus the total, so
  // a token added to one category and dropped from another cannot net out.
  const categories: Array<[label: string, names: string[], expected: number]> = [
    ['palette', namesMatching('--c-'), 12],
    ['semantic roles', namesMatching('--token-'), 12],
    ['families', namesMatching('--f-'), 3],
    ['type scale', namesMatching('--t-'), 10],
    ['weights', namesMatching('--w-'), 5],
    ['line-heights', namesMatching('--lh-'), 5],
    ['tracking', namesMatching('--tr-'), 6],
    ['spacing steps', [...namesMatching('--s-'), '--page-pad'], 9],
    ['shape', namesMatching('--r-'), 3],
    ['stroke', [...namesMatching('--stroke-'), '--focus-offset'], 5],
    ['elevation', namesMatching('--elev-'), 3],
    ['motion', [...namesMatching('--dur-'), ...namesMatching('--ease-')], 7],
    ['z-index', namesMatching('--z-'), 7],
  ];

  for (const [label, names, expected] of categories) {
    it(`declares exactly ${expected} ${label} values`, () => {
      expect(names).toHaveLength(expected);
    });
  }

  it('declares --measure and --tap once each', () => {
    expect(namesMatching('--measure')).toEqual(['--measure']);
    expect(namesMatching('--tap')).toEqual(['--tap']);
  });

  it('declares 89 properties in total and no name twice', () => {
    expect(rootDeclarations).toHaveLength(89);
    expect(new Set(rootDeclarations.map(([name]) => name)).size).toBe(89);
  });

  it('authors every palette value in OKLCH on hue 288, with no hex fallback substituted for one', () => {
    const palette = rootDeclarations.filter(([name]) => name.startsWith('--c-'));
    for (const [name, value] of palette) {
      expect(value, `${name} is not an authored OKLCH value on hue 288`).toMatch(
        /^oklch\(\d+(\.\d+)?% \d+(\.\d+)? 288( \/ \d+(\.\d+)?)?\)$/
      );
    }
    // Read past the comments: the scrim's own note quotes `rgba()` precisely to
    // say the FR-17 gate must reject it everywhere else.
    const declared = `${parts.root}${parts.media}`;
    expect(declared).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declared).not.toContain('rgba(');
    expect(declared).not.toContain('hsl(');
  });

  it('carries the one translucent value on the palette entry and nowhere else', () => {
    const translucent = rootDeclarations.filter(([, value]) => value.includes('/') && value.startsWith('oklch('));
    expect(translucent.map(([name]) => name)).toEqual(['--c-scrim']);
    expect(rootValues.get('--c-scrim')).toBe('oklch(12% 0.011 288 / 0.88)');
    expect(rootValues.get('--token-scrim')).toBe('var(--c-scrim)');
  });
});

describe('the hit-target floor and the px rule', () => {
  it('makes --tap 44px, on both axes by the reader of the contract', () => {
    expect(rootValues.get('--tap')).toBe('44px');
  });

  it('authors nothing in the type scale, the spacing scale or --measure in px', () => {
    const readerScaled = rootDeclarations.filter(
      ([name]) => name.startsWith('--t-') || name.startsWith('--s-') || name === '--page-pad' || name === '--measure'
    );
    for (const [name, value] of readerScaled) {
      expect(value, `${name} is authored in px and would not scale with the root font size`).not.toContain('px');
    }
  });

  // `epics.md:1558-1559` calls --tap "the only length in the contract authored
  // in px". `DESIGN.md` section `tokens.css`, which the same criterion names as
  // what fixes the property set, authors the shape and stroke geometry in px
  // too, and `DESIGN.md:602` states rules are "1px and opaque". The design block
  // wins, and the exact set is pinned here so neither can drift unnoticed.
  it('keeps the shape and stroke geometry in px, and lets nothing else in', () => {
    const inPixels = rootDeclarations.filter(([, value]) => /px\b/.test(value)).map(([name]) => name);
    expect(inPixels.sort()).toEqual(
      [
        '--focus-offset',
        '--r-hair',
        '--r-pill',
        '--stroke-boundary',
        '--stroke-emphasis',
        '--stroke-focus',
        '--stroke-hair',
        '--tap',
      ].sort()
    );
  });
});

describe('the reduced-motion block', () => {
  it('is the one @media rule in the file, and it targets :root', () => {
    expect(css.match(/@media/g)).toHaveLength(1);
    expect(parts.media.trim()).toMatch(/^@media \(prefers-reduced-motion: reduce\) \{\s*:root \{/);
  });

  it('collapses exactly the --dur-* set declared in :root, and every one of them to 1ms', () => {
    const declared = namesMatching('--dur-').sort();
    const collapsed = mediaDeclarations.map(([name]) => name).sort();
    expect(declared).toHaveLength(4);
    expect(collapsed).toEqual(declared);
    for (const [name, value] of mediaDeclarations) {
      expect(value, `${name} is not collapsed to 1ms`).toBe('1ms');
    }
  });

  it('collapses no easing, because an easing has no duration to remove', () => {
    expect(mediaDeclarations.map(([name]) => name).filter((name) => name.startsWith('--ease-'))).toEqual([]);
  });
});

describe('what the contract must never carry', () => {
  it('has no @font-face rule and no url(), so a vendored folder resolves at any depth', () => {
    expect(css).not.toContain('@font-face');
    expect(css).not.toContain('url(');
  });

  it('names the three families and leaves the faces to fonts.css', () => {
    expect(rootValues.get('--f-display')).toContain('"Bricolage Grotesque"');
    expect(rootValues.get('--f-body')).toContain('"Geist"');
    expect(rootValues.get('--f-mono')).toContain('"Geist Mono"');
  });

  it('ships one file under contracts/, and no executable one', () => {
    const published = filesUnder(CONTRACTS).map((file) => relative(REPO_ROOT, file).split(sep).join('/'));
    expect(published).toEqual(['contracts/tokens.css']);
    for (const file of published) {
      expect(file, `${file} is executable and contracts/ is the published surface (AD-1)`).not.toMatch(EXECUTABLE);
    }
  });

  it('keeps every generator file under packages/', () => {
    const generator = filesUnder(PACKAGE_ROOT).map((file) => relative(REPO_ROOT, file).split(sep).join('/'));
    expect(generator.filter((file) => EXECUTABLE.test(file)).length).toBeGreaterThan(0);
    for (const file of generator) {
      expect(file.startsWith('packages/')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The line-by-line comparison against the design source. A count test cannot
// catch a mistyped OKLCH lightness; this can.
// ---------------------------------------------------------------------------

describe('against DESIGN.md section tokens.css, which fixes the property set', () => {
  const design = readFileSync(DESIGN, 'utf8');
  const heading = design.indexOf('### `tokens.css`');
  const fence = design.indexOf('```css', heading);
  const end = design.indexOf('```', fence + 6);
  const block = design.slice(fence + 6, end);
  const designParts = split(block);

  it('finds the block, so a moved heading fails here rather than passing vacuously', () => {
    expect(heading).toBeGreaterThan(-1);
    expect(fence).toBeGreaterThan(heading);
    expect(end).toBeGreaterThan(fence);
    expect(declarationsIn(designParts.root).length).toBeGreaterThan(80);
  });

  it('declares the same names in the same order with the same values', () => {
    expect(rootDeclarations).toEqual(declarationsIn(designParts.root));
  });

  it('carries the same reduced-motion block', () => {
    expect(mediaDeclarations).toEqual(declarationsIn(designParts.media));
  });
});

// ---------------------------------------------------------------------------
// The DTCG source, which is what a later story edits rather than the output.
// ---------------------------------------------------------------------------

describe('the DTCG source', () => {
  it('is JSON only, so nothing executable can be mistaken for a token file', () => {
    for (const entry of readdirSync(SOURCE_DIR)) {
      expect(entry).toMatch(/\.json$/);
    }
  });

  it('authors every value as the CSS string the design fixes, with aliases as {group.name}', () => {
    const aliases: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      if (typeof record.$value === 'string') {
        if (record.$value.startsWith('{')) aliases.push(record.$value);
      } else if (record.$value !== undefined) {
        throw new Error(`a $value is not a string: ${JSON.stringify(record.$value)}`);
      }
      for (const value of Object.values(record)) walk(value);
    };
    for (const entry of readdirSync(SOURCE_DIR)) {
      walk(JSON.parse(readFileSync(join(SOURCE_DIR, entry), 'utf8')));
    }
    // Twelve roles plus three elevation steps.
    expect(aliases).toHaveLength(15);
    for (const alias of aliases) expect(alias).toMatch(/^\{c\.[a-z0-9-]+\}$/);
  });
});
