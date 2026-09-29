import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  collectRosterIds,
  entryTypeNode,
  formatFeedTime,
  toCardModel,
  truncateHash,
} from '@/lib/feed/model';
import { es } from '@/lib/i18n/es';
import type { FeedRow } from '@/lib/feed/types';

const NAMES = new Map<number, string>([
  [11, 'Dex'],
  [22, 'Theo'],
  [33, 'Mara'],
]);

describe('entryTypeNode (AC3 — node color is a pure function of entry_type)', () => {
  it('maps each entry type to its sanctioned color', () => {
    expect(entryTypeNode('bracket_advance')).toBe('blue');
    expect(entryTypeNode('match_result')).toBe('green');
    expect(entryTypeNode('award_reveal')).toBe('gold');
  });

  it('falls back to muted (never gold) for an unrecognised type — gold is the reveal-only leak', () => {
    expect(entryTypeNode('rollback' as never)).toBe('muted');
  });
});

describe('formatFeedTime (AC4 — HH:MM · <position>, 24h, absolute, event-local America/Bogota UTC-5)', () => {
  it('formats time + bracket position in event time (21:12Z → 16:12 Bogota)', () => {
    expect(formatFeedTime('2026-07-28T21:12:00Z', 'Winners R1')).toBe('16:12 · Winners R1');
  });

  it('zero-pads and drops an empty position (09:05Z → 04:05 Bogota)', () => {
    expect(formatFeedTime('2026-07-28T09:05:00Z', null)).toBe('04:05');
    expect(formatFeedTime('2026-07-28T09:05:00Z', '   ')).toBe('04:05');
  });

  it('degrades (never throws) on a malformed timestamp', () => {
    expect(formatFeedTime('not-a-date', 'gran final')).toBe('gran final');
    expect(formatFeedTime('not-a-date', null)).toBe('');
  });
});

describe('truncateHash', () => {
  it('truncates a full sha to first-8…last-4', () => {
    expect(truncateHash('a3f1c9e2deadbeefcafe12347b40')).toBe('a3f1c9e2…7b40');
  });
  it('passes a short value through unchanged', () => {
    expect(truncateHash('abc123')).toBe('abc123');
  });
});

describe('toCardModel — match_result (AC4)', () => {
  const row: FeedRow = {
    id: 5,
    tournament_id: 7,
    entry_type: 'match_result',
    occurred_at: '2026-07-28T21:12:00Z',
    target_match_id: 42,
    detail: {
      winner_entry: 11,
      loser_entry: 22,
      score_a: 16,
      score_b: 13,
      bracket_position: 'Winners R1',
      demo_sha256: 'a3f1c9e2deadbeefcafe12347b40',
    },
  };

  it('shapes names, seat-ordered score, winner-green flag, provenance and aria', () => {
    const card = toCardModel(row, NAMES);
    expect(card).toMatchObject({
      kind: 'match_result',
      id: 5,
      node: 'green',
      time: '16:12 · Winners R1',
      winner: 'Dex',
      loser: 'Theo',
      winnerScore: 16,
      loserScore: 13,
      verified: true,
      hash: 'a3f1c9e2…7b40',
      href: '/bracket?match=42',
      aria: 'Resultado aprobado: Dex venció a Theo 16-13',
    });
  });

  it('renders the score winner-first regardless of seat (winner in seat B: score_a < score_b)', () => {
    const card = toCardModel({ ...row, detail: { ...(row.detail as object), score_a: 13, score_b: 16 } }, NAMES);
    if (card.kind !== 'match_result') throw new Error('kind');
    // Winner-first: the winner's number leads (green), matching the title + aria + mock — even
    // though the winner sat in seat B (score_b holds the higher score). This is the P1 review fix.
    expect(card.winnerScore).toBe(16);
    expect(card.loserScore).toBe(13);
    expect(card.aria).toBe('Resultado aprobado: Dex venció a Theo 16-13');
  });

  it('tolerates a null target_match_id — links to the bracket root', () => {
    const card = toCardModel({ ...row, target_match_id: null }, NAMES);
    expect(card.href).toBe('/bracket');
  });

  it('degrades a manual row with no demo: no verified chip, no hash (not a crash)', () => {
    const card = toCardModel({ ...row, detail: { ...(row.detail as object), demo_sha256: null } }, NAMES);
    if (card.kind !== 'match_result') throw new Error('kind');
    expect(card.verified).toBe(false);
    expect(card.hash).toBeNull();
  });

  it('falls back to a neutral label when a roster id does not resolve (removed player edge)', () => {
    const card = toCardModel(row, new Map([[11, 'Dex']])); // 22 (loser) missing → removed player
    if (card.kind !== 'match_result') throw new Error('kind');
    expect(card.winner).toBe('Dex');
    expect(card.loser).toBe('Jugador retirado');
  });
});

