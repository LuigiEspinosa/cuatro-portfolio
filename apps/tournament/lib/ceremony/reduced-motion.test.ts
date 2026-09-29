import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import {
  FLIP_MS,
  MOTION_PREFERENCES,
  motionBudgetMs,
  motionParity,
  REDUCED_MOTION_QUERY,
  revealPresentation,
  WHEEL_EASING,
  WHEEL_SPIN_MS,
  WHEEL_TURNS,
  type MotionPreference,
} from '@/lib/ceremony/reduced-motion';
import { buildRevealView, revealParityKey, type RevealView } from '@/lib/ceremony/reveal-model';
import type { RevealedCeremony } from '@/lib/ceremony/reveal-read';

/**
 * UX-DR32 / AD-24 reduced-motion parity — marked CRITICAL (Story 6.10, AC3/AC12).
 *
 * ⭐⭐ THIS SUITE IS WHAT MAKES `reduced-motion.ts` LOAD-BEARING RATHER THAN DECORATIVE. The module
 * declares the motion contract; the decision itself is CSS's, because `prefers-reduced-motion` does
 * not exist during server rendering and any JS branch on it would be a hydration mismatch — which
 * HERE is a parity bug by definition. So the numbers are declared once in TypeScript and this suite
 * reads the SHIPPED STYLESHEET as bytes and fails if they drift. Without that, the module would be a
 * comment with an `export` in front of it.
 */

const CEREMONIA = new URL('../../app/(viewer)/ceremonia/', import.meta.url);
const REVEAL_CSS = readFileSync(new URL('reveal.module.css', CEREMONIA), 'utf8');
const CEREMONIA_CSS = readFileSync(new URL('ceremonia.module.css', CEREMONIA), 'utf8');
const VIEWER_CSS = readFileSync(new URL('../../app/(viewer)/viewer.module.css', import.meta.url), 'utf8');

/** Escape a literal for embedding in a `RegExp`. */
function escapeRe(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract one rule block's declarations, so an assertion can be scoped to a SELECTOR.
 *
 * ⚠⚠ CODE REVIEW 2026-08-11 — THE OLD PATTERN MATCHED SELECTORS IT WAS NOT ASKED ABOUT. It was
 * `` `\\${selector}[^{}]*\\{` ``, which (a) escaped only the FIRST character, leaving every later `.`
 * as a regex wildcard, and (b) let `[^{}]*` absorb a suffix — so `ruleBody(css, '.lockRow')` also
 * swallowed `.lockRows { … }`, and `ruleBody(css, '.sweep')` swallowed `.newest .sweep { … }`. A
 * helper that returns the wrong bytes makes every assertion built on it meaningless in BOTH
 * directions. The selector must now be a complete token: preceded by start-of-line, `}` or `,`, and
 * followed by optional whitespace and its own `{`.
 */
function ruleBody(css: string, selector: string): string {
  const re = new RegExp(`(?:^|[},])\\s*${escapeRe(selector)}\\s*\\{([^}]*)\\}`, 'gm');
  return [...css.matchAll(re)].map((m) => m[1] ?? '').join('\n');
}

/**
 * Extract an `@media` block's body by BRACE MATCHING from the at-rule's own `{`.
 *
 * ⚠⚠ WRITTEN THIS WAY BECAUSE THE NAIVE VERSION SILENTLY MEASURED THE WRONG BYTES. A plain
 * `indexOf('@media (prefers-reduced-motion: reduce)')` matched the file HEADER COMMENT, which names
 * the query in prose — so the slice began in the comment, ended at the first `}` it found (the
 * `.reveal` rule), and the assertion failed for a reason that had nothing to do with the rule under
 * test. A scan that can point at the wrong region is a scan whose PASSES mean nothing either.
 */
function mediaBlock(css: string, query: string): string {
  const at = new RegExp(`@media\\s+${query.replace(/[().:\-]/g, (c) => `\\${c}`)}\\s*\\{`).exec(css);
  if (at === null) return '';
  let depth = 0;
  for (let i = at.index + at[0].length - 1; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(at.index, i + 1);
    }
  }
  return '';
}

// ── the helper this file's own assertions are built on ─────────────────────────────────────────

