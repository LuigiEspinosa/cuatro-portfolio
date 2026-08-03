import { describe, it, expect } from 'vitest';
import { es, categoriasSelladas, premioBloqueado, premioDe } from './es';

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
