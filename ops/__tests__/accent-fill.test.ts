// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, compileString } from 'sass';
import { mask } from '../literal-conformance.mjs';

/**
 * RESTYLE-SPEC F-8's binary half: no accent role is a fill (Operator ruling 2026-09-24, the ledger
 * entry on the `Live` dot, with DW-95's `::selection` beside it).
 *
 * `RESTYLE-SPEC.md` § The floor states F-8 as a grep for the accent used as a `background`,
 * `background-color` or `fill`, at any state, expecting none, and F-11 names `::selection` as the one
 * permitted accent fill. The ruling widens the role to all three accent roles, exempts the status
 * dot and `::selection` **by selector, never by role**, and puts the check in the `test` job, so no
 * job name in `.github/workflows/ci.yml` moves. An exemption naming the role would readmit accent
 * fills everywhere, which is why each one here is a file and an exact selector.
 *
 * **Every stylesheet git tracks, compiled.** A `.scss` file is read as Sass writes it, so a fill
 * reached through nesting, a mixin that builds its selector (`HomeLayout.scss` does) or a Sass
 * variable is read under the selector that ships; a `.css` file is read as written. Comments and
 * strings are masked first, with the literal gate's own `mask`, so a rule quoted in a comment is
 * never read as the rule. The listing is git's, as `ops/literal-conformance.mjs` lists it, so build
 * output never counts.
 *
 * **Stated limit.** The check reads roles, as the ruling names them. A palette name written
 * straight into a component (`--c-accent`) is not a role and is not read here; the anchor contract
 * partition in `app/__tests__/anchor-contract.test.ts` is what says who may name the palette at all.
 */

const ROOT = process.cwd();

/** The three accent roles the ruling names. */
const ACCENT_ROLES = ['--token-accent', '--token-accent-hover', '--token-accent-muted'] as const;

/** The properties F-8 calls a fill. */
const FILL_PROPERTIES = ['background', 'background-color', 'fill'] as const;

/** An accent role inside a `var()`, the name ending where the reference does, built from the list. */
const ACCENT_REFERENCE = new RegExp(`var\\(\\s*(${ACCENT_ROLES.join('|')})\\s*[,)]`, 'g');

/**
 * The two fills the system means, each a file and an exact compiled selector. Nothing else is
 * exempt, and each has to be found exactly once, so an exemption outliving its fill fails too.
 */
const EXEMPTIONS = [
  {
    path: 'components/organisms/SuiteDirectory/SuiteDirectory.scss',
    selector: '.suite-directory__dot',
    reason:
      'DESIGN.md § Colors: the Live mark is a 4px filled square, the element that carries Live apart ' +
      'from Complete in greyscale, where the two borders sit 1.13:1 apart.',
  },
  {
    path: 'app/app.scss',
    selector: '::selection',
    reason: 'RESTYLE-SPEC F-11: an accent selection ground is the one permitted accent fill, and F-8 excludes it by name.',
  },
] as const;

interface Fill {
  readonly path: string;
  readonly selector: string;
  readonly property: string;
  readonly role: string;
}

/**
 * Every declaration in a stylesheet with the selector of the style rule it sits in, at-rules walked
 * through. Structure is read off the masked text and content off the original, whose offsets match.
 */
const declarations = (css: string): { selector: string; property: string; value: string }[] => {
  const masked = mask(css);
  const found: { selector: string; property: string; value: string }[] = [];
  const preludes: string[] = [];
  let start = 0;
  for (let at = 0; at < masked.length; at += 1) {
    const char = masked[at];
    if (char !== '{' && char !== '}' && char !== ';') continue;
    const text = css.slice(start, at).trim();
    start = at + 1;
    if (char === '{') {
      preludes.push(text.replace(/\s+/g, ' '));
      continue;
    }
    const colon = text.indexOf(':');
    const selector = [...preludes].reverse().find((prelude) => !prelude.startsWith('@'));
    if (colon > 0 && !text.startsWith('@') && selector !== undefined) {
      found.push({ selector, property: text.slice(0, colon).trim().toLowerCase(), value: text.slice(colon + 1) });
    }
    if (char === '}') preludes.pop();
  }
  return found;
};

/** Every accent role a stylesheet sets as a fill. */
const fillsIn = (path: string, css: string): Fill[] =>
  declarations(css).flatMap(({ selector, property, value }) =>
    (FILL_PROPERTIES as readonly string[]).includes(property)
      ? [...value.matchAll(ACCENT_REFERENCE)].map((match) => ({ path, selector, property, role: match[1] }))
      : []
  );

const exemptionFor = (fill: Fill) =>
  EXEMPTIONS.find((exemption) => exemption.path === fill.path && exemption.selector === fill.selector);

/** The fills no exemption covers, and how many fills each exemption covered. */
const verdict = (fills: readonly Fill[]) => ({
  refused: fills
    .filter((fill) => exemptionFor(fill) === undefined)
    .map((fill) => `${fill.path}: "${fill.selector}" sets ${fill.property} to ${fill.role}`),
  used: EXEMPTIONS.map((exemption) => fills.filter((fill) => exemptionFor(fill) === exemption).length),
});

