import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The viewer's read of the published verification bundle (Story 6.9b, AC5/AC6 — FR-27 / AD-22).
 *
 * ⭐ DECISION O (contexting, confirmed by Cuatro 2026-08-10) — **THE PAGE READS SERVER-SIDE; THE
 * BROWSER DOES THE CRYPTO.** `/ceremonia` stays a Server Component, resolves the ceremony through the
 * anon client, calls `verification_bundle_read` from here, and passes the envelope as props into a
 * `'use client'` island that owns the button. Three reasons, in order of weight: there is NO browser
 * `.rpc()` anywhere in this tree (measured: zero `.rpc(` under `app/`), the house rule for every
 * viewer read is `createSupabaseServerClient()`, and a server read makes the tapped verification PURE
 * COMPUTE — which is what AC13's 2 s budget should be measuring, not a network round-trip.
 * ⚠ The cost is real and is MEASURED rather than assumed: the served bundle rides down in the RSC
 * payload, so `/ceremonia` grows from 6.9a's measured 11,555 B to that plus the served document.
 *
 * ⚠ ANON CLIENT ONLY (`createSupabaseServerClient()`), NEVER `getAdminClient()` — the same rule
 * `lib/awards/read.ts:19-20` states for the award count. `verification_bundle_read` is
 * `security definer` PRECISELY because anon holds no grant on `verification_bundle.payload`; calling
 * it with the service key would work, and would be the exact hole the reveal gate exists to keep shut.
 *
 * ⛔ THIS FILE MUST NOT WIDEN THE PROJECTION. It passes ONE argument and returns what the RPC gives
 * it. `0029:1391-1393` forbids adding a second parameter, and `0029:1638` says it in the function's
 * own comment: "⛔ IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22."
 *
 * ⚠ FAIL CLOSED. A transport error, a null reply, an unrecognised refusal or a malformed ok payload
 * all become `read_failed` — never a partially-trusted envelope. The verifier's whole value is that
 * it refuses rather than guesses, and a reader that shrugged would defeat it one layer earlier.
 */

/**
 * Every reason `verification_bundle_read` can RETURN — a TWO-MEMBER closed set (`0029:1466`, `:1477`)
 * and the SINGLE SOURCE of the refusal union below.
 *
 * ⭐⭐ THE `as const` AND THE DERIVED TYPE ARE LOAD-BEARING — the 6.8b code-review lesson, applied
 * here rather than rediscovered. `reveal.ts:69-79` records what a `new Set([...])` inferring
 * `Set<string>` plus a bare `as` cast cost: a seventh SQL reason was forced into the set, nothing
 * forced it into the union, and a typed business refusal shipped as an opaque 500. Deriving the union
 * FROM the set makes that impossible.
 *
 * ⚠ `not_published` DELIBERATELY CONFLATES "no row" WITH "staged but unpublished" (`0029:1474-1476`):
 * distinguishing them would publish the fact that an admin has staged a bundle, which is a fact about
 * an unrevealed ceremony. ⛔ Do not split it here to make an error message friendlier.
 * ⛔ Do not add an inline quoted token to a comment in this block — the cross-check in
 * `verification.test.ts` strips comment LINES, but a trailing comment on a value line reads as data.
 */
const BUNDLE_READ_REASONS = new Set([
  'no_ceremony',
  'not_published',
] as const);

/**
 * The refusals the SQL returns (derived, never hand-copied), plus the lib's own fail-closed reason.
 * - no_ceremony — no ceremony with that id
 * - not_published — no published bundle for it (or one staged and not yet published — see above)
 * - read_failed — the lib's OWN reason: a transport error, a null reply, an unrecognised refusal or a
 *   malformed ok payload. Never returned by the SQL, and `verification.test.ts` asserts that in both
 *   directions.
 */
type BundleReadRefusal = (typeof BUNDLE_READ_REASONS extends ReadonlySet<infer R> ? R : never) | 'read_failed';

/**
 * Membership test that NARROWS. The widening cast is on the SET, not on the value — safe, because
 * `ReadonlySet<string>.has` only reads — so the reason that flows out is narrowed by real membership
 * rather than by an unchecked assertion on an untrusted string.
 */
const isBundleReadRefusal = (v: string): v is Exclude<BundleReadRefusal, 'read_failed'> =>
  (BUNDLE_READ_REASONS as ReadonlySet<string>).has(v);

/**
 * The success preface, served at every `k` INCLUDING 0 (`0029:1488-1501`).
 *
 * ⚠ `bundle` IS PART OF THE PREFACE AT EVERY `k` TOO, and its SHAPE is the release schedule: the full
 * document at `complete`, and `{algo_version, seed_hex, luck, players, spin_plan, awards}` plus `pity`
 * only-if-a-consolation-is-revealed before that. ⛔ It is carried as `unknown` deliberately —
 * `lib/roulette/verify.ts` owns the parse, and a second shape declaration here would be a second place
 * for the reader and the verifier to drift apart.
 */
