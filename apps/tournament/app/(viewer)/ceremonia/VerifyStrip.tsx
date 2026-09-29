'use client';

import { useState } from 'react';
import { es } from '@/lib/i18n/es';
import { checkViewerText } from '@/lib/i18n/safe-text';
import { VERIFY_COPY } from '@/lib/i18n/verify-copy';
import { truncateHash } from '@/lib/feed/model';
import { verifyCeremony, type VerifyReport } from '@/lib/roulette/verify';
import styles from './ceremonia.module.css';

/**
 * `Verificar la ceremonia` — the verify strip's client island (Story 6.9b, AC6/AC7/AC9).
 *
 * ⭐ WHY THIS IS AN ISLAND AT ALL, RATHER THAN A SERVER COMPONENT. `crypto.subtle.digest` is ASYNC
 * and the whole verify path is therefore a Promise, so a React component cannot compute it at render
 * time — and, more to the point, the entire value of FR-27 is that the recomputation happens in the
 * SKEPTIC'S OWN BROWSER. A server-computed "verified ✓" would be the system vouching for itself,
 * which is exactly what a viewer with doubts has no reason to accept.
 *
 * ⭐ DECISION O — the bundle arrives as PROPS, already read server-side by
 * `lib/ceremony/verification.ts`. This component makes NO network request of any kind: no `fetch`,
 * no `.rpc()`, no realtime subscription. That is what makes the tap pure compute (AC13's 2 s budget
 * measures arithmetic, not a round-trip) and it is also AC6's "it must never request the un-served
 * keys" made structural — there is no client through which it could.
 *
 * ⛔ NO INLINE SPANISH. Every word resolves through `es.verify` (AD-24, `es.ts:6-8` admits no
 * exception) — including `SHA-256`, which is a string in the i18n module and not a literal here.
 * `lib/roulette/verify.ts` returns typed MACHINE outcomes precisely so this file can be the only
 * place the two vocabularies meet.
 *
 * ⭐ STORY 6.10 — THE STRIP IS NOW THE THIRD CELL OF THE REVEAL'S STAGE GRID, and it is handed in as
 * a CHILD by `page.tsx` rather than imported by `CeremonyReveal`. That is AC2 made structural: the
 * k=0 gate lives in one place, so no component below can mount a verify affordance on a surface with
 * nothing to verify. ⚠ Its own `aria-live` region is a LEAF beside the reveal's, never nested inside
 * it (AC10) — two live regions on one screen must be siblings or neither announces predictably.
 *
 * ⭐ UX-DR32 (reduced motion — CRITICAL) IS DISPOSED OF EXPLICITLY RATHER THAN LEFT LOOKING
 * UNADDRESSED: this affordance STILL has NO MOTION TO REDUCE. There is no transition and no
 * animation in `ceremonia.module.css`, and 6.10's layout gave it none — the button swaps its label
 * and a live region gains text. ⚠ THE SENTENCE THAT USED TO SAY *"the rule binds 6.10's wheel and
 * flip"* IS NOW SPENT: it does, and the binding shipped — `reveal.module.css`'s single
 * `@media (prefers-reduced-motion: reduce)` block is the whole implementation. Here the rule is
 * satisfied by construction, which is a different thing from being ignored.
 *
 * ⚠ AC10 also raised the button to a ≥44 px tap target; as 6.9b shipped it, it was 37 px.
 *
 * ⛔ NO IN-APP DISPUTE AFFORDANCE (`SPEC.md:87`, EXPERIENCE.md:71). A disagreement is resolved with
 * this evidence, in Discord. That is a designed non-feature, not an omission.
 */

export interface VerifyStripProps {
  /** `ceremony_state === 'complete'` — the one moment the hash can be bound. */
  readonly complete: boolean;
  readonly bundleSha256: string;
  /** The served projection, verbatim. ⛔ Typed `unknown`: `verify.ts` owns the parse. */
  readonly bundle: unknown;
  /** DECISION P — cross-checked against `bundle.seed_hex`; absent when the column is NULL. */
  readonly seedDemoSha256?: string;
}

