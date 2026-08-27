// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMPONENT_IDS,
  CONTRACTS,
  CONTRACT_FILE_COUNT,
  DAISYUI_DEFAULT_PRIMARY,
  FAMILY_COUNT,
  FIXTURE_CONTROLS,
  FIXTURE_ELEMENTS,
  MAPPED_COLOUR_COUNT,
  MAPPED_SHAPE_COUNT,
  RETIRED_COUNT,
  RETIRED_LITERALS,
  ROLE_COUNT,
  SIZE_COUNT,
  UNCOVERED_COLOUR_COUNT,
  UNPAINTED,
  VERDICT,
  colourMapping,
  compareHashes,
  contrastRatio,
  declaredColourNames,
  emittedValues,
  fileList,
  fixtureDrift,
  fixtureHtml,
  fontUrls,
  hashTree,
  hubFixtureHtml,
  namesInNamespace,
  oklchLiterals,
  preflightCount,
  retiredLiterals,
  routeVerdict,
  selectionRule,
  shapeMapping,
  themeBlocks,
  themeDeclarations,
  unreadableRows,
  withoutComments,
} from '../cs-tracker-adoption-probe.mjs';

// `ops/cs-tracker-adoption-probe.mjs` is the rendered half of Story 1-19, and
// nothing in CI runs it: it needs a browser and a checkout of `cs-tracker`, and
// neither is on a runner. A probe demonstrates only that it could fail on the
// day it was run. These cases run under the blocking `test` job with no browser,
// no `cs-tracker` and no Tailwind binary, and they are what keep the probe able
// to fail after a later edit.
//
// The module's Playwright, `cs-tracker` and filesystem reads all sit inside the
// run function, so importing it pulls in none of them.

const HERE = 'ops/__tests__/cs-tracker-adoption-probe.test.ts';

const VIOLET = 'rgba(143, 126, 240, 1.000)';
const TEAL = 'rgba(0, 150, 137, 1.000)';

type Build = {
  compiled: boolean;
  values: { components: Record<string, string>; reference: string } | null;
};

/** A build as the verdict function sees one. */
const built = (
  components: Record<string, string> | null,
  reference: string,
  compiled = true
): Build => ({
  compiled,
  values: components === null ? null : { components, reference },
});

const both = (value: string): Record<string, string> =>
  Object.fromEntries(COMPONENT_IDS.map((id: string) => [id, value]));

/** `cs-tracker`'s real theme block, in the shape the probe parses. */
const THEME_BLOCK = `
  name: "dark";
  default: true;
  color-scheme: "dark";
  /* grounds */
  --color-base-100: var(--token-bg);
  --color-base-content: var(--token-text);
  --color-primary: var(--token-accent);
  /* the contract publishes no counterpart */
  --color-error: oklch(62% 0.2 25);
  --radius-field: calc(var(--r-none) * 1px);
  --border: var(--stroke-boundary);
`;

/** The nine relative paths the published contract is, at v1.0.0. */
const CONTRACT_PATHS = [
  'fonts.css',
  'fonts/OFL-bricolage-grotesque.txt',
  'fonts/OFL-geist-mono.txt',
  'fonts/OFL-geist.txt',
  'fonts/bricolage-grotesque-latin.woff2',
  'fonts/geist-latin.woff2',
  'fonts/geist-mono-latin.woff2',
  'tailwind.css',
  'tokens.css',
];

