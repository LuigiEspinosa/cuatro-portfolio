import { describe, expect, it } from 'vitest';
import { es } from './es';
import {
  announceAward,
  announceSpin,
  AWARD_BUCKETS,
  awardTitle,
  bucketLabel,
  DECIDING_STATS,
  decidingPhrase,
  OUTCOME_COPY,
  OUTCOME_SENTENCE_ARMS,
  PHASE_COPY,
  statNoun,
  winnerName,
} from './ceremony-copy';
import { REVEAL_OUTCOMES, REVEAL_PHASES, type RevealAwardView } from '@/lib/ceremony/reveal-model';

/**
 * The reveal's machine→Spanish maps (Story 6.10, AC7/AC10 — AD-24).
 *
 * ⭐ THE POINT OF THE MODULE IS THAT EXHAUSTIVENESS IS A GATED ASSERTION INSTEAD OF A LIVE-QA HOPE —
 * `verify-copy.ts:7-13` states exactly that reasoning, and this file is what cashes it.
 */

function award(over: Partial<RevealAwardView> = {}): RevealAwardView {
  return {
    awardResultId: 9,
    awardId: 401,
    name: 'Máquina de Frags',
    bucket: 'skill',
    decidingStat: 'kills',
    decidingText: '21',
    outcome: 'winner',
    isPity: false,
    isShared: false,
    winners: [{ rosterEntryId: 11, displayName: 'Dex' }],
    ...over,
  };
}

// ── totality ────────────────────────────────────────────────────────────────────────────────────

describe('the maps are TOTAL over their runtime-derived domains (AC12)', () => {
  it('OUTCOME_COPY covers exactly REVEAL_OUTCOMES — no extras, no gaps', () => {
    expect(REVEAL_OUTCOMES.length).toBeGreaterThan(0);
    expect(Object.keys(OUTCOME_COPY).sort()).toEqual([...REVEAL_OUTCOMES].sort());
  });

  it('PHASE_COPY covers exactly REVEAL_PHASES', () => {
    expect(REVEAL_PHASES.length).toBeGreaterThan(0);
    expect(Object.keys(PHASE_COPY).sort()).toEqual([...REVEAL_PHASES].sort());
  });

  it('⛔ the bucket and stat vocabularies ARE their maps’ key lists — there is no second array to drift', () => {
    expect(AWARD_BUCKETS).toEqual(Object.keys(es.bucket));
    expect(DECIDING_STATS).toEqual(Object.keys(es.decidingStat));
    // The counts are pinned so a key silently DELETED from `es.ts` reddens, rather than shrinking a
    // "closed set" that quietly stopped being closed.
    expect(AWARD_BUCKETS).toHaveLength(4);
    expect(DECIDING_STATS).toHaveLength(21);
  });

  it.each([...REVEAL_OUTCOMES])('%s resolves to non-empty Spanish', (outcome) => {
    expect(OUTCOME_COPY[outcome].trim().length).toBeGreaterThan(0);
  });

  it.each([...AWARD_BUCKETS])('bucket %s resolves', (b) => {
    expect(bucketLabel(b)!.trim().length).toBeGreaterThan(0);
  });

  it.each([...DECIDING_STATS])('deciding stat %s resolves', (s) => {
    expect(statNoun(s)!.trim().length).toBeGreaterThan(0);
  });
});

describe('a value the closed set does not admit resolves to null — ⛔ never to a wrong label', () => {
  it('returns null for an unknown bucket and an unknown stat', () => {
    expect(bucketLabel('jackpot')).toBeNull();
    expect(statNoun('vibes')).toBeNull();
  });

  it('returns null for absent identity (a pity result has no bucket and no stat)', () => {
    expect(bucketLabel(null)).toBeNull();
    expect(statNoun(null)).toBeNull();
  });

  it('⛔ is not fooled by inherited Object properties', () => {
    // `Object.hasOwn`, not `in` / `?.[k]`: `es.bucket['toString']` is a FUNCTION, and a lookup that
    // reached it would render `[object Function]` on a live ceremony card.
    expect(bucketLabel('toString')).toBeNull();
    expect(statNoun('constructor')).toBeNull();
  });
});