describe('toCardModel — bracket_advance / award_reveal render by construction (AC2)', () => {
  it('renders a bracket_advance card even though no writer exists', () => {
    const card = toCardModel(
      {
        id: 9,
        tournament_id: 7,
        entry_type: 'bracket_advance',
        occurred_at: '2026-07-28T21:14:00Z',
        target_match_id: null,
        detail: { advancing_entry: 33, round: 'Winners R2' },
      },
      NAMES,
    );
    expect(card).toMatchObject({ kind: 'bracket_advance', node: 'blue', player: 'Mara', round: 'Winners R2', href: '/bracket' });
  });

  it('renders an award_reveal card with gold node and teaser fallbacks', () => {
    const card = toCardModel(
      {
        id: 12,
        tournament_id: 7,
        entry_type: 'award_reveal',
        occurred_at: '2026-07-28T23:00:00Z',
        target_match_id: null,
        detail: {},
      },
      NAMES,
    );
    expect(card).toMatchObject({ kind: 'award_reveal', node: 'gold', href: '/leaderboards' });
  });
});

describe('collectRosterIds', () => {
  it('collects and de-duplicates winner/loser/advancing ids across rows', () => {
    const rows: FeedRow[] = [
      {
        id: 1,
        tournament_id: 7,
        entry_type: 'match_result',
        occurred_at: 't',
        target_match_id: null,
        detail: { winner_entry: 11, loser_entry: 22 },
      },
      {
        id: 2,
        tournament_id: 7,
        entry_type: 'bracket_advance',
        occurred_at: 't',
        target_match_id: null,
        detail: { advancing_entry: 11 }, // dup of 11
      },
    ];
    expect(collectRosterIds(rows).sort()).toEqual([11, 22]);
  });

  it('returns an empty array when no rows carry roster ids', () => {
    expect(collectRosterIds([])).toEqual([]);
  });
});

/**
 * ⭐ Story 6.8b (AC8) — the `award_reveal` ROUND TRIP, now that the entry type finally has a WRITER.
 *
 * `timeline_feed.entry_type` has admitted `'award_reveal'` since `0017:109` with nothing writing one, so
 * every assertion above this block renders "by construction". Migration 0028's `reveal_spin` is the writer,
 * and these cases feed the detail shapes IT ACTUALLY PRODUCES through `toCardModel`.
 *
 * ⚠ THE THREE SHAPES ARE NOT HAND-INVENTED — they are the three branches the RPC's `v_detail` builder can
 * emit, and `describe('the writer’s detail contract …')` below proves that by reading the migration source.
 * Measured against a real ceremony on a local stack (main-with-winner, main-zero-winner, pity):
 *   {"kind":"main","title":"Cuchillero","subtitle":"Ana","spin_index":1,"award_count":1,"winner_count":1}
 *   {"kind":"main","title":"Muralla",                   "spin_index":2,"award_count":1,"winner_count":0}
 *   {"kind":"pity",                 "subtitle":"Beto",  "spin_index":3,"award_count":0,"winner_count":1}
 *
 * ⚠ DECISION H — the writer emits DATA, never COPY. AD-24 keeps every viewer string in `lib/i18n/es.ts` and
 * this renderer prints `detail.title` / `detail.subtitle` VERBATIM, so a branch with no fact to state OMITS
 * the key and the shipped fallback carries it. That is deliberate, and it is asserted here on BOTH branches
 * rather than left to be discovered.
 */
