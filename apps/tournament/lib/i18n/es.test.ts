import { describe, it, expect } from 'vitest';
import {
  es,
  categoriasSelladas,
  ganadoresAnunciados,
  premioAnunciado,
  premioBloqueado,
  premioDe,
  valorDecidido,
} from './es';

/**
 * The Spanish copy helpers that carry a CONTRACT rather than just a string (Story 6.1 code review).
 *
 * `premioBloqueado` is AC4's accessible name verbatim — the one string a screen-reader user hears for a locked
 * award — and `categoriasSelladas` must agree in number, because a one-award catalog is a legal curation and
 * `1 categorías selladas.` is wrong Spanish on the block's only fixed-copy line. Neither had a test; both are
 * viewer-facing copy under AD-24, where a defect is invisible to every other gate the project runs.
 */

/** Real award identity copy — none of it may appear in a locked card's accessible name or in es.awards (AD-22). */
const AWARD_IDENTITY_STRINGS = ['Máquina de Frags', 'El Más Generoso', 'A Cuchillo', 'kills', 'deaths', 'skill'];

describe('categoriasSelladas — agrees in NUMBER (AD-24)', () => {
  it('uses the SINGULAR for exactly one sealed category', () => {
    expect(categoriasSelladas(1)).toBe('1 categoría sellada.');
  });

  it.each([0, 2, 12, 64])('uses the plural for %i', (n) => {
    expect(categoriasSelladas(n)).toBe(`${n} categorías selladas.`);
  });
});

describe("premioBloqueado — AC4's accessible name, verbatim", () => {
  it('is `Premio {i} de {n} — bloqueado hasta que gire` with an EM DASH', () => {
    expect(premioBloqueado(7, 12)).toBe('Premio 7 de 12 — bloqueado hasta que gire');
    // U+2014 — not a hyphen and not an en dash. The AC quotes this exact character.
    expect(premioBloqueado(7, 12)).toContain('—');
  });

  it('names an award by POSITION only — never by identity', () => {
    const announced = premioBloqueado(1, 12);
    for (const identity of AWARD_IDENTITY_STRINGS) {
      expect(announced).not.toContain(identity);
    }
  });

  it('builds on premioDe so the two cannot drift apart', () => {
    expect(premioDe(3, 9)).toBe('Premio 3 de 9');
    expect(premioBloqueado(3, 9).startsWith(premioDe(3, 9))).toBe(true);
  });
});

describe('es.awards — the locked block carries no award identity', () => {
  it('defines both plural forms', () => {
    expect(es.awards.sealedSuffix).toBeTruthy();
    expect(es.awards.sealedSuffixOne).toBeTruthy();
  });

  it('names no award, bucket or deciding stat anywhere in the block', () => {
    const block = JSON.stringify(es.awards);
    for (const identity of AWARD_IDENTITY_STRINGS) {
      expect(block).not.toContain(identity);
    }
  });
});