// ── AC7: the copy, verbatim ─────────────────────────────────────────────────────────────────────

describe('AC7 — the ceremony strings, verbatim', () => {
  it('⚠ the two phase lines carry an EM DASH U+2014, not the mock’s middot', () => {
    expect(PHASE_COPY.stage1).toBe('Fase 1 — la suerte elige la categoría');
    expect(PHASE_COPY.stage2).toBe('Fase 2 — las estadísticas eligen al ganador');
    // `mock-ceremony.html:676,729` renders `Fase 1 · …`; the canon is an em dash and docs win.
    expect(PHASE_COPY.stage1).not.toContain('·');
    expect(PHASE_COPY.stage2).not.toContain('·');
    expect(PHASE_COPY.stage1.codePointAt(7)).toBe(0x2014);
  });

  it('carries the anti-sweep note and the consolation round exactly', () => {
    expect(es.reveal.oneTrophy).toBe('un trofeo por giro');
    expect(es.reveal.pityRound).toBe('Ronda de consolación');
    expect(es.reveal.pityPromise).toBe('Nadie se va con las manos vacías');
  });

  it('names the four buckets exactly as EXPERIENCE.md:90 does', () => {
    expect(bucketLabel('skill')).toBe('Habilidad');
    expect(bucketLabel('clutch')).toBe('Clutch');
    expect(bucketLabel('weird')).toBe('Rarezas del demo');
    expect(bucketLabel('comedy')).toBe('Comedia');
  });

  it('⛔ reuses `es.ceremony.seededByDemo` and never retypes it', () => {
    expect(es.ceremony.seededByDemo).toBe('Sembrado por el demo final · reproducible');
    // The hybrid `Verificado desde el demo · reproducible` at `mock-ceremony.html:909` is NOT a real
    // string — it is two different fixed strings spliced, and using it on the shared screen would make
    // the banner diverge from the phone.
    const everything = JSON.stringify(es);
    expect(everything).not.toContain('Verificado desde el demo · reproducible');
  });

  it('⚠⚠ `bajas` = KILLS and `muertes` = DEATHS — ⛔ no new instance of the deferred-work:255 ambiguity', () => {
    expect(statNoun('kills')).toBe('bajas');
    expect(statNoun('deaths')).toBe('muertes');
    expect(statNoun('knife_kills')).toBe('bajas con cuchillo');
    expect(statNoun('blind_kills')).toBe('bajas a ciegas');
    // Every kills-family stat reads `bajas`; nothing in the kills family may read `muertes`.
    for (const key of DECIDING_STATS) {
      if (key.endsWith('kills')) expect(statNoun(key), key).toContain('bajas');
    }
  });

  it('⛔ adds no third spelling for ADR / KAST / HS% — they are `es.player`’s', () => {
    expect(statNoun('adr')).toBe(es.player.adr);
    expect(statNoun('kast_pct')).toBe(es.player.kast);
    expect(statNoun('hs_pct')).toBe(es.player.hsPct);
  });

  it('obeys the EXPERIENCE.md:58-73 voice table', () => {
    const block = JSON.stringify({ reveal: es.reveal, bucket: es.bucket, decidingStat: es.decidingStat });
    for (const forbidden of ['¡', '✓', '💪', 'Más info', 'equidad', 'Premio de consolación para los que no ganaron']) {
      expect(block).not.toContain(forbidden);
    }
  });
});

// ── the three title cases ───────────────────────────────────────────────────────────────────────

describe('awardTitle — three different facts, three different strings (AC8)', () => {
  it('renders a present name verbatim', () => {
    expect(awardTitle(award())).toBe('Máquina de Frags');
  });

  it('a PITY result names the ROUND — it genuinely has no category (0026:104-113)', () => {
    expect(awardTitle(award({ awardId: null, name: null, isPity: true }))).toBe(es.reveal.pityRound);
  });

  it('a REFUSED name says so — ⛔ and does not borrow the pity round’s name', () => {
    const title = awardTitle(award({ name: null, nameRefusal: 'zero_width' }));
    expect(title).toBe(es.reveal.awardUnnamed);
    expect(title).not.toBe(es.reveal.pityRound);
  });

  it('⛔⛔ NONE of the three is the teaser copy that made the card lie', () => {
    for (const a of [award(), award({ awardId: null, name: null }), award({ name: null, nameRefusal: 'blank' })]) {
      expect(awardTitle(a)).not.toBe(es.award.revealAtCeremony);
      expect(awardTitle(a)).not.toBe(es.award.teaserTitle);
    }
  });
});