describe('toCardModel — the award_reveal shapes reveal_spin actually writes (Story 6.8b, AC8)', () => {
  /**
   * ⚠ WRITTEN AS ESCAPES, NEVER AS PASTED CHARACTERS (Story 6.10). Both of these are INVISIBLE, which
   * is the entire hazard `lib/i18n/safe-text.ts` exists for — a literal one in a source file is
   * unreviewable, survives exactly one careless reformat, and the case then silently stops testing
   * anything while still passing. U+200D is the emoji ZWJ and is ubiquitous in Steam display names;
   * U+200B is the zero-width space `0023`'s `[^[:space:]]` check accepts as a legal award name.
   */
  const ZWJ_SUBTITLE = 'Ana · Be\u200Dto';
  const ZWSP_TITLE = '\u200B';

  const revealRow = (detail: unknown): FeedRow => ({
    id: 12,
    tournament_id: 7,
    entry_type: 'award_reveal',
    occurred_at: '2026-07-28T23:00:00Z',
    target_match_id: null,
    detail: detail as FeedRow['detail'],
  });

  it('a main spin WITH a winner renders the award name and the winner name, on the gold rail', () => {
    const card = toCardModel(
      revealRow({
        spin_index: 1,
        kind: 'main',
        award_count: 1,
        winner_count: 1,
        title: 'Cuchillero',
        subtitle: 'Ana',
      }),
      NAMES,
    );
    expect(card).toMatchObject({
      kind: 'award_reveal',
      node: 'gold',
      title: 'Cuchillero',
      subtitle: 'Ana',
      href: '/leaderboards',
      aria: 'Cuchillero — Ana',
    });
  });

  it('CO-WINNERS arrive pre-joined by the writer — the renderer never sees an array', () => {
    // FR-29 rung 5 shares a trophy, and `award_result_winner` is 1..N rows. The SQL aggregates them with
    // `string_agg(… , ' · ')` so the card model stays a flat `{title, subtitle}` string pair.
    const card = toCardModel(
      revealRow({ spin_index: 4, kind: 'main', award_count: 1, winner_count: 3, title: 'Muralla', subtitle: 'Ana · Beto · Caro' }),
      NAMES,
    );
    expect(card).toMatchObject({ kind: 'award_reveal', title: 'Muralla', subtitle: 'Ana · Beto · Caro' });
  });

  it('⭐ a ZERO-WINNER main spin keeps the award name and falls back for the subtitle ONLY', () => {
    // ⚠ Over the measured corpus this is the COMMON case, not an edge: 0/28 players clear the FR-21
    // 24-rounds/20-kills floors, so all 12 main spins resolved `no_eligible_players`. The award IS revealed
    // (its catalog row became viewer-readable); nobody won it.
    const card = toCardModel(
      revealRow({ spin_index: 2, kind: 'main', award_count: 1, winner_count: 0, title: 'Muralla' }),
      NAMES,
    );
    expect(card).toMatchObject({ kind: 'award_reveal', node: 'gold', title: 'Muralla' });
    // ⭐⭐ STORY 6.10, AC8 — THIS ASSERTION IS THE CLOSURE OF `deferred-work.md:369`. It used to read
    // `es.award.revealAtCeremony`, i.e. the test PINNED the defect: an award that had just been
    // revealed announcing *"Se revela en la ceremonia"*, on the ceremony's dominant card.
    expect((card as Extract<typeof card, { kind: 'award_reveal' }>).subtitle).toBe(es.reveal.feedNoWinner);
    // ⛔ AND IT NO LONGER SAYS IT ANYWHERE ON THE CARD — the second site (the lockpill in
    // `TimelineFeed.tsx`) is what made it a DOUBLING, and fixing one without the other left it wrong.
    expect((card as Extract<typeof card, { kind: 'award_reveal' }>).aria).not.toContain(
      es.award.revealAtCeremony,
    );
  });

  it('⭐ a PITY spin reveals a WINNER but NO catalog award — the title names the ROUND (R6, AC8)', () => {
    // A pity result carries `award_id is null` (0026:90-91), so it reveals no catalog award at all and the
    // writer has no name to state. ⭐ STORY 6.10 CLOSES THE GAP 6.8b ASSERTED RATHER THAN HID: the shipped
    // fallback was PRE-ceremony teaser copy (*"Las carreras de premios se aprietan"*) on an
    // already-revealed consolation prize. The writer states `kind` in `detail` (`0028:779`), so the card
    // can name the round instead of guessing — and Q4 (Cuatro, 2026-08-11) settled that the round is the
    // frame and the token shirt is the prize, so there is no thirteenth category to name.
    const card = toCardModel(
      revealRow({ spin_index: 3, kind: 'pity', award_count: 0, winner_count: 1, subtitle: 'Beto' }),
      NAMES,
    );
    expect(card).toMatchObject({ kind: 'award_reveal', node: 'gold', subtitle: 'Beto' });
    expect((card as Extract<typeof card, { kind: 'award_reveal' }>).title).toBe(es.reveal.pityRound);
  });

  it('a MISSING detail still degrades without throwing — and ⛔ never to teaser copy (AC8)', () => {
    // `lib/feed/model.ts` — one malformed row must never blank the feed. Exercised for `{}`, for a null
    // detail, and for keys of the wrong TYPE (a number is not a string).
    // ⛔ THE FALLBACKS CHANGED AT 6.10 AND THE REASON IS STRUCTURAL, NOT AESTHETIC: `award_reveal` rows are
    // written by `reveal_spin` and by NOTHING else, so such a row is BY CONSTRUCTION already revealed. A
    // fallback that says otherwise is false on every row that can reach it.
    // ⭐⭐ CODE REVIEW 2026-08-11 — THE CASE TABLE IS SPLIT BY FACT, BECAUSE IT USED TO PIN A FALSE
    // STATEMENT AS CORRECT. `{ title: 7, subtitle: false }` sat in the same row as `{}` and `null`
    // and was asserted to produce *"Sin ganador en esta categoría"* — a positive claim that nobody
    // won, made about a row whose `subtitle` key was PRESENT and merely the wrong type, i.e. one that
    // may well have had winners. Absent means the aggregate had no rows; a malformed value means the
    // names exist and cannot be shown. Two facts, two sentences — the rule this file's own comment
    // states three lines above `toCardModel`'s fallback.
    for (const detail of [{}, null, { title: null, subtitle: null }]) {
      const card = toCardModel(revealRow(detail), NAMES) as Extract<
        ReturnType<typeof toCardModel>,
        { kind: 'award_reveal' }
      >;
      expect(card.kind).toBe('award_reveal');
      expect(card.title).toBe(es.reveal.awardUnnamed);
      expect(card.subtitle).toBe(es.reveal.feedNoWinner);
      expect(card.node).toBe('gold');
    }

    for (const detail of [{ title: 7, subtitle: false }, { title: [], subtitle: 42 }]) {
      const card = toCardModel(revealRow(detail), NAMES) as Extract<
        ReturnType<typeof toCardModel>,
        { kind: 'award_reveal' }
      >;
      expect(card.kind).toBe('award_reveal');
      expect(card.title).toBe(es.reveal.awardUnnamed);
      // ⛔ NOT `feedNoWinner`: this row never says nobody won.
      expect(card.subtitle).toBe(es.reveal.namesUnavailable);
      expect(card.node).toBe('gold');
    }
  });

  it('⭐ a PRESENT-but-REFUSED subtitle says the names cannot be shown, ⛔ not that nothing was revealed', () => {
    // ⚠ ABSENT AND REFUSED ARE DIFFERENT FACTS. `string_agg` returns NULL only over ZERO ROWS
    // (`award.name` and `player.display_name` are both NOT NULL, `0028:749-752`), so an absent key means
    // "no winner". A key that IS present and fails the text guard means the names exist and cannot be
    // safely rendered — U+200D is the emoji ZWJ and is ubiquitous in Steam display names (`6-9b:354`).
    const card = toCardModel(
      // ⚠ WRITTEN AS AN ESCAPE, NOT AS A PASTED CHARACTER. The whole hazard is that U+200D is
      // INVISIBLE — a literal one in a test file is unreviewable and survives exactly one careless
      // reformat before the case silently stops testing anything.
      revealRow({ spin_index: 5, kind: 'main', award_count: 1, winner_count: 2, title: 'Muralla', subtitle: ZWJ_SUBTITLE }),
      NAMES,
    ) as Extract<ReturnType<typeof toCardModel>, { kind: 'award_reveal' }>;
    expect(card.subtitle).toBe(es.reveal.namesUnavailable);
    expect(card.subtitle).not.toBe(es.reveal.feedNoWinner);
    expect(card.title).toBe('Muralla');
  });

  it('⭐ a REFUSED title falls back without borrowing the pity round’s name', () => {
    const card = toCardModel(
      revealRow({ spin_index: 6, kind: 'main', award_count: 1, winner_count: 0, title: ZWSP_TITLE }),
      NAMES,
    ) as Extract<ReturnType<typeof toCardModel>, { kind: 'award_reveal' }>;
    expect(card.title).toBe(es.reveal.awardUnnamed);
    expect(card.title).not.toBe(es.reveal.pityRound);
  });
});

