/**
 * Roulette domain-separation labels — the browser VERIFIER's mirror of `worker/awards/labels.go`
 * (Story 6.3, FR-25 / AD-14).
 *
 * ⛔ THIS MODULE DELIBERATELY HAS NO `import 'server-only'`. Every other module under `lib/**` is
 * server-only; `lib/roulette` is the first one that is not, because it is the FIRST
 * client-reachable module in `lib/` — 6.9's "Verificar la ceremonia" button pulls it into the
 * browser bundle, and `server-only` throws there. Adding the import out of habit would not fail
 * here; it would fail in someone else's story. `prng.test.ts` pins its absence by scanning this
 * file's source text (the Vitest alias stubs `server-only`, so an import-based test cannot tell
 * the difference).
 *
 * THE SEAM (ARCHITECTURE-SPINE.md:73-76). This module conforms to `roulette/vectors/`, never to
 * `worker/awards`. They are two independent implementations of one spec; neither is the
 * reference and neither may be corrected by reading the other's source.
 */

/** The versioned namespace shared by every stream. Bumping "v1" invalidates every ceremony. */
const LABEL_PREFIX = 'inclusivcup/v1';

/**
 * The single pity stream. Story 6.3 defines the LABEL only — the pity ALGORITHM (**FR-28**'s pity
 * roulette) is Story 6.7's, in {@link ./pity}.
 *
 * ⚠ THIS SIDE NAMED NO FR AT ALL UNTIL STORY 6.7, while Go's mirror named the WRONG one (`FR-26`,
 * which is anti-sweep plus the luck meter). Both now say FR-28, so the two halves of the seam make
 * the same claim about the same constant — the asymmetry was measured at 6.7's contexting, along
 * with the fact that `FR-28` appeared ZERO times anywhere in the seam before this comment.
 *
 * ⛔ THE VALUE IS FROZEN. It is the HMAC message prefix for every consolation draw ever published;
 * moving one byte of it keys a different stream and invalidates every ceremony. Only the trace
 * above changed.
 */
export const PITY_LABEL = `${LABEL_PREFIX}/pity`;

/**
 * The domain separator for Stage-1 spin S.
 *
 * `spin` is 1-BASED and formatted as plain decimal with NO padding: 1 -> ".../spin/1",
 * 12 -> ".../spin/12". `String(spin)` — never `toLocaleString()`, which inserts a thousands
 * separator in most locales (`"1,000"`) and would key a different stream on a different machine.
 *
 * A non-integer or non-positive spin is a programmer error, not a business refusal: it throws
 * rather than producing a label that would silently key a valid-looking but wrong stream.
 *
 * ⭐ The UPPER bound is not decoration. `Number.isInteger(1e21)` is `true`, and `String(1e21)` is
 * `"1e+21"` — so without it this returns `".../spin/1e+21"`, scientific notation, which is exactly
 * the formatting divergence the paragraph above spends five lines guarding against. Go's
 * `strconv.Itoa` on an `int` never does that. Measured at the 6.3 code review.
 */
export function stage1Label(spin: number): string {
  if (!Number.isInteger(spin) || spin < 1 || spin > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(
      `roulette: stage1 spin must be an integer in [1, ${Number.MAX_SAFE_INTEGER}] (1-based), got ${String(spin)}`,
    );
  }
  return `${LABEL_PREFIX}/stage1/spin/${String(spin)}`;
}