describe('winnerName — a removed player and a refused name are DIFFERENT facts (AC9)', () => {
  it('renders a resolved name verbatim', () => {
    expect(winnerName({ rosterEntryId: 11, displayName: 'Dex' })).toBe('Dex');
  });

  it('an UNRESOLVED id is the roster’s active-only policy — the shipped word for that', () => {
    expect(winnerName({ rosterEntryId: 11, displayName: null, nameRefusal: 'unresolved' })).toBe(es.unknownPlayer);
  });

  it('a REFUSED name is not a player who left', () => {
    const refused = winnerName({ rosterEntryId: 11, displayName: null, nameRefusal: 'zero_width' });
    expect(refused).toBe(es.reveal.nameUnavailable);
    expect(refused).not.toBe(es.unknownPlayer);
  });
});

// ── the deciding phrase and the announcement ────────────────────────────────────────────────────

describe('decidingPhrase — ⛔ display only, never rounded, never locale-formatted', () => {
  it('joins the digits to the Spanish noun', () => {
    expect(decidingPhrase(award())).toBe('21 bajas');
  });

  it('falls back to the bare digits when the stat key is unknown', () => {
    expect(decidingPhrase(award({ decidingStat: 'vibes' }))).toBe('21');
  });

  it('is null when the outcome had no value at all', () => {
    expect(decidingPhrase(award({ decidingText: null }))).toBeNull();
  });

  it('carries a rate pair through as stored — ⛔ never divided', () => {
    expect(decidingPhrase(award({ decidingStat: 'adr', decidingText: '73/100' }))).toBe('73/100 ADR');
  });
});

describe('announceAward — EXPERIENCE.md:145’s pattern (AC10)', () => {
  it('is name — bucket — stat — winner for a won award', () => {
    expect(announceAward(award())).toBe('Máquina de Frags — Habilidad — 21 bajas — Dex');
  });

  it('⭐ announces the OUTCOME when there is no stat — the corpus’s dominant card', () => {
    // 12 of 12 main spins resolve `no_eligible_players`, which has no deciding value. A screen-reader
    // user must hear what happened, not a name, a bucket and silence.
    const announced = announceAward(
      award({ outcome: 'no_eligible_players', decidingText: null, winners: [] }),
    );
    expect(announced).toBe('Máquina de Frags — Habilidad — Nadie alcanzó el mínimo.');
  });

  it('⛔ announces EVERY co-winner (AC9)', () => {
    const announced = announceAward(
      award({
        outcome: 'shared',
        isShared: true,
        winners: [
          { rosterEntryId: 11, displayName: 'Dex' },
          { rosterEntryId: 22, displayName: 'Theo' },
          { rosterEntryId: 33, displayName: null, nameRefusal: 'zero_width' },
        ],
      }),
    );
    expect(announced).toContain('Dex, Theo, ' + es.reveal.nameUnavailable);
    // ⛔ A refused element is REFUSED, never dropped — three winners are announced as three.
    expect(announced.split(', ')).toHaveLength(3);
  });

  it('⛔ drops empty segments rather than reading out bare dashes', () => {
    const announced = announceAward(
      award({ awardId: null, name: null, bucket: null, decidingStat: null, decidingText: null, isPity: true }),
    );
    expect(announced).not.toContain('—  —');
    expect(announced.startsWith(es.reveal.pityRound)).toBe(true);
  });

  it('⛔ never announces that an already-revealed award has not been revealed', () => {
    for (const outcome of [...REVEAL_OUTCOMES]) {
      expect(announceAward(award({ outcome, decidingText: null, winners: [] }))).not.toContain(
        es.award.revealAtCeremony,
      );
    }
  });
});