describe('es.verify — a TOP-LEVEL SIBLING, deliberately not under es.awards (Story 6.9b, AC7)', () => {
  /**
   * ⛔⛔ WHY THE PLACEMENT IS A TEST AND NOT A CONVENTION. The scan two blocks above runs
   * `JSON.stringify(es.awards)` and substring-matches `AWARD_IDENTITY_STRINGS` — which sweeps KEY
   * NAMES as well as values. `es.awards.verify.*` would therefore be inside an AD-22 scan that
   * verify copy has no business being in, and the first key someone added containing `skill` or
   * `kills` would fail a test about award secrecy for a reason that had nothing to do with it.
   * ⚠ Verify copy is NOT AD-22-scoped: it names no award, and structurally it cannot — the strip
   * renders a hash and an outcome.
   */
  it('lives at the top level, not nested inside es.awards', () => {
    expect(Object.hasOwn(es, 'verify')).toBe(true);
    expect(Object.hasOwn(es.awards, 'verify')).toBe(false);
  });

  it('the AD-22 scan over es.awards is unchanged by this story', () => {
    // ⛔ `AWARD_IDENTITY_STRINGS` IS NOT TOUCHED BY 6.9b. Re-asserted here so a future reader can see
    // the list was left alone deliberately rather than forgotten.
    expect(AWARD_IDENTITY_STRINGS).toHaveLength(6);
    expect(Object.keys(es.awards).sort()).toEqual([
      'coverTitle',
      'lockedUntilSpin',
      'reveal',
      'sealedSuffix',
      'sealedSuffixOne',
      'sechead',
      'subhead',
    ]);
  });

  it('carries no award identity of its own', () => {
    // Not because AD-22 requires it here, but because it is cheap and it makes the claim above
    // ("structurally it cannot") a measurement instead of an assertion.
    const block = JSON.stringify(es.verify);
    for (const identity of AWARD_IDENTITY_STRINGS) {
      expect(block).not.toContain(identity);
    }
  });

  it('every value is a non-empty string — no nested groups', () => {
    const entries = Object.entries(es.verify);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(typeof value, `es.verify.${key}`).toBe('string');
      expect((value as string).trim().length, `es.verify.${key}`).toBeGreaterThan(0);
    }
  });

  it('the outcome strings are sentence-case Spanish, not the Don’t column', () => {
    // EXPERIENCE.md:58-73 — "Verificar la ceremonia", never "Más info sobre la equidad", and never
    // corporate cheer.
    const block = JSON.stringify(es.verify);
    for (const forbidden of ['Más info', 'equidad', '¡', '💪', '✓']) {
      expect(block).not.toContain(forbidden);
    }
  });
});

/**
 * ⭐⭐ STORY 6.10, AC7 — THE REVEAL GROUP'S PLACEMENT, CHECKED DELIBERATELY RATHER THAN ASSUMED.
 *
 * The story asks in so many words to *"check deliberately whether the new ceremony copy trips the
 * key-name sweep"*, because unlike 6.9b's verify copy — which names no award and structurally cannot
 * — this copy DOES name awards: a revealed award's identity is exactly what it renders. That is
 * legitimate (`award_viewer_read` opens the identity at its spin, `0028:436-445`), and it is
 * precisely why the group must sit OUTSIDE a scan whose job is to prove the LOCKED block leaks
 * nothing. The answer is that it does not trip the sweep — because the sweep is scoped to
 * `es.awards`, and this is a sibling. Asserted in both directions.
 */
