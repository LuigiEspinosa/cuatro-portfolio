import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  AWARD_CATALOG,
  FLOOR_KILLS_RATE,
  FLOOR_KILLS_VOLUME,
  FLOOR_ROUNDS,
  MEASURED_DEGENERATE,
  MEASURED_EMPTY,
  RATE_STAT_KEYS,
  STAT_VOCABULARY,
  THIN_BUT_REAL,
  VOLUME_STAT_KEYS,
  toCuratePayload,
  type StatKey,
} from './catalog';
// ⚠ IMPORTED BY THE TEST, NOT BY `catalog.ts`. `lib/roulette` is the one `lib/**` package that ships
// to the browser and must never import this `server-only` module; the dependency runs the other way
// here, in the suite, which is where "does the shipped catalog survive the shipped ladder" belongs.
import { LadderError, resolveLadder } from '../roulette/ladder';

/**
 * The seed catalog's guardrails (Story 6.1, AC1/AC3) — asserted on the CONSTANT itself, so a future edit that
 * would ship an unwinnable (or a duplicate-winner) award reddens a NAMED test here rather than surfacing on stage
 * at the ceremony. Migration 0023's CHECKs cover the DB half; this covers the SEED half, which is the half the
 * DB cannot see: the DB has no idea which of its perfectly-valid stat keys measured empty on our demos.
 */

const RATE_KEYS = new Set<string>(RATE_STAT_KEYS);
const VOLUME_KEYS = new Set<string>(VOLUME_STAT_KEYS);

describe('AWARD_CATALOG — shape (AC1)', () => {
  it('is exactly 12 awards', () => {
    expect(AWARD_CATALOG).toHaveLength(12);
  });

  it('is DEEPLY frozen — the catalog has ONE definition site and no runtime mutator', () => {
    expect(Object.isFrozen(AWARD_CATALOG)).toBe(true);
    // ⚠ The array being frozen was never the property that mattered (6.1 code review): `readonly` is erased at
    // compile time, so an unfrozen ELEMENT lets any module rewrite a deciding stat at runtime — past the
    // MEASURED_EMPTY guard — and the next curate posts it.
    for (const award of AWARD_CATALOG) {
      expect(Object.isFrozen(award), `award "${award.name}" is mutable at runtime`).toBe(true);
    }
  });

  it('rejects a runtime mutation of a deciding stat (the guard the freeze exists for)', () => {
    const victim = AWARD_CATALOG[0] as { decidingStat: string };
    expect(() => {
      'use strict';
      victim.decidingStat = 'assists'; // a MEASURED_EMPTY key
    }).toThrow();
    expect(AWARD_CATALOG[0].decidingStat).toBe('kills');
  });

  it('carries priorities exactly 1..12, each once', () => {
    const priorities = AWARD_CATALOG.map((a) => a.priority).sort((x, y) => x - y);
    expect(priorities).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('has unique, non-blank names (the `~ [^[:space:]]` rule — a TAB is not a name)', () => {
    const names = AWARD_CATALOG.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/[^\s]/);
    }
  });

  it('demonstrates all four buckets (the Don Clutch retirement left `clutch` empty — Rey del Duelo refills it)', () => {
    expect(new Set(AWARD_CATALOG.map((a) => a.bucket))).toEqual(
      new Set(['skill', 'clutch', 'weird', 'comedy']),
    );
    expect(AWARD_CATALOG.filter((a) => a.bucket === 'clutch').length).toBeGreaterThanOrEqual(1);
  });

  it('uses only `max` / `min` directions', () => {
    for (const a of AWARD_CATALOG) {
      expect(['max', 'min']).toContain(a.direction);
    }
  });
});

describe('AWARD_CATALOG — the vocabulary and class↔key coherence (AC1)', () => {
  it('names only keys that are in the vocabulary', () => {
    for (const a of AWARD_CATALOG) {
      expect(STAT_VOCABULARY).toContain(a.decidingStat);
    }
  });

  it('the vocabulary itself has no duplicates and is exactly rate ∪ volume', () => {
    expect(new Set(STAT_VOCABULARY).size).toBe(STAT_VOCABULARY.length);
    expect(new Set(STAT_VOCABULARY)).toEqual(new Set([...RATE_KEYS, ...VOLUME_KEYS]));
    // The two halves must be DISJOINT, or class↔key coherence is undecidable.
    for (const k of RATE_KEYS) {
      expect(VOLUME_KEYS.has(k)).toBe(false);
    }
  });

  it('a `rate` award names a rate key and a `volume` award names a volume key (what makes `class` honest)', () => {
    for (const a of AWARD_CATALOG) {
      if (a.class === 'rate') {
        expect(RATE_KEYS.has(a.decidingStat)).toBe(true);
      } else {
        expect(VOLUME_KEYS.has(a.decidingStat)).toBe(true);
      }
    }
  });
});

