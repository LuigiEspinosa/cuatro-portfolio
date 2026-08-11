/**
 * The browser CEREMONY ORCHESTRATOR — Story 6.9b, AC5 / AC6 / AC8 / AC9 (FR-27 / FR-30 / AD-22).
 *
 * `worker/awards/ceremony.go:19-26` states the gap in the producer's own file: the orchestrator was
 * "GO ONLY, AND THE ABSENCE OF A TYPESCRIPT MIRROR IS DELIBERATE … a verifier needs an orchestrator
 * only once it has a published bundle to verify against". Story 6.9a published the bundle. This is
 * the mirror.
 *
 *   verifyCeremony(envelope):
 *       WebCrypto present?                        -> else a TYPED refusal (AC9)          V1
 *       U+0000 anywhere in the document?          -> refuse: outside the alphabet        V2
 *       algo_version parses AND its MAJOR is ours -> else a TYPED refusal (AC8)          V3
 *       seed_hex === ceremony.seed_demo_sha256    -> else refuse (DECISION P)            V4
 *       seed = decodeSeedHex(seed_hex)
 *       for each REVEALED main spin, in ascending spin order:
 *           complete? stream = createStream(seed, stage1Label(S))                        V5
 *                     stage1Pick(stream, …) -> compare live/weights/total/draws/bytes
 *           always:   resolveSpin(live, players, fr29Ladder) -> compare every outcome    V6
 *                     shelf += SpinResult.assigned
 *       complete? stream = createStream(seed, PITY_LABEL); resolvePity(…) -> compare     V7
 *       complete? canonicalSha256Hex(canonicalize(bundle, ascii)) === bundle_sha256      V8
 *
 * ⛔⛔ THE SPINS ARE AWAITED SEQUENTIALLY, AND THE REASON IS NOT THE ONE IT LOOKS LIKE. W10
 * (`stage1.ts:32-40`) is about overlapping reads on ONE stream, and this module opens a FRESH stream
 * per spin — so `Promise.all` over the spins would NOT trip `prng.ts:239-244`'s reentrancy throw.
 * What it breaks is SHELF THREADING: spin N's weights are indexed by the shelf accumulated from
 * spins 1..N-1, so running the spins concurrently weighs every one of them against an incomplete
 * shelf. The divergence surfaces as a different drawn order and different `weights` — never as a
 * thrown error and never as a different `bytes_consumed`, because each spin's stream is independent
 * and consumes the same bytes either way. That is precisely the "browser declares a correctly
 * produced ceremony unfair" failure W10 names, reached by a second route. The loop below is a plain
 * sequential `for` for exactly that reason.
 *
 * ⭐ THE SHELF IS THIS MODULE'S JOB AND NOTHING ELSE'S. `resolveSpin` neither reads nor writes it
 * (A10 — there is no parameter to read it with) and `resolvePity` only reads it (P6). Nothing in
 * `lib/roulette` accumulates it, and nothing will catch this file doing it wrongly except the
 * comparison against the published document.
 *
 * ⚠ `bytes_consumed` IS REPRODUCED, NEVER RE-DERIVED. Every byte count below is compared against
 * `stream.consumed` after the real draw; there is no formula anywhere in this file that predicts
 * one. A verifier that computed the expected count would agree with itself rather than with the
 * producer.
 *
 * ⛔ NO `import 'server-only'` — see the note in `labels.ts`. This is the module that finally makes
 * that ban load-bearing in FACT rather than in principle: `Verificar la ceremonia` pulls this file,
 * and therefore the whole package, into the client bundle.
 *
 * ⛔ NO SPANISH AND NO REACT IN THIS FILE (DECISION Q). The third-party import ban
 * (`prng.test.ts:716-721`) asserts every specifier `startsWith('.')`, so this module cannot import
 * `@/lib/i18n/es` even if it wanted to. It returns typed MACHINE reasons; the `'use client'` island
 * maps them to `es.verify.*`. That is a hard constraint, not a style preference.
 *
 * THE SEAM (ARCHITECTURE-SPINE.md:73-76). This module conforms to the published document and to
 * `roulette/vectors/`, never to `worker/ceremony/bundle.go`. Where they disagree the vector decides.
 *
 * ⛔ NOT IN THIS FILE, each with an owner: the wheel and the reveal choreography (6.10), the
 * shared-screen mirror (6.10), the end-to-end vector and `--check` automation (6.11), and the SQL
 * half of `deferred-work.md:378` (re-recorded against Epic 7 — no AC here authorises a migration).
 */

import { canonicalSha256Hex, canonicalize } from './canonical';
import { fr29Ladder } from './ladder';
import { PITY_LABEL, stage1Label } from './labels';
import { resolvePity } from './pity';
import { createStream, decodeSeedHex } from './prng';
import { stage1Pick } from './stage1';
import type { Stage1Candidate } from './stage1';
import { resolveSpin } from './sweep';
import type { Award, Outcome, RatePair, SnapshotPlayer, StatValue } from './stage2';

// ── AC8: the algorithm version, as a REAL exported constant ───────────────────
//
// ⚠ MEASURED AT 6.9a (`6-9a:963`): there was NO exported TypeScript constant for this. The value
// lived as `generate_vectors.py:90`, `worker/ceremony/bundle.go:534` (`BundleAlgoVersion`),
// `0029:779` (`c_algo_version`) and as asserted literals in both suites — four pins, none of them
// reachable from the verifier that has to compare against it. This is the fourth pin and the first
// one a browser can read.
//
// ⛔ DO NOT CONFLATE THE TWO VERSION AXES. `labels.ts`'s `inclusivcup/v1` prefix is DOMAIN
// SEPARATION — it keys the HMAC, and moving one byte of it invalidates every ceremony ever
// published. This is the ALGORITHM's version and it keys nothing; it declares which rules produced
// the document. `6-3:192` stands: no `algo_version` logic in `prng.ts`.

/** The `algo_version` this verifier implements, verbatim. */
export const ALGO_VERSION = 'inclusivcup-roulette-1.0.0';

/** The algorithm's NAME half — everything before the `-<major>.<minor>.<patch>` suffix. */
export const ALGO_NAME = 'inclusivcup-roulette';

/**
 * The MAJOR this verifier implements.
 *
 * ⭐ MAJOR IS THE ONLY AXIS THAT REFUSES. A MAJOR bump is "a deliberate, ceremony-invalidating act,
 * not a refactor" (`labels.go:34-35`), so an unknown MAJOR means the rules below are the wrong rules
 * and a "verification" would be a guess wearing a checkmark. MINOR and PATCH are accepted at any
 * value: they are, by that same definition, changes that do not alter what this file re-derives.
 */
export const ALGO_MAJOR = 1;

/** `<name>-<major>.<minor>.<patch>`. The name half may contain hyphens; ours does. */
const ALGO_VERSION_RE = /^([a-z0-9][a-z0-9-]*)-([0-9]+)\.([0-9]+)\.([0-9]+)$/;

/** A parsed `algo_version`, or the typed reason it could not be one. */
export type AlgoVersionParse =
  | {
      readonly ok: true;
      readonly name: string;
      readonly major: number;
      readonly minor: number;
      readonly patch: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'algo_version_unparseable'
        | 'algo_version_unknown_name'
        | 'algo_version_unsupported_major';
    };

/**
 * AC8 — parse `<name>-<major>.<minor>.<patch>` and compare against {@link ALGO_VERSION}.
 *
 * Three distinct refusals rather than one, because they mean different things to a viewer: an
 * unparseable string is a malformed document, an unknown NAME is somebody else's algorithm, and an
 * unsupported MAJOR is OUR algorithm at rules this build does not implement. Only the third is
 * something a newer browser build would fix.
 */
