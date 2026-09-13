// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

/**
 * The budget for a case that spawns `node packages/tokens/build.mjs` for real.
 * Passed per case rather than through `vi.setConfig`, so the forty-odd cases
 * that only read a string off disk keep Vitest's own 5 second default and a
 * hang in one of them still fails fast.
 */
const SPAWN_TIMEOUT = 120_000;

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
// Parsing. Deliberately dumb: a regex and a brace counter over the text,
// because the whole point of the contract is that a consumer in any language
// reads it with a file read and a parser rather than with a JavaScript
// toolchain.
// ---------------------------------------------------------------------------

type Declaration = [name: string, value: string];

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The name class is deliberately wide: anything CSS would accept as a custom
 * property name up to the colon. A narrow `[a-z0-9-]` class would make a
 * hand-edited `--c-Paper` invisible to the counts, the duplicate check, the
 * alpha audit and the comparison against the design, which is the exact place
 * such a name would appear. Conformance to the naming convention is then
 * asserted, rather than assumed by the parser.
 */
const declarationsIn = (text: string): Declaration[] => {
  const found: Declaration[] = [];
  const pattern = /(--[^\s:;{}()]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    found.push([match[1], match[2].trim()]);
  }
  return found;
};

interface Block {
  prelude: string;
  body: string;
}

/**
 * Splits comment-free CSS into its top-level rules and whatever sits outside
 * them. A regex over the whole text has no notion of a brace, so a declaration
 * that has fallen outside every rule, or everything after an unclosed brace,
 * would otherwise still count toward every assertion below. For an artefact
 * whose entire value is that seven repositories can `@import` it, that is the
 * one thing worth parsing properly.
 */
const blocksIn = (text: string): { blocks: Block[]; outside: string } => {
  const blocks: Block[] = [];
  let outside = '';
  let prelude = '';
  let body = '';
  let depth = 0;
  for (const character of text) {
    if (character === '{') {
      depth += 1;
      if (depth === 1) {
        body = '';
        continue;
      }
    } else if (character === '}') {
      depth -= 1;
      if (depth < 0) throw new Error('a closing brace with no opening brace');
      if (depth === 0) {
        blocks.push({ prelude: prelude.trim(), body });
        prelude = '';
        continue;
      }
    }
    if (depth === 0) {
      prelude += character;
      outside += character;
    } else {
      body += character;
    }
  }
  if (depth !== 0) throw new Error('an opening brace with no closing brace');
  return { blocks, outside };
};

const stripped = stripComments(css);
const topLevel = blocksIn(stripped);
const rootBlock = topLevel.blocks.find((block) => block.prelude === ':root');
const mediaBlock = topLevel.blocks.find((block) => block.prelude.startsWith('@media'));

const rootDeclarations = declarationsIn(rootBlock?.body ?? '');
const mediaDeclarations = declarationsIn(mediaBlock?.body ?? '');
const rootValues = new Map(rootDeclarations);
const declaredNames = rootDeclarations.map(([name]) => name);

const namesWhere = (predicate: (name: string) => boolean): string[] => declaredNames.filter(predicate);
const namesMatching = (prefix: string): string[] => namesWhere((name) => name.startsWith(prefix));