describe('AWARD_CATALOG — the FR-21 floors (AC1)', () => {
  it('applies floor_rounds = 24 to every award', () => {
    for (const a of AWARD_CATALOG) {
      expect(a.floorRounds).toBe(FLOOR_ROUNDS);
      expect(FLOOR_ROUNDS).toBe(24); // value-parity with public.leaderboard's literal (0021:56)
    }
  });

  it('applies floor_kills = 20 to rate awards and 0 to volume awards', () => {
    expect(FLOOR_KILLS_RATE).toBe(20);
    expect(FLOOR_KILLS_VOLUME).toBe(0);
    for (const a of AWARD_CATALOG) {
      expect(a.floorKills).toBe(a.class === 'rate' ? FLOOR_KILLS_RATE : FLOOR_KILLS_VOLUME);
    }
  });
});

describe('⭐ AWARD_CATALOG — measure zeros, never narrate them (AC3)', () => {
  it('seeds NO award over a MEASURED-EMPTY stat', () => {
    const seeded = AWARD_CATALOG.map((a) => a.decidingStat);
    for (const key of seeded) {
      expect(MEASURED_EMPTY.has(key)).toBe(false);
    }
  });

  it('the MEASURED_EMPTY set is non-trivial and every member is a real vocabulary key', () => {
    // A vacuous exclusion set would make the assertion above pass for the wrong reason.
    expect(MEASURED_EMPTY.size).toBeGreaterThanOrEqual(4);
    for (const key of MEASURED_EMPTY) {
      expect(STAT_VOCABULARY).toContain(key);
    }
  });

  it('seeds NO award over a MEASURED-DEGENERATE (exact per-player clone) stat', () => {
    // entry_frags/rounds_won ≡ kills and opening_deaths ≡ deaths on 28/28 players; kast_pct ≡ entry_success.
    // Seeding both halves of a pair crowns the same player twice BY CONSTRUCTION.
    for (const a of AWARD_CATALOG) {
      expect(MEASURED_DEGENERATE.has(a.decidingStat)).toBe(false);
    }
  });

  it('the MEASURED_DEGENERATE set is non-trivial and every member is a real vocabulary key', () => {
    expect(MEASURED_DEGENERATE.size).toBeGreaterThanOrEqual(4);
    for (const key of MEASURED_DEGENERATE) {
      expect(STAT_VOCABULARY).toContain(key);
    }
  });

  it('the two exclusion sets are disjoint (a stat is empty OR degenerate, never recorded as both)', () => {
    for (const key of MEASURED_EMPTY) {
      expect(MEASURED_DEGENERATE.has(key)).toBe(false);
    }
  });

  it('no two awards share a (deciding stat, direction) pair — a relabelled duplicate is not a twelfth award', () => {
    const pairs = AWARD_CATALOG.map((a) => `${a.decidingStat}:${a.direction}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

describe('AWARD_CATALOG — the Bajas/Muertes copy convention (closes deferred-work.md:255)', () => {
  it('labels `kills` as Bajas and `deaths` as Muertes — never the other way round', () => {
    const kills = AWARD_CATALOG.find((a) => a.decidingStat === 'kills');
    const deaths = AWARD_CATALOG.find((a) => a.decidingStat === 'deaths');
    expect(kills?.statLabel).toBe('Bajas');
    expect(deaths?.statLabel).toBe('Muertes');
  });

  it('gives every award a distinct, non-blank stat label (the ambiguity the item reported)', () => {
    const labels = AWARD_CATALOG.map((a) => a.statLabel);
    for (const label of labels) {
      expect(label).toMatch(/[^\s]/);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('never labels a non-deaths award "Muertes" nor a non-kills award "Bajas"', () => {
    for (const a of AWARD_CATALOG) {
      if (a.statLabel === 'Muertes') expect(a.decidingStat).toBe('deaths');
      if (a.statLabel === 'Bajas') expect(a.decidingStat).toBe('kills');
    }
  });
});

/**
 * ⭐ THE CROSS-LANGUAGE PIN (6.1 code review). The closed set is restated SIX times: four CHECK constraints and
 * `award_stat_vocabulary()` in migration 0023, plus `STAT_VOCABULARY` here. pgTAP pins the SQL copies to each
 * other, but NOTHING compared TypeScript to SQL, and pgTAP pinned only ONE of the four constraints — so a key
 * added to `award_deciding_stat_valid` and forgotten in `award_secondary_stat_valid` (or in this file) reddened
 * nothing, and the drift surfaced as a 23514 raised at the INSERT for a payload the RPC had already declared
 * valid. This reads the migration and pins every copy to this module.
 */
const MIGRATION = readFileSync(new URL('../../supabase/migrations/0023_award_catalog.sql', import.meta.url), 'utf8');

/** Pull the quoted stat keys out of the migration text between `marker` and `terminator`. */
function sqlKeys(marker: string, terminator: string): string[] {
  const start = MIGRATION.indexOf(marker);
  expect(start, `marker vanished from migration 0023 — update this test, not the assertion: ${marker}`).toBeGreaterThan(-1);
  const rest = MIGRATION.slice(start + marker.length);
  const end = rest.indexOf(terminator);
  expect(end, `terminator not found after ${marker}`).toBeGreaterThan(-1);
  return [...rest.slice(0, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('⭐ the vocabulary is pinned ACROSS the TS/SQL boundary (AC1)', () => {
  it.each([
    ['award_deciding_stat_valid', 'constraint award_deciding_stat_valid check (', '))'],
    ['award_secondary_stat_valid', 'constraint award_secondary_stat_valid check (', '))'],
    ['award_eff_num_key_valid', 'constraint award_eff_num_key_valid check (', '))'],
    ['award_eff_den_key_valid', 'constraint award_eff_den_key_valid check (', '))'],
  ])('CHECK %s carries EXACTLY the TypeScript vocabulary', (_name, marker, terminator) => {
    expect(new Set(sqlKeys(marker, terminator))).toEqual(new Set<string>(STAT_VOCABULARY));
  });

  it('award_stat_vocabulary() (the RPC guard copy) carries EXACTLY the TypeScript vocabulary', () => {
    expect(new Set(sqlKeys('else array[', ']'))).toEqual(new Set<string>(STAT_VOCABULARY));
  });

  it('award_stat_vocabulary(rate) and (volume) match the TypeScript halves', () => {
    expect(new Set(sqlKeys("when 'rate' then array[", ']'))).toEqual(new Set<string>(RATE_STAT_KEYS));
    expect(new Set(sqlKeys("when 'volume' then array[", ']'))).toEqual(new Set<string>(VOLUME_STAT_KEYS));
  });
});

describe('the module is SERVER-ONLY (AC4/AD-22)', () => {
  it("declares `import 'server-only'` — the file holding all 12 award identities must never reach a client", () => {
    // `server-only` only throws when a CLIENT component imports it, so the bundler is the real enforcement and no
    // runtime test can exercise it. Deleting the import therefore reddened NOTHING (found by mutation-testing this
    // very fix). Asserting on the source is what makes the guard non-removable in silence.
    const source = readFileSync(new URL('./catalog.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/^\s*import 'server-only';/m);
  });
});

describe('THIN_BUT_REAL — the 6.4/6.5 hand-off anchor (AC3)', () => {
  it('is non-trivial and every member is a real vocabulary key', () => {
    expect(THIN_BUT_REAL.size).toBeGreaterThanOrEqual(4);
    for (const key of THIN_BUT_REAL) {
      expect(STAT_VOCABULARY).toContain(key);
    }
  });

  it('names only stats that ARE seeded — a thin stat nobody awards is not a hazard', () => {
    const seeded = new Set<string>(AWARD_CATALOG.map((a) => a.decidingStat));
    for (const key of THIN_BUT_REAL) {
      expect(seeded, `${key} is flagged thin-but-real but no award decides on it`).toContain(key);
    }
  });

  it('is disjoint from both exclusion sets (a stat is thin, empty or degenerate — never two of them)', () => {
    for (const key of THIN_BUT_REAL) {
      expect(MEASURED_EMPTY.has(key)).toBe(false);
      expect(MEASURED_DEGENERATE.has(key)).toBe(false);
    }
  });
});

describe('the FR-29 rung keys (Story 6.5, Question 2 — MEASURED)', () => {
  it('every award declares all three, so no rung is permanently skipped at the ceremony', () => {
    for (const a of AWARD_CATALOG) {
      expect(STAT_VOCABULARY, `${a.name}.secondaryStat`).toContain(a.secondaryStat);
      expect(STAT_VOCABULARY, `${a.name}.effNumKey`).toContain(a.effNumKey);
      expect(STAT_VOCABULARY, `${a.name}.effDenKey`).toContain(a.effDenKey);
    }
  });

  it('no award breaks its own tie on its own deciding stat', () => {
    // The one value every tied player is EQUAL on by construction. A secondary that repeated it
    // would make rung 1 a guaranteed no-op — real code that can never resolve anything.
    for (const a of AWARD_CATALOG) {
      expect(a.secondaryStat, a.name).not.toBe(a.decidingStat);
    }
  });

  /**
   * ⭐⭐ THE CLONE RELATION, RE-MEASURED AND SYMMETRIC (Story 6-5b, AC7 / T8).
   *
   * The previous table said `kast_pct` was a clone of `kills`, cited `catalog.ts:163-166` as the
   * measurement, and CONTRADICTED it: that measurement records `kast_rounds == kills` and concludes
   * `kast_pct` ranks identically to **`entry_success`**, not to `kills`. It was re-measured over the
   * real 14-demo corpus (`worker/cmd/qa65b`, deleted before commit; 204 counted rounds, 28 distinct
   * SteamID64) rather than re-argued, and the numbers are:
   *
   *   kast_rounds == kills                       28/28 players   (the recorded premise HOLDS)
   *   kast_pct    == entry_success  EXACTLY      28/28 players   → a clone, as rationals
   *   kast_pct    == kills          EXACTLY       0/28 players
   *   kast_pct    ranks identically to kills      FALSE
   *   entry_frags ranks identically to kills      TRUE
   *   rounds_won  ranks identically to kills      TRUE
   *   opening_deaths ranks identically to deaths  TRUE
   *
   * And the operative fact for rung 1, which is stronger than "ranks identically": of the SIX `kills`
   * ties the corpus produces, `kast_pct` BREAKS ONE (the width-14 tie at kills = 9, where 7 distinct
   * values appear) while `entry_frags` breaks NONE. The cause is that `kast_pct` is
   * `kast_rounds / rounds_played` and `rounds_played` differs across matches — so it can break a
   * `kills` tie whenever the tied players played different numbers of rounds. Of the TEN
   * `entry_success` ties, `kast_pct` is constant on all ten: degenerate there, and only there.
   *
   * ⚠ `kast_pct` STAYS IN `MEASURED_DEGENERATE` — that set records "clone of something already
   * seeded", and `entry_success` IS seeded (#5 Rey del Duelo). Only this table was wrong.
   *
   * ⭐ SYMMETRIC, because the relation is. An award deciding on `entry_frags` whose secondary is
   * `kills` is the identical defect as the reverse, and passed unchallenged when the table was read
   * one-way only.
   */
  const CLONE_PAIRS: readonly (readonly [StatKey, StatKey])[] = [
    ['kills', 'entry_frags'],
    ['kills', 'rounds_won'],
    ['entry_frags', 'rounds_won'],
    ['deaths', 'opening_deaths'],
    ['entry_success', 'kast_pct'],
  ];

  const areClones = (a: StatKey, b: StatKey): boolean =>
    CLONE_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  it('⭐ the clone table is a MEASURED fact about keys that are actually in play', () => {
    // ⛔ THE VACUITY THE OLD GUARD SHIPPED WITH. `clonesOf[a.decidingStat] ?? []` made the assertion
    // below trivially true for every award NOT deciding on `kills` or `deaths` — and nothing asserted
    // that any award decided on either. Ten of the twelve decided on neither, so the guard was live
    // for two awards and vacuous for ten.
    const decided = new Set<string>(AWARD_CATALOG.map((a) => a.decidingStat));
    const covered = CLONE_PAIRS.filter(([x, y]) => decided.has(x) || decided.has(y));
    expect(
      covered.length,
      'no seeded award decides on a key that has a measured clone — the guard below is vacuous',
    ).toBeGreaterThanOrEqual(3);
    // Every key named in the table is a real vocabulary key, or the table is describing nothing.
    for (const [x, y] of CLONE_PAIRS) {
      expect(STAT_VOCABULARY).toContain(x);
      expect(STAT_VOCABULARY).toContain(y);
      expect(x).not.toBe(y);
    }
  });

  it('⭐ no secondary is a MEASURED CLONE of its own deciding stat, in EITHER direction', () => {
    // ⭐⭐ THE MEASURED RULE, PINNED. A secondary that is an exact per-player clone of the stat that
    // TIED produces a rung that CANNOT BREAK A TIE IT IS EVER HANDED. Story 6.5's BAR reproduced that
    // at the ladder itself: over the corpus's five real ties, `entry_frags` and `rounds_won` left the
    // `kills` tie unresolved and `opening_deaths` left the `deaths` tie unresolved, while `adr` broke
    // all five.
    for (const a of AWARD_CATALOG) {
      expect(
        areClones(a.decidingStat, a.secondaryStat),
        `${a.name}: ${a.secondaryStat} is a measured clone of ${a.decidingStat}, so rung 1 can never break its tie`,
      ).toBe(false);
    }
  });

  it('no secondary is MEASURED_EMPTY — a Σ0 stat breaks nothing', () => {
    for (const a of AWARD_CATALOG) {
      expect(MEASURED_EMPTY.has(a.secondaryStat), `${a.name}.secondaryStat`).toBe(false);
    }
  });

  it('⭐ the RUNG-2 keys are held to the same measured rules as the secondary', () => {
    // ⛔ NEITHER THE CLONE TABLE NOR `MEASURED_EMPTY` WAS APPLIED TO THE EFFICIENCY PAIR AT ALL
    // (Story 6-5b, T8). Rung 2 is a real rung with a real published contract; a pair over a Σ0 stat,
    // or over two clones of each other, is a rung that ships configured and cannot discriminate —
    // exactly what rung 1's guards exist to prevent, one rung down.
    for (const a of AWARD_CATALOG) {
      for (const key of [a.effNumKey, a.effDenKey] as const) {
        expect(MEASURED_EMPTY.has(key), `${a.name}: rung 2 over the Σ0 stat ${key}`).toBe(false);
        expect(STAT_VOCABULARY, `${a.name}: rung-2 key ${key}`).toContain(key);
      }
      // `num / den` where the two are exact clones is 1 for EVERYONE — a configured rung that cannot
      // discriminate, which is worse than a skipped one because it looks like coverage.
      expect(
        areClones(a.effNumKey, a.effDenKey),
        `${a.name}: ${a.effNumKey}/${a.effDenKey} is a ratio of two clones — 1 for everyone`,
      ).toBe(false);
    }
  });

  it('⭐ the efficiency pair is one the SHIPPED LADDER accepts, driven rather than asserted', () => {
    // ⛔ THE OLD GUARD WAS A TYPE TAUTOLOGY. `expect(typeof a.effNumKey).toBe('string')` cannot fail:
    // `SeedAward.effNumKey` is declared `StatKey`, a union of string literals, so the compiler has
    // already proved it — which left `effNumKey !== effDenKey` as the only load-bearing line in the
    // test. The real risk it claimed to cover is that the ladder REFUSES a half-configured or
    // out-of-vocabulary pair AT THE CEREMONY, so this drives the shipped ladder over the shipped
    // catalog and asserts it does not refuse on the AWARD group.
    for (const a of AWARD_CATALOG) {
      const award = {
        decidingStat: a.decidingStat,
        class: a.class,
        direction: a.direction,
        floorRounds: a.floorRounds,
        floorKills: a.floorKills,
        secondaryStat: a.secondaryStat,
        effNumKey: a.effNumKey,
        effDenKey: a.effDenKey,
      };
      const roster = ['76561198000000011', '76561198000000022'].map((steamid64, i) => ({
        steamid64,
        roundsPlayed: 30n,
        kills: 20n,
        idleDq: false,
        volume: {},
        rate: {},
        achievementTs: BigInt(1000 + i),
      }));
      let detail: string | undefined;
      try {
        resolveLadder(award, [roster[0]!.steamid64, roster[1]!.steamid64], roster);
      } catch (err) {
        detail = err instanceof LadderError ? err.detail : 'not-a-LadderError';
      }
      // ⚠ A `player` refusal is EXPECTED and CORRECT: this synthetic roster carries no `secondary`
      // block, so rung 1 lands on the absent-KEY refusal. What must NEVER happen is `award` or
      // `stage2` — those mean the CATALOG itself is malformed, which is the thing under test.
      //
      // ⛔⛔ THE POSITIVE ASSERTION COMES FIRST, AND IT USED TO BE MISSING. Two `not.toBe` checks
      // are both satisfied by `detail === undefined` — i.e. by `resolveLadder` NOT THROWING AT ALL
      // — and by `'not-a-LadderError'`. So an award that fell through to rung 4 and resolved on
      // `achievementTs` (1000n vs 1001n, which this roster supplies) passed a test whose entire
      // claim is "the shipped catalog survives the shipped ladder", proving nothing for that award.
      // Today every one of the twelve refuses `player`, but only by accident of the catalog's
      // current shape — one award losing its `secondaryStat` would have silently gone unchecked.
      // (Story 6-5b code review, 2026-08-06.)
      expect(
        detail,
        `${a.name}: the ladder RESOLVED this synthetic roster instead of refusing it — the row proves nothing, because the assertions below pass for an award that never reached a guard`,
      ).toBe('player');
      expect(detail, `${a.name}: the shipped ladder refuses this award's own surface`).not.toBe(
        'award',
      );
      expect(detail, `${a.name}: the shipped ladder refuses this award's Stage-2 surface`).not.toBe(
        'stage2',
      );
      // `k / k` is 1 for everyone — a rung that cannot discriminate.
      expect(a.effNumKey, a.name).not.toBe(a.effDenKey);
    }
  });
});