export function parseAlgoVersion(raw: unknown): AlgoVersionParse {
  if (typeof raw !== 'string') return { ok: false, reason: 'algo_version_unparseable' };
  const m = ALGO_VERSION_RE.exec(raw);
  if (m === null) return { ok: false, reason: 'algo_version_unparseable' };
  const name = m[1] as string;
  // Digits only by the regex above, so `Number` is exact and total here. ⛔ Never `parseInt`, which
  // is banned in this package: it accepts leading whitespace and stops at the first invalid
  // character, so it would happily read a MAJOR out of a string that is not a version at all.
  const major = Number(m[2]);
  const minor = Number(m[3]);
  const patch = Number(m[4]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return { ok: false, reason: 'algo_version_unparseable' };
  }
  if (name !== ALGO_NAME) return { ok: false, reason: 'algo_version_unknown_name' };
  if (major !== ALGO_MAJOR) return { ok: false, reason: 'algo_version_unsupported_major' };
  return { ok: true, name, major, minor, patch };
}

// ── the closed sets, as RUNTIME values (AC12) ─────────────────────────────────
//
// ⛔ EXPORTED AS `as const` ARRAYS SO THE SUITE CAN READ ITS EVIDENCE. `canonical.test.ts:213`
// records what this project has now shipped eight times: an assertion whose "expected" is a literal
// array typed out beside it, which passes for whatever the source happens to say. A compile-time
// union erases at runtime and proves nothing either — `canonical.ts:66-77` measured exactly that
// failure in the test that was supposed to pin `CanonicalRefusal`. These arrays are what the suite
// compares runtime-against-runtime.

/**
 * The five verification OUTCOMES — one per Spanish string in `es.verify` (AC7).
 *
 * ⚠ `not_yet_revealed` IS NEITHER A FAILURE NOR A FULL SUCCESS. It means "every revealed outcome
 * re-derived and matched, and the parts that need the whole document have not been checked because
 * the whole document does not exist yet". See {@link verifyCeremony}'s DECISION R.
 */
export const VERIFY_OUTCOMES = [
  'matched',
  'mismatched',
  'unsupported_algo_version',
  'not_yet_revealed',
  'web_crypto_unavailable',
] as const;

export type VerifyOutcome = (typeof VERIFY_OUTCOMES)[number];

/**
 * Every machine-readable reason a verification can stop short.
 *
 * ⛔ {@link REASON_OUTCOME} is asserted to cover this array EXACTLY, so a reason added here without
 * an outcome mapping reddens rather than silently defaulting to `mismatched`.
 */
export const VERIFY_REASONS = [
  // environmental — AC9 / `deferred-work.md:289`
  'web_crypto_unavailable',
  // the envelope and the document
  'envelope_shape',
  'bundle_absent',
  'bundle_shape',
  // AC8
  'algo_version_unparseable',
  'algo_version_unknown_name',
  'algo_version_unsupported_major',
  // the alphabet decision — `deferred-work.md:378`
  'nul_in_document',
  // ⭐ 6.9b CODE REVIEW: A DEPTH BOUND IS NOT AN ALPHABET VIOLATION. `containsNul` used to share its
  // sentinel with the NUL path, so an over-deep document was refused as "contains U+0000" — a cause
  // that is not present, on the one code path whose whole purpose is naming causes precisely.
  'document_depth',
  // DECISION P
  'seed_mismatch',
  // the engine refused an input the document handed it
  'engine_refused',
  // genuine divergences between the published document and the re-derivation
  'draw_divergence',
  'outcome_divergence',
  'pity_divergence',
  'bytes_divergence',
  'hash_divergence',
] as const;

export type VerifyReason = (typeof VERIFY_REASONS)[number];

/**
 * reason -> the outcome a viewer is shown.
 *
 * ⭐ A TABLE RATHER THAN A CHAIN OF `if`s, so "which of the five strings does this reason render as"
 * is data the suite can assert over the whole closed set instead of a control-flow shape it would
 * have to re-walk. Everything that is neither environmental nor a version refusal is a MISMATCH —
 * including a malformed envelope, because a document this verifier cannot parse is a document it
 * cannot vouch for, and "we could not read it" must never be shown as a pass.
 */
export const REASON_OUTCOME: Readonly<Record<VerifyReason, VerifyOutcome>> = {
  web_crypto_unavailable: 'web_crypto_unavailable',
  envelope_shape: 'mismatched',
  bundle_absent: 'mismatched',
  bundle_shape: 'mismatched',
  algo_version_unparseable: 'unsupported_algo_version',
  algo_version_unknown_name: 'unsupported_algo_version',
  algo_version_unsupported_major: 'unsupported_algo_version',
  nul_in_document: 'mismatched',
  document_depth: 'mismatched',
  seed_mismatch: 'mismatched',
  engine_refused: 'mismatched',
  draw_divergence: 'mismatched',
  outcome_divergence: 'mismatched',
  pity_divergence: 'mismatched',
  bytes_divergence: 'mismatched',
  hash_divergence: 'mismatched',
};

// ── the bundle's parse types, declared HERE ───────────────────────────────────
//
// ⚠ THERE IS NO TypeScript TYPE FOR THE BUNDLE ANYWHERE IN THIS TREE, and that is measured rather
// than assumed: the producer builds `map[string]any` on purpose (`bundle.go:539-542` — "deliberately
// NOT a struct with JSON tags", because `encoding/json` would decide key order, number formatting
// and omission, and all three belong to the canonicalizer), the RPC returns `jsonb`, and
// `lib/ceremony/bundle.ts` only ever carries the canonical STRING. So the shapes below are this
// file's own reading of the published document, and every field is re-validated at parse time
// rather than trusted from a cast.
//
// ⛔⛔ EVERY DECIMAL STRING BECOMES A `bigint` VIA `BigInt(s)`, NEVER `Number(s)`. `6-5b:587`
// measured what `Number`-parsing a magnitude does: both sides of a comparison read as 2^53, tie, and
// bottom the FR-29 ladder out at rung 5 — a plausible shared trophy from a document that named a
// single winner. The split is by PROVENANCE and not by size: `award_id`, every steamid64 and every
// `players` magnitude are STRINGS; `spin`, `bytes_consumed`, `weights[]`, the floors, `priority`,
// `tie_ladder_exit_step` and every `draws` field are JSON NUMBERS.

/** The four fields every `spin_plan` entry carries, main and pity alike. */
export interface BundleSpinCommon {
  readonly spin: number;
  readonly label: string;
  readonly bytesConsumed: number;
}

/** A main spin — the only kind that carries a Stage-1 pick. */
export interface BundleMainSpin extends BundleSpinCommon {
  readonly kind: 'main';
  readonly liveCount: number;
  readonly pool: readonly string[];
  readonly live: readonly string[];
  readonly weights: readonly number[];
  readonly totalWeight: number;
  readonly draws: readonly {
    readonly n: number;
    readonly r: number;
    readonly consumedAfter: number;
  }[];
}

/**
 * A consolation spin.
 *
 * ⚠ IT CARRIES ONLY THE FOUR COMMON FIELDS AND THAT IS NOT AN OMISSION: FR-28 draws the whole
 * consolation order from ONE stream, so there is no per-consolation-spin Stage-1 draw to publish
 * (`bundle.go:740-743`). Pity spin 13 carries `bytes_consumed: 27`; spins 14-40 carry `0`.
 */
export interface BundlePitySpin extends BundleSpinCommon {
  readonly kind: 'pity';
}

export type BundleSpin = BundleMainSpin | BundlePitySpin;

/** One `awards` entry — the frozen catalog metadata FLAT beside its result. */
export interface BundleAward {
  readonly awardId: string;
  readonly priority: number;
  readonly outcomeKind: string;
  readonly winners: readonly string[];
  readonly isShared: boolean;
  readonly isPity: boolean;
  /** ⭐ ABSENT, never `0` — DECISION J. The comparison is `undefined === undefined`. */
  readonly ladderExitStep?: number;
  readonly decidingValue?: string;
  readonly decidingNum?: string;
  readonly decidingDen?: string;
  /** The resolution projection the engine actually consumes. */
  readonly award: Award;
}

