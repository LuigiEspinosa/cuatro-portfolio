import { describe, expect, it } from 'vitest';
import {
  SAFE_TEXT_REFUSALS,
  VIEWER_TEXT_HARD_LIMIT,
  VIEWER_TEXT_MAX,
  VIEWER_TEXT_SEPARATOR,
  checkViewerJoined,
  checkViewerText,
  safeViewerJoined,
  safeViewerText,
} from './safe-text';

/**
 * The viewer-surface text guard (Story 6.9b, AC9 — closing `deferred-work.md:265-266`).
 *
 * ⚠ THE DEBT WAS MEASURED, NOT ASSUMED: `0023`'s `~ '[^[:space:]]'` correctly refuses U+00A0 and
 * U+3000 and returns TRUE for U+200B / U+200E / U+FEFF, so an award named with a single zero-width
 * space is accepted, stored, and renders as an EMPTY CARD at the ceremony. The rows below
 * re-measure both halves — the characters that guard already stops, and the ones it lets through —
 * so this file states what it closes rather than only that it exists.
 *
 * ⛔⛔ EVERY INVISIBLE CHARACTER IS BUILT FROM ITS CODE POINT, NEVER PASTED AS A LITERAL. A raw
 * U+200B in this source is invisible in every editor and in every diff, so a reviewer cannot tell
 * this file apart from one where the character was lost — and an editor or a lint autofix that
 * stripped it would turn a real refusal case into `checkViewerText('AB')`, which PASSES. The whole
 * suite would stay green while testing nothing. `cp()` makes each case readable and re-derivable.
 */

/** Build a string around one code point: `cp(0x200b)` is `A<U+200B>B`. */
const cp = (code: number): string => `A${String.fromCodePoint(code)}B`;

/** The same code point ALONE — the debt's headline shape, a name that is entirely invisible. */
const lone = (code: number): string => String.fromCodePoint(code);

const FALLBACK = 'FALLBACK';

