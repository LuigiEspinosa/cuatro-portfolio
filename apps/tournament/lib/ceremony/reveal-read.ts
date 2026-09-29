import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkViewerText, type SafeTextRefusal } from '@/lib/i18n/safe-text';
import { resolveNames } from '@/lib/roster/names';

/**
 * The viewer's read of the REVEALED ceremony (Story 6.10, AC5 — FR-30 / AD-22 / AD-11).
 *
 * ⭐ DECISION T — THE REVEAL IS A SERVER READ; THE BROWSER COMPUTES NOTHING ABOUT WHO WON. This file
 * is the reader `lib/` did not have: no module read `spin`, `award_result`, `award_result_winner` or
 * `award` before this story, because before 6.8b none of the four had an anon grant at all. It runs
 * through the ANON, RLS-respecting `createSupabaseServerClient()` the page already holds — ⛔ NEVER
 * `getAdminClient()`, which would work and would be the exact hole the reveal gate exists to keep
 * shut (the rule `lib/awards/read.ts:19-20` states for the award count, and `verification.ts:17-20`
 * restates for the bundle).
 *
 * ⭐ WHAT MAKES THIS SAFE IS NOT THIS FILE. Every gate is in the database (`0028`, sections a-d): a
 * `spin` is visible from the moment `reveal_spin` stamps `revealed_at`; `award_result` and
 * `award_result_winner` are gated through that same spin; and an `award`'s IDENTITY — its name,
 * bucket and deciding stat — opens exactly when it has been DECIDED in a revealed spin. So an
 * unrevealed spin is not blanked here, it is ABSENT from the rows Postgres hands back. ⛔ That is
 * also why there is no `revealed_at is not null` filter written below: adding one would read as
 * though the secrecy lived in this file, and a future edit could then quietly remove it.
 *
 * ⛔⛔ EVERY COLUMN IS NAMED, AND ON `ceremony` THAT IS LOAD-BEARING RATHER THAN TIDY. PostgREST's
 * default `select=*` asks for EVERY column, so an anon request 42501s on `ceremony`'s four ungranted
 * ones even though the ROW is visible (`0028:485-490`). This reader never touches `ceremony` at all —
 * `lib/ceremony/verification.ts` already owns that read — but the four tables below are named out for
 * the same reason: a `select('*')` here would ship `spin.label` / `spin.bytes_consumed` and every
 * future column to the browser in the RSC payload by accident rather than by decision.
 *
 * ⛔ `ceremony.spin_plan` IS NEVER READ, and no query below looks one spin ahead. `spin_plan` names
 * each spin's candidate award POOL and IS the "per-spin live-category sets" AD-22 gates by name; an
 * unrevealed spin's row is ABSENT, not blanked, and this reader must not be the thing that
 * reintroduces a shape from which cardinality-by-position could be inferred (6.9a DECISION B:
 * *"a `redacted` placeholder is a defect"*).
 *
 * ⚠ FAIL CLOSED. A transport error, a malformed row or an unusable field becomes `read_failed` and
 * the page renders nothing ceremonial — never a half-built reveal. A ceremony surface that guessed
 * would be worse than one that refused: the whole point of FR-27 is that the audience can check it.
 */

/**
 * Why the revealed ceremony could not be read. A closed set, exported as a runtime `as const` so the
 * suite asserts against THIS array rather than a literal copied beside the assertion — the defect
 * this project has now shipped eight times (`6-9b:576-588`).
 *
 * - `no_revealed_spins` — the ceremony exists and NOTHING has been revealed yet. ⭐ It is a REFUSAL
 *   rather than an empty success on purpose (AC2): an affordance that looks like it did work must be
 *   gated on a non-zero denominator, and a wheel rendered over zero spins is exactly the vacuous
 *   shape 6.9b's headline review finding was about.
 * - `read_failed` — a transport error, or a row this file cannot trust.
 */
export const REVEAL_READ_REASONS = ['no_revealed_spins', 'read_failed'] as const;

export type RevealReadRefusal = (typeof REVEAL_READ_REASONS)[number];

