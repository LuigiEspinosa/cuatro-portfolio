import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/*
 * Story 8.6: the restyle floor's source-checkable half, over every stylesheet under `app/`
 * (RESTYLE-SPEC.md § The floor). The FR-17 gate (`ops/literal-conformance.mjs`) already refuses colour,
 * spacing and type literals here; these are the rules it does not read. The rendered half (targets,
 * rings, greyscale) is measured by hand and recorded in `ops/restyle-floor.md`.
 */
const APP = join(process.cwd(), 'app');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const SHEETS = walk(APP)
  .filter((path) => path.endsWith('.css'))
  .map((path) => ({ file: relative(APP, path).split('\\').join('/'), css: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

/** The declarations of every rule, with the selector they sit under. */
const declarations = (css: string): { selector: string; property: string; value: string }[] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector, body]) =>
    (body ?? '').split(';').flatMap((line) => {
      const at = line.indexOf(':');
      return at < 0 ? [] : [{ selector: (selector ?? '').trim(), property: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }];
    }),
  );
const ALL = SHEETS.flatMap(({ file, css }) => declarations(css).map((d) => ({ file, ...d })));

describe('the restyle floor, read off the source (Story 8.6)', () => {
  it('reads every stylesheet the viewer ships', () => {
    expect(SHEETS.map((s) => s.file)).toEqual(expect.arrayContaining(['globals.css', '(viewer)/feed.module.css', '(viewer)/ceremonia/reveal.module.css']));
    expect(ALL.length).toBeGreaterThan(300);
  });

  it('loads the token contract, tokens before fonts, and declares the hand-fix lines', () => {
    const globals = SHEETS.find((s) => s.file === 'globals.css')!.css;
    expect(globals.indexOf("@import '../../../contracts/tokens.css'")).toBeGreaterThanOrEqual(0);
    expect(globals.indexOf("@import '../../../contracts/tokens.css'")).toBeLessThan(globals.indexOf("@import '../../../contracts/fonts.css'"));
    expect(globals).toMatch(/:root\s*\{\s*color-scheme:\s*dark;/);
    expect(globals).toMatch(/::selection\s*\{\s*background-color:\s*var\(--token-accent\);\s*color:\s*var\(--token-bg\);/);
    expect(globals).toMatch(/:focus-visible\s*\{\s*outline:\s*var\(--stroke-focus\) solid var\(--token-focus\);/);
  });

  it('draws no shadow and no gradient (F-7)', () => {
    expect(ALL.filter((d) => d.property === 'box-shadow' && d.value !== 'none')).toEqual([]);
    expect(ALL.filter((d) => /gradient\(/.test(d.value))).toEqual([]);
  });

  it('never grounds anything in accent outside ::selection (F-8)', () => {
    const fills = ALL.filter((d) => /^(background(-color)?|fill)$/.test(d.property) && /var\(--token-accent\)/.test(d.value));
    expect(fills.map((d) => d.selector)).toEqual(['::selection']);
  });

  it('keeps every corner square, the ring radius and the round wheel graphic apart (F-5, I-12)', () => {
    const radii = ALL.filter((d) => d.property === 'border-radius' && d.value !== 'var(--r-none)');
    const allowed = radii.filter(
      (d) => (d.selector === ':focus-visible' && d.value === 'var(--r-hair)') || (d.file === '(viewer)/ceremonia/reveal.module.css' && d.value === '50%'),
    );
    expect(radii).toEqual(allowed);
    expect(allowed.filter((d) => d.value === '50%').map((d) => d.selector).sort()).toEqual(['.hub', '.ringBlue', '.ringGold', '.sweep', '.wheel']);
  });

  it('expresses no state with opacity: only the reveal choreography animates it (§ 5 rule 4)', () => {
    const fades = ALL.filter((d) => d.property === 'opacity');
    expect(fades.every((d) => d.file === '(viewer)/ceremonia/reveal.module.css' && /^(\.sweep|from|to|0%|85%|100%)$/.test(d.selector))).toBe(true);
  });

  it('never transitions the ring, and transitions nothing but a border colour', () => {
    const transitions = ALL.filter((d) => d.property.startsWith('transition'));
    expect(transitions.map((d) => d.value).every((v) => /^border-color var\(--dur-micro\) var\(--ease-toggle\)$/.test(v))).toBe(true);
  });

  it('keeps one width breakpoint, 760px (§ 2, I-8)', () => {
    const widths = SHEETS.flatMap(({ css }) => [...css.matchAll(/@media[^{]*\((?:min|max)-width:\s*([^)]+)\)/g)].map((m) => m[1]));
    expect(new Set(widths)).toEqual(new Set(['760px']));
  });
});