describe('checkViewerText — the reject-list deferred-work.md:265 names, exactly', () => {
  const ACCEPTED = [
    'Máquina de Frags',
    'El Más Generoso',
    'A Cuchillo',
    'a3f1c9e2…7b40',
    'SHA-256',
    'x',
    'dos  espacios',
  ];
  it('the accepted table is non-empty', () => {
    expect(ACCEPTED.length).toBeGreaterThan(0);
  });
  it.each(ACCEPTED)('accepts %s unchanged', (s) => {
    const r = checkViewerText(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // ⛔ UNCHANGED. This guard REJECTS, it never strips: removing U+200E from `A<U+200E>B` yields
    // `AB`, which may be a different real name, and silently rewriting text an admin typed is the
    // same class of quiet wrongness the reject-list exists to prevent.
    expect(r.text).toBe(s);
  });

  // ⚠ The raw column is `unknown`, not `string`: `checkViewerText` takes `unknown` and the
  // `not_text` rows below are the whole point of that signature.
  const REFUSED: readonly (readonly [string, unknown, string])[] = [
    // ⭐ THE DEBT'S HEADLINE CASE, VERBATIM: "an award named with a single zero-width space is
    // accepted, stored, and renders as an empty card at the ceremony".
    // ⚠ ALL THREE REPORT `zero_width`, NOT `blank`, AND THAT CONSISTENCY WAS MEASURED RATHER THAN
    // ASSUMED. `trim()` removes U+FEFF but NOT U+200B or U+200E, so an implementation that checked
    // blankness first gave one hazard two different reasons depending on which character it was.
    ['a lone U+200B', lone(0x200b), 'zero_width'],
    ['a lone U+FEFF', lone(0xfeff), 'zero_width'],
    ['a lone U+200E', lone(0x200e), 'zero_width'],
    ['U+200B inside a name', cp(0x200b), 'zero_width'],
    ['U+200C inside a name', cp(0x200c), 'zero_width'],
    ['U+200D inside a name', cp(0x200d), 'zero_width'],
    ['U+200E inside a name', cp(0x200e), 'zero_width'],
    ['U+200F inside a name', cp(0x200f), 'zero_width'],
    ['U+FEFF inside a name', cp(0xfeff), 'zero_width'],
    // ⚠ A BIDI OVERRIDE CAN VISUALLY REVERSE A HASH — which is why the strip runs this over its
    // SHA-256 and not only over names.
    ['U+202A LEFT-TO-RIGHT EMBEDDING', cp(0x202a), 'bidi'],
    ['U+202C POP DIRECTIONAL FORMATTING', cp(0x202c), 'bidi'],
    ['U+202E RIGHT-TO-LEFT OVERRIDE', cp(0x202e), 'bidi'],
    ['U+2066 LEFT-TO-RIGHT ISOLATE', cp(0x2066), 'bidi'],
    ['U+2069 POP DIRECTIONAL ISOLATE', cp(0x2069), 'bidi'],
    ['a C0 control', cp(0x01), 'control'],
    ['NUL', cp(0x00), 'control'],
    ['DEL', cp(0x7f), 'control'],
    ['a C1 control', cp(0x85), 'control'],
    ['the empty string', '', 'blank'],
    ['only ASCII whitespace', '   ', 'blank'],
    // ⚠ THE TWO 0023 ALREADY STOPS, re-measured here so this file states the delta rather than
    // claiming the whole guard. They are `blank` because they ARE whitespace — `trim()` knows them.
    ['only U+00A0', lone(0xa0), 'blank'],
    ['only U+3000', lone(0x3000), 'blank'],
    ['past the length bound', 'a'.repeat(VIEWER_TEXT_MAX + 1), 'too_long'],
    // ⭐ 6.9b CODE REVIEW — `not_text` IS ITS OWN REASON NOW. A non-string used to report `blank`,
    // which this module defines as "nothing visible and nothing forbidden" — a lie for `42` or `{}`,
    // and `checkViewerText` is exported, so the wrong reason reached real callers.
    ['a number', 42, 'not_text'],
    ['an object', {}, 'not_text'],
    ['null', null, 'not_text'],
    ['undefined', undefined, 'not_text'],
  ];
  it('the refusal table is non-empty and reaches every declared refusal', () => {
    expect(REFUSED.length).toBeGreaterThan(0);
    // ⛔ READS ITS EVIDENCE: the reasons the table produces are compared against the module's own
    // runtime closed set, not against a literal typed out here.
    expect([...new Set(REFUSED.map(([, , r]) => r))].sort()).toEqual([...SAFE_TEXT_REFUSALS].sort());
    // …and every crafted case really does carry the character it claims to, so a lost literal
    // cannot make a row pass by degenerating into plain `AB`.
    for (const [name, raw] of REFUSED) {
      if (name.startsWith('U+') || name.startsWith('a lone')) expect(raw).not.toBe('AB');
    }
  });
  it.each(REFUSED)('refuses %s as %s', (_name, raw, reason) => {
    const r = checkViewerText(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(reason);
  });

  it('a non-string is refused rather than coerced', () => {
    for (const v of [undefined, null, 42, {}, []]) {
      expect(checkViewerText(v).ok).toBe(false);
    }
  });

  it('the whole C0/C1 range is covered, not just the sampled rows', () => {
    // ⚠ The table above samples; this walks. A range guard written as an enumeration of the
    // characters somebody happened to think of is the shape that misses one.
    for (let code = 0x00; code <= 0x1f; code++) {
      expect(checkViewerText(cp(code)).ok).toBe(false);
    }
    for (let code = 0x80; code <= 0x9f; code++) {
      expect(checkViewerText(cp(code)).ok).toBe(false);
    }
    expect(checkViewerText(cp(0x7f)).ok).toBe(false);
    // …and the boundaries are exclusive on the right side, so the guard is not simply refusing all.
    expect(checkViewerText(cp(0x20)).ok).toBe(true);
    expect(checkViewerText(cp(0xa1)).ok).toBe(true);
  });

  it('the whole bidi range is covered on both sides of each boundary', () => {
    for (let code = 0x202a; code <= 0x202e; code++) {
      expect(checkViewerText(cp(code)).ok).toBe(false);
    }
    for (let code = 0x2066; code <= 0x2069; code++) {
      expect(checkViewerText(cp(code)).ok).toBe(false);
    }
    // The characters immediately outside each range stay ACCEPTED — otherwise the range check could
    // be refusing everything nearby and nothing would show it.
    expect(checkViewerText(cp(0x2029)).ok).toBe(true);
    expect(checkViewerText(cp(0x202f)).ok).toBe(true);
    expect(checkViewerText(cp(0x2065)).ok).toBe(true);
    expect(checkViewerText(cp(0x206a)).ok).toBe(true);
  });
});

describe('the length bound (deferred-work.md:266)', () => {
  it('counts CODE POINTS, not UTF-16 code units', () => {
    // ⛔ An astral character is 2 UTF-16 units, so a `.length` bound refuses a shorter string than
    // it advertises. Exactly `VIEWER_TEXT_MAX` astral characters is 2x that many units and must
    // still be accepted.
    const astral = String.fromCodePoint(0x1f44d).repeat(VIEWER_TEXT_MAX);
    expect(astral.length).toBe(VIEWER_TEXT_MAX * 2);
    expect(checkViewerText(astral).ok).toBe(true);
    expect(checkViewerText(String.fromCodePoint(0x1f44d).repeat(VIEWER_TEXT_MAX + 1)).ok).toBe(false);
  });

  it('accepts exactly the bound and refuses one past it', () => {
    expect(checkViewerText('a'.repeat(VIEWER_TEXT_MAX)).ok).toBe(true);
    expect(checkViewerText('a'.repeat(VIEWER_TEXT_MAX + 1)).ok).toBe(false);
  });

  it('the bound is comfortably above the shipped catalog names', () => {
    // The twelve shipped names are 8-22 characters; a bound tight enough to clip a real name would
    // make this guard a bug rather than a fix.
    expect(VIEWER_TEXT_MAX).toBeGreaterThan(40);
    expect([...'Máquina de Frags'].length).toBeLessThan(VIEWER_TEXT_MAX);
  });
});

describe('safeViewerText — the rendering helper', () => {
  it('returns the string when it is safe and the CALLER’s fallback when it is not', () => {
    expect(safeViewerText('Máquina de Frags', FALLBACK)).toBe('Máquina de Frags');
    expect(safeViewerText(lone(0x200b), FALLBACK)).toBe(FALLBACK);
    expect(safeViewerText(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('one hazard gets ONE reason, whatever trim() happens to know about', () => {
    // ⛔ THE REGRESSION GUARD FOR THE ORDERING FIX. `trim()` covers U+FEFF and not U+200B, so a
    // blank-check-first implementation split the reject-list's own members across two reasons.
    const reasons = [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0xfeff].map((c) => {
      const r = checkViewerText(lone(c));
      return r.ok ? 'accepted' : r.reason;
    });
    expect(new Set(reasons).size).toBe(1);
    expect(reasons[0]).toBe('zero_width');
  });

  it('never invents copy of its own', () => {
    // ⚠ Every viewer-facing word resolves through `es.ts` (AD-24). A Spanish literal inside the
    // guard would be the second place copy lives — so the fallback is always the caller's.
    expect(safeViewerText(lone(0x200b), '')).toBe('');
  });
});

// ── 6.9b CODE REVIEW: the joined aggregate ────────────────────────────────────

describe('checkViewerJoined — the bound is PER NAME, because the feed does not send one name', () => {
  // ⭐ THE LIVE DEFECT THIS CLOSES. `reveal_spin` writes `title` and `subtitle` as
  // `string_agg(…, ' · ')` over every award the spin decided and every winner it produced
  // (`0028:757-768`). Judging that join against a bound calibrated for ONE award name refused
  // legitimate cards, and `toCardModel` then rendered `es.award.revealAtCeremony` — an
  // already-revealed award telling the viewer it has not been revealed.
  const NAME = 'Máquina de Frags'; // 16 code points, one of the twelve shipped names

  it('accepts a join that is far past the single-name bound', () => {
    const joined = [NAME, NAME, NAME, NAME, NAME, NAME].join(VIEWER_TEXT_SEPARATOR);
    // The non-vacuity control: this really is the case the old whole-string bound refused.
    expect([...joined].length).toBeGreaterThan(VIEWER_TEXT_MAX);
    expect(checkViewerText(joined).ok).toBe(false);
    expect(checkViewerJoined(joined).ok).toBe(true);
    expect(safeViewerJoined(joined, FALLBACK)).toBe(joined);
  });

  it('still refuses when a single ELEMENT is past the bound', () => {
    const joined = [NAME, 'a'.repeat(VIEWER_TEXT_MAX + 1)].join(VIEWER_TEXT_SEPARATOR);
    const r = checkViewerJoined(joined);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('too_long');
  });

  it.each([
    ['zero-width', 0x200b, 'zero_width'],
    ['bidi', 0x202e, 'bidi'],
    ['control', 0x01, 'control'],
  ] as const)('refuses the WHOLE string when one element carries a %s character', (_n, cp, reason) => {
    // ⛔⛔ ALL-OR-NOTHING, DELIBERATELY. Dropping the offending element would silently misreport WHO
    // WON, and rewriting it is the "strips rather than rejects" failure the module header forbids.
    // ⚠ NAMED CONSEQUENCE: U+200D is the emoji ZWJ and is common in Steam display names, so one
    // co-winner with a family-emoji name still sends the whole subtitle to the fallback. Widening
    // the reject-list needs a story — `deferred-work.md:265` declares it a closed set.
    const joined = [NAME, `A${String.fromCodePoint(cp)}B`].join(VIEWER_TEXT_SEPARATOR);
    const r = checkViewerJoined(joined);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(reason);
  });

  it('refuses a hostile multi-MB string in ONE comparison, before anything is split or spread', () => {
    // ⭐ THE ORDERING FIX, MEASURED. `[...raw]` used to run BEFORE the bound, allocating one array
    // slot per code point — so the doc comment's "refused in one comparison instead of being
    // scanned" was false of the code. `award.name` is unbounded at the database (`0023`), so this is
    // the input class the guard exists for.
    const huge = 'a'.repeat(VIEWER_TEXT_HARD_LIMIT + 1);
    expect(huge.length).toBeGreaterThan(VIEWER_TEXT_HARD_LIMIT);
    const r = checkViewerJoined(huge);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('too_long');
    // and the single-value guard has the same pre-check, in UTF-16 units
    const single = checkViewerText('a'.repeat(VIEWER_TEXT_MAX * 2 + 1));
    expect(single.ok).toBe(false);
  });

  it('a non-string is not_text, never blank', () => {
    const r = checkViewerJoined(42);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('not_text');
  });
});

describe('the reject-list is exactly the debt’s list — no silent widening', () => {
  // ⚠ These are DELIBERATELY absent. `deferred-work.md:265` names a closed list, and widening it
  // without a story would make this guard's coverage something nobody could state. If one of them
  // ever needs refusing, that is a decision with a story attached — and this test is where it
  // reddens.
  const NOT_IN_THE_LIST: readonly (readonly [string, number])[] = [
    ['U+00AD SOFT HYPHEN', 0x00ad],
    ['U+2060 WORD JOINER', 0x2060],
    ['U+180E MONGOLIAN VOWEL SEPARATOR', 0x180e],
  ];
  it('the not-in-the-list table is non-empty', () => {
    expect(NOT_IN_THE_LIST.length).toBeGreaterThan(0);
  });
  it.each(NOT_IN_THE_LIST)('%s is accepted — it is not on the debt’s list', (_name, code) => {
    expect(checkViewerText(cp(code)).ok).toBe(true);
  });
});