export function VerifyStrip({ complete, bundleSha256, bundle, seedDemoSha256 }: VerifyStripProps) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<VerifyReport | null>(null);

  async function onVerify() {
    // ⭐ 6.9b CODE REVIEW — RE-ENTRY IS GUARDED HERE, NOT BY `disabled`. The button stays focusable
    // so a keyboard user is not thrown to `<body>` mid-verify (see the button below); this is what
    // `disabled` used to be doing for correctness, kept, without the focus cost.
    if (busy) return;
    setBusy(true);
    setReport(null);
    try {
      // ⚠ `verifyCeremony` NEVER REJECTS. Its own `catch` converts every engine refusal into a typed
      // `mismatched` report, so there is no error path to render here — and a `.catch` that invented
      // one would be a second, untested refusal surface beside the closed set.
      setReport(
        await verifyCeremony({
          complete,
          bundleSha256,
          bundle,
          ...(seedDemoSha256 === undefined ? {} : { seedDemoSha256 }),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  const announced = report === null ? '' : VERIFY_COPY[report.outcome];

  return (
    <section className={styles.strip} aria-label={es.verify.landmark}>
      {/*
        ⚠ ALWAYS RENDERED, EMPTY WHEN IDLE, AND THE FIRST CHILD. A live region that is inserted at
        the moment it gains content is not announced by most screen readers — the region has to exist
        before the text arrives for the change to be a change.
      */}
      <div className={styles.srOnly} aria-live="polite" role="status">
        {announced}
      </div>

      <div className={styles.head}>
        <span className={styles.shield} aria-hidden="true">
          ◈
        </span>
        {/* ⛔ REUSED, NEVER RETYPED — es.ts:71 carries `// FIXED — do not paraphrase`. */}
        <span className={styles.provenance}>{es.ceremony.seededByDemo}</span>
      </div>

      {/*
        The published commitment. `truncateHash` is `@/lib/feed/model`'s — browser-safe (that module
        carries no `server-only`) and ⛔ there is not a second one.

        ⚠ `safeViewerText` RUNS OVER THE HASH, and this is the one place in 6.9b's own surface where
        `deferred-work.md:265`'s reject-list is load-bearing rather than defensive: a bidi override
        (U+202A-202E / U+2066-2069) inside a string can VISUALLY REVERSE it, so a hash that reads
        correctly to a human could be a different hash entirely.

        ⭐⭐ 6.9b CODE REVIEW — TWO FIXES, AND THE FIRST ONE MATTERED MORE THAN THE COMMENT DID.
        (1) THE GUARD NOW RUNS BEFORE `truncateHash`, NOT AFTER. Truncating first meant the guard
            only ever inspected the 13 rendered characters, so an override past byte 8 was discarded
            before it could be seen — which made the "load-bearing" claim above overstated. It is
            true now.
        (2) THE LABEL IS SUPPRESSED AS A UNIT. The fallback used to be substituted for the HASH
            ONLY, so a refused digest rendered `SHA-256 Todavía no hay nada publicado que
            verificar.` — a label glued to an unrelated sentence, in tabular numerals, asserting
            nothing is published on a page that only reaches this branch because something IS. When
            the hash cannot be shown there is no commitment to label, so neither is rendered.

        The `num` class is GLOBAL (globals.css:72) and is applied as a bare string beside the module
        class — tabular lining numerals, which DESIGN.md:236 names for exactly this value.
      */}
      {checkViewerText(bundleSha256).ok ? (
        <span className={`${styles.hash} num`}>
          {es.verify.hashLabel} {truncateHash(bundleSha256)}
        </span>
      ) : (
        <span className={styles.hash}>{es.verify.unavailable}</span>
      )}

      {/*
        ⭐ 6.9b CODE REVIEW — `aria-busy`, AND THE BUTTON STAYS FOCUSABLE. `disabled={busy}` alone
        drops keyboard focus for the whole verify: Chrome and Edge move focus to `<body>` when the
        focused element becomes disabled, so a keyboard or screen-reader user who activated the
        button was returned to the top of the document and left there when `busy` cleared. The
        button now guards re-entry in the handler instead of by going disabled, so focus never
        leaves it, and `aria-busy` announces the in-flight state that `disabled` used to imply.
      */}
      <button
        type="button"
        className={styles.button}
        onClick={() => void onVerify()}
        aria-busy={busy}
        aria-disabled={busy}
      >
        {busy ? es.verify.busy : es.verify.button}
      </button>

      {report !== null && <p className={styles.result}>{VERIFY_COPY[report.outcome]}</p>}

      {/*
        AC6 — the honest limitation, stated in the UI. ⚠ It is shown BEFORE the tap as well as after,
        because a viewer deciding whether to trust a mid-ceremony check needs it then, not once the
        answer is already on screen. It disappears at `complete`, where it stops being true.
      */}
      {!complete && <p className={styles.limit}>{es.verify.midCeremonyLimit}</p>}
    </section>
  );
}
