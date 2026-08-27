// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ACTIVE_MARKER,
  CLAIM_GRACE_MS,
  COMPONENT_IDS,
  COMPOSITION,
  CONTRACTS,
  SCRATCH_PREFIX,
  VARIANTS,
  VERDICT,
  appCss,
  declaredColourNames,
  emittedValues,
  fixtureHtml,
  preflightCount,
  routeVerdict,
  sweepLeftovers,
} from '../daisyui-route-probe.mjs';

// `ops/daisyui-route-probe.mjs` produces a record that tells the Operator that
// re-running it is the whole check on a Tailwind or daisyUI bump. A probe
// demonstrates only that it could fail on the day it was run; these cases are
// what keep it able to fail after a later edit, which is the argument
// `ops/__tests__/contract-purity.test.ts:20-24` makes for every other
// `ops/*.mjs` in this repository.
//
// Everything here runs with no Elixir, no network and no browser. The module's
// Playwright and `mix` reads all sit inside the run function, so importing it
// pulls in neither.

const HERE = 'ops/__tests__/daisyui-route-probe.test.ts';

type Build = { compiled: boolean; values: { components: Record<string, string> } | null };

/** A build as the verdict function sees one. */
const built = (components: Record<string, string> | null, compiled = true): Build => ({
  compiled,
  values: components === null ? null : { components },
});

const VIOLET = 'oklch(0.66 0.165 288)';
const INDIGO = 'oklch(0.45 0.24 277.023)';
const GREEN = 'oklch(0.5 0.2 140)';

const both = (value: string): Record<string, string> =>
  Object.fromEntries(COMPONENT_IDS.map((id: string) => [id, value]));

const variant = (name: string) => {
  const found = [...VARIANTS, COMPOSITION].find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`${HERE}: the probe declares no variant named ${name}`);
  return found;
};

/** Backdate a directory past the claim grace, so the sweep stops treating it as mid claim. */
const aged = (target: string): void => {
  const when = new Date(Date.now() - CLAIM_GRACE_MS * 4);
  utimesSync(target, when, when);
};

/** A process id nothing is running under, so `ownerAlive` has a real negative to answer. */
const deadPid = (): number => {
  // A process this one started and watched exit, rather than a number picked out
  // of the air: on a busy host a guessed id can be live, and a case that landed
  // on a running process would assert the opposite of what it means to.
  const finished = spawnSync(process.execPath, ['-e', '0']);
  if (typeof finished.pid !== 'number') throw new Error(`${HERE}: could not start a process to take an id from`);
  return finished.pid;
};