/** Why a viewer-bound name is not being shown. `unresolved` is the roster's, the rest are the guard's. */
export type NameRefusal = 'unresolved' | SafeTextRefusal;

/**
 * One winner of one award.
 *
 * ⭐ DECISION Y — WINNERS ARE SEPARATE ELEMENTS, NOT A `' · '`-JOINED STRING, and the reason is
 * measured rather than stylistic. `6-9b:354` found that `VIEWER_TEXT_MAX = 80` applied to a joined
 * aggregate sends the WHOLE subtitle to the fallback when ONE co-winner has an emoji-ZWJ Steam name
 * (U+200D is ubiquitous in them) — so a shared trophy announced nobody. Judged per element, one
 * refused name costs one name.
 *
 * ⛔ A REFUSED ELEMENT IS REFUSED, NEVER DROPPED. `displayName` goes `null` and `nameRefusal` says
 * why; the winner stays in the list and stays counted. Dropping it would misreport who won, which is
 * the one thing this surface exists to get right.
 */
export interface RevealedWinner {
  readonly rosterEntryId: number;
  /** The safe display name, or `null` when the roster could not resolve it or the guard refused it. */
  readonly displayName: string | null;
  /** ⚠ ABSENT when `displayName` is present — never `'ok'`, never an empty string. */
  readonly nameRefusal?: NameRefusal;
}

/**
 * What ONE live award concluded in ONE revealed spin.
 *
 * ⚠ A PITY RESULT HAS `awardId === null` AND THEREFORE NO NAME, BUCKET OR DECIDING STAT. `0026:90-91`
 * made the column nullable precisely because *"a consolation prize is not a category"*, and
 * `award_viewer_read`'s join yields nothing for it BY CONSTRUCTION (`0028:402-412`). ⛔ Model it; do
 * not treat the nulls as an error and do not invent a name for it.
 */
export interface RevealedAward {
  readonly awardResultId: number;
  /** `null` on a pity result — see above. */
  readonly awardId: number | null;
  readonly name: string | null;
  /** ⚠ ABSENT when `name` is present OR when there is no award at all (a pity row refuses nothing). */
  readonly nameRefusal?: SafeTextRefusal;
  readonly bucket: string | null;
  readonly decidingStat: string | null;
  /** One of `OUTCOME_KINDS` (`lib/roulette/stage2.ts:320`). `tie` is in the vocabulary and never persisted. */
  readonly outcomeKind: string;
  readonly isPity: boolean;
  readonly isShared: boolean;
  /**
   * ⛔ 6.9a DECISION J — ABSENT, NEVER `0`. The engines carry an always-present exit step whose
   * no-ladder value is the integer zero, `0025:174` maps that to SQL NULL at the writer, and a model
   * that normalised NULL back to a number would republish the fourth spelling of "no rung" the
   * database went out of its way to remove.
   */
  readonly ladderExitStep?: number;
  /**
   * ⛔ DISPLAY ONLY, NEVER AN INPUT (SOLUTION-DESIGN:219, and `award_result.deciding_value` carries
   * the same warning on the column). Kept as TEXT: `numeric` has no lossless JS number, and this
   * value is rendered, never compared.
   */
  readonly decidingValue: string | null;
  /** The AD-19 integer rate pair, all-or-nothing (`award_result_deciding_pair_complete`). Display only. */
  readonly decidingNum: string | null;
  readonly decidingDen: string | null;
  readonly winners: readonly RevealedWinner[];
}

/** One wheel-turn, revealed. */
export interface RevealedSpin {
  /** ⚠ 1-BASED, dense and forward-only (`0029:697-698`); `verify.ts:658-661` refuses `< 1`. */
  readonly spinIndex: number;
  /** `'main'` or `'pity'` — the closed set `spin_kind_valid` enforces. */
  readonly kind: string;
  readonly awards: readonly RevealedAward[];
}

export interface RevealedCeremony {
  readonly ceremonyId: number;
  /** Ascending by `spin_index`. ⛔ This IS the published reveal order — see the note on the sort below. */
  readonly spins: readonly RevealedSpin[];
}

export type RevealReadResult =
  | { ok: true; ceremony: RevealedCeremony }
  | { ok: false; reason: RevealReadRefusal };

