import { describe, expect, it } from 'vitest';
import { VERIFY_COPY } from './verify-copy';
import { es } from './es';
import { VERIFY_OUTCOMES } from '@/lib/roulette/verify';

/**
 * AC7 — the five verification-outcome strings, and the map that reaches them.
 *
 * ⭐ THIS IS THE ONE PART OF THE VERIFY STRIP VITEST CAN SEE. `vitest.config.ts:17` collects
 * `lib/**` only and the environment is `node` with no jsdom, so the island's rendering is proven by
 * live-QA (AC13) — but the machine-to-Spanish mapping is pure data and belongs here, where it can
 * redden.
 */

describe('es.verify — AC7 authors the five outcome strings', () => {
  // ⛔ READS ITS EVIDENCE, runtime against runtime. The expected side is `VERIFY_OUTCOMES` as the
  // verifier actually holds it, never a literal list typed out here — the defect
  // `canonical.test.ts:213` records this project shipping eight times.
  it('covers every VerifyOutcome exactly, with no invented key', () => {
    expect(VERIFY_OUTCOMES.length).toBeGreaterThan(0);
    expect(Object.keys(VERIFY_COPY).sort()).toEqual([...VERIFY_OUTCOMES].sort());
  });

  it('every outcome resolves to a distinct, non-empty Spanish string', () => {
    const strings = VERIFY_OUTCOMES.map((o) => VERIFY_COPY[o]);
    for (const s of strings) {
      expect(typeof s).toBe('string');
      expect(s.trim().length).toBeGreaterThan(0);
    }
    // ⚠ DISTINCT MATTERS: two outcomes sharing a string means a viewer cannot tell "it matched" from
    // "it did not", which is the only thing this affordance exists to say.
    expect(new Set(strings).size).toBe(strings.length);
  });

  it('the button label is the FIXED string, verbatim', () => {
    // EXPERIENCE.md:62 and :75 — a load-bearing transparency string. ⛔ Never "Más info sobre la
    // equidad", which is the Don't column of that same table.
    expect(es.verify.button).toBe('Verificar la ceremonia');
    expect(es.verify.button).not.toContain('equidad');
  });

  it('reuses the FIXED provenance line rather than a second spelling of it', () => {
    // ⛔ `es.ceremony.seededByDemo` carries `// FIXED — do not paraphrase`. The strip renders THAT
    // string; a near-copy under `es.verify` would be the third spelling of one sentence.
    expect(es.ceremony.seededByDemo).toBe('Sembrado por el demo final · reproducible');
    for (const key of Object.keys(es.verify)) {
      const value = (es.verify as Record<string, string>)[key] as string;
      expect(value).not.toBe(es.ceremony.seededByDemo);
    }
  });

  it('SHA-256 is a string in the module, not an inline literal at the call site', () => {
    // `es.ts:6-8` admits no exception: viewer components carry NO inline string literals.
    expect(es.verify.hashLabel).toBe('SHA-256');
  });

  it("AC6's honest limitation exists and actually states the limitation", () => {
    const line = es.verify.midCeremonyLimit;
    expect(line.trim().length).toBeGreaterThan(0);
    // It has to say BOTH halves — what a viewer can check now, and what they cannot yet.
    expect(line).toContain('revelado');
    expect(line).toContain('hash');
  });

  it('the not-yet-revealed string is not phrased as a failure', () => {
    // ⚠ `not_yet_revealed` is neither a pass nor a fail; copy that reads as "no coincide" would tell
    // a viewer the ceremony is broken every time they tap mid-ceremony.
    expect(VERIFY_COPY.not_yet_revealed).not.toContain('No coincide');
    expect(VERIFY_COPY.mismatched).toContain('No coincide');
  });
});