describe('appCss', () => {
  it('declares the intended number of --color-primary lines per variant', () => {
    // `css-var` carries two on purpose: a decoy inside the plugin block for the
    // unlayered rule to beat, and the reference in the rule itself. Every other
    // variant carries one or none.
    const expected: Record<string, number> = { unmapped: 0, literal: 1, 'plugin-var': 1, 'css-var': 2 };
    for (const candidate of VARIANTS) {
      const declarations = appCss(candidate).match(/^\s*--color-primary:/gm) ?? [];
      expect(declarations.length, `${candidate.name} declares ${declarations.length} --color-primary lines`).toBe(
        expected[candidate.name]
      );
    }
  });

  it('the four variants are byte-identical once --color-primary is taken out', () => {
    // The whole experiment rests on this. If anything else moved between the
    // builds, a difference in the rendered output would not be attributable to
    // the one line under test.
    const strip = (candidate: (typeof VARIANTS)[number]): string => {
      const css = candidate.trailing === null ? appCss(candidate) : appCss(candidate).replace(`${candidate.trailing}\n`, '');
      return css
        .split('\n')
        .filter((line) => !line.includes('--color-primary:'))
        .join('\n');
    };
    const first = strip(VARIANTS[0]);
    for (const candidate of VARIANTS.slice(1)) {
      expect(strip(candidate), `${candidate.name} differs from ${VARIANTS[0].name} somewhere other than --color-primary`)
        .toBe(first.replace(`fixture/${VARIANTS[0].name}.html`, `fixture/${candidate.name}.html`));
    }
  });

  it('the unmapped control declares no --color-primary at all', () => {
    expect(appCss(variant('unmapped'))).not.toContain('--color-primary:');
  });

  it('the literal reference declares the value --token-accent resolves to', () => {
    const css = appCss(variant('literal'));
    expect(css).toContain('--color-primary: oklch(66% 0.165 288);');
    expect(css).not.toContain('var(--token-accent)');
  });

  it('the literal reference is the value contracts/tokens.css actually publishes', () => {
    // The one hand-copied value in the probe. Its runtime guard lives inside
    // `buildApplication`, which needs Elixir, a hex fetch and a browser to
    // reach, so nothing in the blocking `test` job held it: a contract MINOR
    // that moved `--c-accent` would leave this suite green while every real run
    // refused to compile. This is that guard, with none of those three.
    const tokens = readFileSync(join(CONTRACTS, 'tokens.css'), 'utf8');
    const declared = /--c-accent:\s*([^;]+);/.exec(tokens)?.[1].trim();
    expect(declared, 'contracts/tokens.css declares no --c-accent this case could read').toBeDefined();
    expect(appCss(variant('literal')), `contracts/tokens.css publishes ${declared}`).toContain(
      `--color-primary: ${declared};`
    );
  });

  it('route A puts the var() reference inside the theme plugin block and nowhere else', () => {
    const css = appCss(variant('plugin-var'));
    const pluginAt = css.indexOf('@plugin "../vendor/daisyui-theme"');
    const declarationAt = css.indexOf('--color-primary: var(--token-accent);');
    const closeAt = css.indexOf('}', pluginAt);
    expect(pluginAt).toBeGreaterThan(-1);
    expect(declarationAt).toBeGreaterThan(pluginAt);
    expect(declarationAt).toBeLessThan(closeAt);
    // No trailing unlayered rule: route A and route B have to be separable.
    expect(css).not.toContain('[data-theme="cuatro"] {');
  });

  it('route B puts an unlayered rule after both plugin blocks, over a decoy inside one', () => {
    const css = appCss(variant('css-var'));
    const ruleAt = css.indexOf('[data-theme="cuatro"] {');
    const lastPluginAt = css.lastIndexOf('@plugin ');
    expect(ruleAt).toBeGreaterThan(lastPluginAt);
    expect(css).toContain('--color-primary: oklch(50% 0.2 140);');
    // The decoy is inside the plugin block and the reference is in the rule, so
    // "the unlayered rule won" and "the var() resolved" cannot be confused.
    expect(css.slice(ruleAt)).toContain('--color-primary: var(--token-accent);');
  });

  it('the composition build carries route A rather than the literal', () => {
    // A composition build declaring the literal would never exercise the var()
    // at all, so it could not support the claim that the route still works with
    // the adapter present.
    const css = appCss(COMPOSITION);
    expect(css).toContain('--color-primary: var(--token-accent);');
    expect(css).not.toContain('--color-primary: oklch(66% 0.165 288);');
    expect(css).toContain('@import "../vendor/cuatro-contracts/tailwind.css";');
    expect(css).not.toContain('@import "../vendor/cuatro-contracts/tokens.css";');
  });

  it('variants 1 to 4 import the token file and not the adapter', () => {
    for (const candidate of VARIANTS) {
      const css = appCss(candidate);
      expect(css, `${candidate.name}`).toContain('@import "../vendor/cuatro-contracts/tokens.css";');
      expect(css, `${candidate.name}`).not.toContain('cuatro-contracts/tailwind.css');
    }
  });

  it('keeps the two settings that give the unmapped control a colour to fall back to', () => {
    // The control measures "did not resolve" only because something else paints
    // `--color-primary` underneath it: daisyUI's own default theme, loaded with
    // `themes: light --default`, reached because the probe's theme declares
    // `default: false`. Flip either and the control measures an unpainted
    // element instead, which shows nothing, while every other case here still
    // passes. Both are disclosed as deliberate departures from `cs-tracker`'s
    // `themes: false` in `ops/daisyui-route.md`'s stated limits.
    for (const candidate of [...VARIANTS, COMPOSITION]) {
      const css = appCss(candidate);
      expect(css, `${candidate.name}`).toContain('  themes: light --default;');
      expect(css, `${candidate.name}`).toContain('  default: false;');
    }
  });

  it('every variant scans its own fixture and nothing else', () => {
    for (const candidate of [...VARIANTS, COMPOSITION]) {
      const css = appCss(candidate);
      expect(css, `${candidate.name}`).toContain('@import "tailwindcss" source(none);');
      const sources = css.match(/^@source .*$/gm) ?? [];
      expect(sources, `${candidate.name}`).toEqual([`@source "../../fixture/${candidate.name}.html";`]);
    }
  });
});

