/**
 * The 12-award seed catalog — ONE definition site (Story 6.1, AC1/AC3).
 *
 * The admin route posts THIS constant; nothing re-derives it, and no other module restates an award's bucket,
 * class, deciding stat or floors. Migration 0023's CHECKs make a malformed award unrepresentable in the DB; this
 * file is what makes the SEED honest — the catalog we actually ship.
 *
 * ⭐⭐ THE CENTRAL RULE: **THE CATALOG IS MEASURED BEFORE IT IS SEEDED.** An award is a PROMISE that a stat can be
 * won. Seeding an award over a stat that is structurally empty in the current format produces a category with no
 * possible winner and no error anywhere to reveal it — the failure surfaces on stage, at the ceremony. Epic 5
 * learned that twice and expensively (5.2a's dead `AttackerBlind`; the Don Clutch retirement). So every deciding
 * stat below was DEMONSTRATED POPULATED over the 14 real 1v1-wingman demos before it was written here, and the
 * two exclusion sets at the bottom are enforced by `catalog.test.ts` so a future addition reddens a named test
 * instead of shipping an unwinnable — or an unwinnable-by-anyone-else — award.
 *
 * ⚠ COPY CONVENTION, and the standing item it closes (deferred-work.md:255). The mock labels the *kills* award
 * "habilidad · volumen · muertes" while the most-deaths comedy award is also "muertes" — two different awards
 * reading identically to a screen-reader user. The convention, already applied by the 5.7 review patch, is
 * **Bajas = kills · Muertes = deaths**, and `statLabel` below is its single definition site. Do not carry the
 * mock's ambiguity forward.
 *
 * ⚠ `statLabel` IS SERVER-SIDE ONLY. It is not a DB column and it is deliberately NOT part of the curate payload
 * — AD-22 forbids award identity reaching a client at all before its spin (AC4). It exists so Story 6.10's reveal
 * has one place to read the Spanish stat name from, rather than minting a thirteenth.
 */

// ⛔ SERVER ONLY (6.1 code review). This module is the single definition site of all twelve award NAMES, buckets,
// classes and deciding stats — precisely the identity AD-22/AC4 forbid reaching a client before a spin. Its two
// siblings (curate.ts, read.ts) already carry this guard; the file that actually holds the secrets was the one
// without it. A client component importing anything from here — even `STAT_VOCABULARY`, which pulls the whole
// module — would bundle every award identity into the browser, and only a served-HTML grep would notice.
import 'server-only';

export type AwardBucket = 'skill' | 'clutch' | 'weird' | 'comedy';
export type AwardClass = 'rate' | 'volume';
export type AwardDirection = 'max' | 'min';

/** Rate keys — `{num, den}` INTEGER pairs, never a float (AD-14/AD-19). */
export const RATE_STAT_KEYS = ['adr', 'hs_pct', 'kast_pct', 'entry_success'] as const;

/** Volume keys — integer totals. */
export const VOLUME_STAT_KEYS = [
  'kills',
  'deaths',
  'assists',
  'mvps',
  'flash_assists',
  'utility_damage',
  'knife_kills',
  'wallbang_kills',
  'through_smoke_kills',
  'no_scope_kills',
  'blind_kills',
  'entry_frags',
  'opening_deaths',
  'rounds_won',
  'rounds_played',
  'matches_played',
  'hs_kills',
] as const;

export type RateStatKey = (typeof RATE_STAT_KEYS)[number];
export type VolumeStatKey = (typeof VOLUME_STAT_KEYS)[number];
export type StatKey = RateStatKey | VolumeStatKey;

/**
 * The full vocabulary — the TypeScript mirror of migration 0023's `award_deciding_stat_valid` CHECK and of
 * `public.award_stat_vocabulary()`. Deliberately a SUPERSET of what is seeded: it carries the measured-empty keys
 * too, because the format could change and the schema should not need a migration when it does. The MEASUREMENT
 * bites at the seed (below), not at the vocabulary.
 */