describe('⛔ ruleBody scopes to a COMPLETE selector — every assertion below depends on it', () => {
  // ⭐⭐ THIS BLOCK EXISTS BECAUSE A MUTATION SURVIVED. The 2026-08-11 review found the old pattern
  // (`\\${selector}[^{}]*\\{`) matched selectors it was not asked about; the fix was applied and then
  // re-cut as a mutant — and NOTHING reddened, because no assertion pinned the helper. A test helper
  // that returns the wrong bytes silently weakens every `toContain`/`not.toContain` built on it, in
  // both directions.
  const FIXTURE = ['.lockRow {', '  color: var(--tm);', '}', '.lockRows {', '  color: var(--gold);', '}'].join('\n');

  it('does not swallow a selector that merely STARTS with the one asked for', () => {
    expect(ruleBody(FIXTURE, '.lockRow')).toContain('--tm');
    expect(ruleBody(FIXTURE, '.lockRow')).not.toContain('--gold');
  });

  it('does not swallow a DESCENDANT rule when asked for the bare class', () => {
    const css = ['.sweep {', '  opacity: 0;', '}', '.newest .sweep {', '  animation: sweepOut 1ms;', '}'].join('\n');
    expect(ruleBody(css, '.sweep')).toContain('opacity: 0');
    expect(ruleBody(css, '.sweep')).not.toContain('sweepOut');
  });

  it('still finds the rule it IS asked for, including a descendant selector', () => {
    const css = ['.newest .wheel {', '  animation: wheelSpin 4600ms;', '}'].join('\n');
    expect(ruleBody(css, '.newest .wheel')).toContain('wheelSpin');
  });

  it('returns empty for a selector that is not there — ⛔ never a silent whole-file match', () => {
    expect(ruleBody(FIXTURE, '.nope')).toBe('');
  });
});

// ── the declared contract ───────────────────────────────────────────────────────────────────────

describe('the motion vocabulary is a closed set (AC12)', () => {
  it('is exactly the media query’s own two states', () => {
    // ⚠ `no-preference`, not "off": a user agent that has never been told anything reports
    // `no-preference`, and treating an unknown as `reduce` would strip the ceremony from everyone
    // whose browser predates the query.
    expect([...MOTION_PREFERENCES]).toEqual(['no-preference', 'reduce']);
  });

  it('the case table is non-empty — an it.each over [] is zero tests and a green run', () => {
    expect(MOTION_PREFERENCES.length).toBe(2);
  });

  it.each([...MOTION_PREFERENCES])('presents %s without throwing, with a static emphasis on both', (pref) => {
    const p = revealPresentation(pref);
    // ⭐ Q2 (Cuatro) — the emphasis is STATIC and timerless on BOTH paths, so it can never make the
    // two captures AC13 diffs depend on WHEN they were taken.
    expect(p.emphasis).toBe('static');
  });
});

describe('motionBudgetMs — ⛔ exactly zero under reduce, by BOTH terms', () => {
  it('is the full wheel + flip when motion is allowed', () => {
    expect(motionBudgetMs('no-preference')).toBe(WHEEL_SPIN_MS + FLIP_MS);
    expect(motionBudgetMs('no-preference')).toBeGreaterThan(0);
  });

  it('is 0 under reduce — and neither term is merely small', () => {
    expect(motionBudgetMs('reduce')).toBe(0);
    const p = revealPresentation('reduce');
    expect(p.wheelSpinMs).toBe(0);
    expect(p.flipMs).toBe(0);
    expect(p.spinWheel).toBe(false);
    expect(p.animateFlip).toBe(false);
  });
});

// ── the parity oracle ───────────────────────────────────────────────────────────────────────────

function sampleView(): RevealView {
  const ceremony: RevealedCeremony = {
    ceremonyId: 77,
    spins: [
      {
        spinIndex: 1,
        kind: 'main',
        awards: [
          {
            awardResultId: 9,
            awardId: 401,
            name: 'Muralla',
            bucket: 'skill',
            decidingStat: 'kills',
            outcomeKind: 'no_eligible_players',
            isPity: false,
            isShared: false,
            decidingValue: null,
            decidingNum: null,
            decidingDen: null,
            winners: [],
          },
        ],
      },
      {
        spinIndex: 2,
        kind: 'main',
        awards: [
          {
            awardResultId: 10,
            awardId: 402,
            name: 'Cuchillero',
            bucket: 'weird',
            decidingStat: 'knife_kills',
            outcomeKind: 'winner',
            isPity: false,
            isShared: false,
            decidingValue: '4',
            decidingNum: null,
            decidingDen: null,
            winners: [{ rosterEntryId: 11, displayName: 'Dex' }],
          },
        ],
      },
    ],
  };
  return buildRevealView({ ceremony, awardCount: 12, complete: false });
}