describe('fixtureHtml', () => {
  it('carries both verdict components, both diagnostics and the inline token reference', () => {
    const html = fixtureHtml(variant('literal'));
    for (const id of COMPONENT_IDS) expect(html).toContain(`data-component="${id}"`);
    expect(html).toContain('data-component="accent"');
    expect(html).toContain('data-component="bg-accent"');
    // The comparison reference: the browser's own resolution of the token,
    // rather than a colour string written into the probe.
    expect(html).toContain('data-component="token" style="background-color: var(--token-accent)"');
    expect(html).toContain('data-theme="cuatro"');
  });

  it('links the stylesheet the same run compiled for that variant', () => {
    expect(fixtureHtml(variant('css-var'))).toContain('href="./css-var.css"');
  });
});

describe('declaredColourNames', () => {
  it('reports none for a stylesheet declaring none', () => {
    expect([...declaredColourNames(':root { --token-accent: red; }')]).toEqual([]);
  });

  it('reports every distinct --color-* name once', () => {
    const css = ':root{--color-primary:red;--color-accent:blue}[data-theme=x]{--color-primary:green}';
    expect([...declaredColourNames(css)].sort()).toEqual(['--color-accent', '--color-primary']);
  });

  it('does not read a var() reference as a declaration', () => {
    expect([...declaredColourNames('.btn{background:var(--color-primary)}')]).toEqual([]);
  });

  it('survives a build that produced no css at all', () => {
    expect([...declaredColourNames(null as unknown as string)]).toEqual([]);
  });
});

describe('emittedValues', () => {
  it('reports none when the property is never declared', () => {
    expect(emittedValues(':root{--color-accent:red}', '--color-primary')).toEqual([]);
  });

  it('reports one value once however often it is declared', () => {
    expect(emittedValues(':root{--color-primary:red}[data-theme=x]{--color-primary:red}', '--color-primary')).toEqual([
      'red',
    ]);
  });

  it('reports several distinct values in the order they first appear', () => {
    const css = '[data-theme=x]{--color-primary:var(--token-accent)}:root{--color-primary:blue}.y{--color-primary:red}';
    expect(emittedValues(css, '--color-primary')).toEqual(['var(--token-accent)', 'blue', 'red']);
  });

  it('does not read a longer custom property that merely ends in the requested name', () => {
    expect(emittedValues(':root{--btn--color-primary:red;--color-primary:blue}', '--color-primary')).toEqual(['blue']);
  });

  it('survives a build that produced no css at all', () => {
    expect(emittedValues(null as unknown as string, '--color-primary')).toEqual([]);
  });
});

describe('preflightCount', () => {
  it('counts one Preflight per emitted marker', () => {
    expect(preflightCount('a{-webkit-tap-highlight-color:transparent}')).toBe(1);
    expect(preflightCount('a{-webkit-tap-highlight-color:x}b{-webkit-tap-highlight-color:y}')).toBe(2);
    expect(preflightCount('nothing here')).toBe(0);
    expect(preflightCount(null as unknown as string)).toBe(0);
  });
});