describe('the tree walk the comparison rests on', () => {
  // `compareHashes` cannot see a walk that stopped recursing: it would be handed
  // the three top-level stylesheets on both sides, find nothing wrong, pass the
  // `source.size > 0` guard, and report a verbatim copy having never looked at
  // the three woff2 faces or the three licence texts. So the walk itself is
  // pinned here, against the real published folder.
  it('fileList descends into fonts/ and reports every published path', () => {
    const found = fileList(CONTRACTS);

    expect(found).toEqual(CONTRACT_PATHS);
    expect(found).toHaveLength(CONTRACT_FILE_COUNT);
    expect(found.filter((path: string) => path.startsWith('fonts/'))).toHaveLength(6);
  });

  it('hashTree hashes every one of them, faces included', () => {
    const hashes = hashTree(CONTRACTS);

    expect([...hashes.keys()].sort()).toEqual(CONTRACT_PATHS);
    expect(hashes.size).toBe(CONTRACT_FILE_COUNT);
    for (const [path, hash] of hashes) {
      expect(hash, `${path} was not hashed`).toMatch(/^[0-9a-f]{64}$/);
    }
    // The two licence texts are the same file, and the woff2 faces are not. A
    // walk that read only the top level would have neither fact available.
    expect(hashes.get('fonts/OFL-geist.txt')).toBe(hashes.get('fonts/OFL-geist-mono.txt'));
    expect(hashes.get('fonts/geist-latin.woff2')).not.toBe(hashes.get('fonts/geist-mono-latin.woff2'));
  });

  it('fileList reads nothing out of a directory that is not there, rather than throwing', () => {
    expect(fileList(join(CONTRACTS, 'nowhere'))).toEqual([]);
    expect(hashTree(join(CONTRACTS, 'nowhere')).size).toBe(0);
  });
});