describe('⭐⭐ AC3 — the same view states the same thing under both preferences', () => {
  it('holds for a presenter that respects DECISION U (the shipped shape: presentation cannot reach content)', () => {
    expect(motionParity(sampleView(), (v) => v)).toBe(true);
  });

  /**
   * ⛔⛔ THE NON-VACUITY CONTROL, AND IT IS THE POINT OF THIS BLOCK. The assertion above passes BY
   * CONSTRUCTION today, which is exactly the property AC3 wants — but a check that cannot fail proves
   * nothing (`deferred-work.md` records that vacuity failure three times). So the same oracle is fed
   * the obvious "optimisation" a future edit would reach for — *don't build the winner block until
   * the wheel lands* — and must report it as a parity BREAK.
   */
  it.each([
    [
      'withholding the newest winners under reduce',
      (v: RevealView, p: MotionPreference): RevealView =>
        p === 'reduce'
          ? { ...v, spins: v.spins.map((s) => (s.isNewest ? { ...s, awards: [] } : s)) }
          : v,
    ],
    [
      're-ordering the spins under reduce',
      (v: RevealView, p: MotionPreference): RevealView =>
        p === 'reduce' ? { ...v, spins: [...v.spins].reverse() } : v,
    ],
  ])('reports a BREAK for %s', (_label, presenter) => {
    expect(motionParity(sampleView(), presenter)).toBe(false);
  });

  /**
   * ⭐⭐ THE ORACLE ITSELF IS PINNED, AND THE MUTATION PASS IS WHY.
   *
   * `motionParity` is only as good as `revealParityKey`. Cutting the spin index and the outcome OUT
   * of that key left every assertion above green — **M11 and M12 both SURVIVED** — because the
   * presenter-mutation controls happen to disturb other fields too, so they reddened for the wrong
   * reason. AC3's whole claim is that the two paths state the SAME THING; a key blind to order or to
   * outcome cannot detect the one divergence that would matter. ⛔ Each field the key must carry is
   * asserted here by changing exactly that field and nothing else.
   */
  it('⛔ the parity key is SENSITIVE to every fact AC3 is about, one field at a time', () => {
    const base = sampleView();
    const key = revealParityKey(base);

    const swap = <T,>(fn: (v: RevealView) => RevealView) => revealParityKey(fn(base));

    // the spin INDEX (the published order, restated)
    expect(swap((v) => ({ ...v, spins: v.spins.map((s, i) => (i === 0 ? { ...s, spinIndex: 99 } : s)) }))).not.toBe(key);
    // the OUTCOME
    expect(
      swap((v) => ({
        ...v,
        spins: v.spins.map((s, i) => (i === 0 ? { ...s, awards: s.awards.map((a) => ({ ...a, outcome: 'shared' as const })) } : s)),
      })),
    ).not.toBe(key);
    // WHO won
    expect(
      swap((v) => ({
        ...v,
        spins: v.spins.map((s, i) =>
          i === 1 ? { ...s, awards: s.awards.map((a) => ({ ...a, winners: [{ rosterEntryId: 77, displayName: 'Otro' }] })) } : s,
        ),
      })),
    ).not.toBe(key);
    // the DECIDING VALUE the card shows
    expect(
      swap((v) => ({
        ...v,
        spins: v.spins.map((s, i) => (i === 1 ? { ...s, awards: s.awards.map((a) => ({ ...a, decidingText: '999' })) } : s)),
      })),
    ).not.toBe(key);
    // the award IDENTITY
    expect(
      swap((v) => ({
        ...v,
        spins: v.spins.map((s, i) => (i === 0 ? { ...s, awards: s.awards.map((a) => ({ ...a, name: 'Otra cosa' })) } : s)),
      })),
    ).not.toBe(key);

    // ⛔ AND INSENSITIVE to pure decoration — folding `isNewest` in would make the key sensitive to
    // things AC3 explicitly permits to differ.
    expect(swap((v) => ({ ...v, spins: v.spins.map((s) => ({ ...s, isNewest: !s.isNewest })) }))).toBe(key);
    expect(swap((v) => ({ ...v, complete: !v.complete }))).toBe(key);
  });

  it('⛔ the SPIN line carries the index in its own right — an award-less spin is still identified', () => {
    // ⭐⭐ M11 SURVIVED TWICE, AND THE SECOND SURVIVAL WAS THE INTERESTING ONE. Cutting `spinIndex` out
    // of the spin line is masked by REDUNDANCY: the award line repeats `spin.spinIndex`, so every
    // fixture with awards still reddens. The gap it leaves is a spin with ZERO awards — the read
    // racing the result insert, which is a state the renderer branches on by name — whose only
    // contribution to the key IS the spin line. Two ceremonies differing only in that spin's index
    // would then key identically, and AC3's oracle would call a re-ordered reveal "identical".
    const bare: RevealView = {
      spins: [{ spinIndex: 1, kind: 'main', position: 1, awards: [], isNewest: true }],
      mainSpins: [],
      pity: null,
      shelf: [],
      lockedPositions: [],
      awardCount: 12,
      complete: false,
    };
    const moved: RevealView = { ...bare, spins: [{ ...bare.spins[0]!, spinIndex: 7 }] };
    expect(revealParityKey(bare)).not.toBe(revealParityKey(moved));
  });
});