/** The `pity` block. Absent mid-ceremony until a consolation spin is revealed. */
export interface BundlePity {
  readonly label: string;
  readonly winless: readonly string[];
  readonly revealOrder: readonly string[];
  readonly draws: readonly {
    readonly n: number;
    readonly k: number;
    readonly rejections: number;
    readonly value: number;
  }[];
  /** ⚠ WITHHELD until every pity spin is revealed (`0029:1603-1605`) — absent is not zero. */
  readonly bytesConsumed?: number;
}

/** The parsed document. */
export interface ParsedBundle {
  readonly algoVersion: string;
  readonly seedHex: string;
  readonly weightTable: readonly number[];
  readonly spinPlan: readonly BundleSpin[];
  readonly awards: readonly BundleAward[];
  readonly players: readonly SnapshotPlayer[];
  readonly pity?: BundlePity;
}

/** What the verification concluded, and the evidence for it. */
export interface VerifyReport {
  readonly outcome: VerifyOutcome;
  /** Absent on `matched` and on `not_yet_revealed`; present on every other outcome. */
  readonly reason?: VerifyReason;
  /** A machine-readable English detail for a stack trace or a bug report. ⛔ NEVER rendered as copy. */
  readonly detail?: string;
  /** True only when the served document was re-canonicalized and matched `bundle_sha256`. */
  readonly hashBound: boolean;
  /** True when the full AC5 chain ran — Stage 1's draws included (`ceremony_state === 'complete'`). */
  readonly full: boolean;
  readonly mainSpinsChecked: number;
  readonly awardOutcomesChecked: number;
  readonly pityDrawsChecked: number;
  /**
   * The re-derived reveal (draw) order across every checked main spin, in spin order.
   *
   * ⭐ IT IS THE RE-DERIVED ONE, NOT A COPY OF `live`. AC5 pins the measured corpus's
   * `aw-04,aw-12,…` order, and pinning the published copy would assert that the document equals
   * itself.
   *
   * ⚠ 6.9b CODE REVIEW — THEREFORE IT IS EMPTY WHEN `full` IS FALSE, AND THAT IS THE POINT. It is
   * pushed from `stage1Pick`'s own `picked.live`, which only runs at `complete`; it used to be pushed
   * from the published `entry.live` after the branch, which made the mid-ceremony value a verbatim
   * copy of the document and the doc comment above false. ⛔ Read it together with `full`.
   */
  readonly drawOrder: readonly string[];
  /** `stream.consumed` per checked main spin, in spin order — REPRODUCED, never re-derived. */
  readonly mainBytes: readonly number[];
  /** `stream.consumed` after the consolation draw, when the full chain ran. */
  readonly pityBytes?: number;
}

/**
 * AC9 / `deferred-work.md:289` — is WebCrypto reachable at all?
 *
 * ⛔⛔ THE CHECK LIVES HERE, AT THE BUTTON'S ENTRY POINT, AND NOT INSIDE `prng.ts` OR `canonical.ts`.
 * 6.9a homed it here on purpose (`canonical.ts:383-386`: "it is 6.9b's, at the button, where there
 * is Spanish copy to refuse WITH"), and `prng.test.ts:909-914` asserts the literal substrings
 * `crypto.subtle.importKey` and `crypto.subtle.sign` still appear in `prng.ts` — so a guard added
 * there would be the wrong shape in the wrong file.
 *
 * ⚠ THE DEBT'S OWN LINE NUMBERS ARE STALE AND MISS THE SITE THAT MATTERS. `deferred-work.md:289`
 * cites `prng.ts:137,180`; measured 2026-08-09 the three real dereferences are `prng.ts:201`
 * (`crypto.subtle.sign`), `prng.ts:279` (`crypto.subtle.importKey`) and `canonical.ts:390`
 * (`crypto.subtle.digest`) — and the DIGEST is the one this path reaches first on a complete
 * ceremony. A feature detection written to the debt's own line numbers would have missed it. All
 * three are covered here because all three hang off the same `crypto.subtle` object, and each is
 * probed BY NAME rather than inferred from the parent's presence.
 *
 * `crypto.subtle` is `undefined` in any NON-SECURE context. ⚠ `http://localhost` and `127.0.0.1`
 * ARE secure contexts by specification, so this arm is unreachable on a dev server and needs a LAN
 * origin to exercise for real (AC13).
 */
export function webCryptoAvailable(): boolean {
  const c = (globalThis as { crypto?: unknown }).crypto;
  if (c === undefined || c === null || typeof c !== 'object') return false;
  const subtle = (c as { subtle?: unknown }).subtle;
  if (subtle === undefined || subtle === null || typeof subtle !== 'object') return false;
  const s = subtle as { digest?: unknown; sign?: unknown; importKey?: unknown };
  return typeof s.digest === 'function' && typeof s.sign === 'function' && typeof s.importKey === 'function';
}

/**
 * ⭐ THE ALPHABET DECISION — `deferred-work.md:378`, the verifier half. **DECISION S (Story 6.9b):
 * U+0000 IS OUTSIDE THE BUNDLE'S ALPHABET.**
 *
 * All three canonicalizers emit the legal six-character escape for U+0000 and the `string-escaping`
 * vector pins exactly that output, so a document containing one is valid RFC-8785 *and* valid
 * RFC-8259 — and then dies in `p_payload::jsonb` as 22P05, which `publish_bundle`'s `when others`
 * reports as `payload_shape / 'the payload is not valid JSON'`. The document is not malformed JSON;
 * PostgreSQL `text` simply cannot hold NUL.
 *
 * This verifier refuses it BY NAME rather than inheriting that misdiagnosis. Declaring it out of the
 * alphabet — rather than teaching the verifier to accept a document the storage layer can never
 * round-trip — is the fail-closed direction: a bundle carrying U+0000 could never have been
 * published, so one arriving here did not come from `publish_bundle`.
 *
 * ⛔ THE SQL HALF DOES NOT TRAVEL WITH THIS (Cuatro, 2026-08-10). Narrowing `publish_bundle`'s
 * `when others` to distinguish 22P05 from 22P02 needs a migration `0030`, which no AC in this story
 * authorises and which would be the first migration written after a live commitment. Re-recorded
 * against Epic 7.
 *
 * ⚠ Unreachable in production in both directions — no value read out of the database can carry
 * U+0000 into the builder — which is why it is a named refusal here rather than a guard anywhere hot.
 */
const NUL = '\u0000';

function containsNul(value: unknown, depth: number): boolean {
  // The same bound `canonicalize` uses, for the same reason: an untyped `RangeError` from a
  // recursion this deep would escape as somebody else's failure.
  //
  // ⭐ 6.9b CODE REVIEW — IT REFUSES UNDER ITS OWN REASON, NOT UNDER THE NUL PATH'S. Returning `true`
  // here reported "the served document contains U+0000" for a document that contains no such thing,
  // collapsing two distinct causes onto one name. `canonicalize` carries a typed
  // `max_depth_exceeded` for this, but V2 runs BEFORE canonicalization by design, so the refusal has
  // to be named here.
  if (depth > 256) {
    throw new VerifyStop(
      'document_depth',
      'the served document nests deeper than 256 levels, which no published bundle does',
    );
  }
  if (typeof value === 'string') return value.includes(NUL);
  if (Array.isArray(value)) {
    for (const item of value) if (containsNul(item, depth + 1)) return true;
    return false;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.includes(NUL)) return true;
      if (containsNul((value as Record<string, unknown>)[key], depth + 1)) return true;
    }
  }
  return false;
}

/** A refusal carrying its typed reason. Never leaves this module — {@link verifyCeremony} maps it. */
class VerifyStop extends Error {
  readonly reason: VerifyReason;

  constructor(reason: VerifyReason, detail: string) {
    super(detail);
    this.name = 'VerifyStop';
    this.reason = reason;
  }
}

const DECIMAL_RE = /^-?[0-9]+$/;