describe('the sha256 comparison', () => {
  const tree = (entries: Record<string, string>): Map<string, string> =>
    new Map(Object.entries(entries).map(([path, body]) => [path, createHash('sha256').update(body).digest('hex')]));

  it('calls two identical trees identical', () => {
    const source = tree({ 'tokens.css': ':root{}', 'fonts/geist.woff2': 'wOF2' });
    const vendored = tree({ 'tokens.css': ':root{}', 'fonts/geist.woff2': 'wOF2' });

    const result = compareHashes(source, vendored);

    expect(result.identical).toBe(true);
    expect(result.equal).toEqual(['fonts/geist.woff2', 'tokens.css']);
    expect(result.differing).toEqual([]);
  });

  it('reports a planted mismatch, naming the file and both hashes', () => {
    const source = tree({ 'tokens.css': ':root{}' });
    const vendored = tree({ 'tokens.css': ':root{ /* hand edited */ }' });

    const result = compareHashes(source, vendored);

    expect(result.identical).toBe(false);
    expect(result.differing).toHaveLength(1);
    expect(result.differing[0].path).toBe('tokens.css');
    expect(result.differing[0].source).not.toBe(result.differing[0].vendored);
    expect(result.differing[0].source).toMatch(/^[0-9a-f]{64}$/);
    expect(result.differing[0].vendored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a missing file and an extra one separately from a differing one', () => {
    const source = tree({ 'tokens.css': 'a', 'fonts.css': 'b' });
    const vendored = tree({ 'tokens.css': 'a', 'README.md': 'c' });

    const result = compareHashes(source, vendored);

    expect(result.identical).toBe(false);
    expect(result.missing).toEqual(['fonts.css']);
    expect(result.extra).toEqual(['README.md']);
    expect(result.differing).toEqual([]);
  });

  it('refuses to call an empty file list a verbatim copy', () => {
    // Two empty trees agree on everything and prove nothing. A comparison that
    // passed here would report a byte-identical copy of a folder that does not
    // exist, which is the vacuous pass the story forbids.
    expect(compareHashes(new Map(), new Map()).identical).toBe(false);
  });
});

describe('the declared-name parser', () => {
  it('reads every --color-* name a stylesheet declares', () => {
    const names = declaredColourNames(':root{--color-primary:red;--color-base-100:blue}');

    expect([...names].sort()).toEqual(['--color-base-100', '--color-primary']);
  });

  it('reads nothing out of a stylesheet that declares none, and out of a non-string', () => {
    expect(declaredColourNames(':root{color:red}').size).toBe(0);
    expect(declaredColourNames(undefined as unknown as string).size).toBe(0);
  });

  it('reads the contract namespaces off the real tokens.css, at the pinned counts', () => {
    const tokens = readFileSync(join(CONTRACTS, 'tokens.css'), 'utf8');

    expect(namesInNamespace(tokens, '--token-')).toHaveLength(ROLE_COUNT);
    expect(namesInNamespace(tokens, '--f-')).toHaveLength(FAMILY_COUNT);
    expect(namesInNamespace(tokens, '--t-')).toHaveLength(SIZE_COUNT);
    expect(namesInNamespace(tokens, '--token-')).toContain('--token-accent');
  });

  it('does not let a neighbouring namespace leak in', () => {
    // `--tap`, `--tr-body` and `--token-bg` all begin with `--t`. A prefix match
    // that forgot the trailing hyphen would silently grow the size list.
    const tokens = readFileSync(join(CONTRACTS, 'tokens.css'), 'utf8');
    const sizes = namesInNamespace(tokens, '--t-');

    expect(sizes.every((name: string) => name.startsWith('--t-'))).toBe(true);
    expect(sizes).not.toContain('--tap');
    expect(sizes).not.toContain('--token-bg');
    expect(namesInNamespace(tokens, '--f-')).not.toContain('--focus-offset');
  });

  it('counts Preflights and reads emitted values without a longer name leaking in', () => {
    expect(preflightCount('a{-webkit-tap-highlight-color:x}b{-webkit-tap-highlight-color:y}')).toBe(2);
    expect(preflightCount('a{}')).toBe(0);

    expect(emittedValues(':root{--color-primary:red;--color-primary-content:blue}', '--color-primary')).toEqual([
      'red',
    ]);
    expect(emittedValues('', '--color-primary')).toEqual([]);
  });

  it('finds the ::selection rule and its declared value, or reports none', () => {
    expect(selectionRule('::selection{background-color:var(--token-accent);color:var(--token-bg)}')).toBe(
      'background-color:var(--token-accent);color:var(--token-bg)'
    );
    expect(selectionRule('body{}')).toBeNull();
    // A commented-out rule is not a rule.
    expect(selectionRule('/* ::selection{background-color:red} */')).toBeNull();
  });

  it('reads the font urls and skips the data URIs daisyUI ships', () => {
    const css = '@font-face{src:url("./fonts/geist.woff2")}.x{background:url("data:image/svg+xml,%3csvg%3e")}';

    expect(fontUrls(css)).toEqual(['./fonts/geist.woff2']);
    expect(fontUrls('')).toEqual([]);
  });
});

describe('the mapping extractor', () => {
  it('finds one theme block, and two when a second is planted', () => {
    const css = `@plugin "../vendor/daisyui-theme" {${THEME_BLOCK}}`;

    expect(themeBlocks(css)).toHaveLength(1);
    expect(themeBlocks(`${css}\n@plugin "../vendor/daisyui-theme" { name: "light"; }`)).toHaveLength(2);
    expect(themeBlocks('')).toHaveLength(0);
  });

  it('reads past a closing brace inside a comment', () => {
    // A `[^}]*` body match ends at the `}` in the comment and returns a block
    // carrying neither declaration, which every assertion downstream then reads
    // as a block that never declared them. A silent partial read, not a failure.
    const planted = [
      '@plugin "../vendor/daisyui-theme" {',
      '  name: "dark";',
      '  /* a closing brace } inside a comment, which is legal CSS */',
      '  --color-primary: var(--token-accent);',
      '  --noise: 0;',
      '}',
    ].join('\n');

    const [body] = themeBlocks(planted);

    expect(body).toContain('--noise');
    expect(colourMapping(body).mapped).toEqual([{ name: '--color-primary', role: '--token-accent' }]);

    // And the matcher it replaces, shown getting it wrong on the same input.
    const naive = /@plugin\s+"[^"]+"\s*\{([^}]*)\}/.exec(planted);
    expect(naive).not.toBeNull();
    expect(naive?.[1]).not.toContain('--noise');
  });

  it('does not run away when a block is never closed', () => {
    expect(themeBlocks('@plugin "../vendor/daisyui-theme" { name: "dark";')).toEqual([]);
    expect(themeBlocks('@plugin "../vendor/daisyui-theme"')).toEqual([]);
  });

  it('splits the family into the names that read a role and the names that kept a literal', () => {
    const { mapped, literal } = colourMapping(THEME_BLOCK);

    expect(mapped).toEqual([
      { name: '--color-base-100', role: '--token-bg' },
      { name: '--color-base-content', role: '--token-text' },
      { name: '--color-primary', role: '--token-accent' },
    ]);
    expect(literal).toEqual([{ name: '--color-error', value: 'oklch(62% 0.2 25)' }]);
  });

  it('reports a mapping that was quietly turned back into a literal', () => {
    const planted = THEME_BLOCK.replace('--color-primary: var(--token-accent);', '--color-primary: oklch(72% 0.2 50);');
    const { mapped, literal } = colourMapping(planted);

    expect(mapped.map((entry: { name: string }) => entry.name)).not.toContain('--color-primary');
    expect(literal.map((entry: { name: string }) => entry.name)).toContain('--color-primary');
  });

  it('refuses a self-reference dressed as a mapping', () => {
    // AD-14: the same name must never appear on both sides of a `var()`. Only
    // the `--token-*` namespace counts as a role, so `--color-primary:
    // var(--color-primary)` lands in the literal list and fails the count.
    const { mapped, literal } = colourMapping('--color-primary: var(--color-primary);');

    expect(mapped).toEqual([]);
    expect(literal).toEqual([{ name: '--color-primary', value: 'var(--color-primary)' }]);
  });

  it('never reads a commented-out declaration as a live one', () => {
    const parsed = themeDeclarations('/* --color-primary: var(--token-accent); */ --border: var(--stroke-boundary);');

    expect(parsed).toEqual([{ name: '--border', value: 'var(--stroke-boundary)' }]);
    expect(withoutComments('/* x */a')).toBe('a');
  });

  it('reads the non-colour rows the story maps as well', () => {
    const declared = new Map(
      themeDeclarations(THEME_BLOCK).map((entry: { name: string; value: string }) => [entry.name, entry.value])
    );

    expect(declared.get('--radius-field')).toBe('calc(var(--r-none) * 1px)');
    expect(declared.get('--border')).toBe('var(--stroke-boundary)');
  });

  it('shapeMapping pairs each radius and the border with the role it reads', () => {
    const shapes = shapeMapping(THEME_BLOCK);

    expect(shapes).toEqual([
      {
        name: '--radius-field',
        role: '--r-none',
        property: 'border-radius',
        read: 'borderTopLeftRadius',
      },
      { name: '--border', role: '--stroke-boundary', property: 'border-width', read: 'borderTopWidth' },
    ]);

    // A radius turned back into a literal drops out of the list, so the pinned
    // count in the probe fails rather than the loop simply getting shorter.
    expect(shapeMapping('--radius-field: 0.375rem;')).toEqual([]);
    expect(shapeMapping('')).toEqual([]);
    expect(MAPPED_SHAPE_COUNT).toBe(4);
  });

  it('pins the two colour counts so a deletion cannot pass', () => {
    expect(MAPPED_COLOUR_COUNT).toBe(12);
    expect(UNCOVERED_COLOUR_COUNT).toBe(8);
  });
});