describe('routeVerdict', () => {
  const reference = built(both(VIOLET));
  const control = built(both(INDIGO));

  it('passes only when the route equals the reference and differs from the control', () => {
    const outcome = routeVerdict(built(both(VIOLET)), reference, control);
    expect(outcome.verdict).toBe(VERDICT.live);
    expect(outcome.live).toBe(true);
    expect(outcome.pass).toBe(true);
  });

  it('FAILS a route that compiled and did not resolve', () => {
    // The case this repository exists to catch: a Tailwind bump kills route A
    // while route B survives. It must not leave the run exiting 0.
    const outcome = routeVerdict(built(both(INDIGO)), reference, control);
    expect(outcome.verdict).toBe(VERDICT.dead);
    expect(outcome.live).toBe(false);
    expect(outcome.pass).toBe(false);
  });

  it('FAILS a route that did not compile, and says so rather than calling it dead', () => {
    const outcome = routeVerdict(built(null, false), reference, control);
    expect(outcome.verdict).toBe(VERDICT.noCompile);
    expect(outcome.pass).toBe(false);
    // The story's Never clause: a variant that failed to compile is never
    // reported as a route that failed to resolve.
    expect(outcome.verdict).not.toBe(VERDICT.dead);
  });

  it('FAILS a route that compiled but was never read', () => {
    const outcome = routeVerdict(built(null, true), reference, control);
    expect(outcome.verdict).toBe(VERDICT.notObserved);
    expect(outcome.pass).toBe(false);
  });

  it('reports no reference rather than dead when the literal build is unusable', () => {
    for (const broken of [built(null, false), built(null, true)]) {
      const outcome = routeVerdict(built(both(VIOLET)), broken, control);
      expect(outcome.verdict).toBe(VERDICT.noReference);
      expect(outcome.pass).toBe(false);
    }
  });

  it('reports no control rather than dead when the unmapped build is unusable', () => {
    const outcome = routeVerdict(built(both(VIOLET)), reference, built(null, false));
    expect(outcome.verdict).toBe(VERDICT.noControl);
    expect(outcome.pass).toBe(false);
  });

  it('reports the split when the two components disagree with each other', () => {
    const outcome = routeVerdict(built({ btn: VIOLET, badge: INDIGO }), reference, control);
    expect(outcome.verdict).toBe(VERDICT.split);
    expect(outcome.pass).toBe(false);
  });

  it('refuses a verdict when the control equals the reference, whatever the route computed', () => {
    // A control that cannot fail proves nothing, so a route sitting on top of
    // it is not live even when it matches.
    const outcome = routeVerdict(built(both(VIOLET)), reference, built(both(VIOLET)));
    expect(outcome.verdict).toBe(VERDICT.vacuous);
    expect(outcome.pass).toBe(false);
  });

  it('does not call a route live merely for differing from the control', () => {
    const outcome = routeVerdict(built(both(GREEN)), reference, control);
    expect(outcome.verdict).toBe(VERDICT.dead);
  });

  it('refuses a verdict when a component was never read on either side', () => {
    // `undefined === undefined` is not agreement. A reading that never happened
    // must not be able to compute LIVE out of two absences.
    const missing = built({ ...both(VIOLET), [COMPONENT_IDS[0]]: undefined as unknown as string });
    expect(routeVerdict(missing, reference, control).verdict).toBe(VERDICT.notObserved);
    expect(routeVerdict(built(both(VIOLET)), built(both('')), control).verdict).toBe(VERDICT.notObserved);
  });

  it('refuses a verdict when there are no components to read', () => {
    // With an empty id list every() and some() are vacuously true, so the
    // comparisons below them would report LIVE off nothing at all.
    expect(routeVerdict(built(both(VIOLET)), reference, control, []).verdict).toBe(VERDICT.notObserved);
  });

  it('only LIVE ever passes', () => {
    const outcomes = [
      routeVerdict(built(both(VIOLET)), reference, control),
      routeVerdict(built(both(INDIGO)), reference, control),
      routeVerdict(built(null, false), reference, control),
      routeVerdict(built({ btn: VIOLET, badge: INDIGO }), reference, control),
    ];
    expect(outcomes.filter((outcome) => outcome.pass)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.pass)[0].verdict).toBe(VERDICT.live);
  });
});

