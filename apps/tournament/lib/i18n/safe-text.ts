/**
 * The viewer-surface text guard — Story 6.9b, AC9, closing `deferred-work.md:265-266`.
 *
 * ⭐⭐ WHAT THIS CLOSES, AND WHY IT IS HERE RATHER THAN AT THE DATABASE. `0023`'s
 * `~ '[^[:space:]]'` name guard correctly refuses U+00A0 and U+3000 and returns TRUE for
 * U+200B / U+200E / U+FEFF, so an award named with a single zero-width space is accepted, stored,
 * and **renders as an empty card at the ceremony**; `name` is additionally unbounded, so a multi-KB
 * name is stored and copied into every `audit_log` payload. 6.9a's code review corrected the record
 * in four places: the bundle's ASCII restriction was claimed to give this debt teeth and **cannot**,
 * because DECISION N drops `name` from the hashed document entirely. ⚠ A byte-alphabet rule on a
 * hashed document was never the right shape for this — *the hazard is what a HUMAN sees, not what
 * the hash covers* — so the guard belongs exactly where a name reaches a viewer.
 *
 * ⛔ IT REJECTS, IT NEVER STRIPS. Removing U+200E from `"A‎B"` yields `"AB"`, which may be a
 * DIFFERENT real name; and silently rewriting text an admin typed is the same class of quiet
 * wrongness the reject-list exists to prevent. A refused string is replaced by a caller-supplied
 * fallback that the viewer can see is a fallback.
 *
 * ⚠ THE REJECT-LIST IS EXACTLY THE ONE `deferred-work.md:265` NAMES, and nothing more: C0/C1
 * controls, U+200B/200C/200D/200E/200F/FEFF, and the bidi overrides U+202A-202E / U+2066-2069. Other
 * plausible members (U+00AD SOFT HYPHEN, the U+2060 word joiner) are deliberately NOT here — the
 * debt is a closed list and widening it silently would make this guard's coverage a thing nobody
 * could state. Add them with a story, not with a commit.
 *
 * ⛔ NO `import 'server-only'`. This runs in the browser: `lib/feed/model.ts` is browser-safe and the
 * `'use client'` verify strip calls it directly.
 */

/**
 * The upper bound on a viewer-rendered string, in CODE POINTS.
 *
 * ⚠ CODE POINTS, NOT UTF-16 CODE UNITS. `'👍'.length` is 2, so a `.length` bound counts a
 * supplementary-plane character twice and refuses a shorter string than it claims to. The twelve
 * shipped award names are 8-22 characters, so 80 is roughly four times the longest real one and far
 * below the multi-KB shape the debt names.
 */
export const VIEWER_TEXT_MAX = 80;

/**
 * The separator `reveal_spin` joins its aggregates with (`0028:757-768`).
 *
 * ⭐⭐ 6.9b CODE REVIEW — THE BOUND ABOVE IS PER NAME, AND THE FEED DOES NOT HAND US ONE NAME.
 * `reveal_spin` writes `title = string_agg(a.name, ' · ' order by a.priority)` over every award the
 * spin decided and `subtitle = string_agg(pl.display_name, ' · ')` over every winner — the
 * migration says so itself: *"A SPIN MAY DECIDE MORE THAN ONE AWARD"*. Judging the JOIN against a
 * bound calibrated for one name refused legitimate cards: four 22-character award names is ~97 code
 * points, three Steam display names ~102. The card then fell back to *"Se revela en la ceremonia"* —
 * an already-revealed award telling the viewer it has not been revealed.
 */
export const VIEWER_TEXT_SEPARATOR = ' · ';

/**
 * An absolute ceiling on any raw string, in UTF-16 CODE UNITS, checked before anything is split or
 * spread. It is not a display bound — {@link VIEWER_TEXT_MAX} is — it is the cheap comparison that
 * stops a hostile multi-MB value from being walked at all.
 */
export const VIEWER_TEXT_HARD_LIMIT = 8192;

/** Why a string was refused. A closed set — the suite asserts against this runtime array. */
export const SAFE_TEXT_REFUSALS = ['blank', 'too_long', 'control', 'zero_width', 'bidi', 'not_text'] as const;

export type SafeTextRefusal = (typeof SAFE_TEXT_REFUSALS)[number];

/**
 * The zero-width and format characters `deferred-work.md:265` names, as code points.
 *
 * ⭐ U+FEFF IS THE ONE THAT LOOKS HARMLESS AND IS NOT: as a BOM it is invisible everywhere, and as
 * ZERO WIDTH NO-BREAK SPACE it survives every trim in every language.
 */
const ZERO_WIDTH = new Set<number>([0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0xfeff]);

/** ⚠ A BIDI OVERRIDE CAN VISUALLY REVERSE A HASH. That is why the strip runs this over its SHA-256. */
function isBidi(cp: number): boolean {
  return (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);
}

/** C0, DEL and C1 — every one of them either invisible or terminal-active. */
function isControl(cp: number): boolean {
  return cp <= 0x1f || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f);
}

export type SafeTextResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: SafeTextRefusal };