describe('the retired palette', () => {
  it('derives the retired set as baseline minus current', () => {
    const baseline = '.a{color:oklch(72% 0.2 50);background:oklch(62% 0.2 25)}';
    const current = '.a{background:oklch(62% 0.2 25)}';

    expect(oklchLiterals(baseline)).toEqual(['oklch(62% 0.2 25)', 'oklch(72% 0.2 50)']);
    expect(retiredLiterals(baseline, current)).toEqual(['oklch(72% 0.2 50)']);
  });

  it('reports a literal that was only half retired', () => {
    // The failure mode a hand-written list hides: one block cleaned, the other
    // left. The derivation shortens, and the probe's pinned count catches it.
    const baseline = 'a{color:oklch(1% 0 0)}b{color:oklch(2% 0 0)}';

    expect(retiredLiterals(baseline, 'b{color:oklch(2% 0 0)}')).toEqual(['oklch(1% 0 0)']);
    expect(retiredLiterals(baseline, '')).toHaveLength(2);
    expect(retiredLiterals(baseline, baseline)).toEqual([]);
  });

  it('pins the list the Elixir suite carries, which cannot derive it', () => {
    // `cs-tracker`'s own suite runs with no access to this repository's git
    // history, so it transcribes. The probe derives from git and compares
    // against this list, which is what keeps the transcription honest.
    expect(RETIRED_LITERALS).toHaveLength(RETIRED_COUNT);
    expect(new Set(RETIRED_LITERALS).size).toBe(RETIRED_COUNT);
    expect(RETIRED_LITERALS).toEqual([...RETIRED_LITERALS].sort());
    expect(RETIRED_LITERALS).toContain('oklch(72% 0.2 50)');
    // The four uncovered status pairs kept their values and must NOT be here.
    expect(RETIRED_LITERALS).not.toContain('oklch(62% 0.2 25)');
    expect(RETIRED_LITERALS).not.toContain('oklch(60% 0.118 184.704)');
  });
});