/** A `numeric`/`bigint` as PostgREST may hand it back, normalised to text or refused. */
type NumericText = { ok: true; text: string | null } | { ok: false };

/**
 * ⚠ POSTGREST SERIALISES `numeric` AND `bigint` INCONSISTENTLY ACROSS VALUES, so both spellings are
 * accepted and neither is trusted. A float is refused rather than rounded: this value is rendered to
 * an audience beside a hash that promises reproducibility.
 */
function numericText(v: unknown): NumericText {
  if (v === null || v === undefined) return { ok: true, text: null };
  // ⭐ THE STRING PATH IS THE TRUSTWORTHY ONE and it is first on purpose: PostgREST hands `numeric`
  // back as JSON text precisely because the value does not survive a double.
  if (typeof v === 'string') return { ok: true, text: v };
  // ⭐⭐ CODE REVIEW 2026-08-11 — THIS USED TO BE `Number.isFinite`, WHICH CONTRADICTED THE COMMENT
  // ABOVE IT. `isFinite` excludes only `NaN`/`±Infinity`, so `21.5` rendered as `21.5 bajas` and a
  // `numeric` past 2^53 — `0027:970` permits 38 integer digits — arrived as a double and announced
  // itself as `1.2345678901234568e+22` beside a hash that promises the digits shown are the digits
  // stored. ⛔ A float or an unsafe integer is REFUSED, never rounded and never stringified.
  if (typeof v === 'number' && Number.isSafeInteger(v)) return { ok: true, text: String(v) };
  return { ok: false };
}

/** The raw shapes, before any of them are trusted. */
interface SpinRow {
  id?: unknown;
  spin_index?: unknown;
  kind?: unknown;
  live_award_ids?: unknown;
}
interface ResultRow {
  id?: unknown;
  spin_id?: unknown;
  award_id?: unknown;
  outcome_kind?: unknown;
  is_pity?: unknown;
  is_shared?: unknown;
  tie_ladder_exit_step?: unknown;
  deciding_value?: unknown;
  deciding_num?: unknown;
  deciding_den?: unknown;
}
interface WinnerRow {
  id?: unknown;
  award_result_id?: unknown;
  winner_entry_id?: unknown;
}
interface AwardRow {
  id?: unknown;
  name?: unknown;
  bucket?: unknown;
  deciding_stat?: unknown;
}

/**
 * Read every REVEALED spin of `ceremonyId`, in published order, with its awards, winners and names.
 *
 * Five batched queries and no join through PostgREST's embedding syntax, deliberately: an embedded
 * select is one request whose RLS behaviour on a FAILING inner relation is harder to reason about
 * than five explicit ones, and `lib/roster/names.ts` already resolves display names in exactly this
 * batched shape for the feed and the bracket (⛔ there is not a second resolver).
 */
