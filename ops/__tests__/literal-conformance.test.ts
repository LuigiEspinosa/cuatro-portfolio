// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import {
  ALPHA_ALLOWANCE,
  DISPOSITIONS,
  NAMED_COLOURS,
  PERMITTED,
  SCALE_UNITS,
  TYPE_PROPERTIES,
  inspect,
  mask,
  report,
  scan,
} from '../literal-conformance.mjs';

// One standing case per row of Story 2-34's I/O matrix, the configuration pinned, the real tree,
// both exit paths of the command, and the job's wiring. They run inside the already-blocking `test`
// job as well as beside the new one, so the two are independent readers of one rule.

// Resolved from the repository root, where Vitest runs. Not from `import.meta.url`, which is a vite
// URL under Vitest (the `ops/__tests__/contract-purity.test.ts` precedent).
const ROOT = process.cwd();
const GATE = resolve(ROOT, 'ops/literal-conformance.mjs');
const WORKFLOW = resolve(ROOT, '.github/workflows/ci.yml');
const TOKENS = resolve(ROOT, 'contracts/tokens.css');
const JOB = 'literal-conformance';
const HERE = 'ops/__tests__/literal-conformance.test.ts';

/** A stylesheet outside the permitted set, and the two kinds inside it. */
const COMPONENT = 'components/organisms/Probe/Probe.scss';
const PRINT = 'app/scss/_print.scss';
const CONTRACT = 'contracts/tokens.css';

type Allowance = { path: string; property: string };

/** The findings for one stylesheet, as `rule property: literal`. */
const findingsIn = (source: string, path = COMPONENT, allowance?: Allowance): string[] =>
  scan([{ path, source }], allowance).findings.map((finding) => `${finding.rule} ${finding.property}: ${finding.literal}`);

/** One declaration inside a rule, which is the shape nearly every case needs. */
const rule = (declaration: string): string => `.probe {\n  ${declaration}\n}\n`;

const atCollection = <T>(why: string, build: () => T): T => {
  try {
    return build();
  } catch (error) {
    throw new Error(`${HERE}: ${why} ${error instanceof Error ? error.message : String(error)}`);
  }
};

// `spawnSync` reports a failure to start in `error` and leaves `status` null, so an unguarded
// `run.status` turns a broken harness into what reads as a gate defect.
const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

/**
 * A scratch git repository under `tmpdir()` carrying `files`, left untracked unless `track` names
 * them, so the committed tree is never touched by a test run and a killed run leaves nothing under
 * the repository. `--others --exclude-standard` lists untracked files, which is the half of the
 * listing a developer's own machine exercises before a commit.
 */