export const STAT_VOCABULARY: readonly StatKey[] = [...VOLUME_STAT_KEYS, ...RATE_STAT_KEYS];

export interface SeedAward {
  readonly name: string;
  readonly bucket: AwardBucket;
  readonly class: AwardClass;
  readonly decidingStat: StatKey;
  readonly direction: AwardDirection;
  /** Spanish label for the deciding stat — server-side only (see the ⚠ above). Bajas = kills, Muertes = deaths. */
  readonly statLabel: string;
  readonly floorRounds: number;
  readonly floorKills: number;
  readonly priority: number;
  /**
   * FR-29 rung 1 — the secondary stat the tie ladder narrows on before anything else (0023:71).
   *
   * ⭐⭐ MEASURED, NOT NARRATED (Story 6.5, Question 2 — Cuatro's call, 2026-08-04). 0024's DECISION B
   * left all three keys NULL for 6.5 to fill, and filling them by name would have been exactly the
   * mistake Story 6.1's clone probe caught at the deciding stat. So every candidate key was run
   * against the FIVE REAL TIES the corpus produces (floors forced to 0 in the harness only), and the
   * measurement reproduced `MEASURED_DEGENERATE` at the LADDER: `entry_frags` and `rounds_won` do
   * NOT break the `kills` tie and `opening_deaths` does NOT break the `deaths` tie, because each is
   * an exact per-player clone of the stat that tied. `adr` breaks ALL FIVE.
   *
   * So `adr` is the secondary for every award that is not already decided by it, and the two `adr`
   * awards fall back to `kills`. It is also the semantically right answer — damage per round is the
   * ordinary "who actually played better" measure — and, being a RATE key on the EIGHT VOLUME
   * awards (8 volume + 4 rate = 12; `adr` is the secondary on all eight of the volume ones plus the
   * two rate awards not already decided by it), it is what makes the ladder's L5 cross-class path
   * the NORMAL case rather than an exotic one. ⚠ The count was "nine" until the Group-1 code review
   * counted it: measure, never narrate, applies to the comments too.
   */
  readonly secondaryStat: StatKey;
  /**
   * FR-29 rung 2 — the efficiency ratio `eff_num_key / eff_den_key`, resolved by pure integer
   * cross-multiplication over AD-19's uniform `{num, den}` form (0023:72-73).
   *
   * ⚠ BOTH-OR-NEITHER: the ladder refuses a half-configured pair (a skip means "this award declines
   * rung 2"; half a ratio means somebody edited the catalog and stopped). `kills / deaths` is the
   * universal second-order CS measure and is the BACKSTOP behind `adr` — on today's corpus rung 1
   * resolves every real tie, so rung 2 never executes; it is filled so the rung is CONFIGURED rather
   * than permanently skipped, and `direction` inverts it for `El Inofensivo` exactly as it inverts
   * rung 1.
   *
   * ⭐⭐ THE DENOMINATOR IS `deaths`, AND A ZERO DENOMINATOR IS A REAL SHAPE ON A 1v1 CORPUS —
   * ACCEPTED AND DOCUMENTED RATHER THAN ENGINEERED AWAY (Cuatro, Group-1 code review, 2026-08-04).
   * Under 6-4a's S3 semantics, which L6 forbids this story from changing, the rung-2 ratio
   * `kills·1 / 1·deaths` produces two degenerate cases that the choice of `deaths` makes ordinary
   * rather than exotic:
   *
   *   - a survivor with **0 deaths** yields `n/0`, which BEATS every finite value — so they win
   *     rung 2 outright on every `max` award, and are eliminated by everyone on `El Inofensivo`;
   *   - a survivor with **0 kills AND 0 deaths** yields `0/0`, which compares EQUAL to everything —
   *     so they can never be eliminated at rung 1 or rung 2 and ride to the shared rung 5.
   *
   * Both are consistent with Stage 2, which is the point: the ladder shares `compareValues` so that
   * "the ladder agrees with Stage 2" stays a fact rather than a claim. Neither is reachable on
   * today's corpus (rung 1 resolves all five real ties), and the alternative — a denominator that
   * cannot be zero, e.g. `rounds_played` — was left for a future measured pass rather than swapped
   * in unmeasured. ⛔ If you change this pair, re-run the Question-2 probe; do not reason about it.
   */
  readonly effNumKey: StatKey;
  readonly effDenKey: StatKey;
}