export async function fetchRevealedCeremony(
  client: SupabaseClient,
  ceremonyId: number,
): Promise<RevealReadResult> {
  // ── 1. the spins. RLS (`spin_viewer_read`) is what makes this "revealed only".
  //
  // ⛔⛔ ASCENDING BY `spin_index`, AND THE PUBLISHED SPIN ORDER IS THE REVEAL ORDER (UX-DR32/42,
  // `lib/ceremony/reveal.ts:102`). Reveals are forward-only and dense — `reveal_spin` refuses an
  // out-of-order index — so this ORDER BY re-states a server fact rather than imposing a client one.
  const { data: spinData, error: spinErr } = await client
    .from('spin')
    .select('id, spin_index, kind, live_award_ids')
    .eq('ceremony_id', ceremonyId)
    .order('spin_index', { ascending: true });

  if (spinErr) {
    console.error('[fetchRevealedCeremony] spin read failed:', spinErr.message);
    return { ok: false, reason: 'read_failed' };
  }

  const spinRows = (spinData ?? []) as SpinRow[];
  // ⭐ AC2 — THE NON-ZERO DENOMINATOR, AT THE READER. Zero revealed spins is a legitimate live state
  // (published bundle, nothing spun) and it is a REFUSAL here, so nothing downstream can render a
  // wheel, a shelf or a locked grid over it.
  if (spinRows.length === 0) return { ok: false, reason: 'no_revealed_spins' };

  const spinIds: number[] = [];
  const spinIndexById = new Map<number, number>();
  const spinKindById = new Map<number, string>();
  const drawOrderById = new Map<number, ReadonlyMap<number, number>>();

  for (const row of spinRows) {
    if (
      typeof row.id !== 'number' ||
      !Number.isSafeInteger(row.id) ||
      typeof row.spin_index !== 'number' ||
      !Number.isSafeInteger(row.spin_index) ||
      row.spin_index < 1 ||
      typeof row.kind !== 'string'
    ) {
      console.error('[fetchRevealedCeremony] spin row missing a usable field:', row);
      return { ok: false, reason: 'read_failed' };
    }
    // ⭐ CODE REVIEW 2026-08-11 — DENSITY AND FORWARD-ONLYNESS ARE A SERVER FACT, SO A DUPLICATE
    // `spin_index` IS A BROKEN READ, NOT A RENDERABLE ONE. Nothing rejected it before: two rows
    // sharing an index produced duplicate React keys in `Record`, an ambiguous stage key, and a
    // `Premio i de n` that disagreed with the spin count. Fail closed, like every other shape here.
    if (spinIndexById.has(row.id) || [...spinIndexById.values()].includes(row.spin_index)) {
      console.error('[fetchRevealedCeremony] duplicate spin id or spin_index:', row);
      return { ok: false, reason: 'read_failed' };
    }
    spinIds.push(row.id);
    spinIndexById.set(row.id, row.spin_index);
    spinKindById.set(row.id, row.kind);

    // ⭐⭐ `live_award_ids` IS THE DRAW ORDER AND THE REVEAL ORDER (`0025:127-129`), and
    // `sweep.test.ts:448` warns this story by name: *"sorting it in place would silently discard
    // it."* It is therefore READ AS AN ORDER KEY and never re-sorted. A spin whose column is null (a
    // pity spin decides no catalog award) simply contributes no key, and its results fall back to
    // insertion order below.
    const order = new Map<number, number>();
    if (Array.isArray(row.live_award_ids)) {
      row.live_award_ids.forEach((id, i) => {
        if (typeof id === 'number' && Number.isSafeInteger(id) && !order.has(id)) order.set(id, i);
      });
    }
    drawOrderById.set(row.id, order);
  }

  // ── 2. the results, gated through the parent spin.
  const { data: resultData, error: resultErr } = await client
    .from('award_result')
    .select(
      'id, spin_id, award_id, outcome_kind, is_pity, is_shared, tie_ladder_exit_step, deciding_value, deciding_num, deciding_den',
    )
    .in('spin_id', spinIds)
    .order('id', { ascending: true });

  if (resultErr) {
    console.error('[fetchRevealedCeremony] award_result read failed:', resultErr.message);
    return { ok: false, reason: 'read_failed' };
  }

  // ── 3. the winners, gated on their OWN denormalised `spin_id` (legitimate only because 0025's
  //       COMPOSITE FK makes a child disagreeing with its parent unrepresentable — `0028:351-360`).
  const { data: winnerData, error: winnerErr } = await client
    .from('award_result_winner')
    .select('id, award_result_id, winner_entry_id')
    .in('spin_id', spinIds)
    .order('id', { ascending: true });

  if (winnerErr) {
    console.error('[fetchRevealedCeremony] award_result_winner read failed:', winnerErr.message);
    return { ok: false, reason: 'read_failed' };
  }

  const resultRows = (resultData ?? []) as ResultRow[];
  const winnerRows = (winnerData ?? []) as WinnerRow[];

  // ── 4. the award identities, opened per-award by the two-hop gate.
  const awardIds = new Set<number>();
  for (const row of resultRows) {
    if (typeof row.award_id === 'number' && Number.isSafeInteger(row.award_id)) awardIds.add(row.award_id);
  }

  const awardById = new Map<number, { name: string | null; refusal?: SafeTextRefusal; bucket: string; decidingStat: string }>();
  if (awardIds.size > 0) {
    const { data: awardData, error: awardErr } = await client
      .from('award')
      .select('id, name, bucket, deciding_stat')
      .in('id', [...awardIds]);

    if (awardErr) {
      console.error('[fetchRevealedCeremony] award read failed:', awardErr.message);
      return { ok: false, reason: 'read_failed' };
    }

    for (const raw of (awardData ?? []) as AwardRow[]) {
      if (
        typeof raw.id !== 'number' ||
        !Number.isSafeInteger(raw.id) ||
        typeof raw.bucket !== 'string' ||
        typeof raw.deciding_stat !== 'string'
      ) {
        console.error('[fetchRevealedCeremony] award row missing a usable field:', raw);
        return { ok: false, reason: 'read_failed' };
      }
      // ⚠ THE NAME IS THE ONE FIELD AN ADMIN TYPED, so it goes through the guard `6-9b` shipped for
      // exactly this: `0023`'s `[^[:space:]]` check RETURNS TRUE for a lone U+200B, which would
      // render as an empty award card at the ceremony, and the column is unbounded.
      const checked = checkViewerText(raw.name);
      awardById.set(
        raw.id,
        checked.ok
          ? { name: checked.text, bucket: raw.bucket, decidingStat: raw.deciding_stat }
          : { name: null, refusal: checked.reason, bucket: raw.bucket, decidingStat: raw.deciding_stat },
      );
    }
  }

  // ── 5. the display names, through the SHARED batched roster→player resolver.
  const rosterIds = new Set<number>();
  for (const row of winnerRows) {
    if (typeof row.winner_entry_id === 'number' && Number.isSafeInteger(row.winner_entry_id)) {
      rosterIds.add(row.winner_entry_id);
    }
  }
  const names = await resolveNames(client, [...rosterIds]);

  // ⭐ CODE REVIEW 2026-08-11 — THE WINNER→RESULT DIRECTION NOW FAILS CLOSED LIKE ITS MIRROR. The
  // result→spin direction already refuses an orphan (`!spinIndexById.has(row.spin_id)` below), but a
  // winner whose parent `award_result` was absent from this read was simply never consulted: the
  // entry sat unread in `winnersByResult` and the card rendered *"Nadie alcanzó el mínimo"* over a
  // winner row the database had actually returned. ⛔ Silence is the one thing a reader that claims
  // to fail closed may not do about a row it received.
  const resultIds = new Set<number>();
  for (const row of resultRows) if (typeof row.id === 'number') resultIds.add(row.id);

  // ── assemble. Winners first, so each result can be built in one pass.
  const winnersByResult = new Map<number, RevealedWinner[]>();
  for (const row of winnerRows) {
    if (
      typeof row.id !== 'number' ||
      typeof row.award_result_id !== 'number' ||
      !Number.isSafeInteger(row.award_result_id) ||
      typeof row.winner_entry_id !== 'number' ||
      !Number.isSafeInteger(row.winner_entry_id)
    ) {
      console.error('[fetchRevealedCeremony] award_result_winner row missing a usable field:', row);
      return { ok: false, reason: 'read_failed' };
    }
    if (!resultIds.has(row.award_result_id)) {
      console.error('[fetchRevealedCeremony] winner row has no parent award_result in this read:', row);
      return { ok: false, reason: 'read_failed' };
    }
    const raw = names.get(row.winner_entry_id);
    // ⛔ TWO DIFFERENT FACTS, KEPT APART. `unresolved` is the roster's active-only policy hiding a
    // player REMOVED after playing (`names.ts:14-16`); a guard refusal is a name that exists and
    // cannot be shown safely. Collapsing them would tell a viewer someone left when they did not.
    let winner: RevealedWinner;
    if (raw === undefined) {
      winner = { rosterEntryId: row.winner_entry_id, displayName: null, nameRefusal: 'unresolved' };
    } else {
      const checked = checkViewerText(raw);
      winner = checked.ok
        ? { rosterEntryId: row.winner_entry_id, displayName: checked.text }
        : { rosterEntryId: row.winner_entry_id, displayName: null, nameRefusal: checked.reason };
    }
    const bucket = winnersByResult.get(row.award_result_id);
    if (bucket) bucket.push(winner);
    else winnersByResult.set(row.award_result_id, [winner]);
  }

  const awardsBySpin = new Map<number, RevealedAward[]>();
  for (const row of resultRows) {
    if (
      typeof row.id !== 'number' ||
      !Number.isSafeInteger(row.id) ||
      typeof row.spin_id !== 'number' ||
      !spinIndexById.has(row.spin_id) ||
      typeof row.outcome_kind !== 'string' ||
      typeof row.is_pity !== 'boolean' ||
      typeof row.is_shared !== 'boolean'
    ) {
      console.error('[fetchRevealedCeremony] award_result row missing a usable field:', row);
      return { ok: false, reason: 'read_failed' };
    }
    const awardId =
      row.award_id === null || row.award_id === undefined
        ? null
        : typeof row.award_id === 'number' && Number.isSafeInteger(row.award_id)
          ? row.award_id
          : undefined;
    if (awardId === undefined) {
      console.error('[fetchRevealedCeremony] award_result.award_id is neither an id nor null:', row.award_id);
      return { ok: false, reason: 'read_failed' };
    }

    const value = numericText(row.deciding_value);
    const num = numericText(row.deciding_num);
    const den = numericText(row.deciding_den);
    if (!value.ok || !num.ok || !den.ok) {
      console.error('[fetchRevealedCeremony] award_result carries an unusable deciding value:', row);
      return { ok: false, reason: 'read_failed' };
    }

    // ⛔ 6.9a DECISION J — the step is carried ONLY when the database has one. `null` (no ladder ran)
    // must not become `0`, and a non-integer must not become anything at all.
    const step = row.tie_ladder_exit_step;
    if (step !== null && step !== undefined && (typeof step !== 'number' || !Number.isSafeInteger(step))) {
      console.error('[fetchRevealedCeremony] tie_ladder_exit_step is neither an int nor null:', step);
      return { ok: false, reason: 'read_failed' };
    }

    const identity = awardId === null ? undefined : awardById.get(awardId);
    const award: RevealedAward = {
      awardResultId: row.id,
      awardId,
      name: identity?.name ?? null,
      ...(identity?.refusal === undefined ? {} : { nameRefusal: identity.refusal }),
      bucket: identity?.bucket ?? null,
      decidingStat: identity?.decidingStat ?? null,
      outcomeKind: row.outcome_kind,
      isPity: row.is_pity,
      isShared: row.is_shared,
      ...(typeof step === 'number' ? { ladderExitStep: step } : {}),
      decidingValue: value.text,
      decidingNum: num.text,
      decidingDen: den.text,
      winners: winnersByResult.get(row.id) ?? [],
    };

    const bucket = awardsBySpin.get(row.spin_id);
    if (bucket) bucket.push(award);
    else awardsBySpin.set(row.spin_id, [award]);
  }

  const spins: RevealedSpin[] = spinIds.map((spinId) => {
    const order = drawOrderById.get(spinId) ?? new Map<number, number>();
    const awards = awardsBySpin.get(spinId) ?? [];
    // ⚠ THE DRAW ORDER DECIDES, AND `award.priority` DOES NOT. `reveal_spin` aggregates its feed
    // title by priority (`0028:757`), which is a rendering choice for a one-line string; the reveal
    // is the one surface where the ORDER IS THE PRODUCT. A result whose award is absent from
    // `live_award_ids` (or a pity result, which has no award at all) keeps its insertion position
    // after the drawn ones — `Number.MAX_SAFE_INTEGER` rather than `-1`, so an unplaced row never
    // jumps ahead of a drawn one.
    const placed = awards.map((award, i) => ({
      award,
      key: award.awardId === null ? Number.MAX_SAFE_INTEGER : (order.get(award.awardId) ?? Number.MAX_SAFE_INTEGER),
      i,
    }));
    placed.sort((a, b) => (a.key === b.key ? a.i - b.i : a.key - b.key));
    return {
      spinIndex: spinIndexById.get(spinId) as number,
      kind: spinKindById.get(spinId) as string,
      awards: placed.map((p) => p.award),
    };
  });

  return { ok: true, ceremony: { ceremonyId, spins } };
}