/**
 * A decimal STRING to a `bigint`.
 *
 * ⛔ THE REGEX IS NOT DECORATION. `BigInt` TRIMS SURROUNDING WHITESPACE (`BigInt(' 12 ')` is `12n`)
 * and `BigInt('')` is `0n`, so an empty or padded magnitude would decode to a plausible number
 * instead of refusing. Go's `strconv.ParseInt` accepts neither, so without this the two halves of
 * the seam would disagree about an input neither would report.
 */
function bigOf(raw: unknown, where: string): bigint {
  if (typeof raw !== 'string' || !DECIMAL_RE.test(raw)) {
    throw new VerifyStop('bundle_shape', `${where} must be a decimal string, got ${JSON.stringify(raw)}`);
  }
  return BigInt(raw);
}

/** A JSON integer, refused rather than coerced. */
function intOf(raw: unknown, where: string): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) {
    throw new VerifyStop('bundle_shape', `${where} must be a safe-integer JSON number, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function strOf(raw: unknown, where: string): string {
  if (typeof raw !== 'string') {
    throw new VerifyStop('bundle_shape', `${where} must be a string, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function boolOf(raw: unknown, where: string): boolean {
  if (typeof raw !== 'boolean') {
    throw new VerifyStop('bundle_shape', `${where} must be a boolean, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function objOf(raw: unknown, where: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new VerifyStop('bundle_shape', `${where} must be a JSON object`);
  }
  return raw as Record<string, unknown>;
}

function arrOf(raw: unknown, where: string): unknown[] {
  if (!Array.isArray(raw)) throw new VerifyStop('bundle_shape', `${where} must be a JSON array`);
  return raw;
}

function strsOf(raw: unknown, where: string): string[] {
  return arrOf(raw, where).map((v, i) => strOf(v, `${where}[${String(i)}]`));
}

/** ⚠ `Object.hasOwn`, never a bare lookup — a plain object inherits `constructor`/`toString`. */
function has(o: Record<string, unknown>, k: string): boolean {
  return Object.hasOwn(o, k);
}

/**
 * AD-19's class-shaped value: a decimal string for a volume key, `{num, den}` for a rate key.
 *
 * The SHAPE is the discriminator here rather than a declared class, because that is exactly what the
 * document carries — `numbersToStrings` (`bundle.go:1163`) walks the snapshot tree and rewrites every
 * number as its decimal string, leaving the pair's object structure intact.
 */
function statValueOf(raw: unknown, where: string): StatValue {
  if (typeof raw === 'string') return { class: 'volume', value: bigOf(raw, where) };
  const o = objOf(raw, where);
  return { class: 'rate', num: bigOf(o.num, `${where}.num`), den: bigOf(o.den, `${where}.den`) };
}

function ratePairOf(raw: unknown, where: string): RatePair {
  const o = objOf(raw, where);
  return { num: bigOf(o.num, `${where}.num`), den: bigOf(o.den, `${where}.den`) };
}

function volumeBlockOf(raw: unknown, where: string): Record<string, bigint> {
  const o = objOf(raw, where);
  const out: Record<string, bigint> = {};
  for (const k of Object.keys(o)) out[k] = bigOf(o[k], `${where}.${k}`);
  return out;
}

function rateBlockOf(raw: unknown, where: string): Record<string, RatePair> {
  const o = objOf(raw, where);
  const out: Record<string, RatePair> = {};
  for (const k of Object.keys(o)) out[k] = ratePairOf(o[k], `${where}.${k}`);
  return out;
}

function statBlockOf(raw: unknown, where: string): Record<string, StatValue> {
  const o = objOf(raw, where);
  const out: Record<string, StatValue> = {};
  for (const k of Object.keys(o)) out[k] = statValueOf(o[k], `${where}.${k}`);
  return out;
}

function h2hBlockOf(raw: unknown, where: string): Record<string, Record<string, StatValue>> {
  const o = objOf(raw, where);
  const out: Record<string, Record<string, StatValue>> = {};
  for (const opp of Object.keys(o)) out[opp] = statBlockOf(o[opp], `${where}.${opp}`);
  return out;
}

/** The eligibility inputs, absent when the source column is NULL — see {@link playerOf}. */
const ELIGIBILITY_KEYS = ['rounds_played', 'kills', 'idle_dq'] as const;

/**
 * One `players` entry.
 *
 * ⛔⛔ AN ABSENT `rounds_played` / `kills` / `idle_dq` IS A REFUSAL, NEVER A ZERO. All three columns
 * are nullable and 6.9a's code review found the builder publishing `"0"` for a NULL — "a magnitude
 * the database does not hold", on precisely the two fields that make the twelve
 * `no_eligible_players` cards checkable rather than assertable. Substituting one here would
 * re-introduce that fabrication on the READING side, where nothing downstream could see it: the
 * verifier would apply the FR-21 floors to a number nobody recorded and then declare the ceremony
 * fair. Refusing means a bundle that genuinely lacks them is reported as INCOMPLETE, which is a
 * bundle defect to escalate (SOLUTION-DESIGN:448-449) rather than a gap to paper over.
 *
 * ⭐ `achievement_ts` is the ONE deliberate exception and is ALWAYS PRESENT, with `"-1"` as the
 * absent sentinel (`ABSENT_ACHIEVEMENT_TS`, `ladder.ts:125`) — because FR-29's rung 4 compares it,
 * and a verifier handed an absent key would have to invent the same constant to proceed.
 */
function playerOf(raw: unknown, index: number): SnapshotPlayer {
  const where = `players[${String(index)}]`;
  const o = objOf(raw, where);
  for (const k of ELIGIBILITY_KEYS) {
    if (!has(o, k)) {
      throw new VerifyStop(
        'bundle_shape',
        `${where}.${k} is absent — the FR-21 floors cannot be re-applied to a magnitude the ` +
          'document does not carry, and substituting a zero would re-introduce the fabrication ' +
          '6.9a removed from the builder',
      );
    }
  }
  return {
    steamid64: strOf(o.steamid64, `${where}.steamid64`),
    roundsPlayed: bigOf(o.rounds_played, `${where}.rounds_played`),
    kills: bigOf(o.kills, `${where}.kills`),
    idleDq: boolOf(o.idle_dq, `${where}.idle_dq`),
    volume: volumeBlockOf(o.volume, `${where}.volume`),
    rate: rateBlockOf(o.rate, `${where}.rate`),
    secondary: statBlockOf(o.secondary, `${where}.secondary`),
    efficiency: rateBlockOf(o.efficiency, `${where}.efficiency`),
    h2h: h2hBlockOf(o.h2h, `${where}.h2h`),
    achievementTs: bigOf(o.achievement_ts, `${where}.achievement_ts`),
  };
}

/** The three FR-29 rung keys are nullable in the catalog; ABSENT in the document means NULL. */
function rungOf(o: Record<string, unknown>, key: string, where: string): string | null {
  if (!has(o, key)) return null;
  return strOf(o[key], `${where}.${key}`);
}

function awardOf(raw: unknown, index: number): BundleAward {
  const where = `awards[${String(index)}]`;
  const o = objOf(raw, where);
  return {
    awardId: strOf(o.award_id, `${where}.award_id`),
    priority: intOf(o.priority, `${where}.priority`),
    outcomeKind: strOf(o.outcome_kind, `${where}.outcome_kind`),
    winners: strsOf(o.winners, `${where}.winners`),
    isShared: boolOf(o.is_shared, `${where}.is_shared`),
    isPity: boolOf(o.is_pity, `${where}.is_pity`),
    // ⭐ DECISION J — the key is ABSENT when no ladder was walked, never `0`. `has` rather than a
    // truthiness test: `0` is not a legal published value here at all, and reading it as "no ladder"
    // would silently accept the sentinel this project spent a story removing.
    ...(has(o, 'tie_ladder_exit_step')
      ? { ladderExitStep: intOf(o.tie_ladder_exit_step, `${where}.tie_ladder_exit_step`) }
      : {}),
    ...(has(o, 'deciding_value') ? { decidingValue: strOf(o.deciding_value, `${where}.deciding_value`) } : {}),
    ...(has(o, 'deciding_num') ? { decidingNum: strOf(o.deciding_num, `${where}.deciding_num`) } : {}),
    ...(has(o, 'deciding_den') ? { decidingDen: strOf(o.deciding_den, `${where}.deciding_den`) } : {}),
    award: {
      decidingStat: strOf(o.deciding_stat, `${where}.deciding_stat`),
      class: strOf(o.class, `${where}.class`) as Award['class'],
      direction: strOf(o.direction, `${where}.direction`) as Award['direction'],
      floorRounds: intOf(o.floor_rounds, `${where}.floor_rounds`),
      floorKills: intOf(o.floor_kills, `${where}.floor_kills`),
      secondaryStat: rungOf(o, 'secondary_stat', where),
      effNumKey: rungOf(o, 'eff_num_key', where),
      effDenKey: rungOf(o, 'eff_den_key', where),
    },
  };
}

function spinOf(raw: unknown, index: number): BundleSpin {
  const where = `spin_plan[${String(index)}]`;
  const o = objOf(raw, where);
  // ⭐ 6.9b CODE REVIEW — `spin` IS 1-BASED, AND SAYING SO HERE KEEPS THE REASON HONEST. `intOf`
  // alone accepts `0` and negatives; `stage1Label` then throws a bare `RangeError`, which lands in
  // the `engine_refused` arm — reporting a malformed DOCUMENT FIELD as "the engine refused an input
  // the document handed it" and bypassing `bundle_shape`, the reason that exists for exactly this.
  const spin = intOf(o.spin, `${where}.spin`);
  if (spin < 1) {
    throw new VerifyStop('bundle_shape', `${where}.spin is ${String(spin)}; spin indices are 1-based`);
  }
  const common: BundleSpinCommon = {
    spin,
    label: strOf(o.label, `${where}.label`),
    bytesConsumed: intOf(o.bytes_consumed, `${where}.bytes_consumed`),
  };
  const kind = strOf(o.kind, `${where}.kind`);
  // ⛔ THE CLOSED SET IS `spin_kind_valid` (`0025:119`), AND AN UNKNOWN KIND REFUSES RATHER THAN
  // FALLING THROUGH TO THE PITY SHAPE. A third kind added later must not be silently verified as a
  // draw-less spin — that would pass a spin nobody checked.
  if (kind === 'pity') return { ...common, kind: 'pity' };
  if (kind !== 'main') {
    throw new VerifyStop('bundle_shape', `${where}.kind is ${JSON.stringify(kind)}, not main or pity`);
  }
  return {
    ...common,
    kind: 'main',
    liveCount: intOf(o.live_count, `${where}.live_count`),
    pool: strsOf(o.pool, `${where}.pool`),
    live: strsOf(o.live, `${where}.live`),
    weights: arrOf(o.weights, `${where}.weights`).map((v, i) => intOf(v, `${where}.weights[${String(i)}]`)),
    totalWeight: intOf(o.total_weight, `${where}.total_weight`),
    draws: arrOf(o.draws, `${where}.draws`).map((v, i) => {
      const d = objOf(v, `${where}.draws[${String(i)}]`);
      return {
        n: intOf(d.n, `${where}.draws[${String(i)}].n`),
        r: intOf(d.r, `${where}.draws[${String(i)}].r`),
        consumedAfter: intOf(d.consumed_after, `${where}.draws[${String(i)}].consumed_after`),
      };
    }),
  };
}

function pityOf(raw: unknown): BundlePity {
  const o = objOf(raw, 'pity');
  return {
    label: strOf(o.label, 'pity.label'),
    winless: strsOf(o.winless, 'pity.winless'),
    revealOrder: strsOf(o.reveal_order, 'pity.reveal_order'),
    draws: arrOf(o.draws, 'pity.draws').map((v, i) => {
      const d = objOf(v, `pity.draws[${String(i)}]`);
      return {
        n: intOf(d.n, `pity.draws[${String(i)}].n`),
        k: intOf(d.k, `pity.draws[${String(i)}].k`),
        rejections: intOf(d.rejections, `pity.draws[${String(i)}].rejections`),
        value: intOf(d.value, `pity.draws[${String(i)}].value`),
      };
    }),
    // ⚠ WITHHELD UNTIL THE PHASE IS FULLY REVEALED (`0029:1603-1605`) — a whole-stream measurement
    // has no honest truncated value. Absent is absent; it is never 0.
    ...(has(o, 'bytes_consumed') ? { bytesConsumed: intOf(o.bytes_consumed, 'pity.bytes_consumed') } : {}),
  };
}

/**
 * Parse the served document.
 *
 * ⚠ MID-CEREMONY THE SEVEN TOP-LEVEL KEYS ARE SIX: `pity` is ABSENT ENTIRELY until a consolation
 * spin is revealed, because an empty-but-present `pity` would announce that a consolation phase
 * exists and how it is shaped before any of it is public (`0029:1621-1624`). ⛔ Reading it
 * unconditionally would be exactly the "request the un-served keys" AC6 forbids.
 */
export function parseBundle(raw: unknown): ParsedBundle {
  const o = objOf(raw, 'bundle');
  const luck = objOf(o.luck, 'bundle.luck');
  return {
    algoVersion: strOf(o.algo_version, 'bundle.algo_version'),
    seedHex: strOf(o.seed_hex, 'bundle.seed_hex'),
    weightTable: arrOf(luck.weight_table, 'bundle.luck.weight_table').map((v, i) =>
      intOf(v, `bundle.luck.weight_table[${String(i)}]`),
    ),
    spinPlan: arrOf(o.spin_plan, 'bundle.spin_plan').map(spinOf),
    awards: arrOf(o.awards, 'bundle.awards').map(awardOf),
    players: arrOf(o.players, 'bundle.players').map(playerOf),
    ...(has(o, 'pity') ? { pity: pityOf(o.pity) } : {}),
  };
}

// ── the comparison half ───────────────────────────────────────────────────────

/**
 * Compare a re-derived value against the published one.
 *
 * `JSON.stringify` on both sides so an array, an object and a scalar all compare by VALUE with one
 * function — and so `undefined` on both sides compares equal, which is what DECISION J's absent
 * `tie_ladder_exit_step` needs. ⚠ Nothing passed here ever carries a `bigint`: every magnitude is
 * rendered back to its decimal string first, because `JSON.stringify` THROWS on one and a throw here
 * would be reported as `engine_refused` rather than as the divergence it is.
 */
function expectSame(actual: unknown, published: unknown, reason: VerifyReason, where: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(published);
  if (a !== b) {
    throw new VerifyStop(
      reason,
      `${where}: re-derived ${a ?? 'undefined'} but the document published ${b ?? 'undefined'}`,
    );
  }
}

/**
 * The winners an `Outcome` names, in the document's own spelling.
 *
 * ⚠ `'tie'` IS UNREACHABLE HERE AND IS STILL HANDLED. `resolveSpin` routes every tie through the
 * injected ladder, which returns `'winner'` or `'shared'` — the vector declares that as
 * `unreachable_outcome_kinds` and both suites assert zero rows carry it. Falling through silently
 * would publish an empty winners list for an award that TIED, which reads as "nobody qualified".
 */
function winnersOf(outcome: Outcome): readonly string[] {
  switch (outcome.kind) {
    case 'winner':
      return [outcome.steamid64];
    case 'shared':
      return outcome.winners;
    case 'tie':
      throw new VerifyStop(
        'outcome_divergence',
        'the re-derivation produced an unresolved TIE — the FR-29 ladder was bypassed, which is the ' +
          "vector's `unreachable_outcome_kinds`",
      );
    default:
      return [];
  }
}

function exitStepOf(outcome: Outcome): number | undefined {
  if (outcome.kind === 'winner') return outcome.ladderExitStep;
  if (outcome.kind === 'shared') return outcome.ladderExitStep;
  return undefined;
}

/** The three display-only deciding fields, spelled exactly as the document spells them. */
function decidingOf(outcome: Outcome): {
  value?: string;
  num?: string;
  den?: string;
} {
  if (outcome.kind !== 'winner' || outcome.decidingValue === undefined) return {};
  const dv = outcome.decidingValue;
  if (dv.class === 'volume') return { value: dv.value.toString() };
  return { num: dv.num.toString(), den: dv.den.toString() };
}

function compareOutcome(published: BundleAward, outcome: Outcome): void {
  const where = `award ${published.awardId}`;
  expectSame(outcome.kind, published.outcomeKind, 'outcome_divergence', `${where}.outcome_kind`);
  expectSame([...winnersOf(outcome)], [...published.winners], 'outcome_divergence', `${where}.winners`);
  // ⭐ DECISION J: `undefined === undefined`, not a special case for a `0` sentinel.
  expectSame(exitStepOf(outcome), published.ladderExitStep, 'outcome_divergence', `${where}.tie_ladder_exit_step`);
  expectSame(outcome.kind === 'shared', published.isShared, 'outcome_divergence', `${where}.is_shared`);
  const d = decidingOf(outcome);
  expectSame(d.value, published.decidingValue, 'outcome_divergence', `${where}.deciding_value`);
  expectSame(d.num, published.decidingNum, 'outcome_divergence', `${where}.deciding_num`);
  expectSame(d.den, published.decidingDen, 'outcome_divergence', `${where}.deciding_den`);
  // A main spin's results are never pity results: the two live on different `spin.kind` rows and
  // `0027`'s declarative bind makes disagreement unrepresentable at the database.
  expectSame(false, published.isPity, 'outcome_divergence', `${where}.is_pity`);
}

// ── the orchestrator ──────────────────────────────────────────────────────────

/** The envelope `verification_bundle_read` returns, in the shape this module consumes. */
export interface VerifyInput {
  readonly complete: boolean;
  readonly bundleSha256: string;
  readonly bundle: unknown;
  /**
   * DECISION P — `ceremony.seed_demo_sha256`, read through the anon column grant `0028:501` opens.
   *
   * ⭐ IT IS CROSS-CHECKED BECAUSE IT CAN BE. 6.9a's DECISION B release-schedule row 1 promises a
   * viewer can check that "`seed_hex` matches `ceremony.seed_demo_sha256`", and it costs one column
   * on a read the page is already making. Optional so the engine stays drivable without a database.
   */
  readonly seedDemoSha256?: string;
}

/** The zero-evidence shape every early return carries, so a refusal never claims a partial check. */
const NOTHING_CHECKED = {
  hashBound: false,
  mainSpinsChecked: 0,
  awardOutcomesChecked: 0,
  pityDrawsChecked: 0,
  drawOrder: [] as readonly string[],
  mainBytes: [] as readonly number[],
};

/**
 * Re-derive the ceremony from the published document and compare every field.
 *
 * ⭐⭐ DECISION R (Story 6.9b) — **MID-CEREMONY THIS VERIFIES THE OUTCOMES, NOT THE DRAW, AND IT
 * NEVER BINDS THE HASH.** The two halves are separable, and the reason is structural rather than
 * cautious:
 *
 *   * Stage 2 + anti-sweep + the FR-29 ladder need only a spin's LIVE awards and the roster, and a
 *     spin's awards are revealed WITH the spin — so every revealed outcome is fully re-derivable,
 *     which is exactly what AC6 says a viewer can confirm before completion.
 *   * Stage 1's weights are computed over the whole POOL, which includes awards that have NOT been
 *     revealed and whose metadata the projection correctly refuses to serve (AD-22). ⛔ There is no
 *     honest way to re-derive the draw from a served prefix, and the dishonest ways — assuming an
 *     unrevealed award weighs the heaviest, or reading the published `weights` back as though they
 *     had been re-derived — are precisely the "the client compensates" failure AC6 forbids. So it is
 *     not attempted, and the report says which half ran (`full`).
 *   * `bundle_sha256` binds ONE document. A prefix is a DIFFERENT document, so the commitment cannot
 *     be checked against it (6.9a's answer to Question 3, a deliberately accepted gap). ⚠ AC6
 *     requires the UI to state this, and it does.
 *
 * At `complete` the served document IS the whole document, and the full AC5 chain runs.
 *
 * ⛔ IT NEVER READS AN UN-SERVED KEY. Every access below is guarded by what the projection actually
 * returned; there is no fetch, no second RPC, and no default standing in for a missing spin.
 */
export async function verifyCeremony(input: VerifyInput): Promise<VerifyReport> {
  // V1 — ⛔ BEFORE ANY ENGINE CALL. `canonicalSha256Hex` reaches `crypto.subtle.digest` and
  // `createStream` reaches `importKey`/`sign`; without this the button dies as
  // `TypeError: Cannot read properties of undefined` instead of as a typed refusal (AC9).
  if (!webCryptoAvailable()) {
    return {
      outcome: 'web_crypto_unavailable',
      reason: 'web_crypto_unavailable',
      detail: 'globalThis.crypto.subtle is unavailable — this is a non-secure browsing context',
      full: false,
      ...NOTHING_CHECKED,
    };
  }

  try {
    return await run(input);
  } catch (err) {
    if (err instanceof VerifyStop) {
      return {
        outcome: REASON_OUTCOME[err.reason],
        reason: err.reason,
        detail: err.message,
        full: false,
        ...NOTHING_CHECKED,
      };
    }
    // ⭐ EVERY OTHER THROW IS THE ENGINE REFUSING AN INPUT THE DOCUMENT HANDED IT, and it is reported
    // as a MISMATCH rather than re-thrown. `Stage1Error`, `PityError`, `SweepError`, `LadderError`,
    // `Stage2Error` and `CanonicalError` all mean one thing to a viewer: this document does not
    // describe a ceremony these rules could have produced. ⛔ Swallowing it as a pass, and letting it
    // escape as an unhandled rejection, are the two failures this arm exists to prevent.
    return {
      outcome: 'mismatched',
      reason: 'engine_refused',
      detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      full: false,
      ...NOTHING_CHECKED,
    };
  }
}

async function run(input: VerifyInput): Promise<VerifyReport> {
  if (input === null || typeof input !== 'object') {
    throw new VerifyStop('envelope_shape', 'verifyCeremony takes the projection envelope as an object');
  }
  if (typeof input.complete !== 'boolean' || typeof input.bundleSha256 !== 'string') {
    throw new VerifyStop('envelope_shape', 'the envelope must carry `complete` and `bundleSha256`');
  }
  if (input.bundle === undefined || input.bundle === null) {
    throw new VerifyStop('bundle_absent', 'the projection served no bundle');
  }

  // V2 — the alphabet decision, BEFORE canonicalization, so the refusal names the real cause rather
  // than surfacing three layers up as somebody else's reason.
  if (containsNul(input.bundle, 0)) {
    throw new VerifyStop(
      'nul_in_document',
      'the served document contains U+0000, which is outside the bundle alphabet — no document ' +
        'carrying one could have been published, because PostgreSQL text cannot hold NUL',
    );
  }

  const bundle = parseBundle(input.bundle);

  // V3 — AC8.
  const version = parseAlgoVersion(bundle.algoVersion);
  if (!version.ok) {
    throw new VerifyStop(
      version.reason,
      `algo_version ${JSON.stringify(bundle.algoVersion)} is not ${ALGO_VERSION} — this build ` +
        `implements ${ALGO_NAME} MAJOR ${String(ALGO_MAJOR)}`,
    );
  }

  // V4 — DECISION P.
  if (input.seedDemoSha256 !== undefined && input.seedDemoSha256 !== bundle.seedHex) {
    throw new VerifyStop(
      'seed_mismatch',
      'the document names a seed the ceremony did not freeze: seed_hex does not equal ' +
        'ceremony.seed_demo_sha256',
    );
  }

  const seed = decodeSeedHex(bundle.seedHex);

  // The award catalog, by id. ⚠ `award_id` is unique across `awards`: a pity result carries
  // `award_id IS NULL` (`0026`) and is dropped by the builder's inner join, so every entry here is
  // one of the twelve categories.
  const byId = new Map<string, BundleAward>();
  for (const a of bundle.awards) {
    if (byId.has(a.awardId)) {
      throw new VerifyStop('bundle_shape', `awards carries award_id ${a.awardId} twice`);
    }
    byId.set(a.awardId, a);
  }

  // ⛔ SORTED BY `spin`, NOT TRUSTED FROM ARRAY ORDER. The shelf makes spin N depend on 1..N-1, so
  // processing them out of order is the same defect as the `Promise.all` mutant with none of its
  // visibility. A numeric subtraction over values `intOf` has already proven to be safe integers.
  const ordered = bundle.spinPlan
    .filter((s): s is BundleMainSpin => s.kind === 'main')
    .slice()
    .sort((a, b) => a.spin - b.spin);

  // ⭐ 6.9b CODE REVIEW — `spin` UNIQUENESS IS ASSERTED, NOT ASSUMED. Sorting hides a duplicate
  // rather than refusing it: a repeated main-spin entry is processed TWICE, double-advancing the
  // shelf and double-counting `drawOrder`, and mid-ceremony nothing else notices because the shelf is
  // only consulted at `complete`. The whole plan is checked, main and pity alike, because a duplicate
  // pity index corrupts the per-spin byte total the same way.
  const seenSpins = new Set<number>();
  for (const s of bundle.spinPlan) {
    if (seenSpins.has(s.spin)) {
      throw new VerifyStop('bundle_shape', `spin_plan carries spin ${String(s.spin)} twice`);
    }
    seenSpins.add(s.spin);
  }

  // ⭐ THE CONSOLATION SPINS' OWN `spin_plan` ENTRIES, CHECKED SEPARATELY FROM THE `pity` BLOCK.
  // They carry only the four common fields, and both of them are verifiable at every `k`: FR-28
  // draws the WHOLE consolation order from ONE stream, so every pity spin must name that stream.
  // ⚠ A pity entry labelled with a Stage-1 separator would mean the consolation round drew from a
  // spin's stream — invisible in the outcome and fatal from the next draw onward.
  const pitySpins = bundle.spinPlan.filter((s): s is BundlePitySpin => s.kind === 'pity');
  for (const s of pitySpins) {
    expectSame(PITY_LABEL, s.label, 'pity_divergence', `spin ${String(s.spin)}.label`);
  }

  const shelf: Record<string, number> = {};
  const drawOrder: string[] = [];
  const mainBytes: number[] = [];
  let awardOutcomesChecked = 0;
  // ⭐ 6.9b CODE REVIEW — the evidence for the two COVERAGE assertions below. Neither existed:
  // `awardOutcomesChecked` was incremented and never compared to anything, and the pool was read
  // forward out of the document without ever being related to the spin before it.
  const checkedAwardIds = new Set<string>();
  let prevPool: readonly string[] | undefined;
  let prevLive: readonly string[] | undefined;

  // ⛔⛔ SEQUENTIAL. See the module header: `Promise.all` here does not throw, it corrupts the shelf.
  for (const entry of ordered) {
    // ⭐ THE LIVE SET IS SERVED AT EVERY `k`, AND THE POOL IS NOT. A spin's awards are revealed WITH
    // the spin, so `entry.live` always resolves against `byId`; `entry.pool` names the awards that
    // are still SEALED, and the projection correctly refuses to describe them (AD-22). ⛔ Building
    // candidates from the pool unconditionally would make the verifier refuse a perfectly correct
    // mid-ceremony document for the crime of being reveal-gated.
    const live: Stage1Candidate[] = entry.live.map((id) => {
      const a = byId.get(id);
      if (a === undefined) {
        throw new VerifyStop(
          'outcome_divergence',
          `spin ${String(entry.spin)} drew award ${id}, which the document does not describe — a ` +
            'revealed spin must carry the awards it decided',
        );
      }
      return { awardId: id, priority: a.priority, award: a.award };
    });

    // ⚠ THE DOMAIN SEPARATOR IS CHECKED AT EVERY `k`, BEFORE ANY STREAM IS OPENED. `stage1Label` is
    // pure and draws nothing, so a published label that does not match its own spin index is
    // detectable mid-ceremony — and it is the one field that decides which bytes the spin drew.
    expectSame(stage1Label(entry.spin), entry.label, 'draw_divergence', `spin ${String(entry.spin)}.label`);

    // ⭐ 6.9b CODE REVIEW — `live_count` IS VERIFIED AGAINST ITS OWN ARRAY, AT EVERY `k`. A
    // reviewer-independent mutant that replaced the published `live_count` with `entry.live.length`
    // SURVIVED the whole suite, which is the measurement that this field was never checked against
    // anything: it was read only inside the `complete` branch and handed straight to `stage1Pick`. A
    // document declaring a count that disagrees with the set it describes is malformed at every `k`.
    expectSame(entry.live.length, entry.liveCount, 'draw_divergence', `spin ${String(entry.spin)}.live_count`);

    if (input.complete) {
      const candidates: Stage1Candidate[] = entry.pool.map((id) => {
        const a = byId.get(id);
        if (a === undefined) {
          // ⭐ THIS IS THE COMPLETENESS BOUNDARY, AND IT IS A DOCUMENT DEFECT RATHER THAN A GAP TO
          // FILL. At `complete` every pooled award is served, so reaching here means the bundle is
          // incomplete — SOLUTION-DESIGN:448-449: "the JS verifier needs NOTHING outside the
          // bundle; if it does, the bundle is incomplete (a spec bug)".
          throw new VerifyStop(
            'bundle_shape',
            `spin ${String(entry.spin)} pools award ${id}, which the document does not describe`,
          );
        }
        return { awardId: id, priority: a.priority, award: a.award };
      });

      // ⭐ 6.9b CODE REVIEW — THE POOL PROGRESSION, WHICH WAS TAKEN ON TRUST. `pool` was read forward
      // out of the document and never related to the spin before it, so a plan that silently DROPPED
      // a category from a later pool — meaning it could never be drawn — verified as `matched`. The
      // rule the producer satisfies is `pool(n+1) === pool(n) \ live(n)`.
      // ⚠ COMPARED AS SETS, deliberately. The pool's ORDER is the producer's business and is already
      // pinned through `picked.live`/`weights` below; asserting order here would make the verifier
      // refuse a correct ceremony over an ordering the document never promised.
      if (prevPool !== undefined && prevLive !== undefined) {
        const removed = new Set(prevLive);
        const expected = prevPool.filter((id) => !removed.has(id));
        expectSame(
          [...expected].sort(),
          [...entry.pool].sort(),
          'draw_divergence',
          `spin ${String(entry.spin)}.pool (the previous pool minus the previous live set)`,
        );
      }
      prevPool = entry.pool;
      prevLive = entry.live;

      // V5 — the full AC5 chain. A FRESH stream per spin, keyed by that spin's own label.
      const stream = await createStream(seed, stage1Label(entry.spin));
      const picked = await stage1Pick(stream, {
        candidates,
        players: bundle.players,
        shelf,
        table: bundle.weightTable,
        liveCount: entry.liveCount,
        ladder: fr29Ladder,
      });
      expectSame([...picked.live], [...entry.live], 'draw_divergence', `spin ${String(entry.spin)}.live`);
      // ⭐ 6.9b CODE REVIEW — THE DRAWN ORDER IS PUSHED FROM `picked`, AND ONLY HERE. It used to be
      // pushed from `entry.live` after the branch, so on the mid-ceremony path — where `stage1Pick`
      // never runs — `drawOrder` was a verbatim COPY of the published field, and pinning it asserted
      // that the document equals itself. That contradicted this field's own doc comment. It is now
      // populated only when the full chain ran, which is exactly when it is re-derived evidence.
      for (const id of picked.live) drawOrder.push(id);
      expectSame([...picked.weights], [...entry.weights], 'draw_divergence', `spin ${String(entry.spin)}.weights`);
      expectSame(picked.totalWeight, entry.totalWeight, 'draw_divergence', `spin ${String(entry.spin)}.total_weight`);
      expectSame(
        picked.draws.map((d) => ({ n: d.n, r: d.r, consumed_after: d.consumedAfter })),
        entry.draws.map((d) => ({ n: d.n, r: d.r, consumed_after: d.consumedAfter })),
        'draw_divergence',
        `spin ${String(entry.spin)}.draws`,
      );
      // ⚠ REPRODUCED, NEVER RE-DERIVED — this is `stream.consumed` after the real draw, compared
      // against the published count. No formula anywhere in this file predicts it.
      expectSame(stream.consumed, entry.bytesConsumed, 'bytes_divergence', `spin ${String(entry.spin)}.bytes_consumed`);
      mainBytes.push(stream.consumed);
    }

    // V6 — Stage 2 + anti-sweep + the ladder, over the spin's LIVE set. This half runs at every `k`.
    const spinResult = resolveSpin(live, bundle.players, fr29Ladder);
    for (const assignment of spinResult.results) {
      const published = byId.get(assignment.awardId);
      if (published === undefined) {
        throw new VerifyStop(
          'outcome_divergence',
          `spin ${String(entry.spin)} decided ${assignment.awardId}, which the document does not describe`,
        );
      }
      compareOutcome(published, assignment.outcome);
      awardOutcomesChecked += 1;
      checkedAwardIds.add(assignment.awardId);
    }

    // ⭐ THE SHELF ADVANCES HERE AND NOWHERE ELSE (A10 / P6 / DECISION G). `SpinResult.assigned` is
    // every player who won anything this spin, in byte-lex order; a duplicate is impossible by
    // construction, which is what `unique (spin_id, winner_entry_id)` backstops at the database.
    for (const sid of spinResult.assigned) {
      shelf[sid] = (Object.hasOwn(shelf, sid) ? (shelf[sid] as number) : 0) + 1;
    }
  }

  // ⭐ 6.9b CODE REVIEW — EVERY PUBLISHED AWARD MUST HAVE BEEN RE-DERIVED BY SOME SPIN. Comparison
  // was driven ONLY by `spinResult.results`, so an `awards` entry that no spin's `live` ever named
  // was parsed and never compared to anything: a fabricated `winners` list rode along inside
  // `bundle_sha256` and verified as `matched`. The hash does not save you here — it binds the
  // producer to the doctored document, which is the class FR-27 exists to catch.
  // ⚠ At `complete` only: mid-ceremony the projection legitimately serves fewer spins than awards.
  if (input.complete && checkedAwardIds.size !== byId.size) {
    const unchecked = [...byId.keys()].filter((id) => !checkedAwardIds.has(id)).sort();
    throw new VerifyStop(
      'outcome_divergence',
      `the document describes ${String(byId.size)} awards but only ${String(checkedAwardIds.size)} ` +
        `were decided by a spin — never re-derived: ${unchecked.join(', ')}`,
    );
  }

  let pityDrawsChecked = 0;
  let pityBytes: number | undefined;

  // ⭐ 6.9b CODE REVIEW — AT `complete`, A `pity` BLOCK IS REQUIRED WHENEVER THE PLAN HAS PITY SPINS.
  // The V7 guard below is `input.complete && bundle.pity !== undefined` with no `else`, so a complete
  // document carrying 28 `kind: 'pity'` entries and NO top-level `pity` key skipped the entire
  // consolation verification — winless set, reveal order, every draw and both byte counts — and still
  // reported `matched` with `pityDrawsChecked: 0`. ⚠ The commitment does not backstop it:
  // `publish_bundle` hashes the payload it is handed, so a document that never carried `pity` hashes
  // correctly and `hash_divergence` never fires. This mirrors the pool completeness boundary above —
  // at `complete` the whole document is served, so a missing block is a BUNDLE DEFECT.
  if (input.complete && pitySpins.length > 0 && bundle.pity === undefined) {
    throw new VerifyStop(
      'bundle_shape',
      `the plan carries ${String(pitySpins.length)} consolation spins but the complete document has ` +
        'no pity block to verify them against',
    );
  }

  // V7 — the consolation draw. ⛔ Only at `complete`: `resolvePity` needs the shelf after ALL main
  // spins, and mid-ceremony `pity.winless` is TRUNCATED to the revealed prefix (`0029:1580-1606`) —
  // it is byte-identical to `reveal_order` there, so asserting on it would compare a prefix against
  // a set and call a correct ceremony wrong.
  if (input.complete && bundle.pity !== undefined) {
    const pity = bundle.pity;
    const stream = await createStream(seed, PITY_LABEL);
    expectSame(stream.label, pity.label, 'pity_divergence', 'pity.label');
    const drawn = await resolvePity({ players: bundle.players, shelf, stream });
    expectSame([...drawn.winless], [...pity.winless], 'pity_divergence', 'pity.winless');
    expectSame([...drawn.revealOrder], [...pity.revealOrder], 'pity_divergence', 'pity.reveal_order');
    expectSame(
      drawn.draws.map((d) => ({ n: d.n, k: d.k, rejections: d.rejections, value: d.value })),
      pity.draws.map((d) => ({ n: d.n, k: d.k, rejections: d.rejections, value: d.value })),
      'pity_divergence',
      'pity.draws',
    );
    expectSame(drawn.bytesConsumed, pity.bytesConsumed, 'bytes_divergence', 'pity.bytes_consumed');
    // ⚠ AND THE STREAM'S OWN POSITION, WHICH IS NOT THE SAME ASSERTION. `resolvePity` REPORTS
    // `bytesConsumed`; this is what the stream actually moved. 6.7's review measured a structurally
    // faked stream reporting a byte count it had invented, so the reported value and the real one
    // are compared separately.
    expectSame(stream.consumed, pity.bytesConsumed, 'bytes_divergence', 'pity stream.consumed');
    // ⭐ AND THE PER-SPIN COSTS MUST TOTAL THE PHASE'S COST. `persist_ceremony` attributes the whole
    // consolation draw to the spin that ran it and zero to the rest (the measured corpus: spin 13
    // carries 27, spins 14-40 carry 0), but that attribution is a WRITER convention rather than a
    // published rule — so this asserts the property the convention has to satisfy instead of the
    // convention itself. It catches both halves of the obvious corruption: all-zeros, and the
    // whole-phase count repeated on every entry.
    let pitySpinBytes = 0;
    for (const s of pitySpins) pitySpinBytes += s.bytesConsumed;
    expectSame(pitySpinBytes, pity.bytesConsumed, 'bytes_divergence', 'the pity spins total');

    pityDrawsChecked = drawn.draws.length;
    pityBytes = stream.consumed;
  }

  // V8 — the commitment. ⭐ THE ONE MOMENT IT CAN BE CHECKED. Re-canonicalized from the served
  // `payload` jsonb rather than expected to arrive byte-preserved: RFC-8785 is NORMALISING, which is
  // exactly what makes serving from `payload` safe (`0029:1506-1512`).
  let hashBound = false;
  if (input.complete) {
    const canonical = canonicalize(input.bundle, { asciiOnly: true });
    const digest = await canonicalSha256Hex(canonical);
    if (digest !== input.bundleSha256) {
      throw new VerifyStop(
        'hash_divergence',
        `the served document canonicalizes to ${digest} but the commitment published before spin 1 ` +
          `is ${input.bundleSha256}`,
      );
    }
    hashBound = true;
  }

  return {
    outcome: input.complete ? 'matched' : 'not_yet_revealed',
    hashBound,
    full: input.complete,
    mainSpinsChecked: ordered.length,
    awardOutcomesChecked,
    pityDrawsChecked,
    drawOrder,
    mainBytes,
    ...(pityBytes === undefined ? {} : { pityBytes }),
  };
}