describe('the contrast calculator', () => {
  it('computes the ratios the record quotes', () => {
    // Black on white is the ratio every implementation agrees on, so it is what
    // calibrates this one.
    expect(contrastRatio('rgba(0, 0, 0, 1.000)', 'rgba(255, 255, 255, 1.000)')).toBeCloseTo(21, 5);
    expect(contrastRatio('rgba(255, 255, 255, 1.000)', 'rgba(255, 255, 255, 1.000)')).toBeCloseTo(1, 5);

    // The two pairs the record names, to two decimals.
    expect(contrastRatio('rgba(6, 5, 9, 1.000)', 'rgba(238, 238, 242, 1.000)')).toBeCloseTo(17.56, 2);
    expect(contrastRatio('rgba(143, 126, 240, 1.000)', 'rgba(6, 5, 9, 1.000)')).toBeCloseTo(6.2, 2);
  });

  it('is symmetric, and reports nothing rather than a number it could not read', () => {
    const a = 'rgba(6, 5, 9, 1.000)';
    const b = 'rgba(238, 238, 242, 1.000)';

    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
    expect(contrastRatio('', b)).toBeNull();
    expect(contrastRatio(undefined as unknown as string, b)).toBeNull();
    expect(contrastRatio('not a colour', b)).toBeNull();
  });
});

describe('the FR-18 readability guard', () => {
  const row = (over: Record<string, string>) => ({
    name: '--t-lg',
    hub: '25px',
    tracker: '25px',
    hubDeclared: '1.5625rem',
    trackerDeclared: '1.5625rem',
    ...over,
  });

  it('passes a row both sides declare and both sides painted', () => {
    expect(unreadableRows([row({})])).toEqual([]);
  });

  it('catches a name neither side declares, which would compare equal by default', () => {
    // The trap: an undeclared --t-* makes both probes inherit the same document
    // default, so the row reads as agreement between two values nobody
    // published. Both computed values are non-empty and identical here.
    const undeclared = row({ hub: '16px', tracker: '16px', hubDeclared: '', trackerDeclared: '' });

    expect(unreadableRows([undeclared])).toHaveLength(1);
    expect(unreadableRows([row({ hubDeclared: '' })])).toHaveLength(1);
    expect(unreadableRows([row({ trackerDeclared: '' })])).toHaveLength(1);
  });

  it('catches an unread or unpainted computed value on either side', () => {
    expect(unreadableRows([row({ hub: '' })])).toHaveLength(1);
    expect(unreadableRows([row({ tracker: '' })])).toHaveLength(1);
    expect(unreadableRows([row({ hub: UNPAINTED })])).toHaveLength(1);
    expect(unreadableRows([row({ tracker: UNPAINTED })])).toHaveLength(1);
  });

  it('reads nothing out of a non-array rather than throwing', () => {
    expect(unreadableRows(undefined as unknown as [])).toEqual([]);
  });
});