/** FR-21 anti-farm floors. Value-parity with `public.leaderboard`'s literals (0021:56) and 0023's defaults. */
export const FLOOR_ROUNDS = 24;
export const FLOOR_KILLS_RATE = 20;
export const FLOOR_KILLS_VOLUME = 0;

/**
 * ⛔ MEASURED EMPTY over the 14 real demos (204 counted rounds, 28 distinct SteamID64) — Σ total 0, zero players
 * non-zero, zero demos non-zero. A stat that measures empty DOES NOT GET AN AWARD, regardless of how good the
 * award name is. `catalog.test.ts` asserts no seeded award names one of these.
 *
 * `clutches` is deliberately ABSENT from this set: it is a jsonb column, not a deciding-stat key, so it is not in
 * the vocabulary at all. Don Clutch's retirement (Cuatro, 2026-07-21 — binding while the format is 1v1) removed
 * the AWARD, not the `clutch` BUCKET, which is still demonstrated below by `Rey del Duelo`.
 */
export const MEASURED_EMPTY: ReadonlySet<StatKey> = new Set<StatKey>([
  'no_scope_kills', // Σ0 — but only 16 scoped-weapon kills of 218; an ordinary 0-of-16 sample, not a dead field
  'assists', // Σ0 — no teammates in 1v1
  'flash_assists', // Σ0 — same reason
  'mvps', // Σ0 — a raw diagnostic counted RoundMVPAnnouncement total = 0; the mode emits none
]);

/**
 * ⛔ MEASURED DEGENERATE — populated, but an EXACT per-player CLONE of a stat that IS seeded, so an award over it
 * would have a GUARANTEED-identical winner to an award already in the catalog. Measured, not argued (Story 6.1
 * Task 0, over all 28 players of all 14 demos):
 *
 *   entry_frags    == kills   on 28/28 players   → ranks IDENTICALLY to `kills`
 *   rounds_won     == kills   on 28/28 players   → ranks IDENTICALLY to `kills`
 *   kast_rounds    == kills   on 28/28 players   → `kast_pct` ranks IDENTICALLY to `entry_success`
 *   opening_deaths == deaths  on 28/28 players   → ranks IDENTICALLY to `deaths`
 *
 * The cause is structural to the format: in 1v1 wingman every round is ONE duel between the only two players, so
 * that single kill IS the round's opening duel, wins the round, and earns the killer their KAST round. Seeding
 * both halves of any pair would crown the same player twice by construction and hand Story 6.6's anti-sweep a
 * rigged catalog to damp. ⚠ These stay in the VOCABULARY (a 5v5 format separates them immediately) — they are
 * only barred from the SEED. Cuatro's call, 2026-08-03, on the Task-0 measurement.
 */
export const MEASURED_DEGENERATE: ReadonlySet<StatKey> = new Set<StatKey>([
  'entry_frags',
  'rounds_won',
  'opening_deaths',
  'kast_pct',
]);

/**
 * ⚠ THIN BUT REAL — seeded, with the consequence RECORDED for 6.4/6.5 rather than fixed here. Tournament-wide
 * totals over the QA corpus: knife 1 · through-smoke 2 · blind 4 · wallbang 8. It is entirely likely that every
 * eligible player sits at 0 for the thinnest of them. Stage 2 picks the BEST value, so an all-zero field is a
 * WHOLE-ROSTER TIE that walks the FR-29 ladder to a shared trophy for everyone. Whether a zero deciding value is
 * awardable at all is a **6.4 / 6.5** question; 6.1's job is to keep the floors honest and write this down so the
 * later stories meet it as a specified case instead of discovering it live.
 */