/**
 * Judge one viewer-bound string.
 *
 * ⚠⚠ THE ORDER IS CONTRACT, AND THE FIRST DRAFT HAD IT WRONG IN A WAY ONLY MEASUREMENT FOUND. It
 * checked `blank` first, on the reasoning that a name made entirely of zero-width characters should
 * be reported as what a viewer experiences (an empty card). But `String.prototype.trim` removes
 * exactly the Unicode White_Space set plus U+FEFF — and U+FEFF is the ONLY member of the reject-list
 * below that it knows about. So a lone U+FEFF came back `blank` while a lone U+200B came back
 * `zero_width`: two refusal reasons for one hazard, decided by an accident of what `trim()` happens
 * to cover.
 *
 * The walk now runs FIRST, so a refused CHARACTER always reports its own class wherever it sits, and
 * `blank` means what it says — nothing visible and nothing forbidden. The length bound stays ahead
 * of the walk so a multi-MB string is refused in one comparison instead of being scanned.
 *
 * ⭐ 6.9b CODE REVIEW — TWO CORRECTIONS TO THAT LAST SENTENCE, WHICH WAS NOT TRUE OF THE CODE.
 * (1) `[...raw]` was evaluated BEFORE the bound, so the expensive scan ran first and the stated
 * protection did not exist: the spread walks every code point and allocates one array slot per code
 * point, so an 8 MB name allocated ~8M slots on the render path and only then returned `too_long`.
 * The cheap `raw.length` comparison now runs first — UTF-16 units are always ≥ code points, so a
 * `raw.length > VIEWER_TEXT_MAX * 2` pre-check can never refuse a string the code-point bound would
 * have accepted.
 * (2) A non-string was reported as `blank`, which this module defines as "nothing visible and
 * nothing forbidden" — a lie for `42`, `{}` or `null`. `checkViewerText` is exported, so the reason
 * had to grow a sixth member rather than borrow one that means something else.
 */
export function checkViewerText(raw: unknown): SafeTextResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'not_text' };

  // The cheap bound FIRST, in UTF-16 units, before a single code point is materialised.
  if (raw.length > VIEWER_TEXT_MAX * 2) return { ok: false, reason: 'too_long' };

  const points = [...raw];
  if (points.length > VIEWER_TEXT_MAX) return { ok: false, reason: 'too_long' };

  let visible = 0;
  for (const ch of points) {
    const cp = ch.codePointAt(0) as number;
    if (isControl(cp)) return { ok: false, reason: 'control' };
    if (ZERO_WIDTH.has(cp)) return { ok: false, reason: 'zero_width' };
    if (isBidi(cp)) return { ok: false, reason: 'bidi' };
    if (ch.trim().length > 0) visible += 1;
  }

  // ⭐ THE `[^[:space:]]` RULE, RE-STATED AT THE SURFACE. `0023`'s regex already refuses U+00A0 and
  // U+3000 at the database, so this arm is the belt to that braces; what it adds is that it counts
  // VISIBLE characters after the walk above has removed the invisible ones the database lets
  // through. A string with nothing visible is the empty card this guard exists to stop, whatever
  // made it empty.
  if (visible === 0) return { ok: false, reason: 'blank' };

  return { ok: true, text: raw };
}

/**
 * The rendering helper: the string itself when it is safe, the caller's fallback when it is not.
 *
 * ⚠ THE FALLBACK IS THE CALLER'S AND IS NEVER INVENTED HERE. Every viewer-facing word resolves
 * through `es.ts` (AD-24), and a Spanish literal in this file would be the second place copy lives.
 */
export function safeViewerText(raw: unknown, fallback: string): string {
  const checked = checkViewerText(raw);
  return checked.ok ? checked.text : fallback;
}

/**
 * Judge a `' · '`-JOINED AGGREGATE by judging each element (Cuatro's call, 6.9b code review).
 *
 * ⭐ THE LENGTH BOUND BECOMES PER ELEMENT, WHICH IS WHAT IT WAS CALIBRATED FOR. That is the live
 * defect this fixes: a spin deciding four awards, or a shared trophy with three co-winners, produced
 * a legal join over 80 code points and the card silently fell back to teaser copy on a real reveal.
 *
 * ⛔⛔ A REFUSED ELEMENT STILL REFUSES THE WHOLE STRING, AND THAT IS DELIBERATE — the alternative is
 * worse. Dropping the offending element from the join would silently misreport WHO WON; rewriting it
 * would be the "strips rather than rejects" failure the module header forbids (removing U+200E from
 * `"A‎B"` yields `"AB"`, which may be a different real name). So a character refusal is still
 * all-or-nothing.
 * ⚠ NAMED CONSEQUENCE, so it is not discovered later: **U+200D is the emoji ZWJ** and is common in
 * Steam display names, so one co-winner with a family-emoji name still sends the whole subtitle to
 * the fallback. Fixing THAT means either widening the reject-list (which `deferred-work.md:265`
 * declares a closed set — "add them with a story, not with a commit") or rendering per-winner
 * elements separately, which is a feed-card change and 6.10's surface.
 */
export function checkViewerJoined(raw: unknown, separator: string = VIEWER_TEXT_SEPARATOR): SafeTextResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'not_text' };

  // The absolute ceiling first — one comparison, before any split or spread.
  if (raw.length > VIEWER_TEXT_HARD_LIMIT) return { ok: false, reason: 'too_long' };

  const parts = raw.split(separator);
  for (const part of parts) {
    const checked = checkViewerText(part);
    if (!checked.ok) return checked;
  }
  return { ok: true, text: raw };
}

/** The rendering helper for a joined aggregate. See {@link checkViewerJoined}. */
export function safeViewerJoined(raw: unknown, fallback: string, separator: string = VIEWER_TEXT_SEPARATOR): string {
  const checked = checkViewerJoined(raw, separator);
  return checked.ok ? checked.text : fallback;
}