describe('the fixture builder', () => {
  const html = fixtureHtml({
    stylesheet: 'app.css',
    roles: ['--token-accent', '--token-bg'],
    themeColours: ['--color-primary'],
    shapes: shapeMapping(THEME_BLOCK),
  });

  it('links the compiled stylesheet and wears the theme the application pins', () => {
    expect(html).toContain('<link rel="stylesheet" href="./app.css">');
    expect(html).toContain('data-theme="dark"');
  });

  it('carries every component the probe reads, each addressable by its own id', () => {
    for (const element of FIXTURE_ELEMENTS) {
      expect(html).toContain(`data-probe="${element.id}"`);
      expect(html).toContain(`class="${element.classes}"`);
    }
    for (const control of FIXTURE_CONTROLS) {
      expect(html).toContain(`data-probe="${control.id}"`);
    }
    for (const id of COMPONENT_IDS) {
      expect(html).toContain(`data-probe="${id}"`);
    }
  });

  it('declares every reference probe inline, so no comparison rests on a string written here', () => {
    expect(html).toContain('<span data-role="--token-accent" style="background-color: var(--token-accent)">');
    expect(html).toContain('<span data-theme-colour="--color-primary" style="background-color: var(--color-primary)">');
  });

  it('carries a shape probe beside the role probe for every shape row', () => {
    // The record marks the radii and the border Observed, so something has to
    // observe them: the four form controls cannot, because the S-3 hand-fix
    // squares those whether the theme maps a radius or not.
    expect(html).toContain('data-shape="--radius-field" style="border-style: solid; border-radius: var(--radius-field)"');
    expect(html).toContain('data-shape-role="--radius-field" style="border-style: solid; border-radius: var(--r-none)"');
    expect(html).toContain('data-shape="--border" style="border-style: solid; border-width: var(--border)"');
    expect(html).toContain('data-shape-role="--border" style="border-style: solid; border-width: var(--stroke-boundary)"');
  });

  it('carries a focusable anchor before the button, so Tab has somewhere to start', () => {
    expect(html.indexOf('id="focus-anchor"')).toBeLessThan(html.indexOf('data-probe="btn"'));
  });

  it('builds the Hub fixture with the same probes and no application markup', () => {
    const hub = hubFixtureHtml({
      stylesheet: 'hub.css',
      roles: ['--token-accent'],
      families: ['--f-body'],
      sizes: ['--t-lg'],
    });

    expect(hub).toContain('<link rel="stylesheet" href="./hub.css">');
    expect(hub).toContain('data-role="--token-accent"');
    expect(hub).toContain('data-family="--f-body"');
    expect(hub).toContain('data-size="--t-lg"');
    expect(hub).not.toContain('class="btn btn-primary"');
  });

  it('reports a class string that no longer exists in the file it was read out of', () => {
    // The fixture is the application's markup only while every class in it is
    // still in the file it came from. This is the matcher that says so, shown
    // firing: a source that carries nothing fails every element.
    expect(fixtureDrift(() => '')).not.toHaveLength(0);

    // And a source carrying every token passes, so the matcher is not simply
    // always failing.
    const everything = [...FIXTURE_ELEMENTS, ...FIXTURE_CONTROLS]
      .map((element: { classes: string }) => element.classes)
      .join(' ');
    expect(fixtureDrift(() => ` ${everything} `)).toEqual([]);

    // A token that is only a prefix of a longer class does not satisfy it:
    // `btn-primary` in the source must not stand in for `btn`.
    const noBareBtn = everything
      .split(/\s+/)
      .filter((token: string) => token !== 'btn')
      .join(' ');
    expect(noBareBtn).toContain('btn-primary');
    const drift = fixtureDrift(() => ` ${noBareBtn} `);
    expect(drift.some((entry: { token: string }) => entry.token === 'btn')).toBe(true);
  });
});