export const THIN_BUT_REAL: ReadonlySet<StatKey> = new Set<StatKey>([
  'knife_kills',
  'through_smoke_kills',
  'blind_kills',
  'wallbang_kills',
]);

/**
 * THE CATALOG. Twelve awards, four buckets demonstrated (skill 4 · clutch 1 · weird 5 · comedy 2), every deciding
 * stat measured populated, and — per the Task-0 clone probe — no two awards sharing a ranking.
 *
 * ⭐ #5 `Rey del Duelo` is the DON CLUTCH REPLACEMENT. FR-20's clutch rule is a TRANSITION (a player must go from
 * a team with ≥2 alive to sole survivor); in 1v1 wingman the victim's team goes 1 → 0, never → 1, so `clutches` is
 * `{}` for every player of every match — proven structurally (`T:1 CT:1` on 221/221 rounds). `entry_success`
 * (Σ204 duels over 204 counted rounds) is the duel-win-rate axis that DOES fill in this format, and it keeps the
 * `clutch` bucket demonstrated. ⚠ Its clone `kast_pct` is barred above — seed exactly one of the pair.
 *
 * ⭐ #12 `El Inofensivo` is the catalog's only `direction: 'min'` award, and the only one that exercises the
 * `award.direction` column at all. It ranks the LEAST damage per round among players who cleared both floors —
 * a distinct winner from #2's `max` over the same stat, which is what makes it a real twelfth award rather than
 * a relabelled second.
 */
// ⚠ DEEP-frozen (6.1 code review). `Object.freeze` on the array alone leaves every award OBJECT mutable, and the
// `readonly` modifiers on `SeedAward` are erased at compile time — so `AWARD_CATALOG[4].decidingStat = 'assists'`
// used to succeed silently at runtime and the next curate would post it, MEASURED_EMPTY guard and all. Freezing
// the elements too is what makes "one definition site, no runtime mutator" a fact rather than a comment.
const SEED_CATALOG = [
  {
    name: 'Máquina de Frags',
    bucket: 'skill',
    class: 'volume',
    decidingStat: 'kills',
    direction: 'max',
    statLabel: 'Bajas', // Bajas = kills (NEVER "muertes" — deferred-work.md:255)
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 1,
  },
  {
    name: 'Rey del Daño',
    bucket: 'skill',
    class: 'rate',
    decidingStat: 'adr',
    direction: 'max',
    statLabel: 'Daño por ronda',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_RATE,
    // ⚠ `kills`, not `adr` — an award cannot break its own tie on its own deciding stat, which is
    // the one value every tied player is equal on by construction.
    secondaryStat: 'kills',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 2,
  },
  {
    name: 'Puntería Quirúrgica',
    bucket: 'skill',
    class: 'rate',
    decidingStat: 'hs_pct',
    direction: 'max',
    statLabel: '% de cabeza',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_RATE,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 3,
  },
  {
    name: 'Cabeza de Martillo',
    bucket: 'skill',
    class: 'volume',
    decidingStat: 'hs_kills',
    direction: 'max',
    statLabel: 'Bajas a la cabeza',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 4,
  },
  {
    name: 'Rey del Duelo',
    bucket: 'clutch',
    class: 'rate',
    decidingStat: 'entry_success',
    direction: 'max',
    statLabel: 'Duelos de apertura ganados',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_RATE,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 5,
  },
  {
    name: 'A Cuchillo',
    bucket: 'weird',
    class: 'volume',
    decidingStat: 'knife_kills',
    direction: 'max',
    statLabel: 'Bajas con cuchillo',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 6,
  },
  {
    name: 'Atraviesa-muros',
    bucket: 'weird',
    class: 'volume',
    decidingStat: 'wallbang_kills',
    direction: 'max',
    statLabel: 'Bajas a través de un muro',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 7,
  },
  {
    name: 'Fantasma del Humo',
    bucket: 'weird',
    class: 'volume',
    decidingStat: 'through_smoke_kills',
    direction: 'max',
    statLabel: 'Bajas a través del humo',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 8,
  },
  {
    name: 'Justicia Ciega',
    bucket: 'weird',
    class: 'volume',
    decidingStat: 'blind_kills',
    direction: 'max',
    statLabel: 'Bajas a ciegas',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 9,
  },
  {
    name: 'Manos de Piedra',
    bucket: 'weird',
    class: 'volume',
    decidingStat: 'utility_damage',
    direction: 'max',
    statLabel: 'Daño con utilidad',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 10,
  },
  {
    name: 'El Más Generoso',
    bucket: 'comedy',
    class: 'volume',
    decidingStat: 'deaths',
    direction: 'max',
    statLabel: 'Muertes', // Muertes = deaths (NEVER "bajas" — deferred-work.md:255)
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_VOLUME,
    secondaryStat: 'adr',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 11,
  },
  {
    name: 'El Inofensivo',
    bucket: 'comedy',
    class: 'rate',
    decidingStat: 'adr',
    direction: 'min',
    statLabel: 'Menor daño por ronda',
    floorRounds: FLOOR_ROUNDS,
    floorKills: FLOOR_KILLS_RATE,
    // ⚠ `kills`, not `adr` — see `Rey del Daño`. ⭐ And `direction: 'min'` INVERTS this rung, so the
    // most harmless player's tie is broken by the FEWEST kills, which is the coherent reading rather
    // than an accident: `El Inofensivo` is the catalog's only `min` award and the ladder's L4 says
    // direction inverts rungs 1-3 and never rung 4.
    secondaryStat: 'kills',
    effNumKey: 'kills',
    effDenKey: 'deaths',
    priority: 12,
  },
] as const satisfies readonly SeedAward[];