// ── the stylesheet actually honours the declared numbers ────────────────────────────────────────

describe('the SHIPPED stylesheet matches the declared contract (this is what makes the module real)', () => {
  it('the stylesheets are actually loaded', () => {
    expect(REVEAL_CSS.length).toBeGreaterThan(2000);
    expect(VIEWER_CSS.length).toBeGreaterThan(500);
    expect(CEREMONIA_CSS.length).toBeGreaterThan(500);
  });

  it('⭐ carries the repo’s FIRST reduced-motion block, spelled exactly as the module declares it', () => {
    expect(REVEAL_CSS).toContain(`@media ${REDUCED_MOTION_QUERY}`);
  });

  it('animates the wheel and the flip for exactly the declared durations, with the declared curve', () => {
    // ⭐⭐ CODE REVIEW 2026-08-11 — THESE USED TO BE WHOLE-FILE SUBSTRING CHECKS AND COULD NOT FAIL FOR
    // THE THING THEY NAMED. `toContain('4600ms')` and `toContain('520ms')` are both satisfied by the
    // SINGLE declaration `animation: flipIn 520ms ease-out 4600ms both`, so swapping the flip's
    // duration and its delay — a 4.6 s flip after a 0.52 s wait, an entirely different ceremony —
    // passed every assertion in this test. Each number is now pinned to the rule it belongs to, and
    // to its POSITION within that rule (duration first, delay third).
    const wheel = ruleBody(REVEAL_CSS, '.newest .wheel');
    expect(wheel).toMatch(new RegExp(`animation:\\s*wheelSpin\\s+${WHEEL_SPIN_MS}ms\\s+${escapeRe(WHEEL_EASING)}`));

    const sweep = ruleBody(REVEAL_CSS, '.newest .sweep');
    expect(sweep).toMatch(new RegExp(`animation:\\s*sweepOut\\s+${WHEEL_SPIN_MS}ms`));

    // ⚠ THE FLIP'S DELAY IS THE WHEEL'S DURATION — the card lands when the wheel stops. Pinning the
    // pair together is what makes a swap of the two numbers reddens rather than pass.
    const card = ruleBody(REVEAL_CSS, '.newest .catCard');
    expect(card).toMatch(new RegExp(`animation:\\s*flipIn\\s+${FLIP_MS}ms\\s+[a-z-]+\\s+${WHEEL_SPIN_MS}ms\\s+both`));
  });

  it('⛔ the duration pins are NOT satisfiable by swapping a duration for a delay (the control)', () => {
    // The mutant this test exists to kill, applied by hand to a copy of the real declaration.
    const swapped = REVEAL_CSS.replace(
      `animation: flipIn ${FLIP_MS}ms ease-out ${WHEEL_SPIN_MS}ms both`,
      `animation: flipIn ${WHEEL_SPIN_MS}ms ease-out ${FLIP_MS}ms both`,
    );
    expect(swapped).not.toBe(REVEAL_CSS); // the replace actually matched something
    const card = ruleBody(swapped, '.newest .catCard');
    expect(card).not.toMatch(
      new RegExp(`animation:\\s*flipIn\\s+${FLIP_MS}ms\\s+[a-z-]+\\s+${WHEEL_SPIN_MS}ms\\s+both`),
    );
  });

  it('⛔ the wheel keyframe ends on a WHOLE number of turns — otherwise the two paths REST differently', () => {
    // ⭐⭐ THIS IS THE MECHANISM OF AC3, NOT A DETAIL. `wheelSpin` travels `WHEEL_TURNS × 360°`, so its
    // final frame is visually identical to `rotate(0deg)` — the position the wheel occupies when the
    // animation is removed. An animation whose base state is not its resting state breaks parity, and
    // the DOM diff is the only thing that would ever tell you.
    expect(REVEAL_CSS).toContain(`rotate(${WHEEL_TURNS * 360}deg)`);
    expect(WHEEL_TURNS * 360).toBe(1800);
  });

  it('the sweep RESTS invisible, so removing its animation leaves the same document', () => {
    expect(ruleBody(REVEAL_CSS, '.sweep')).toContain('opacity: 0');
  });

  it('the reduced block disables all three animated elements — ⛔ not just the wheel', () => {
    const block = mediaBlock(REVEAL_CSS, REDUCED_MOTION_QUERY);
    // ⛔ NON-VACUITY FIRST: an empty slice would satisfy nothing below and pass the `not.toContain`
    // style of assertion elsewhere in this file by accident.
    expect(block.length).toBeGreaterThan(40);
    for (const selector of ['.wheel', '.sweep', '.catCard']) {
      expect(block, selector).toContain(selector);
    }
    expect(block).toContain('animation: none');
  });

  it('⭐ the pre-existing infinite `pulse` came under the same rule, and the DECISION is recorded', () => {
    // Task 3 asks for a deliberate choice, not a silent one. `@keyframes pulse` has been unguarded
    // since 5.6, runs `infinite`, and sits in the app bar of every viewer surface including this one.
    expect(VIEWER_CSS).toContain('@keyframes pulse');
    expect(VIEWER_CSS).toContain('animation: pulse');
    const guarded = mediaBlock(VIEWER_CSS, REDUCED_MOTION_QUERY);
    expect(guarded.length).toBeGreaterThan(20);
    expect(guarded).toContain('.pulse');
    expect(guarded).toContain('animation: none');
  });
});

