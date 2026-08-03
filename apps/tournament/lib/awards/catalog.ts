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
}

/**
 * Project the catalog onto the RPC's payload shape. The ONLY producer of a curate payload — a caller that hand-
 * built one would be a second definition site of the catalog, which is exactly what AC1 forbids.
 *
 * `secondary_stat` / `eff_num_key` / `eff_den_key` are deliberately omitted (the RPC defaults them to NULL): the
 * FR-29 tiebreak ladder is Story 6.5's, and seeding a rung the ladder does not yet read would be inventing a
 * contract for a story that has not made its decisions.
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
  }));
}