describe('es.reveal — a TOP-LEVEL SIBLING, and the AD-22 sweep is untouched (Story 6.10, AC7)', () => {
  it('lives at the top level, not nested inside es.awards', () => {
    expect(Object.hasOwn(es, 'reveal')).toBe(true);
    expect(Object.hasOwn(es, 'bucket')).toBe(true);
    expect(Object.hasOwn(es, 'decidingStat')).toBe(true);
    expect(Object.hasOwn(es.awards, 'bucket')).toBe(false);
    expect(Object.hasOwn(es.awards, 'decidingStat')).toBe(false);
  });

  it('⚠ `es.awards.reveal` is the 6.1 LOCKED PILL and is a different thing entirely', () => {
    // ⛔ A NAME COLLISION WORTH ASSERTING RATHER THAN DISCOVERING. `es.awards.reveal` has existed
    // since 6.1 as the string `SE DESBLOQUEA EN LA CEREMONIA` on the locked leaderboards block — so
    // `Object.hasOwn(es.awards, 'reveal')` is TRUE and always was, and a placement test written
    // against it would have failed for a reason that had nothing to do with this story's group.
    expect(typeof es.awards.reveal).toBe('string');
    expect(typeof es.reveal).toBe('object');
    expect(es.awards.reveal).toBe('SE DESBLOQUEA EN LA CEREMONIA');
  });

  it('⛔ es.awards is BYTE-UNCHANGED by this story — same seven keys, same AD-22 scan', () => {
    // ⛔ `AWARD_IDENTITY_STRINGS` IS NOT TOUCHED BY 6.10 either. Re-asserted so a future reader can
    // see the list was left alone deliberately rather than forgotten.
    expect(AWARD_IDENTITY_STRINGS).toHaveLength(6);
    expect(Object.keys(es.awards).sort()).toEqual([
      'coverTitle',
      'lockedUntilSpin',
      'reveal',
      'sealedSuffix',
      'sealedSuffixOne',
      'sechead',
      'subhead',
    ]);
    const block = JSON.stringify(es.awards);
    for (const identity of AWARD_IDENTITY_STRINGS) {
      expect(block).not.toContain(identity);
    }
  });

  it('⚠ and the sweep WOULD have caught the new copy had it been nested — so the placement matters', () => {
    // ⛔ NON-VACUITY FOR THE PLACEMENT CLAIM. If the new groups happened to contain none of the
    // identity strings, "it is outside the scan" would be a fact about the copy rather than about the
    // structure, and someone could later move it in harmlessly-looking. They cannot: the bucket map's
    // KEY `skill` and the stat map's keys `kills` / `deaths` are all in the list, so nesting these
    // groups under `es.awards` reddens the AD-22 scan immediately.
    const wouldBeScanned = JSON.stringify({ ...es.awards, bucket: es.bucket, decidingStat: es.decidingStat });
    const tripped = AWARD_IDENTITY_STRINGS.filter((s) => wouldBeScanned.includes(s));
    expect(tripped).toEqual(expect.arrayContaining(['skill', 'kills', 'deaths']));
  });

  it('every es.reveal value is a non-empty string — no nested groups', () => {
    const entries = Object.entries(es.reveal);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(typeof value, `es.reveal.${key}`).toBe('string');
      expect((value as string).trim().length, `es.reveal.${key}`).toBeGreaterThan(0);
    }
  });

  it('obeys the EXPERIENCE.md:58-73 voice table', () => {
    const block = JSON.stringify({ reveal: es.reveal, bucket: es.bucket, decidingStat: es.decidingStat });
    for (const forbidden of ['Más info', 'equidad', '¡', '💪', '✓']) {
      expect(block).not.toContain(forbidden);
    }
  });
});

describe('the reveal helpers (Story 6.10, AC10)', () => {
  it('premioAnunciado joins with EM DASHES and DROPS empty segments', () => {
    expect(premioAnunciado('Máquina de Frags', 'Habilidad', '21 bajas')).toBe(
      'Máquina de Frags — Habilidad — 21 bajas',
    );
    // ⚠ A pity result has no bucket and no deciding stat; two bare dashes are what a screen reader
    // would actually read out.
    expect(premioAnunciado('Ronda de consolación', '', '', 'Mara')).toBe('Ronda de consolación — Mara');
    expect(premioAnunciado('solo')).toBe('solo');
    expect(premioAnunciado()).toBe('');
  });

  it('ganadoresAnunciados speaks every winner — ⚠ `, ` rather than the visual middle dot', () => {
    expect(ganadoresAnunciados(['Dex', 'Theo', 'Mara'])).toBe('Dex, Theo, Mara');
    expect(ganadoresAnunciados(['Dex'])).toBe('Dex');
    expect(ganadoresAnunciados([])).toBe('');
    expect(ganadoresAnunciados(['Dex', 'Theo'])).not.toContain('·');
  });

  it('valorDecidido renders the stored digits verbatim — ⛔ no rounding, no locale separators', () => {
    expect(valorDecidido('21', 'bajas')).toBe('21 bajas');
    expect(valorDecidido('1234567', 'bajas')).toBe('1234567 bajas');
    expect(valorDecidido('1234567', 'bajas')).not.toContain(',');
    expect(valorDecidido('73/100', 'ADR')).toBe('73/100 ADR');
  });
});