// ── AC4: the shared screen is the same tree at a wide breakpoint ────────────────────────────────

describe('AC4 / DECISION V — one tree, one breakpoint, ⛔ never a second route', () => {
  it('uses the only wide-breakpoint numbers that exist anywhere in the project', () => {
    expect(REVEAL_CSS).toContain('@media (min-width: 1024px)');
    expect(REVEAL_CSS).toContain('320px 1fr 300px');
    expect(REVEAL_CSS).toContain('1180px');
  });

  it('relaxes the 430px shell cap ONLY for a page that actually casts', () => {
    // ⛔ Not lifted globally: `/`, `/bracket`, `/leaderboards` and `/jugador/[id]` must be
    // byte-identical at every width.
    expect(VIEWER_CSS).toContain('max-width: 430px');
    expect(VIEWER_CSS).toContain('[data-ceremony-wide]');
    expect(VIEWER_CSS).toContain(':has(');
  });

  it('there is no second ceremony route', () => {
    const routes = readdirSync(new URL('../../app/(viewer)/', import.meta.url), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(routes).toContain('ceremonia');
    for (const name of routes) {
      expect(name).not.toMatch(/cast|stream|banner|pantalla/i);
    }
  });
});

// ── AC11: the gold discipline, and AC3's structural claim across the route ──────────────────────

describe('AC11 — gold discipline, as a grep the way 6.9b made it one', () => {
  it('⛔⛔ `ceremonia.module.css` still carries ZERO gold — 6.9b’s invariant, now a REGRESSION guard', () => {
    // 6.9b wrote its own header so that a plain grep over that file returns zero, and this story is
    // the first that could have broken it. The reveal's gold lives in the sibling module instead.
    expect(CEREMONIA_CSS).not.toContain('--gold');
    expect(REVEAL_CSS).toContain('var(--gold)');
  });

  it('⛔ no gold on anything LOCKED, muted, or on the lock glyph', () => {
    for (const selector of ['.lockRow', '.lockNum', '.redact', '.lockGlyph', '.slotEmpty']) {
      expect(ruleBody(REVEAL_CSS, selector), selector).not.toContain('--gold');
    }
  });

  it('the blurred lock is 7px — ⚠ not the mock’s 4.5px', () => {
    expect(ruleBody(REVEAL_CSS, '.redact')).toContain('blur(7px)');
    expect(REVEAL_CSS).not.toContain('blur(4.5px)');
  });
});

describe('⭐⭐ DECISION U across the whole route — no JS anywhere reads a motion preference', () => {
  /**
   * ⚠⚠ CODE REVIEW 2026-08-11 — THE SCAN NOW FOLLOWS THE ROUTE, NOT ONE DIRECTORY, AND THE CLAIM IT
   * PROVES IS NARROWER THAN THE ONE THAT WAS BEING MADE. It used to read only
   * `app/(viewer)/ceremonia/`, so it could not see that this route's own island retains a store one
   * directory up which schedules TWO `window.setTimeout`s (the coalescer and the deferred teardown).
   * "No timer anywhere on the route" was therefore false, and the scan was structurally incapable of
   * saying so. ⛔ The honest claim — the one AC3 actually needs — is that NOTHING ON THE ROUTE READS A
   * MOTION PREFERENCE, and that is what is asserted: `matchMedia` and `prefers-reduced-motion` are
   * scanned across every module the route pulls in, while the timer needles stay scoped to the
   * components that render the choreography, where a timer really would be a parity hazard.
   */
  const ROUTE_FILES = readdirSync(CEREMONIA)
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
    .map((f) => ({ file: f, src: readFileSync(new URL(f, CEREMONIA), 'utf8') }));

  const COMPONENTS = new URL('../../app/(viewer)/components/', import.meta.url);
  const REACHED = ['SpinRevealNudge.tsx', 'realtime-channels.ts', 'RealtimeNudge.tsx'].map((f) => ({
    file: f,
    src: readFileSync(new URL(f, COMPONENTS), 'utf8'),
  }));

  const LIB = new URL('../realtime/', import.meta.url);
  const REACHED_LIB = ['channels.ts', 'status.ts'].map((f) => ({
    file: f,
    src: readFileSync(new URL(f, LIB), 'utf8'),
  }));

  const ALL = [...ROUTE_FILES, ...REACHED, ...REACHED_LIB];

  function stripComments(src: string): string {
    // ⚠ Comments stripped first: these files EXPLAIN why they contain no such call, and a scan that
    // reddened on its own documentation would be answered by deleting the documentation.
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/.*$/gm, '');
  }

  it('the route’s sources are actually loaded', () => {
    // ⚠ THREE, not four: `SpinRevealNudge.tsx` moved to `components/` at the 2026-08-11 review, when
    // the feed became its second consumer. It is still scanned — see `REACHED` below.
    expect(ROUTE_FILES.length).toBeGreaterThanOrEqual(3);
    expect(ROUTE_FILES.map((t) => t.file)).toContain('page.tsx');
    expect(ROUTE_FILES.map((t) => t.file)).toContain('CeremonyReveal.tsx');
    expect(ROUTE_FILES.map((t) => t.file)).toContain('VerifyStrip.tsx');
  });

  it('⭐ the scan reaches BEYOND the route directory — otherwise it proves only that four files are quiet', () => {
    expect(ALL.length).toBeGreaterThan(ROUTE_FILES.length);
    expect(ALL.map((t) => t.file)).toContain('realtime-channels.ts');
    // ⛔ NON-VACUITY: the reached files must genuinely contain the timers the old scan could not see,
    // or this widening is decoration. If these ever stop using a timer, tighten the claim instead.
    const reachedSrc = [...REACHED, ...REACHED_LIB].map((t) => stripComments(t.src)).join('\n');
    expect(reachedSrc).toContain('setTimeout');
  });

  it.each(['matchMedia', 'prefers-reduced-motion'])(
    '⛔⛔ NOTHING the route reaches — route, islands or store — mentions %s',
    (needle) => {
      for (const { file, src } of ALL) expect(stripComments(src), file).not.toContain(needle);
    },
  );

  it.each(['requestAnimationFrame', 'setTimeout'])(
    '⛔ no file under /ceremonia mentions %s — the choreography itself is timerless',
    (needle) => {
      for (const { file, src } of ROUTE_FILES) expect(stripComments(src), file).not.toContain(needle);
    },
  );

  it('⛔ carries no inline `style=` — plain CSS Modules only, no CSS-in-JS', () => {
    for (const { file, src } of ROUTE_FILES) {
      expect(src, file).not.toContain('style={{');
    }
  });
});