describe('the verdict function', () => {
  it('calls a resolved mapping live', () => {
    const verdict = routeVerdict(built(both(VIOLET), VIOLET), TEAL);

    expect(verdict).toEqual({ verdict: VERDICT.live, live: true, pass: true });
  });

  it('fails a dead mapping rather than reporting it as anything else', () => {
    const verdict = routeVerdict(built(both(TEAL), VIOLET), TEAL);

    expect(verdict.verdict).toBe(VERDICT.dead);
    expect(verdict.live).toBe(false);
    expect(verdict.pass).toBe(false);
  });

  it('reports an uncompiled build as "does not compile", not as dead', () => {
    const verdict = routeVerdict(built(null, VIOLET, false), TEAL);

    expect(verdict.verdict).toBe(VERDICT.noCompile);
    expect(verdict.pass).toBe(false);
    expect(routeVerdict(null as unknown as Build, TEAL).verdict).toBe(VERDICT.noCompile);
  });

  it('reports a missing reference as "no reference", not as dead', () => {
    expect(routeVerdict(built(both(VIOLET), ''), TEAL).verdict).toBe(VERDICT.noReference);
    expect(routeVerdict(built(both(VIOLET), UNPAINTED), TEAL).verdict).toBe(VERDICT.noReference);
  });

  it('reports two components that disagree as a split, not as dead', () => {
    const verdict = routeVerdict(built({ btn: VIOLET, badge: TEAL }, VIOLET), TEAL);

    expect(verdict.verdict).toBe(VERDICT.split);
    expect(verdict.pass).toBe(false);
  });

  it('reports a build that compiled but was never read as "no value observed"', () => {
    expect(routeVerdict(built(null, VIOLET), TEAL).verdict).toBe(VERDICT.notObserved);
    expect(routeVerdict(built({ btn: VIOLET, badge: '' }, VIOLET), TEAL).verdict).toBe(VERDICT.notObserved);
    // With no ids, `every` is vacuously true and the comparison would report
    // LIVE from measurements nobody took.
    expect(routeVerdict(built(both(VIOLET), VIOLET), TEAL, []).verdict).toBe(VERDICT.notObserved);
  });

  it('refuses a reference that already equals daisyUI\'s own default', () => {
    // Then "equal to the token" and "different from daisyUI" cannot both be
    // measured, so nothing about the mapping was established.
    const verdict = routeVerdict(built(both(TEAL), TEAL), TEAL);

    expect(verdict.verdict).toBe(VERDICT.vacuous);
    expect(verdict.pass).toBe(false);
  });

  it('pins daisyUI 5.0.35\'s own default primary, which the components must differ from', () => {
    expect(DAISYUI_DEFAULT_PRIMARY).toBe('oklch(0.45 0.24 277.023)');
    expect(COMPONENT_IDS).toEqual(['btn', 'badge']);
  });
});

describe(`${HERE} covers the module it imports`, () => {
  it('imports only pure parts, so no browser, Elixir or cs-tracker checkout is needed', () => {
    // The import at the top of this file is the assertion: if the module read
    // `cs-tracker` or loaded Playwright at import time, this suite could not run
    // under the blocking `test` job at all.
    expect(typeof routeVerdict).toBe('function');
    expect(typeof compareHashes).toBe('function');
    expect(typeof fixtureHtml).toBe('function');
    expect(typeof colourMapping).toBe('function');
  });
});