export interface VerificationEnvelope {
  readonly ceremonyId: number;
  readonly ceremonyState: string;
  readonly bundleSha256: string;
  readonly publishedAt: string;
  /** NULL until the full document is released — the projection carries it as JSON `null`. */
  readonly releasedAt: string | null;
  readonly complete: boolean;
  readonly revealedSpins: number;
  readonly totalSpins: number;
  readonly bundle: unknown;
}

export type VerificationBundleResult =
  | { ok: true; envelope: VerificationEnvelope }
  | { ok: false; reason: BundleReadRefusal };

/** The RPC's reply, before any of it is trusted. */
interface RpcResult {
  ok?: unknown;
  reason?: unknown;
  ceremony_id?: unknown;
  ceremony_state?: unknown;
  bundle_sha256?: unknown;
  published_at?: unknown;
  released_at?: unknown;
  complete?: unknown;
  revealed_spins?: unknown;
  total_spins?: unknown;
  bundle?: unknown;
}

/**
 * Read the reveal-gated projection of ceremony `ceremonyId`'s published bundle.
 *
 * ⛔ ONE ARGUMENT. `p_ceremony_id` is the whole signature and `0029:1391-1393` forbids a second.
 */
export async function fetchVerificationBundle(
  client: SupabaseClient,
  ceremonyId: number,
): Promise<VerificationBundleResult> {
  const { data, error } = await client.rpc('verification_bundle_read', { p_ceremony_id: ceremonyId });

  if (error) {
    console.error('[fetchVerificationBundle] verification_bundle_read failed:', error.message);
    return { ok: false, reason: 'read_failed' };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    console.error('[fetchVerificationBundle] verification_bundle_read returned a non-object:', data);
    return { ok: false, reason: 'read_failed' };
  }

  const result = data as RpcResult;

  if (result.ok !== true) {
    const reason = typeof result.reason === 'string' ? result.reason : '';
    if (isBundleReadRefusal(reason)) return { ok: false, reason };
    console.error('[fetchVerificationBundle] unrecognised refusal:', result.reason);
    return { ok: false, reason: 'read_failed' };
  }

  // ⛔⛔ VALIDATE THE OK-PAYLOAD'S SHAPE BEFORE TRUSTING IT — the 4.1 review lesson, re-applied at
  // 6.1, 6.2, 6.8b and `lib/ceremony/bundle.ts:189-206`. It matters MORE here than anywhere it has
  // been applied before: `bundleSha256` is the value a viewer hashes against for the life of the
  // tournament, so a "successful" read that returned an `undefined` hash would hand the island
  // nothing to compare with — and the strip would render a verification that checked nothing while
  // looking exactly like one that checked everything.
  // ⭐ 6.9b CODE REVIEW — THREE OF THESE CHECKS WERE WEAKER THAN THE REST OF THE TREE.
  // (1) `bundle` was the ONE field that got no type check at all — only `!== undefined && !== null` —
  //     so a `payload` that was a JSON scalar or array passed, the strip rendered a real-looking
  //     commitment, and the tap came back `bundle_shape` → *"No coincide"*: the viewer told the
  //     ceremony does not match ITSELF, where this reader's own fail-closed doctrine wants
  //     `read_failed` and the Placeholder. A bundle is a JSON OBJECT; anything else is a bad read.
  // (2) `bundle_sha256` was only checked non-empty. It is the value a viewer hashes against for the
  //     life of the tournament, and `verify.ts` compares it with `===` against a lowercase hex
  //     digest — so anything that is not 64 lowercase hex can only ever produce a FALSE mismatch.
  // (3) The three numerics accepted `NaN`, `Infinity`, fractions and negatives, where the engine
  //     uses `Number.isSafeInteger` throughout.
  // ⚠ THE `typeof` CHECKS ARE WRITTEN OUT RATHER THAN FACTORED INTO A HELPER, DELIBERATELY. A
  // `(v: unknown) => boolean` predicate does not NARROW, so the envelope build below stops
  // type-checking — and `npm test` would never have told us (there is no typecheck script; only
  // `npm run build` type-checks). Measured at the 6.9b code review, by the build failing.
  const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
  if (
    typeof result.ceremony_id !== 'number' ||
    !Number.isSafeInteger(result.ceremony_id) ||
    result.ceremony_id < 0 ||
    typeof result.ceremony_state !== 'string' ||
    typeof result.bundle_sha256 !== 'string' ||
    !SHA256_HEX_RE.test(result.bundle_sha256) ||
    typeof result.published_at !== 'string' ||
    typeof result.complete !== 'boolean' ||
    typeof result.revealed_spins !== 'number' ||
    !Number.isSafeInteger(result.revealed_spins) ||
    result.revealed_spins < 0 ||
    typeof result.total_spins !== 'number' ||
    !Number.isSafeInteger(result.total_spins) ||
    result.total_spins < 0 ||
    result.bundle === undefined ||
    result.bundle === null ||
    typeof result.bundle !== 'object' ||
    Array.isArray(result.bundle)
  ) {
    console.error('[fetchVerificationBundle] ok reply missing a usable field:', result);
    return { ok: false, reason: 'read_failed' };
  }
  // ⚠ `released_at` is the ONE nullable field and is NOT folded into the block above: it is NULL for
  // every ceremony that has not completed, which is the NORMAL mid-ceremony state. Requiring a string
  // would fail-close the whole read on the state the strip exists to render.
  if (result.released_at !== null && typeof result.released_at !== 'string') {
    console.error('[fetchVerificationBundle] released_at is neither a timestamp nor null:', result.released_at);
    return { ok: false, reason: 'read_failed' };
  }
  // ⚠ CROSS-CHECKED RATHER THAN TAKEN FROM WHICHEVER FIELD IS NEARER. `complete` and
  // `ceremony_state` are two spellings of one fact (`0029:1498`), so a disagreement means the
  // projection is not the projection this file was written against — fail closed rather than pick one.
  if (result.complete !== (result.ceremony_state === 'complete')) {
    console.error('[fetchVerificationBundle] complete disagrees with ceremony_state:', result);
    return { ok: false, reason: 'read_failed' };
  }

  return {
    ok: true,
    envelope: {
      ceremonyId: result.ceremony_id,
      ceremonyState: result.ceremony_state,
      bundleSha256: result.bundle_sha256,
      publishedAt: result.published_at,
      releasedAt: result.released_at,
      complete: result.complete,
      revealedSpins: result.revealed_spins,
      totalSpins: result.total_spins,
      bundle: result.bundle,
    },
  };
}