// ── the announcement's statement slot, and the spin-level join (code review, 2026-08-11) ────────

describe('⛔⛔ the statement slot is a SENTENCE or nothing — never an eyebrow label', () => {
  it('the sentence arms are exactly the three zero-winner outcomes', () => {
    // ⛔ DERIVED from OUTCOME_COPY's own keys, so a sixth outcome cannot quietly join the set.
    expect([...OUTCOME_SENTENCE_ARMS].sort()).toEqual(['no_awardable_value', 'no_eligible_players', 'tie']);
    expect(OUTCOME_SENTENCE_ARMS).not.toContain('winner');
    expect(OUTCOME_SENTENCE_ARMS).not.toContain('shared');
  });

  it('⭐ a PITY result announces the round and the name — ⛔ never "— Ganador —" between them', () => {
    // THE DOMINANT PATH: 28 of the 40 spins over the standing corpus are consolation spins, all with
    // a null deciding stat, so this arm ran on 70% of the ceremony and read "Ronda de consolacion —
    // Ganador — Mara" to every screen-reader user.
    const line = announceAward(
      award({ awardId: null, name: null, bucket: null, decidingStat: null, decidingText: null, isPity: true,
        outcome: 'winner', winners: [{ rosterEntryId: 33, displayName: 'Mara' }] }),
    );
    expect(line).toBe(`${es.reveal.pityRound} — Mara`);
    expect(line).not.toContain(es.reveal.winnerLabel);
  });

  it('a SHARED trophy with no stat announces the names, not the "Trofeo compartido" eyebrow', () => {
    const line = announceAward(
      award({ decidingStat: null, decidingText: null, outcome: 'shared', isShared: true,
        winners: [{ rosterEntryId: 11, displayName: 'Dex' }, { rosterEntryId: 22, displayName: 'Theo' }] }),
    );
    expect(line).not.toContain(es.reveal.sharedTrophy);
    expect(line).toContain('Dex');
    expect(line).toContain('Theo');
  });

  it('⭐ a zero-winner award still puts its OUTCOME SENTENCE in the slot — silence would be worse', () => {
    const line = announceAward(
      award({ decidingStat: null, decidingText: null, outcome: 'no_eligible_players', winners: [] }),
    );
    expect(line).toContain(es.reveal.noEligiblePlayers);
  });

  it('a deciding stat still wins the slot over everything else', () => {
    expect(announceAward(award())).toContain('21');
  });
});

describe('announceSpin — one live-region string per spin', () => {
  it('⛔ does not double a full stop that the outcome copy already carries', () => {
    // The old renderer joined with ". " and three of the five OUTCOME_COPY values end in "." —
    // multi-award spins are real (`live_award_ids: [401, 402]`), so this read "...minimo.. Muralla".
    const line = announceSpin([
      award({ awardResultId: 1, decidingStat: null, decidingText: null, outcome: 'no_eligible_players', winners: [] }),
      award({ awardResultId: 2, name: 'Muralla', decidingText: '9', winners: [{ rosterEntryId: 11, displayName: 'Dex' }] }),
    ]);
    expect(line).not.toContain('..');
    expect(line).toContain(es.reveal.noEligiblePlayers);
    expect(line).toContain('Muralla');
    // ⛔ and the two announcements are separated by exactly one space after that full stop.
    expect(line).toContain(`${es.reveal.noEligiblePlayers} `);
  });

  it('adds the separating full stop when the previous award did NOT end in one', () => {
    const line = announceSpin([
      award({ awardResultId: 1, decidingText: '21' }),
      award({ awardResultId: 2, name: 'Muralla', decidingText: '9' }),
    ]);
    expect(line).toContain('. ');
    expect(line).not.toContain('..');
  });

  it('a single award is its own announcement, with nothing appended', () => {
    expect(announceSpin([award()])).toBe(announceAward(award()));
  });

  it('no awards is the empty string — ⛔ not a bare separator', () => {
    expect(announceSpin([])).toBe('');
  });
});
