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
    });
  });

  it('carries NO statLabel — award identity copy must never ride the payload (AD-22)', () => {
    for (const row of toCuratePayload()) {
      expect(Object.keys(row)).not.toContain('statLabel');
      expect(Object.keys(row).sort()).toEqual(
        ['bucket', 'class', 'deciding_stat', 'direction', 'floor_kills', 'floor_rounds', 'name', 'priority'],
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