/** The ceremony row a viewer may see, in the four columns `0028:501` grants anon. */
export interface ViewerCeremony {
  readonly id: number;
  readonly state: string;
  /**
   * DECISION P — the published seed, under the contract name `seed_hex`.
   *
   * ⭐ IT IS CROSS-CHECKED AGAINST THE BUNDLE BECAUSE IT CAN BE. 6.9a's DECISION B release-schedule
   * row 1 promises a viewer can check that "`seed_hex` matches `ceremony.seed_demo_sha256`", and it
   * costs one column on a read the page is already making. ⛔ Read from HERE and never from
   * `tournament.fair_seed`, whose IC908 trigger was deliberately loosened to permit value -> NULL so
   * `rollback_match` can un-crown (`0028:495-500`).
   */
  readonly seedDemoSha256: string | null;
}

export type ViewerCeremonyResult =
  | { ok: true; ceremony: ViewerCeremony }
  | { ok: false; reason: 'no_ceremony' | 'read_failed' };

/**
 * Resolve the tournament's ceremony through the anon column grant.
 *
 * ⛔⛔ THE COLUMNS ARE NAMED EXPLICITLY AND THAT IS NOT TIDINESS. `0028:485-490` states it: PostgREST's
 * default `select=*` asks for EVERY column, so an anon request for `ceremony` 42501s on the four
 * ungranted ones (`snapshot_id`, `spin_plan`, `luck_weight_table`, `algorithm_version`) even though the
 * ROW is visible — and `spin_plan` alone names each spin's candidate award POOL, which IS the
 * "per-spin live-category sets" AD-22 gates by name. ⛔ Do not "fix" a 42501 here by widening the
 * grant; add the column to `0028`'s list with the story that publishes it.
 *
 * ⚠ `ceremony_viewer_read` hides a `not_started` ceremony, so an unstarted one reads as `no_ceremony`
 * from a viewer's seat. That is the gate working: before the ceremony starts there is nothing to
 * verify and nothing to say about it.
 */
export async function fetchViewerCeremony(
  client: SupabaseClient,
  tournamentId: number,
): Promise<ViewerCeremonyResult> {
  const { data, error } = await client
    .from('ceremony')
    .select('id, state, seed_demo_sha256')
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  if (error) {
    console.error('[fetchViewerCeremony] ceremony read failed:', error.message);
    return { ok: false, reason: 'read_failed' };
  }
  if (data === null) return { ok: false, reason: 'no_ceremony' };

  const row = data as { id?: unknown; state?: unknown; seed_demo_sha256?: unknown };
  if (typeof row.id !== 'number' || typeof row.state !== 'string') {
    console.error('[fetchViewerCeremony] ceremony row missing a usable field:', data);
    return { ok: false, reason: 'read_failed' };
  }
  // ⚠ NULL IS LEGAL AND IS NOT A FAILURE: `seed_demo_sha256` is filled by `lock_ceremony`, so a
  // ceremony that has left `not_started` always carries one — but the column is nullable and
  // `assert_ceremony_transition` only makes it write-once ONCE NON-NULL. A null here means DECISION
  // P's cross-check has nothing to compare, which is stated to the verifier by omission rather than
  // by substituting a value.
  if (row.seed_demo_sha256 !== null && typeof row.seed_demo_sha256 !== 'string') {
    console.error('[fetchViewerCeremony] seed_demo_sha256 is neither text nor null:', row.seed_demo_sha256);
    return { ok: false, reason: 'read_failed' };
  }

  return { ok: true, ceremony: { id: row.id, state: row.state, seedDemoSha256: row.seed_demo_sha256 } };
}
