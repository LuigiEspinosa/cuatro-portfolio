import { es } from './es';
import type { VerifyOutcome } from '@/lib/roulette/verify';

/**
 * The one place the verifier's MACHINE vocabulary meets Spanish (Story 6.9b, AC7).
 *
 * ⭐ WHY THIS IS A `lib/` MODULE RATHER THAN A CONSTANT INSIDE `VerifyStrip.tsx`. DECISION Q keeps
 * `lib/roulette/verify.ts` free of Spanish — the third-party import ban (`prng.test.ts:716-721`)
 * asserts every specifier `startsWith('.')`, so an aliased `@/lib/i18n/es` there reddens the ban —
 * and AD-24 keeps every viewer-facing word in `es.ts`. Something has to join them, and if that
 * something lives under `app/` it is UNTESTABLE: `vitest.config.ts:17` restricts collection to test
 * files under `lib`, so a `.test.tsx` beside the island would be doubly invisible (no jsdom, no
 * collection). Here the exhaustiveness below is a gated assertion instead of a live-QA hope.
 *
 * ⚠ That sentence is deliberately not written as the glob itself: a `*` followed by a `/` inside a
 * block comment CLOSES it, and the first draft of this file did exactly that — the module stopped
 * parsing mid-sentence and every suite importing it failed with a syntax error rather than an
 * assertion.
 *
 * ⛔ IT IS A TOTAL MAP OVER `VerifyOutcome`, NOT A LOOKUP WITH A FALLBACK. `Record<VerifyOutcome,
 * string>` makes a new outcome a COMPILE error; a fallback would render an unknown verdict as
 * whichever string happened to be the default, which for a verification affordance means showing a
 * viewer a pass or a failure that the verifier never concluded.
 */
export const VERIFY_COPY: Readonly<Record<VerifyOutcome, string>> = {
  matched: es.verify.matched,
  mismatched: es.verify.mismatched,
  unsupported_algo_version: es.verify.unsupportedVersion,
  not_yet_revealed: es.verify.notYetRevealed,
  web_crypto_unavailable: es.verify.webCryptoUnavailable,
};
