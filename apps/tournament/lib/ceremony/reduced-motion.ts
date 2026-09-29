import type { RevealView } from './reveal-model';
import { revealParityKey } from './reveal-model';

/**
 * The ceremony's MOTION CONTRACT (Story 6.10, AC3/AC12 — AD-24 / UX-DR32, marked CRITICAL).
 *
 * ⭐⭐ DECISION U, STATED WHERE IT CAN BE CHECKED. Reduced-motion parity in this story is STRUCTURAL,
 * not asserted: the server renders the RESOLVED state for every revealed spin, so the DOM — text,
 * order, announced strings, winner names — is identical on both paths, and motion is a client-only
 * CSS layer applied OVER an already-correct document. The consequence people get wrong is the
 * interesting one: ⛔ THERE IS NO CODE PATH THAT READS A MOTION PREFERENCE. No `matchMedia`, no
 * hydration branch, no timer, no deferred content. The whole of the reduced-motion implementation is
 * one `@media` block in a stylesheet.
 *
 * ⚠⚠ SO READ WHAT THIS MODULE IS, HONESTLY, RATHER THAN ASSUMING IT DRIVES THE RENDER. It drives
 * nothing at render time — it CANNOT, because the decision is CSS's. It is the single DECLARED
 * source for the numbers and the query string, and `reduced-motion.test.ts` is what makes it
 * load-bearing: the suite reads the shipped stylesheet as bytes and fails if the durations, the turn
 * count or the `@media` guard drift from the values below. Without that test this file would be
 * decoration; with it, the stylesheet cannot quietly stop honouring the rule.
 *
 * ⭐ WHY THAT IS BETTER THAN A JS IMPLEMENTATION, in one line: `prefers-reduced-motion` does not
 * exist during server rendering, so any JS branch on it is a hydration mismatch — and a hydration
 * mismatch HERE is a parity bug by definition. The no-JS and pre-hydration DOM IS the reduced-motion
 * DOM. That is the accessible baseline, and it is what makes AC3 provable by diffing two captures.
 *
 * ⛔ FIRST `prefers-reduced-motion` IN THE REPO. There was no `matchMedia`, no `transition:` and no
 * `@media` anywhere under `app/` before this story — 6.9a and 6.9b both disposed of UX-DR32 by
 * declaring *"this affordance has no motion to reduce"* and `6-9b:851` homed the rule here by name.
 */

/**
 * The two states `prefers-reduced-motion` can be in.
 *
 * ⚠ `no-preference` is the media query's own spelling, not "on"/"off": a user agent that has never
 * been told anything reports `no-preference`, and treating an unknown as "reduce" would silently
 * strip the ceremony from everyone whose browser predates the query.
 */
export const MOTION_PREFERENCES = ['no-preference', 'reduce'] as const;

export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

/** The media query, spelled once. The suite asserts the stylesheet contains exactly this text. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * ⭐ Q1 (Cuatro, 2026-08-11) — THE TIMING IS THE PRE-LOCK PROTOTYPE'S, RESTYLED TO BROADCAST SLATE.
 * No duration or easing exists in EXPERIENCE.md or DESIGN.md; both specify CHARACTER only
 * (*"decelerating conic sweep"*, *"motion is disciplined"*, *"never a slot machine"*). The only
 * project-native curve is `brainstorm.html:222` — `transform 4.6s cubic-bezier(.12,.62,.12,1)`, 4-6
 * turns — and its TIMING was approved for reuse while its neon-glow look stays explicitly rejected
 * (`DESIGN.md:181/294`). ⚠ Twelve spins is ~55 s of wheel across the whole ceremony; that was stated
 * when the choice was taken, not discovered afterwards.
 */
export const WHEEL_SPIN_MS = 4600;

/** Turns per spin — the middle of the prototype's 4-6. */
export const WHEEL_TURNS = 5;

/** The category flip, once the wheel has settled. */
export const FLIP_MS = 520;

/** The deceleration curve, spelled once. */
export const WHEEL_EASING = 'cubic-bezier(0.12, 0.62, 0.12, 1)';

/**
 * What the presentation layer does under each preference.
 *
 * ⭐ Q2 (Cuatro, 2026-08-11) — `emphasis` IS `'static'` ON BOTH PATHS, AND THERE IS NO TIMER.
 * AC3's *"brief non-animated emphasis"* is defined in no artifact: no token, no duration, no visual.
 * The closest project-native precedent is the mock's trophy-shelf `.new` slot (`:414-418`) —
 * full-strength `var(--gold)` border over `rgba(255,178,62,0.12)` against `.filled`'s `0.45`/`0.06`,
 * a purely tonal emphasis with no motion. ⚠ "Brief" implies a TIMED state change, which is itself
 * motion-adjacent; dropping the timer resolves that, and the newest reveal simply KEEPS the stronger
 * treatment until a newer one takes it. ⛔ That means the emphasis is identical on both paths, which
 * is why it never appears in {@link revealParityKey}'s domain and never needs to.
 */
export interface RevealPresentation {
  readonly spinWheel: boolean;
  readonly animateFlip: boolean;
  readonly wheelSpinMs: number;
  readonly flipMs: number;
  readonly emphasis: 'static';
}

export function revealPresentation(preference: MotionPreference): RevealPresentation {
  const reduce = preference === 'reduce';
  return {
    spinWheel: !reduce,
    animateFlip: !reduce,
    wheelSpinMs: reduce ? 0 : WHEEL_SPIN_MS,
    flipMs: reduce ? 0 : FLIP_MS,
    emphasis: 'static',
  };
}

/** Total motion a viewer is subjected to per spin. ⛔ Exactly `0` under `reduce`, by both terms. */
export function motionBudgetMs(preference: MotionPreference): number {
  const p = revealPresentation(preference);
  return p.wheelSpinMs + p.flipMs;
}

/**
 * AC3, as a MEASUREMENT: the same view, presented under both preferences, states the same thing.
 *
 * ⚠⚠ READ WHY THIS IS NOT A TAUTOLOGY, BECAUSE IT LOOKS LIKE ONE. It passes today BY CONSTRUCTION —
 * `revealParityKey` takes the VIEW and the presentation cannot reach it — and that is precisely the
 * property AC3 wants, stated as a runnable check rather than as a paragraph. The day somebody adds a
 * motion parameter to the model (the obvious "optimisation": don't build the winner block until the
 * wheel lands), this stops compiling or stops passing, which is the only warning that edit would
 * ever get. The 6.9b lesson applies in the other direction too: a guard that cannot fail is
 * vacuous — so the suite ALSO feeds a deliberately motion-sensitive builder through this function
 * and asserts it comes back `false`.
 */
export function motionParity(view: RevealView, present: (v: RevealView, p: MotionPreference) => RevealView): boolean {
  const animated = revealParityKey(present(view, 'no-preference'));
  const reduced = revealParityKey(present(view, 'reduce'));
  return animated === reduced;
}