export const AWARD_CATALOG: readonly SeedAward[] = Object.freeze(SEED_CATALOG.map((a) => Object.freeze(a)));

/** One award as migration 0023's `curate_award_catalog` expects it (snake_case, no `statLabel` — see the ⚠ above). */
export interface CurateAwardPayload {
  name: string;
  bucket: AwardBucket;
  class: AwardClass;
  deciding_stat: StatKey;
  direction: AwardDirection;
  floor_rounds: number;
  floor_kills: number;
  priority: number;
  /**
   * The FR-29 rung keys (Story 6.5). ⭐ NO MIGRATION WAS NEEDED: 0023 already declares all three
   * columns with closed-set CHECKs that admit NULL (0023:71-73, 98-115) and `curate_award_catalog`
   * already validates and inserts them (0023:344-346, 380-390, 458-462) — 6.1 simply had no values
   * to send. This is the story that measured them.
   */
  secondary_stat: StatKey;
  eff_num_key: StatKey;
  eff_den_key: StatKey;
}

/**
 * Project the catalog onto the RPC's payload shape. The ONLY producer of a curate payload — a caller that hand-
 * built one would be a second definition site of the catalog, which is exactly what AC1 forbids.
 *
 * ⭐ `secondary_stat` / `eff_num_key` / `eff_den_key` ARE SENT SINCE STORY 6.5. 6.1 omitted them because the
 * FR-29 ladder had made no decisions yet and seeding a rung nothing read would have been inventing a contract;
 * 6.5 built the ladder, MEASURED which keys actually break the real corpus's five ties, and filled them. Omitting
 * them now would leave rungs 1 and 2 permanently skipped at the real ceremony.
 */
export function toCuratePayload(catalog: readonly SeedAward[] = AWARD_CATALOG): CurateAwardPayload[] {
  return catalog.map((a) => ({
    name: a.name,
    bucket: a.bucket,
    class: a.class,
    deciding_stat: a.decidingStat,
    direction: a.direction,
    floor_rounds: a.floorRounds,
    floor_kills: a.floorKills,
    priority: a.priority,
    secondary_stat: a.secondaryStat,
    eff_num_key: a.effNumKey,
    eff_den_key: a.effDenKey,
  }));
}