const withRepo = <T>(files: Record<string, string>, use: (root: string) => T, track: string[] = []): T => {
  const root = mkdtempSync(join(tmpdir(), 'literal-conformance-'));
  try {
    spawned(spawnSync('git', ['init', '--quiet'], { cwd: root, encoding: 'utf8' }));
    for (const [path, source] of Object.entries(files)) {
      const full = join(root, ...path.split('/'));
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, source, 'utf8');
    }
    if (track.length > 0) spawned(spawnSync('git', ['add', '--', ...track], { cwd: root, encoding: 'utf8' }));
    return use(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const REAL_TOKENS = atCollection('could not read contracts/tokens.css:', () => readFileSync(TOKENS, 'utf8'));

// ---------------------------------------------------------------------------
// The configuration: every allowance is a named entry with its reason.
// ---------------------------------------------------------------------------

describe('the configuration', () => {
  it('permits exactly contracts/ and app/scss/_print.scss, each with its reason', () => {
    expect(
      PERMITTED.map((entry) => entry.path),
      'the permitted set is exactly two entries (Story 2.34); a third is a reviewed edit, never a quiet one'
    ).toEqual(['contracts/', 'app/scss/_print.scss']);
    for (const entry of PERMITTED) expect(entry.reason.trim(), `${entry.path} carries no reason`).not.toBe('');
  });

  it('writes the one alpha allowance against the palette declaration, never against the role', () => {
    expect(ALPHA_ALLOWANCE.path).toBe('contracts/tokens.css');
    expect(ALPHA_ALLOWANCE.property).toBe('--c-scrim');
    expect(ALPHA_ALLOWANCE.property, 'review finding HIGH-4: the role holds no alpha').not.toBe('--token-scrim');
    expect(ALPHA_ALLOWANCE.reason.trim()).not.toBe('');
    // The contract as the allowance describes it: the alpha on the palette entry, the role a plain reference.
    expect(REAL_TOKENS).toMatch(/--c-scrim:\s*oklch\([^)]*\/\s*0\.88\)/);
    expect(REAL_TOKENS).toMatch(/--token-scrim:\s*var\(--c-scrim\)/);
  });

  it('carries the four dispositions, each with its verdict and its reason', () => {
    expect(DISPOSITIONS.map((entry) => entry.verdict)).toEqual(['allowed', 'allowed', 'rejected', 'allowed']);
    expect(DISPOSITIONS[0].collision).toContain('opacity');
    expect(DISPOSITIONS[1].collision).toContain('clip-path');
    expect(DISPOSITIONS[2].collision).toContain('44px');
    expect(DISPOSITIONS[3].collision).toContain('font-variation-settings');
    for (const entry of DISPOSITIONS) expect(entry.reason.trim(), `${entry.collision} carries no reason`).not.toBe('');
  });

  it('names the 148 CSS named colours, and neither transparent, currentcolor nor a system colour', () => {
    expect(NAMED_COLOURS).toHaveLength(148);
    expect(new Set(NAMED_COLOURS).size, 'a named colour is listed twice').toBe(148);
    for (const keyword of ['transparent', 'currentcolor', 'canvas', 'canvastext']) {
      expect(NAMED_COLOURS).not.toContain(keyword);
    }
  });

  it('scopes the type check to the scaled properties and the spacing check to scale units', () => {
    expect(TYPE_PROPERTIES).toEqual(['font', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing']);
    expect(TYPE_PROPERTIES).not.toContain('font-variation-settings');
    expect(TYPE_PROPERTIES).not.toContain('font-stretch');
    expect(SCALE_UNITS).toContain('px');
    expect(SCALE_UNITS).toContain('rem');
    expect(SCALE_UNITS).not.toContain('%');
    expect(SCALE_UNITS).not.toContain('vw');
  });
});

// ---------------------------------------------------------------------------
// Matrix row "Colour literal": every form, anywhere outside the permitted set.
// ---------------------------------------------------------------------------

describe('a colour literal outside the permitted set', () => {
  const forms = [
    '#fff',
    '#FFF',
    '#ffff',
    '#ffffff',
    '#ffffff80',
    'rgb(0 0 0)',
    'rgba(0, 0, 0, 0.5)',
    'hsl(0 0% 0%)',
    'hsla(0, 0%, 0%, 0.5)',
    'hwb(0 0% 0%)',
    'lab(50% 0 0)',
    'lch(50% 0 0)',
    'oklab(50% 0 0)',
    'oklch(50% 0.1 288)',
    'color(display-p3 1 0 0)',
    'color-mix(in oklch, var(--token-accent) 50%, var(--token-bg))',
    'White',
    'rebeccapurple',
  ];

  it.each(forms)('refuses %s', (form) => {
    expect(findingsIn(rule(`color: ${form};`))).toEqual([`colour color: ${form}`]);
  });

  it('refuses one in a custom property, a Sass variable and a Sass at-rule argument', () => {
    expect(findingsIn(rule('--probe: #fff;'))).toEqual(['colour --probe: #fff']);
    expect(findingsIn('$probe: red;\n')).toEqual(['colour $probe: red']);
    expect(findingsIn('@include probe(#fff);\n')).toEqual(['colour @include: #fff']);
    expect(findingsIn('@mixin probe($colour: #fff) {\n}\n')).toEqual(['colour @mixin: #fff']);
    expect(findingsIn('@if $x == white {\n}\n')).toEqual(['colour @if: white']);
  });

  it('names the file, the line, the property and the literal, and reports every one', () => {
    const source = '.a {\n  display: grid;\n  color: #fff;\n  border: 1px solid rgba(0, 0, 0, 0.1);\n}\n';
    const { findings } = scan([{ path: COMPONENT, source }]);
    expect(findings.map((finding) => [finding.line, finding.property, finding.literal])).toEqual([
      [3, 'color', '#fff'],
      [4, 'border', 'rgba(0, 0, 0, 0.1)'],
    ]);
    const { ok, message } = report({ read: true, error: null, ...scan([{ path: COMPONENT, source }]) });
    expect(ok).toBe(false);
    expect(message).toContain('literal conformance: REFUSED');
    expect(message).toContain(`${COMPONENT}:3: color: #fff, a colour literal`);
    expect(message).toContain(`${COMPONENT}:4: border: rgba(0, 0, 0, 0.1), a colour literal`);
  });

  it('reads no colour in a keyword, a reference or a longer name', () => {
    for (const declaration of [
      'background-color: transparent;',
      'border-color: currentcolor;',
      'color: var(--token-text);',
      'color: var(--white-ish);',
      'white-space: nowrap;',
      'grid-area: tanned;',
      'rotate: calc(tan(45deg) * 1turn);',
      'font-weight: var(--w-black);',
      '$white-ish: var(--token-text);',
    ]) {
      expect(findingsIn(rule(declaration)), declaration).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix row "Permitted".
// ---------------------------------------------------------------------------

describe('the permitted set', () => {
  const opaque = rule('color: #000;\n  background: white;\n  border-color: rgb(0 0 0);');

  it('lets an opaque literal stand in contracts/ at any depth and in the print stylesheet', () => {
    expect(findingsIn(opaque, CONTRACT)).toEqual([]);
    expect(findingsIn(opaque, 'contracts/nested/probe.css')).toEqual([]);
    expect(findingsIn(opaque, PRINT)).toEqual([]);
  });

  it('matches a path, never a basename or a prefix without its separator', () => {
    expect(findingsIn(opaque, 'components/organisms/Probe/_print.scss')).toHaveLength(3);
    expect(findingsIn(opaque, 'contracts-extra/probe.css')).toHaveLength(3);
    expect(findingsIn(opaque, 'app/scss/_print.scss.bak.scss')).toHaveLength(3);
  });

  it('keeps every other check off the permitted set: spacing, type and 44px are the contract\'s own', () => {
    expect(findingsIn(rule('padding: 12px;\n  font-size: 12pt;\n  min-height: 44px;'), PRINT)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matrix rows "Alpha" and "Role-named allowance".
// ---------------------------------------------------------------------------

describe('alpha', () => {
  const scrim = ':root {\n  --c-scrim: oklch(12% 0.011 288 / 0.88);\n  --token-scrim: var(--c-scrim);\n}\n';

  it('allows exactly one alpha in the real contract, on --c-scrim, and refuses nothing there', () => {
    const { findings, allowed } = scan([{ path: CONTRACT, source: REAL_TOKENS }]);
    expect(findings).toEqual([]);
    expect(allowed, 'the contract carries exactly one alpha value').toBe(1);
  });

  it('allows the alpha on the palette declaration and nowhere else, even inside contracts/', () => {
    expect(scan([{ path: CONTRACT, source: scrim }]).allowed).toBe(1);
    expect(findingsIn(':root {\n  --c-line: oklch(28% 0.015 288 / 0.5);\n}\n', CONTRACT)).toEqual([
      'alpha --c-line: oklch(28% 0.015 288 / 0.5)',
    ]);
    expect(findingsIn(':root {\n  --token-scrim: oklch(12% 0.011 288 / 0.88);\n}\n', CONTRACT)).toEqual([
      'alpha --token-scrim: oklch(12% 0.011 288 / 0.88)',
    ]);
    expect(findingsIn(scrim, 'contracts/tailwind.css')).toEqual(['alpha --c-scrim: oklch(12% 0.011 288 / 0.88)']);
  });

  it('refuses alpha in the print stylesheet, in every spelling', () => {
    for (const form of [
      'rgba(6, 5, 9, 0.88)',
      '#06050988',
      '#0008',
      'rgb(0 0 0 / 50%)',
      'hsl(0, 0%, 0%, 0.5)',
      'color-mix(in srgb, #000 50%, transparent)',
    ]) {
      expect(findingsIn(rule(`color: ${form};`), PRINT), form).toContain(`alpha color: ${form}`);
    }
  });

  it('refuses a hand-written copy of the scrim anywhere outside contracts/, however it is spelled', () => {
    expect(findingsIn(rule('background: rgba(6, 5, 9, 0.88);'))).toEqual(['colour background: rgba(6, 5, 9, 0.88)']);
    expect(findingsIn(':root {\n  --c-scrim: oklch(12% 0.011 288 / 0.88);\n}\n')).toEqual([
      'colour --c-scrim: oklch(12% 0.011 288 / 0.88)',
    ]);
  });

  it('shows why the allowance names the palette entry: one written against the role refuses the contract itself', () => {
    const againstTheRole = { path: CONTRACT, property: '--token-scrim' };
    expect(findingsIn(REAL_TOKENS, CONTRACT, againstTheRole)).toEqual(['alpha --c-scrim: oklch(12% 0.011 288 / 0.88)']);
    expect(findingsIn(REAL_TOKENS, CONTRACT)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matrix rows "Dispositions" and "44px".
// ---------------------------------------------------------------------------

describe('the four dispositions', () => {
  it('1. allows opacity keyframes: the alpha check reads colour functions, never opacity', () => {
    const entrance = '@keyframes enter {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n.a { opacity: 0.5; }\n';
    expect(findingsIn(entrance)).toEqual([]);
  });

  it('2. allows clip-path coordinates: the spacing check reads spacing properties only', () => {
    const notch = 'clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);';
    expect(findingsIn(rule(notch))).toEqual([]);
    expect(findingsIn(rule('padding: 10px;'))).toEqual(['spacing padding: 10px']);
  });

  it('3. rejects a hand-written 44px in every declaration, with no local-constant allowance', () => {
    expect(findingsIn(rule('min-height: 44px;'))).toEqual(['tap min-height: 44px']);
    expect(findingsIn(rule('min-width: 44.0px;'))).toEqual(['tap min-width: 44.0px']);
    expect(findingsIn(rule('--tap-local: 44px;'))).toEqual(['tap --tap-local: 44px']);
    expect(findingsIn('$tap: 44px;\n')).toEqual(['tap $tap: 44px']);
    expect(findingsIn(rule('padding: calc(44px + 0px);'))).toEqual(['tap padding: 44px']);
    expect(findingsIn('@include target(44px);\n')).toEqual(['tap @include: 44px']);
    expect(findingsIn(rule('min-height: var(--tap);\n  min-width: var(--tap);'))).toEqual([]);
  });

  it('4. allows font-variation-settings axis literals, and font-stretch on the same axis', () => {
    expect(findingsIn(rule('font-variation-settings: "wdth" 85, "opsz" 48;'))).toEqual([]);
    expect(findingsIn(rule('font-stretch: 85%;'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matrix row "Spacing".
// ---------------------------------------------------------------------------

describe('a spacing literal in a spacing property', () => {
  const properties = [
    'padding',
    'padding-inline-start',
    'padding-top',
    'margin',
    'margin-block',
    'margin-left',
    'gap',
    'row-gap',
    'column-gap',
    'grid-gap',
    'inset',
    'inset-block',
    'inset-block-start',
    'top',
    'right',
    'bottom',
    'left',
    'scroll-margin-top',
    'scroll-padding-inline',
  ];

  it.each(properties)('refuses a length in %s', (property) => {
    expect(findingsIn(rule(`${property}: 12px;`))).toEqual([`spacing ${property}: 12px`]);
  });

  it('refuses every absolute and font-relative length, a negative one and a var() fallback', () => {
    expect(findingsIn(rule('margin: 1.5rem;'))).toEqual(['spacing margin: 1.5rem']);
    expect(findingsIn(rule('margin: 1em;'))).toEqual(['spacing margin: 1em']);
    expect(findingsIn(rule('margin-top: -1px;'))).toEqual(['spacing margin-top: -1px']);
    expect(findingsIn(rule('padding: var(--s-md, 16px);'))).toEqual(['spacing padding: 16px']);
    expect(findingsIn(rule('margin-left: calc(var(--s-md) + 2px);'))).toEqual(['spacing margin-left: 2px']);
  });

  it('allows zero, auto, a reference, a unitless factor and relative geometry', () => {
    for (const declaration of [
      'margin: 0;',
      'margin: 0 auto;',
      'padding: 0px;',
      'gap: var(--s-md);',
      'inset: 0;',
      'margin-block: calc(var(--s-md) * -1);',
      'top: 12%;',
      'inset-inline-start: 50%;',
      'left: 8vw;',
      'padding-block: 5dvh;',
    ]) {
      expect(findingsIn(rule(declaration)), declaration).toEqual([]);
    }
  });

  it('reads no other property: a width, a stroke, an offset outline or a transform is not spacing', () => {
    for (const declaration of [
      'width: 12px;',
      'border-width: 3px;',
      'min-height: 100vh;',
      'max-width: 46ch;',
      'outline-offset: 3px;',
      'transform: translateY(8px);',
    ]) {
      expect(findingsIn(rule(declaration)), declaration).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix row "Type".
// ---------------------------------------------------------------------------

describe('a type literal in a type property', () => {
  const literals = [
    'font-family: system-ui',
    'font-family: var(--f-body), sans-serif',
    'font-family: "Geist"',
    'font-size: 14px',
    'font-size: min(8vw, 5rem)',
    'font-size: var(--t-sm, 14px)',
    'font-size: calc(var(--t-sm) * 1.2)',
    'font-weight: 700',
    'font-weight: bold',
    'line-height: 1.5',
    'line-height: normal',
    'letter-spacing: 0.1em',
    'font: 700 1rem/1.5 var(--f-body)',
  ];

  it.each(literals)('refuses %s', (declaration) => {
    const [property, value] = declaration.split(/:\s*/);
    expect(findingsIn(rule(`${declaration};`))).toEqual([`type ${property}: ${value}`]);
  });

  it('allows a role, a reference to any other custom property, a Sass variable and a CSS-wide keyword', () => {
    for (const declaration of [
      'font-family: var(--f-display);',
      'font-family: var(--local-family);',
      'font-size: var(--t-display);',
      'font-size: $size;',
      'font-weight: var(--w-black);',
      'line-height: var(--lh-body);',
      'letter-spacing: var(--tr-label);',
      'font: inherit;',
      'font-size: inherit !important;',
      'line-height: revert-layer;',
    ]) {
      expect(findingsIn(rule(declaration)), declaration).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix rows "Not a value" and "Suppression".
// ---------------------------------------------------------------------------

describe('what is not a value', () => {
  it('reads no comment, whether block or line, and a brace inside one breaks nothing', () => {
    expect(findingsIn('/* color: #fff; */\n.a {\n  // .b { color: red; }\n  color: var(--token-text);\n}\n')).toEqual([]);
  });

  it('reads no string, no url() and no interpolation', () => {
    expect(findingsIn(rule('content: "#fff red 44px";'))).toEqual([]);
    expect(findingsIn(rule('grid-template-areas: "red white";'))).toEqual([]);
    expect(findingsIn(rule('background-image: url(#fff);'))).toEqual([]);
    expect(findingsIn(rule('mask: url("data:image/svg+xml;utf8,<svg fill=\'#fff\'/>");'))).toEqual([]);
    expect(findingsIn('#{$container} .a {\n  width: calc(100% - #{$gap});\n}\n')).toEqual([]);
  });

  it('reads no selector and no condition', () => {
    expect(findingsIn('#fed,\n.red,\n#add {\n  color: var(--token-text);\n}\n')).toEqual([]);
    expect(findingsIn('@media (min-width: 44px) {\n  .a { color: var(--token-text); }\n}\n')).toEqual([]);
    expect(findingsIn('@supports (color: oklch(0 0 0)) {\n  .a { color: var(--token-text); }\n}\n')).toEqual([]);
    expect(findingsIn("@use '../../contracts/tokens';\n@forward './print';\n")).toEqual([]);
  });

  it('still reads the declarations inside a condition, a mixin and a keyframe', () => {
    expect(findingsIn('@media (hover: hover) {\n  .a:hover { color: #fff; }\n}\n')).toEqual(['colour color: #fff']);
    expect(findingsIn('@mixin probe($c) {\n  #{$c} { padding: 12px; }\n}\n')).toEqual(['spacing padding: 12px']);
  });

  it('keeps every offset, so a finding quotes the source at its real line', () => {
    const source = '/* a\n comment */\n.a {\n  content: "x";\n  color: #fff;\n}\n';
    expect(mask(source)).toHaveLength(source.length);
    expect(mask(source).split('\n')).toHaveLength(source.split('\n').length);
    expect(scan([{ path: COMPONENT, source }]).findings.map((finding) => finding.line)).toEqual([5]);
  });

  it('fails closed on a statement it cannot read as a declaration', () => {
    expect(findingsIn(rule('*zoom: 1;'))).toEqual(['unread : *zoom: 1']);
  });
});

describe('suppression', () => {
  it('is never a comment: a comment naming the gate, or any linter, silences nothing', () => {
    expect(findingsIn(rule('/* literal-conformance: ignore */ color: #fff;'))).toEqual(['colour color: #fff']);
    expect(findingsIn(rule('color: #fff; // literal-conformance-disable-line'))).toEqual(['colour color: #fff']);
    expect(findingsIn(`/* stylelint-disable */\n${rule('color: #fff;')}`)).toEqual(['colour color: #fff']);
  });
});

// ---------------------------------------------------------------------------
// Matrix rows "Out of scope", "Nothing read" and "Clean tree", through the real listing.
// ---------------------------------------------------------------------------

describe('the listing', () => {
  const clean = rule('color: var(--token-text);');

  it('reads stylesheets only: a script carrying a colour is seam S-1 and is never opened', () => {
    withRepo(
      {
        'components/Scene/Scene.tsx': "const colour = new THREE.Color('#ff0000');\n",
        'components/Scene/Scene.ts': "export const fog = '#000000';\n",
        [COMPONENT]: clean,
      },
      (root) => {
        const inspection = inspect(root);
        expect(inspection.read).toBe(true);
        expect(inspection.findings).toEqual([]);
        expect(inspection.outside, 'a script was read as a stylesheet').toBe(1);
        expect(report(inspection).ok).toBe(true);
      }
    );
  });

  it('refuses a Sass indented-syntax file rather than skip it', () => {
    withRepo({ [COMPONENT]: clean, 'components/Probe/probe.sass': '.a\n  color: #fff\n' }, (root) => {
      const inspection = inspect(root);
      expect(inspection.findings.map((finding) => [finding.path, finding.rule])).toEqual([
        ['components/Probe/probe.sass', 'syntax'],
      ]);
      expect(report(inspection).message).toContain('components/Probe/probe.sass: Sass indented syntax');
    });
  });

  it('reads what a commit would carry, tracked or not, and never what .gitignore keeps out of one', () => {
    withRepo(
      {
        '.gitignore': '/public/contracts/\n/.next/\n',
        'public/contracts/tokens.css': ':root { --c-ink: #fff; }\n',
        '.next/static/chunks/probe.css': '.a{color:#fff}\n',
        'components/Tracked/Tracked.scss': rule('color: #fff;'),
        'components/Untracked/Untracked.scss': rule('color: #000;'),
      },
      (root) => {
        expect(inspect(root).findings.map((finding) => finding.path)).toEqual([
          'components/Tracked/Tracked.scss',
          'components/Untracked/Untracked.scss',
        ]);
      },
      ['components/Tracked/Tracked.scss']
    );
  });

  it('skips a tracked stylesheet deleted from the working tree, which no build reads', () => {
    withRepo(
      { 'components/Gone/Gone.scss': rule('color: #fff;'), [COMPONENT]: clean },
      (root) => {
        rmSync(join(root, 'components', 'Gone', 'Gone.scss'));
        const inspection = inspect(root);
        expect(inspection.findings).toEqual([]);
        expect(inspection.outside).toBe(1);
      },
      ['components/Gone/Gone.scss']
    );
  });

  it('refuses a listed stylesheet it cannot read, rather than skip it', () => {
    // A tracked path that is a directory on disk is the one unreadable file every host can build: the
    // index still lists it and the read fails with EISDIR, not with the ENOENT a deletion gives.
    withRepo(
      { 'components/Dir/Dir.scss': clean, [COMPONENT]: clean },
      (root) => {
        const path = join(root, 'components', 'Dir', 'Dir.scss');
        rmSync(path);
        mkdirSync(path);
        const inspection = inspect(root);
        expect(inspection.findings.map((finding) => [finding.path, finding.rule])).toEqual([
          ['components/Dir/Dir.scss', 'unreadable'],
        ]);
        const { ok, message } = report(inspection);
        expect(ok).toBe(false);
        expect(message).toContain('components/Dir/Dir.scss: could not be read (EISDIR)');
      },
      ['components/Dir/Dir.scss']
    );
  });

  it('refuses when the stylesheets cannot be listed, and never passes over a tree it did not read', () => {
    const missing = join(tmpdir(), `literal-conformance-missing-${process.pid}-${Date.now()}`);
    const inspection = inspect(missing);
    expect(inspection.read).toBe(false);
    const { ok, message } = report(inspection);
    expect(ok).toBe(false);
    expect(message).toContain('literal conformance: REFUSED');
    expect(message).toContain('The stylesheets could not be listed');
  });

  it('refuses when nothing outside the permitted set was read', () => {
    withRepo({ [CONTRACT]: REAL_TOKENS }, (root) => {
      const inspection = inspect(root);
      expect(inspection.findings).toEqual([]);
      expect(inspection.outside).toBe(0);
      const { ok, message } = report(inspection);
      expect(ok).toBe(false);
      expect(message).toContain('No stylesheet outside the permitted set was read');
    });
  });

  it('passes the committed tree, reading all of it and allowing exactly one alpha', () => {
    const inspection = inspect(ROOT);
    expect(inspection.read).toBe(true);
    expect(inspection.findings, report(inspection).message).toEqual([]);
    expect(inspection.allowed, 'the contract carries exactly one alpha value').toBe(1);
    // Three contract stylesheets and the print stylesheet inside the set; the Hub's own outside it.
    expect(inspection.inside).toBe(4);
    expect(inspection.outside).toBeGreaterThanOrEqual(20);
    expect(report(inspection).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The command itself, both exits, and the two properties its source must keep.
// ---------------------------------------------------------------------------

describe('the command', () => {
  const run = (script: string) => spawned(spawnSync(process.execPath, [script], { cwd: tmpdir(), encoding: 'utf8' }));

  it('exits 0 on the committed tree and writes one line to stdout, from any working directory', () => {
    const result = run(GATE);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^literal conformance: read \d+ stylesheets, \d+ outside the permitted set and 4 inside it; no colour, spacing or type literal outside it, and 1 alpha, on --c-scrim in contracts\/tokens\.css \(FR-17, AD-21\)\.\n$/);
  });

  it('exits 1 on a tree carrying a literal, naming it on stderr, and 0 once it is gone', () => {
    withRepo({ 'components/Probe/Probe.scss': rule('color: #fff;') }, (root) => {
      const copy = join(root, 'ops', 'literal-conformance.mjs');
      mkdirSync(dirname(copy), { recursive: true });
      copyFileSync(GATE, copy);

      const refused = run(copy);
      expect(refused.status).toBe(1);
      expect(refused.stdout).toBe('');
      expect(refused.stderr).toContain('literal conformance: REFUSED');
      expect(refused.stderr).toContain('components/Probe/Probe.scss:2: color: #fff, a colour literal');

      writeFileSync(join(root, 'components', 'Probe', 'Probe.scss'), rule('color: var(--token-text);'), 'utf8');
      const passed = run(copy);
      expect(passed.status, passed.stderr).toBe(0);
      expect(passed.stdout).toContain('literal conformance: read 1 stylesheet, 1 outside the permitted set');
    });
  });

  const instructions = atCollection('could not read ops/literal-conformance.mjs:', () =>
    readFileSync(GATE, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n')
  );

  it('records the verdict before it writes, so a lost write callback cannot exit 0', () => {
    const verdict = instructions.indexOf('process.exitCode');
    const write = instructions.indexOf('stream.write');
    expect(verdict, 'the verdict is recorded nowhere').toBeGreaterThan(-1);
    expect(write, 'the message is written nowhere').toBeGreaterThan(-1);
    expect(verdict, 'the verdict is recorded after the write').toBeLessThan(write);
  });

  it('imports only node: builtins, so the job that installs nothing can run it', () => {
    const specifiers = [...instructions.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^node:/);
    expect(instructions).not.toMatch(/\bimport\s*\(/);
    expect(instructions).not.toContain('createRequire');
    expect(instructions).not.toMatch(/\brequire\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// The workflow's own wiring, read as the data it is.
// ---------------------------------------------------------------------------

describe('the CI wiring', () => {
  // Line endings normalised first: `.gitattributes` names no `.yml`, so the file arrives CRLF on a
  // Windows checkout and every anchored pattern below would miss there while passing on the runner.
  const workflow = atCollection(`${WORKFLOW} could not be read, and it is the file this block asserts.`, () =>
    readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n')
  );
  const marker = '\njobs:\n';
  const found = workflow.indexOf(marker);
  if (found === -1) throw new Error(`${HERE}: ${WORKFLOW} has no top-level "jobs:" key, so no job can be read out of it`);
  const jobsSection = workflow.slice(found + marker.length);
  const JOB_ID = /^ {2}([A-Za-z_][A-Za-z0-9_-]*):$/gm;
  const jobNames = [...jobsSection.matchAll(JOB_ID)].map((match) => match[1]);

  const blockFor = (name: string): string => {
    const lines = jobsSection.split('\n');
    const start = lines.indexOf(`  ${name}:`);
    if (start === -1) throw new Error(`${HERE}: no job named ${name} in ${WORKFLOW}`);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^ {2}[A-Za-z_]/.test(lines[index])) {
        end = index;
        break;
      }
    }
    return lines.slice(start, end).join('\n');
  };

  // The job's comments discuss `continue-on-error` and `if:` by name, so the assertions read its
  // instructions rather than its prose.
  const instructionsOf = (name: string): string =>
    blockFor(name)
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

  it(`carries a ${JOB} job`, () => {
    expect(jobNames, `the ${JOB} job is gone from ${WORKFLOW}, so FR-17 has no gate holding it`).toContain(JOB);
  });

  it('runs the gate this file tests, with no argument beside it', () => {
    const commands = [...instructionsOf(JOB).matchAll(/^\s*run: (.+)$/gm)].map((match) => match[1].trim());
    expect(commands, `the ${JOB} job runs something other than the gate, or more than one thing`).toEqual([
      'node ops/literal-conformance.mjs',
    ]);
    expect(existsSync(GATE), 'the job names a script that is not in the tree').toBe(true);
  });

  it('never downgrades the job to a warning and never makes it conditional (AD-21)', () => {
    const job = instructionsOf(JOB);
    expect(job, `AD-21: the ${JOB} job may never be soft-failed`).not.toMatch(/continue-on-error\s*:/);
    expect(job, `AD-21: the ${JOB} job may never swallow a non-zero exit`).not.toContain('|| true');
    expect(job, `AD-21: the ${JOB} job may never be skipped`).not.toMatch(/^\s+if\s*:/m);
    // `needs:` is a skip condition by another name: the gate would drop on every run where the job it
    // waits on is already red.
    expect(job, `AD-21: the ${JOB} job may never wait on another job`).not.toMatch(/^\s+needs\s*:/m);
  });

  it('runs where the record says it runs, on the Node the record says, within its ceiling', () => {
    const job = instructionsOf(JOB);
    expect(job, 'ops/literal-conformance.md tables ubuntu-latest').toMatch(/^\s+runs-on: ubuntu-latest$/m);
    expect(job, 'ops/literal-conformance.md tables Node 22').toMatch(/^\s+node-version: 22$/m);
    expect(job, 'a container: would change what the recorded run means').not.toMatch(/^\s+container\s*:/m);
    expect(job, 'ops/literal-conformance.md tables timeout-minutes: 5').toMatch(/^\s+timeout-minutes: 5$/m);
  });

  it('installs nothing, which is what makes it run when the install fails', () => {
    const job = instructionsOf(JOB);
    const actions = [...job.matchAll(/^\s*- uses: (.+)$/gm)].map((match) => match[1].trim());
    expect(actions, `the ${JOB} job gained or lost an action step`).toEqual(['actions/checkout@v7', 'actions/setup-node@v7']);
    expect(job, 'the job installs, so it no longer runs when the install fails').not.toContain('pnpm install');
    // From v5 `setup-node` caches off the `packageManager` field whenever it is present, and this job
    // has no pnpm for it to find.
    expect(job, 'setup-node will cache off packageManager unless this is here').toMatch(/^\s+package-manager-cache: false$/m);
  });

  it("declares no on: and no env: of its own, and the file declares no env: either", () => {
    expect(instructionsOf(JOB)).not.toMatch(/^\s+on\s*:/m);
    expect(instructionsOf(JOB), `the ${JOB} job gained an env: block`).not.toMatch(/^\s+env\s*:/m);
    expect(workflow, 'ci.yml gained a top-level env: block, which reaches every job in the file').not.toMatch(/^env\s*:/m);
    expect(workflow).toMatch(/^on:\n {2}push:\n {4}branches: \['\*\*'\]\n {2}pull_request:\n {4}branches: \[main\]$/m);
  });
});