/**
 * Every stylesheet git tracks or would track, the way the literal gate lists the tree. A path the
 * index lists and the working tree no longer has is a deletion not yet staged, which no build reads,
 * so it is left out as `ops/literal-conformance.mjs` leaves it out.
 */
const tracked = (): string[] => {
  const run = spawnSync(
    'git',
    ['-c', 'core.quotePath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.css', '*.scss', '*.sass'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`git ls-files exited ${run.status}: ${run.stderr}`);
  return [...new Set(run.stdout.split('\0').filter((path) => path !== ''))]
    .filter((path) => existsSync(resolve(ROOT, path)))
    .sort();
};

/** A stylesheet as it ships: Sass compiled, CSS as written. */
const shipped = (path: string): string =>
  path.endsWith('.css') ? readFileSync(resolve(ROOT, path), 'utf8') : compile(resolve(ROOT, path), { style: 'compressed' }).css;

describe('no accent role is a fill, but the Live dot and the selection (RESTYLE-SPEC F-8)', () => {
  const paths = tracked();
  const fills = paths.flatMap((path) => fillsIn(path, shipped(path)));

  it('reads every tracked stylesheet, the two that carry an exemption and the contract among them', () => {
    expect(paths.length, 'git listed too few stylesheets, so the check below is over a fragment').toBeGreaterThan(20);
    for (const path of [...EXEMPTIONS.map((exemption) => exemption.path), 'contracts/tokens.css']) {
      expect(paths, `${path} was not listed`).toContain(path);
    }
    for (const path of paths) expect(shipped(path).length, `${path} compiled to nothing`).toBeGreaterThan(0);
  });

  it('finds no accent fill outside the two exempt selectors', () => {
    const { refused } = verdict(fills);
    expect(refused, `an accent role is a fill, which RESTYLE-SPEC F-8 refuses:\n${refused.join('\n')}`).toEqual([]);
  });

  it('finds each exempt fill exactly once, so no exemption outlives its fill', () => {
    expect(verdict(fills).used, EXEMPTIONS.map((exemption) => `${exemption.path} ${exemption.selector}`).join(', ')).toEqual([1, 1]);
  });

  it('refuses a planted fill in every shape a stylesheet can hide one, and passes what is not a fill', () => {
    const planted = compileString(
      [
        '$accent: var(--token-accent);',
        '@mixin filled($selector) { #{$selector} { background-color: var(--token-accent-hover); } }',
        '.planted-plain { background: var(--token-accent); }',
        '.planted-state { &:hover { background-color: var(--token-accent-hover); } }',
        '.planted-svg { fill: var(--token-accent-muted); }',
        '.planted-variable { background: $accent; }',
        "@include filled('.planted-mixin');",
        '.suite-directory__dot { background: var(--token-accent); }',
        '::selection { background: var(--token-accent); }',
        '.suite-directory__dot, .planted-list { background: var(--token-accent); }',
        '@media (hover: hover) { .planted-media:hover { background: var(--token-accent); } }',
        '@keyframes planted-flash { from { background-color: var(--token-accent); } }',
        '.planted-fallback { background: var(--planted, var(--token-accent)); }',
        '// .planted-comment { background: var(--token-accent); }',
        '.planted-text { color: var(--token-accent); }',
        '.planted-rule { border-block-end: 2px solid var(--token-accent); }',
        '.planted-ground { background: var(--token-bg); }',
        '.planted-property { --planted: var(--token-accent); }',
        '.planted-near { background: var(--token-accent-hovered); }',
        '.planted-quoted::before { content: "{ background: var(--token-accent); }"; }',
      ].join('\n'),
      { style: 'compressed' }
    ).css;
    const path = 'components/planted/Planted.scss';
    expect(verdict(fillsIn(path, planted))).toEqual({
      refused: [
        `${path}: ".planted-plain" sets background to --token-accent`,
        `${path}: ".planted-state:hover" sets background-color to --token-accent-hover`,
        `${path}: ".planted-svg" sets fill to --token-accent-muted`,
        `${path}: ".planted-variable" sets background to --token-accent`,
        `${path}: ".planted-mixin" sets background-color to --token-accent-hover`,
        `${path}: ".suite-directory__dot" sets background to --token-accent`,
        `${path}: "::selection" sets background to --token-accent`,
        `${path}: ".suite-directory__dot,.planted-list" sets background to --token-accent`,
        `${path}: ".planted-media:hover" sets background to --token-accent`,
        `${path}: "from" sets background-color to --token-accent`,
        `${path}: ".planted-fallback" sets background to --token-accent`,
      ],
      used: [0, 0],
    });

    // And the two exemptions hold in their own files and nowhere else, one fill each.
    const dot = fillsIn(EXEMPTIONS[0].path, compileString('.suite-directory__dot { background: var(--token-accent); }').css);
    const selection = fillsIn(EXEMPTIONS[1].path, compileString('::selection { background: var(--token-accent); }').css);
    expect(verdict([...dot, ...selection])).toEqual({ refused: [], used: [1, 1] });
  });
});