describe('sweepLeftovers', () => {
  // Every case here runs against a base directory of this suite's own rather
  // than the shared `tmpdir()`. A sweep pointed at `tmpdir()` would delete a
  // concurrently running probe's planted directory, failing its `Leftover sweep`
  // case for a reason that has nothing to do with the probe.
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'daisyui-sweep-case-'));
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /**
   * A directory under `base` the sweep will consider.
   *
   * The caller ages it with `aged()` as the last thing it does, because writing
   * into a directory moves its mtime forward again and the sweep reads that
   * mtime to tell an abandoned tree from one being claimed right now.
   */
  const plantIn = (suffix: string): string => {
    const target = join(base, `${SCRATCH_PREFIX}${suffix}`);
    mkdirSync(target, { recursive: true });
    return target;
  };

  it('removes a scratch tree no live run claims', () => {
    const leftover = plantIn('leftover');
    writeFileSync(join(leftover, 'deps.txt'), 'a full Phoenix tree would be here\n');
    aged(leftover);
    const { swept } = sweepLeftovers(null, base);
    expect(swept).toContain(leftover);
    expect(existsSync(leftover)).toBe(false);
  });

  it('leaves a directory whose name does not carry the prefix alone', () => {
    const unrelated = join(base, 'not-a-daisyui-probe-tree');
    mkdirSync(unrelated, { recursive: true });
    sweepLeftovers(null, base);
    expect(existsSync(unrelated)).toBe(true);
  });

  it('skips the active root it is told about', () => {
    const active = plantIn('active');
    aged(active);
    const { swept, skipped } = sweepLeftovers(active, base);
    expect(swept).not.toContain(active);
    expect(skipped).toContain(active);
    expect(existsSync(active)).toBe(true);
  });

  it('skips a tree a live process has marked as its own', () => {
    // Two probes running at once must not delete each other's application. The
    // marker names this process, which is by definition alive.
    const claimed = plantIn('claimed');
    writeFileSync(join(claimed, ACTIVE_MARKER), JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
    aged(claimed);
    const { swept, skipped } = sweepLeftovers(null, base);
    expect(swept).not.toContain(claimed);
    expect(skipped).toContain(claimed);
    expect(existsSync(claimed)).toBe(true);
  });

  it('does not let an unreadable marker protect an abandoned tree', () => {
    const stale = plantIn('stale');
    writeFileSync(join(stale, ACTIVE_MARKER), 'not json at all');
    aged(stale);
    const { swept } = sweepLeftovers(null, base);
    expect(swept).toContain(stale);
    expect(existsSync(stale)).toBe(false);
  });

  it('removes a tree whose marker names a process that is no longer running', () => {
    // This is the production path, and until now nothing pinned it. Every tree
    // the sweep exists for carries a well-formed marker: it is written the
    // statement after the root is created, and its owner is dead by the time the
    // next run looks. A guard that returned "alive" for it would leak a full
    // Phoenix tree per crashed run while every other case here still passed.
    const abandoned = plantIn('abandoned');
    writeFileSync(join(abandoned, ACTIVE_MARKER), JSON.stringify({ pid: deadPid(), startedAt: Date.now() }));
    aged(abandoned);
    const { swept } = sweepLeftovers(null, base);
    expect(swept).toContain(abandoned);
    expect(existsSync(abandoned)).toBe(false);
  });

  it('removes a tree whose marker names no process, which is what the probe plants', () => {
    // The production path for the probe's own `Leftover sweep` case: it plants a
    // directory carrying `{ pid: null }` precisely so the claim grace does not
    // protect it and the case asserts a real removal. Nothing held that branch
    // in place, so a guard that answered "alive" for an unparseable pid would
    // make the probe's self-test fail with every case here still green.
    const unowned = plantIn('unowned');
    writeFileSync(join(unowned, ACTIVE_MARKER), JSON.stringify({ pid: null, planted: true }));
    aged(unowned);
    const { swept } = sweepLeftovers(null, base);
    expect(swept).toContain(unowned);
    expect(existsSync(unowned)).toBe(false);
  });

  it('does not let a marker naming pid 0 or a negative pid protect an abandoned tree', () => {
    // `process.kill(0, 0)` signals the caller's own process group on POSIX and
    // answers "alive" for a marker that names nothing.
    for (const pid of [0, -1]) {
      const corrupt = plantIn(`corrupt-${pid}`);
      writeFileSync(join(corrupt, ACTIVE_MARKER), JSON.stringify({ pid }));
      aged(corrupt);
      const { swept } = sweepLeftovers(null, base);
      expect(swept, `a marker naming pid ${pid}`).toContain(corrupt);
      expect(existsSync(corrupt)).toBe(false);
    }
  });

  it('leaves an unclaimed tree younger than the claim grace alone', () => {
    // A run claims its root in the statement after `mkdtempSync` returns. A
    // concurrent sweep landing in that window would delete a live application,
    // so an unclaimed tree is only swept once it is too old to be mid claim.
    const claiming = join(base, `${SCRATCH_PREFIX}claiming`);
    mkdirSync(claiming, { recursive: true });
    const { swept, skipped } = sweepLeftovers(null, base);
    expect(swept).not.toContain(claiming);
    expect(skipped).toContain(claiming);
    expect(existsSync(claiming)).toBe(true);
  });

  it('reports an unreadable base rather than throwing', () => {
    // The sweep runs before the first variant compiles, and nothing about the
    // temporary directory is a finding about the routes.
    const missing = join(base, 'no-such-directory');
    const { swept, skipped, failed } = sweepLeftovers(null, missing);
    expect(swept).toHaveLength(0);
    expect(skipped).toHaveLength(0);
    expect(failed.map((entry) => entry.target)).toContain(missing);
  });
});