/** Every name the contract publishes, pinned. A rename is major under AD-16. */
const EXPECTED_NAMES = [
  '--c-paper',
  '--c-surface',
  '--c-surface-high',
  '--c-line',
  '--c-line-strong',
  '--c-muted',
  '--c-ink',
  '--c-accent',
  '--c-accent-bright',
  '--c-accent-quiet',
  '--c-focus',
  '--c-scrim',
  '--token-bg',
  '--token-bg-raised',
  '--token-bg-raised-2',
  '--token-text',
  '--token-text-secondary',
  '--token-border',
  '--token-border-interactive',
  '--token-accent',
  '--token-accent-hover',
  '--token-accent-muted',
  '--token-focus',
  '--token-scrim',
  '--f-display',
  '--f-body',
  '--f-mono',
  '--t-3xs',
  '--t-2xs',
  '--t-xs',
  '--t-sm',
  '--t-base',
  '--t-md',
  '--t-lg',
  '--t-xl',
  '--t-2xl',
  '--t-display',
  '--w-light',
  '--w-regular',
  '--w-medium',
  '--w-bold',
  '--w-black',
  '--lh-display',
  '--lh-heading',
  '--lh-lede',
  '--lh-body',
  '--lh-label',
  '--tr-display',
  '--tr-heading',
  '--tr-name',
  '--tr-body',
  '--tr-meta',
  '--tr-label',
  '--measure',
  '--s-2xs',
  '--s-xs',
  '--s-sm',
  '--s-md',
  '--s-lg',
  '--s-xl',
  '--s-2xl',
  '--s-3xl',
  '--page-pad',
  '--tap',
  '--r-none',
  '--r-hair',
  '--r-pill',
  '--stroke-hair',
  '--stroke-boundary',
  '--stroke-emphasis',
  '--stroke-focus',
  '--focus-offset',
  '--elev-0',
  '--elev-1',
  '--elev-2',
  '--dur-micro',
  '--dur-minor',
  '--dur-major',
  '--dur-exit',
  '--ease-entrance',
  '--ease-exit',
  '--ease-toggle',
  '--z-base',
  '--z-raised',
  '--z-dropdown',
  '--z-sticky',
  '--z-modal',
  '--z-toast',
  '--z-tooltip',
];

// ---------------------------------------------------------------------------
// The assertions that must be able to fail. Each is a function so the suite can
// run it against synthetic input as well as against the real file: a helper
// that has stopped rejecting anything would otherwise pass silently.
// ---------------------------------------------------------------------------

const VAR_TARGET = /var\(\s*(--[^\s,)]+)/g;

/**
 * Matrix rows "Role points at a missing palette entry" and "Role is
 * self-referential". AD-14: a self-reference resolves to `transparent` at
 * runtime with no error anywhere, so it has to be caught statically.
 *
 * Every `var()` in the file is checked, not only the ones on `--token-*`. The
 * three `--elev-*` tokens are aliases too, and a check written for this exact
 * failure mode that skipped a third of the aliases would be a check in name
 * only. The `--token-*` layer then carries the extra rule AD-14 puts on it.
 */
const assertReferencesResolve = (declarations: Declaration[]): void => {
  const declared = new Set(declarations.map(([name]) => name));
  for (const [name, value] of declarations) {
    for (const reference of value.matchAll(VAR_TARGET)) {
      const target = reference[1];
      if (target === name) {
        throw new Error(`${name} references itself, which resolves to transparent once a bundler flattens it (AD-14)`);
      }
      if (!declared.has(target)) {
        throw new Error(`${name} references ${target}, which is not declared in this file`);
      }
    }
    if (!name.startsWith('--token-')) continue;
    const whole = /^var\((--[^\s,)]+)\)$/.exec(value);
    if (!whole) {
      throw new Error(`${name} is not a plain var() reference to a palette value: ${value}`);
    }
    if (!whole[1].startsWith('--c-')) {
      throw new Error(`${name} references ${whole[1]}, which is not a --c-* palette value (AD-14)`);
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

const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.pnpm-store',
  '.bmad-loop',
  '_bmad',
  '_bmad-output',
  '.claude',
  '.vscode',
  'coverage',
  'playwright-report',
  'test-results',
]);

const filesUnder = (directory: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
};

const repoRelative = (file: string): string => relative(REPO_ROOT, file).split(sep).join('/');

// ---------------------------------------------------------------------------
// Matrix row 1: build from source, output rewritten byte-identically.
// ---------------------------------------------------------------------------

const runBuild = (environment: Record<string, string | undefined>) => {
  const child = { ...process.env, ...environment };
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete child[name];
  }
  // `timeout` on the spawn itself, not only on the Vitest case. `spawnSync`
  // blocks the worker thread, so Vitest's per-case budget cannot interrupt it: a
  // generator that hangs would run until the CI platform killed the whole job.
  return spawnSync(process.execPath, [BUILD], { encoding: 'utf8', env: child, timeout: SPAWN_TIMEOUT });
};