describe('toCuratePayload — the RPC projection (AC1/AC4)', () => {
  it('maps every award, argument by argument, into the RPC snake_case shape', () => {
    const payload = toCuratePayload();
    expect(payload).toHaveLength(12);
    const first = AWARD_CATALOG[0];
    expect(payload[0]).toEqual({
      name: first.name,
      bucket: first.bucket,
      class: first.class,
      deciding_stat: first.decidingStat,
      direction: first.direction,
      floor_rounds: first.floorRounds,
      floor_kills: first.floorKills,
      priority: first.priority,
      // ⭐ Story 6.5 — the three FR-29 rung keys now RIDE the payload. 6.1 omitted them because the
      // ladder had made no decisions yet; 6.5 MEASURED which keys break the real corpus's five ties
      // and filled them, and omitting them now would leave rungs 1 and 2 permanently skipped.
      secondary_stat: first.secondaryStat,
      eff_num_key: first.effNumKey,
      eff_den_key: first.effDenKey,
    });
  });

  it('carries NO statLabel — award identity copy must never ride the payload (AD-22)', () => {
    for (const row of toCuratePayload()) {
      expect(Object.keys(row)).not.toContain('statLabel');
      expect(Object.keys(row).sort()).toEqual(
        [
          'bucket',
          'class',
          'deciding_stat',
          'direction',
          'eff_den_key',
          'eff_num_key',
          'floor_kills',
          'floor_rounds',
          'name',
          'priority',
          'secondary_stat',
        ],
      );
    }
  });

  it('projects a caller-supplied catalog too (the seam the tests and the route share)', () => {
    const one: StatKey = 'kills';
    const payload = toCuratePayload([
      {
        name: 'Solo',
        bucket: 'skill',
        class: 'volume',
        decidingStat: one,
        direction: 'max',
        statLabel: 'Bajas',
        floorRounds: 24,
        floorKills: 0,
        priority: 1,
      },
    ]);
    expect(payload).toEqual([
      {
        name: 'Solo',
        bucket: 'skill',
        class: 'volume',
        deciding_stat: 'kills',
        direction: 'max',
        floor_rounds: 24,
        floor_kills: 0,
        priority: 1,
      },
    ]);
  });
});
