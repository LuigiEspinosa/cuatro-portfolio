import { describe, expect, it } from 'vitest';
import { PITY_LABEL, stage1Label } from './labels';

describe('stage1Label', () => {
  it.each([
    [1, 'inclusivcup/v1/stage1/spin/1'],
    [9, 'inclusivcup/v1/stage1/spin/9'],
    // The 10/12 cases pin "decimal, NO padding": a zero-padded ".../spin/09" would look
    // perfectly reasonable and key a completely different stream.
    [10, 'inclusivcup/v1/stage1/spin/10'],
    [12, 'inclusivcup/v1/stage1/spin/12'],
    [100, 'inclusivcup/v1/stage1/spin/100'],
  ])('spin %i -> %s', (spin, want) => {
    expect(stage1Label(spin)).toBe(want);
  });

  // 1-BASED: there is no spin 0. A 0-based off-by-one draws a valid-looking but wrong stream for
  // every award, with no symptom — so it throws rather than returning a label.
  it.each([0, -1, -12])('rejects non-positive spin %i (1-based)', (spin) => {
    expect(() => stage1Label(spin)).toThrow(RangeError);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects non-integer spin %p', (spin) => {
    expect(() => stage1Label(spin)).toThrow(RangeError);
  });

  // The formatting must not be locale-aware. `toLocaleString()` renders 1000 as "1,000" in
  // en-US and "1.000" in es-ES — three different streams for one spin number.
  it('formats large spins without a thousands separator', () => {
    expect(stage1Label(1000)).toBe('inclusivcup/v1/stage1/spin/1000');
    expect(stage1Label(1000)).not.toContain(',');
    expect(stage1Label(1000)).not.toContain('.');
  });

  // ⭐ The upper bound, measured at the 6.3 code review. `Number.isInteger(1e21)` is TRUE and
  // `String(1e21)` is "1e+21" — so without the bound this returns ".../spin/1e+21", scientific
  // notation, which is exactly the formatting divergence the locale rule above guards against.
  // Go's strconv.Itoa on an int never does this. The old tests stopped at 1000, far below.
  it('rejects spins past the safe-integer range, where String() turns exponential', () => {
    expect(() => stage1Label(1e21)).toThrow(RangeError);
    expect(() => stage1Label(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
    expect(() => stage1Label(Number.MAX_VALUE)).toThrow(RangeError);
  });

  it('accepts the safe-integer ceiling and still formats it as plain decimal', () => {
    const label = stage1Label(Number.MAX_SAFE_INTEGER);
    expect(label).toBe(`inclusivcup/v1/stage1/spin/${Number.MAX_SAFE_INTEGER}`);
    // Only the numeric suffix — "inclusivcup" and "spin" both contain an 'e'.
    const suffix = label.slice(label.lastIndexOf('/') + 1);
    expect(suffix).toMatch(/^[0-9]+$/);
  });
});

describe('PITY_LABEL', () => {
  it('is the exact domain separator', () => {
    expect(PITY_LABEL).toBe('inclusivcup/v1/pity');
  });
});

describe('label domain separation', () => {
  it('shares the versioned namespace', () => {
    for (const label of [stage1Label(1), PITY_LABEL]) {
      expect(label.startsWith('inclusivcup/v1/')).toBe(true);
    }
  });

  it('never collides across the ceremony labels', () => {
    const seen = new Set<string>();
    for (let spin = 1; spin <= 12; spin++) {
      const label = stage1Label(spin);
      expect(seen.has(label)).toBe(false);
      seen.add(label);
    }
    expect(seen.has(PITY_LABEL)).toBe(false);
  });
});