const scratch = (label: string): string => mkdtempSync(join(tmpdir(), `cuatro-tokens-${label}-`));

describe('building from source', () => {
  it(
    'reproduces the committed file byte for byte, so the committed file is never hand-maintained',
    () => {
      const output = scratch('build');
      try {
        const result = runBuild({ CUATRO_TOKENS_SOURCE: SOURCE_DIR, CUATRO_TOKENS_OUTPUT: output });
        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(join(output, 'tokens.css'), 'utf8')).toBe(css);
      } finally {
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'emits the same bytes twice, so the drift gate is comparing against a stable output',
    () => {
      const first = scratch('first');
      const second = scratch('second');
      try {
        expect(runBuild({ CUATRO_TOKENS_SOURCE: SOURCE_DIR, CUATRO_TOKENS_OUTPUT: first }).status).toBe(0);
        expect(runBuild({ CUATRO_TOKENS_SOURCE: SOURCE_DIR, CUATRO_TOKENS_OUTPUT: second }).status).toBe(0);
        expect(readFileSync(join(first, 'tokens.css'), 'utf8')).toBe(readFileSync(join(second, 'tokens.css'), 'utf8'));
      } finally {
        rmSync(first, { recursive: true, force: true });
        rmSync(second, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  // `CUATRO_TOKENS_SOURCE` and `CUATRO_TOKENS_OUTPUT` are build inputs, and
  // either one present in a runner's environment would redirect the build away
  // from `contracts/`, leave `git status -- contracts/` clean and hold the drift
  // gate green over real drift. The `tokens-contract` job pins both empty so no
  // environment can reach the generator, and these two cases pin what an
  // unredirected run resolves to. One default each, because a case that
  // overrides one of them says nothing about the other.
  it(
    'defaults its output to contracts/tokens.css when CUATRO_TOKENS_OUTPUT is unset',
    () => {
      // Pinned without writing anything: an empty source makes the generator
      // refuse before it writes, and the resolved paths are printed before that.
      const source = scratch('empty-source');
      const before = readFileSync(PUBLISHED, 'utf8');
      try {
        const result = runBuild({ CUATRO_TOKENS_SOURCE: source, CUATRO_TOKENS_OUTPUT: undefined });
        expect(result.stdout).toContain(`writing  ${PUBLISHED.replace(/\\/g, '/')}`);
        expect(result.status, 'an empty source directory must not produce a build').not.toBe(0);
        expect(readFileSync(PUBLISHED, 'utf8'), 'the published contract was written during a test').toBe(before);
      } finally {
        // The assertion above reports a regression; this keeps that regression
        // from also leaving the published contract overwritten in the tree.
        if (readFileSync(PUBLISHED, 'utf8') !== before) writeFileSync(PUBLISHED, before);
        rmSync(source, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'defaults its source to packages/tokens/tokens when CUATRO_TOKENS_SOURCE is unset',
    () => {
      const output = scratch('default-source');
      try {
        const result = runBuild({ CUATRO_TOKENS_SOURCE: undefined, CUATRO_TOKENS_OUTPUT: output });
        expect(result.stdout).toContain(`reading  ${SOURCE_DIR.replace(/\\/g, '/')}/*.json`);
        expect(result.status, result.stderr).toBe(0);
        expect(
          readFileSync(join(output, 'tokens.css'), 'utf8'),
          'the default source directory no longer produces the committed contract'
        ).toBe(css);
      } finally {
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'refuses to publish an empty contract when the source directory holds no tokens',
    () => {
      const source = scratch('no-tokens');
      const output = scratch('no-tokens-out');
      try {
        const result = runBuild({ CUATRO_TOKENS_SOURCE: source, CUATRO_TOKENS_OUTPUT: output });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('no tokens were read from');
        expect(result.stderr).toContain(source.replace(/\\/g, '/'));
        expect(readdirSync(output), 'a file was written from an empty source').toEqual([]);
      } finally {
        rmSync(source, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );
});

// ---------------------------------------------------------------------------
// Matrix row 4: a token added without a section.
// ---------------------------------------------------------------------------

describe('a token whose group has no section', () => {
  it(
    'fails the build naming the group, rather than emitting it into an arbitrary position or dropping it',
    () => {
      const source = scratch('unmapped');
      const output = scratch('unmapped-out');
      try {
        for (const entry of readdirSync(SOURCE_DIR)) {
          writeFileSync(join(source, entry), readFileSync(join(SOURCE_DIR, entry)));
        }
        writeFileSync(
          join(source, 'zzz-unmapped.json'),
          JSON.stringify({ shadow: { $type: 'dimension', soft: { $value: '4px' } } })
        );

        const result = runBuild({ CUATRO_TOKENS_SOURCE: source, CUATRO_TOKENS_OUTPUT: output });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('shadow');
        expect(result.stderr).toContain('has no section');
        expect(readdirSync(output), 'a file was written despite the unmapped group').toEqual([]);
      } finally {
        rmSync(source, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it('leaves the ungrouped tokens working, because their group key is the token name itself', () => {
    for (const name of ['--measure', '--page-pad', '--tap', '--focus-offset']) {
      expect(rootValues.has(name), `${name} is not declared`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The generator's remaining refusals.
//
// `ops/token-contract.md` records each of these as a one-time probe, which
// proves the refusal worked on the day it was run and nothing about the run
// after someone deletes the guard. These run the real generator against a copy
// of the committed source with one file corrupted, on every suite run.
// ---------------------------------------------------------------------------

/** The committed DTCG source, copied so a case can corrupt one file of it. */
const scratchSource = (label: string): string => {
  const source = scratch(label);
  for (const entry of readdirSync(SOURCE_DIR)) {
    writeFileSync(join(source, entry), readFileSync(join(SOURCE_DIR, entry)));
  }
  return source;
};

describe('what the generator refuses to publish', () => {
  it(
    'refuses a $description carrying a CSS comment delimiter, which would inject prose as CSS',
    () => {
      const source = scratchSource('bad-description');
      const output = scratch('bad-description-out');
      try {
        const colour = JSON.parse(readFileSync(join(source, 'colour.json'), 'utf8')) as {
          c: { paper: { $description?: string } };
        };
        // Closes the generated comment early. Everything after it lands in the
        // published file as CSS, where a browser drops the malformed run and
        // whatever declaration it collides with, in seven repositories at once.
        colour.c.paper.$description = 'ends the comment */ --injected: red';
        writeFileSync(join(source, 'colour.json'), JSON.stringify(colour));

        const result = runBuild({ CUATRO_TOKENS_SOURCE: source, CUATRO_TOKENS_OUTPUT: output });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('CSS comment delimiter');
        expect(readdirSync(output), 'a file was written despite the injected comment delimiter').toEqual([]);
      } finally {
        rmSync(source, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'refuses a $value carrying a CSS delimiter, which would end the declaration early',
    () => {
      const source = scratchSource('bad-value');
      const output = scratch('bad-value-out');
      try {
        const colour = JSON.parse(readFileSync(join(source, 'colour.json'), 'utf8')) as {
          c: { paper: { $value: string } };
        };
        colour.c.paper.$value = 'oklch(12% 0.011 288); --injected: red';
        writeFileSync(join(source, 'colour.json'), JSON.stringify(colour));

        const result = runBuild({ CUATRO_TOKENS_SOURCE: source, CUATRO_TOKENS_OUTPUT: output });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('CSS delimiter');
        expect(readdirSync(output), 'a file was written despite the injected value delimiter').toEqual([]);
      } finally {
        rmSync(source, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'refuses a source with no durations, rather than publishing a contract with no reduced-motion block',
    () => {
      // Reduced-motion compliance is the one behaviour the token layer
      // federates. The block is derived from the `dur` group, so an emptied
      // group would otherwise drop the whole `@media` rule and exit 0.
      const source = scratchSource('no-durations');
      const output = scratch('no-durations-out');
      try {
        const motion = JSON.parse(readFileSync(join(source, 'motion.json'), 'utf8')) as { dur?: unknown };
        delete motion.dur;
        writeFileSync(join(source, 'motion.json'), JSON.stringify(motion));

        const result = runBuild({ CUATRO_TOKENS_SOURCE: source, CUATRO_TOKENS_OUTPUT: output });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('prefers-reduced-motion');
        expect(readdirSync(output), 'a file was written despite having no durations to collapse').toEqual([]);
      } finally {
        rmSync(source, { recursive: true, force: true });
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );
});

// ---------------------------------------------------------------------------
// Matrix rows 5 and 6: a reference that does not resolve, and one that resolves
// to itself.
// ---------------------------------------------------------------------------

describe('the reference layer', () => {
  it('resolves every var() in the file to a property declared in the same file', () => {
    expect(() => assertReferencesResolve(rootDeclarations)).not.toThrow();
  });

  it('makes every --token-* a plain var() reference to a --c-* value', () => {
    for (const name of namesMatching('--token-')) {
      expect(rootValues.get(name), name).toMatch(/^var\(--c-[a-z0-9-]+\)$/);
    }
  });

  it('fails naming the role and the target when a role points at a palette entry that is not declared', () => {
    expect(() =>
      assertReferencesResolve([
        ['--c-paper', 'oklch(12% 0.011 288)'],
        ['--token-bg', 'var(--c-missing)'],
      ])
    ).toThrow(/--token-bg references --c-missing, which is not declared/);
  });

  it('fails naming the role when a role references itself, which is silently transparent at runtime', () => {
    expect(() => assertReferencesResolve([['--token-bg', 'var(--token-bg)']])).toThrow(/--token-bg references itself/);
  });

  // `--elev-*` is an alias layer too, and was invisible to this check while it
  // only looked at `--token-*`.
  it('fails on an elevation alias that points nowhere, and on one that points at itself', () => {
    expect(() => assertReferencesResolve([['--elev-0', 'var(--c-missing)']])).toThrow(
      /--elev-0 references --c-missing, which is not declared/
    );
    expect(() => assertReferencesResolve([['--elev-1', 'var(--elev-1)']])).toThrow(/--elev-1 references itself/);
  });

  it('fails when a role is not a var() reference at all, so text that merely looks like one cannot pass', () => {
    expect(() => assertReferencesResolve([['--token-bg', 'oklch(12% 0.011 288)']])).toThrow(
      /--token-bg is not a plain var\(\) reference/
    );
    expect(() =>
      assertReferencesResolve([
        ['--c-paper', 'oklch(12% 0.011 288)'],
        ['--token-bg', 'var(--c-paper) var(--c-paper)'],
      ])
    ).toThrow(/--token-bg is not a plain var\(\) reference/);
  });

  it('refuses a role that reaches past the palette into another role', () => {
    expect(() =>
      assertReferencesResolve([
        ['--c-paper', 'oklch(12% 0.011 288)'],
        ['--token-bg', 'var(--c-paper)'],
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
// The file has to be CSS a consumer can @import, not merely text that parses
// under a regex.
// ---------------------------------------------------------------------------

describe('the published file as CSS', () => {
  it('balances its braces', () => {
    expect(() => blocksIn(stripped)).not.toThrow();
    expect((stripped.match(/\{/g) ?? []).length).toBe((stripped.match(/\}/g) ?? []).length);
  });

  it('carries exactly two top-level rules, :root and the reduced-motion query', () => {
    expect(topLevel.blocks.map((block) => block.prelude)).toEqual([
      ':root',
      '@media (prefers-reduced-motion: reduce)',
    ]);
  });

  it('declares nothing outside a rule', () => {
    expect(declarationsIn(topLevel.outside)).toEqual([]);
    expect(topLevel.outside).not.toContain(';');
  });

  it('puts all 89 declarations inside the single :root block', () => {
    expect(rootBlock).toBeDefined();
    expect(declarationsIn(rootBlock!.body)).toHaveLength(89);
    expect(declarationsIn(stripped)).toHaveLength(89 + mediaDeclarations.length);
  });

  it('nests exactly one :root inside the reduced-motion query and nothing else', () => {
    expect(mediaBlock).toBeDefined();
    const inner = blocksIn(mediaBlock!.body);
    expect(inner.blocks.map((block) => block.prelude)).toEqual([':root']);
    expect(declarationsIn(inner.outside)).toEqual([]);
  });

  it('is LF only and ends with exactly one newline', () => {
    // `.gitattributes` carries `contracts/** text eol=lf` precisely because a
    // CRLF checkout desyncs the drift gate from the generator. When that rule is
    // lost, this fails as the checkout problem it is rather than as an opaque
    // byte mismatch in the build case above.
    expect(css.includes('\r'), 'the published contract holds a CR, so `contracts/** text eol=lf` is not in effect').toBe(
      false
    );
    expect(css.endsWith('\n')).toBe(true);
    expect(css.endsWith('\n\n')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The acceptance criteria that are not matrix rows.
// ---------------------------------------------------------------------------

describe('the published property set', () => {
  // The counts `epics.md:1550` fixes, category by category, plus the total, so
  // a token added to one category and dropped from another cannot net out.
  // Every member list is filtered out of the parsed file, never appended as a
  // literal, so deleting `--page-pad` or `--focus-offset` fails its count here.
  const categories: Array<[label: string, names: string[], expected: number]> = [
    ['palette', namesMatching('--c-'), 12],
    ['semantic roles', namesMatching('--token-'), 12],
    ['families', namesMatching('--f-'), 3],
    ['type scale', namesMatching('--t-'), 10],
    ['weights', namesMatching('--w-'), 5],
    ['line-heights', namesMatching('--lh-'), 5],
    ['tracking', namesMatching('--tr-'), 6],
    ['spacing steps', namesWhere((name) => name.startsWith('--s-') || name === '--page-pad'), 9],
    ['shape', namesMatching('--r-'), 3],
    ['stroke', namesWhere((name) => name.startsWith('--stroke-') || name === '--focus-offset'), 5],
    ['elevation', namesMatching('--elev-'), 3],
    ['motion', namesWhere((name) => name.startsWith('--dur-') || name.startsWith('--ease-')), 7],
    ['z-index', namesMatching('--z-'), 7],
  ];

  for (const [label, names, expected] of categories) {
    it(`declares exactly ${expected} ${label} values`, () => {
      expect(names).toHaveLength(expected);
    });
  }

  it('declares --measure and --tap once each', () => {
    expect(namesWhere((name) => name === '--measure')).toEqual(['--measure']);
    expect(namesWhere((name) => name === '--tap')).toEqual(['--tap']);
  });

  it('declares 89 properties in total and no name twice', () => {
    expect(rootDeclarations).toHaveLength(89);
    expect(new Set(declaredNames).size).toBe(89);
  });

  it('declares exactly the expected names, in the expected order', () => {
    expect(declaredNames).toEqual(EXPECTED_NAMES);
  });

  it('keeps every name inside the naming convention, so a hand-edited one is rejected rather than ignored', () => {
    for (const name of declaredNames) {
      expect(name, `${name} is not a lowercase kebab custom property`).toMatch(/^--[a-z][a-z0-9-]*$/);
    }
  });

  it('authors every palette value in OKLCH on hue 288, with no hex or other colour space substituted', () => {
    for (const name of namesMatching('--c-')) {
      expect(rootValues.get(name), `${name} is not an authored OKLCH value on hue 288`).toMatch(
        /^oklch\(\d+(\.\d+)?% \d+(\.\d+)? 288( \/ \d+(\.\d+)?)?\)$/
      );
    }
  });

  // Asserted as a property of the values rather than as a ban on three
  // spellings. `hsla()` contains neither `hsl(` nor `rgba(`, and an eight-digit
  // hex contains neither, so a ban-list lets both through. An allow-list of the
  // functions the contract carries does not.
  it('calls only the four value functions the contract is allowed to carry, and no hex anywhere', () => {
    const allowed = new Set(['var', 'oklch', 'clamp', 'cubic-bezier']);
    for (const [name, value] of [...rootDeclarations, ...mediaDeclarations]) {
      expect(value, `${name} carries a hex colour`).not.toContain('#');
      for (const call of value.matchAll(/([A-Za-z][A-Za-z-]*)\(/g)) {
        expect(allowed.has(call[1]), `${name} calls ${call[1]}(), which the contract does not carry`).toBe(true);
      }
    }
  });

  it('carries exactly one translucent value, on the palette entry that exists to be one', () => {
    const translucent = rootDeclarations.filter(([, value]) => /\s\/\s/.test(value)).map(([name]) => name);
    expect(translucent).toEqual(['--c-scrim']);
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
    expect(readerScaled.length).toBe(20);
    for (const [name, value] of readerScaled) {
      expect(value, `${name} is authored in px and would not scale with the root font size`).not.toContain('px');
    }
  });

  // `epics.md:1558-1559` and `DESIGN.md:540` both call --tap "the only length in
  // the contract authored in px". `DESIGN.md` section `tokens.css`, which the
  // same criterion names as what fixes the property set, authors the shape and
  // stroke geometry in px too, and `DESIGN.md:602` states rules are "1px and
  // opaque". The design block wins, and the exact set is pinned here so neither
  // can drift unnoticed. See `ops/token-contract.md`.
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

  it('publishes a comment about --tap that the file it sits in does not contradict', () => {
    const comment = (css.match(/\/\*[\s\S]*?\*\//g) ?? []).find((block) => block.includes('hit-target floor')) ?? '';
    expect(comment, 'the --tap note is not in the published file').not.toBe('');
    expect(comment).toContain('physical-size guarantee');
    expect(comment).toContain('BOTH axes');
    expect(comment).toContain('shape and stroke');
    expect(comment).not.toContain('ONE px length in the contract');
  });
});

describe('the reduced-motion block', () => {
  it('is the one @media rule in the file, and it targets :root', () => {
    expect(css.match(/@media/g)).toHaveLength(1);
    expect(mediaBlock?.prelude).toBe('@media (prefers-reduced-motion: reduce)');
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
    const published = filesUnder(CONTRACTS).map(repoRelative);
    expect([...published].sort()).toEqual([
      'contracts/fonts.css',
      'contracts/fonts/OFL-bricolage-grotesque.txt',
      'contracts/fonts/OFL-geist-mono.txt',
      'contracts/fonts/OFL-geist.txt',
      'contracts/fonts/bricolage-grotesque-latin.woff2',
      'contracts/fonts/geist-latin.woff2',
      'contracts/fonts/geist-mono-latin.woff2',
      // The two hand-authored files this generator does not write. Story 2-3
      // added them: `contracts/` is the published surface, and from that story
      // it is the token contract's nine plus the Registry pair (AD-4).
      'contracts/registry.json',
      'contracts/registry.schema.json',
      'contracts/tailwind.css',
      'contracts/tokens.css',
    ]);
    for (const file of published) {
      expect(file, `${file} is executable and contracts/ is the published surface (AD-1)`).not.toMatch(EXECUTABLE);
    }
  });

  it('keeps the generator out of the published surface and out of every manifest above packages/', () => {
    // AD-1 states two things and this asserts both: nothing executable is
    // published, and the generator's dependency belongs to the workspace package
    // alone. Enumerating files under `packages/` and asserting their paths start
    // with `packages/` proved nothing, which is what this replaces.
    for (const file of filesUnder(CONTRACTS).map(repoRelative)) {
      expect(file, `${file} is a script under the published surface`).not.toMatch(/\.(mjs|cjs|js|ts)$/);
    }

    const manifests = filesUnder(REPO_ROOT)
      .map(repoRelative)
      .filter((file) => file.endsWith('package.json') && !file.startsWith('packages/'));
    expect(manifests, 'the root manifest was not found, so this case would pass over nothing').toContain('package.json');
    for (const manifest of manifests) {
      expect(readFileSync(join(REPO_ROOT, manifest), 'utf8'), `${manifest} declares style-dictionary`).not.toContain(
        'style-dictionary'
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The line-by-line comparison against the design source. A count test cannot
// catch a mistyped OKLCH lightness; this can.
// ---------------------------------------------------------------------------

describe('against DESIGN.md section tokens.css, which fixes the property set', () => {
  /**
   * Reading the design source off disk is what makes "every name and value
   * matches the design" a machine assertion. It also couples this suite to a
   * planning artefact under a dated directory this story does not own, which is
   * recorded as a stated limit in `ops/token-contract.md`. Every way that
   * coupling can break throws with the coupling named, rather than throwing
   * ENOENT during collection or locking onto the wrong fenced block.
   */
  const designBlock = (): string => {
    const where = repoRelative(DESIGN);
    if (!existsSync(DESIGN)) {
      throw new Error(
        `the design source is not at ${where}. This suite reads it to compare the published contract ` +
          `declaration by declaration; see ops/token-contract.md, "Stated limits".`
      );
    }
    const design = readFileSync(DESIGN, 'utf8');
    const heading = design.indexOf('### `tokens.css`');
    if (heading === -1) {
      throw new Error(`${where} carries no "### \`tokens.css\`" heading, so there is no block to compare against.`);
    }
    const fence = design.indexOf('```css', heading);
    if (fence === -1) {
      throw new Error(`${where} has no fenced css block after its "### \`tokens.css\`" heading.`);
    }
    const end = design.indexOf('```', fence + 6);
    if (end === -1) {
      throw new Error(`${where} has an unterminated css fence under its "### \`tokens.css\`" heading.`);
    }
    return design.slice(fence + 6, end);
  };

  const designParts = () => {
    const block = stripComments(designBlock());
    const media = block.indexOf('@media');
    return {
      root: media === -1 ? block : block.slice(0, media),
      media: media === -1 ? '' : block.slice(media),
    };
  };

  it('finds the block, so a moved heading fails here rather than passing vacuously', () => {
    expect(() => designBlock()).not.toThrow();
    expect(declarationsIn(designParts().root).length).toBeGreaterThan(80);
  });

  it('declares the same names in the same order with the same values', () => {
    expect(rootDeclarations).toEqual(declarationsIn(designParts().root));
  });

  it('carries the same reduced-motion block', () => {
    expect(mediaDeclarations).toEqual(declarationsIn(designParts().media));
  });
});

// ---------------------------------------------------------------------------
// The DTCG source, which is what a later story edits rather than the output.
// ---------------------------------------------------------------------------

describe('the DTCG source', () => {
  const sourceFiles = readdirSync(SOURCE_DIR);

  it('is JSON only, so nothing executable can be mistaken for a token file', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    for (const entry of sourceFiles) {
      expect(entry).toMatch(/\.json$/);
    }
  });

  it('carries its own provenance, so a tool author who trusts $type is not left to infer the decision', () => {
    for (const entry of sourceFiles) {
      const parsed = JSON.parse(readFileSync(join(SOURCE_DIR, entry), 'utf8')) as { $description?: string };
      expect(parsed.$description, `${entry} carries no $description`).toBeTypeOf('string');
      expect(parsed.$description).toContain('CSS strings inside DTCG structure');
      expect(parsed.$description).toContain('ops/token-contract.md');
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
    for (const entry of sourceFiles) {
      walk(JSON.parse(readFileSync(join(SOURCE_DIR, entry), 'utf8')));
    }
    // Twelve roles plus three elevation steps.
    expect(aliases).toHaveLength(15);
    for (const alias of aliases) expect(alias).toMatch(/^\{c\.[a-z0-9-]+\}$/);
  });
});