/**
 * ⭐⭐ GUARD THE GUARDS. The four cases above are hand-written rows, so on their own they prove only that
 * the renderer handles the shapes THIS FILE imagines. This block reads migration 0028's `reveal_spin` body
 * and asserts the renderer's contract against what the WRITER is actually coded to emit — the technique
 * 6.8a's review installed after finding a closed-set test "asserting against a hand-copied duplicate of
 * itself" (the project's signature defect, seventh occurrence).
 */
describe('the writer’s detail contract, read from migration 0028 rather than assumed', () => {
  const MIGRATION = new URL('../../supabase/migrations/0028_reveal_gating.sql', import.meta.url);

  function detailBuilder(): string {
    const sql = readFileSync(MIGRATION, 'utf8');
    const start = sql.indexOf('v_detail := jsonb_build_object(');
    const end = sql.indexOf('insert into public.timeline_feed');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return sql.slice(start, end);
  }

  it('the two RENDERED keys are exactly `title` and `subtitle`, and both are CONDITIONAL', () => {
    const src = detailBuilder();
    // Each rendered key is emitted through a `case when … is not null then jsonb_build_object('<k>', …)`
    // arm — which is precisely what makes the fallback branches above reachable rather than theoretical.
    for (const key of ['title', 'subtitle']) {
      expect(src).toMatch(new RegExp(`case when v_\\w+ is not null[\\s\\S]*?jsonb_build_object\\('${key}',`));
    }
  });

  it('the writer emits NO key the renderer would print that this file does not cover', () => {
    // Every quoted key in the builder, compared against the set this suite knows about. A NEW key added to
    // the SQL reddens here instead of shipping unrendered — and the count guard stops the regex from
    // passing vacuously if the slice above ever stops matching (the `bool_and`-over-an-empty-set trap).
    const keys = [...new Set([...detailBuilder().matchAll(/'([a-z_]+)',/g)].map((m) => m[1]))].sort();
    expect(keys.length).toBeGreaterThanOrEqual(6);
    expect(keys).toEqual(['award_count', 'kind', 'spin_index', 'subtitle', 'title', 'winner_count']);
  });

  it('⛔ the writer contains NO Spanish literal — DECISION H: it emits DATA, never COPY (AD-24)', () => {
    // The renderer prints title/subtitle verbatim, so a Spanish sentence in the SQL would be viewer copy
    // living outside the one i18n module. The only strings the builder may name are jsonb KEYS (snake_case
    // ASCII) — anything carrying an accent, an ñ, or a non-key Spanish word would break AD-24 silently.
    expect(detailBuilder()).not.toMatch(/[áéíóúñ¿¡]/i);
  });
});
