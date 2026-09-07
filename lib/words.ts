/**
 * Prose machinery: a count written as the word for it (Story 2-11).
 *
 * Deliberately separate from `lib/registry.ts`. Everything there is a rule about the published
 * Registry; this is a rule about English. The premise opens with a word rather than a digit
 * (`EXPERIENCE.md:276`) and the footer line is written out in full (`EXPERIENCE.md:295`), so a
 * surface forbidden from stating a number the Registry contradicts still needs its number spelled.
 * Keeping that here leaves the Registry module about the Registry.
 *
 * **Why the counts are spelled rather than printed, and why `tabular-nums` still applies.**
 * `DESIGN.md:490` binds `font-variant-numeric: tabular-nums` to every count, plate mark and metric.
 * Both hold at once: the lines carry no digit today, and the rule is set on the element so a future
 * digit does not shift the characters beside it. This module is what lets the word stay true, which
 * is the whole reason `EXPERIENCE.md:295` allowed the footer line to exist rather than be deleted.
 */

/**
 * Zero through twenty, lowercase, in numeric order. The index is the number.
 *
 * **The table stops at twenty, and that is a decision rather than a limit reached by accident.**
 * Every count it serves is the length of something the estate holds: the Registry's entries, the
 * entries a Visitor is shown, the declared languages, the declared frameworks. Past twenty English
 * needs a hyphen (`twenty-one`) and the words stop being a fixed list, which is more machinery than
 * three short lines of copy justify. A count that outgrows the table falls back to digits, which is
 * a legible answer rather than a wrong word.
 */
const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
] as const;

/**
 * `count` as the English word for it, lowercase, or as digits when the table does not hold it.
 *
 * **Bounds.** Whole numbers from zero to twenty inclusive are spelled. Everything else, a larger
 * count, a negative, a fraction, is returned as digits.
 *
 * **The fallback is digits rather than a throw, and it is not a graceful degradation.** It keeps
 * this function total, so nothing here is the thing that breaks; what breaks is the suite. Three
 * cases assert that no digit reaches these lines at all, one per surface plus the composed rule:
 * `components/organisms/Premise/__tests__/Premise.test.tsx`,
 * `components/organisms/SiteFooter/__tests__/SiteFooter.test.tsx` and
 * `lib/__tests__/registry.test.ts`. So the twenty-first entry turns the suite red rather than
 * quietly printing `21 personal projects` on the homepage.
 *
 * **That is the intended outcome, not an oversight.** These lines are meant to be words
 * (`EXPERIENCE.md:276`, `:295`), and a digit sliding into them is exactly the kind of change nobody
 * would notice. Failing makes a person extend the table by one line, in the same change that grew
 * the estate past it, which is cheaper than either alternative: a copy that silently changes
 * register, or a throw that takes the page down over a word.
 *
 * **Lowercase always.** A word that arrives at the start of a sentence is capitalised by its
 * caller through `capitalise`, because only the caller knows where the word sits.
 */
export function spellOut(count: number): string {
  if (!Number.isInteger(count) || count < 0 || count >= WORDS.length) return String(count);
  return WORDS[count];
}

/**
 * `singular` in the number `count` calls for.
 *
 * English pluralises everything but one, zero included, so the test is equality with one rather
 * than a threshold. `plural` defaults to the regular `-s` form and is supplied for anything that is
 * not regular; the three nouns these lines carry all are, and the parameter exists so an irregular
 * one arrives as an argument rather than as a special case inside here.
 *
 * **It is here rather than at the call sites because a count and its noun are one decision.** A
 * Registry rendering a single entry produced `One applications` before this existed, and the count
 * being derived is what made that reachable: nobody types the word, so nobody sees the noun beside
 * it disagree.
 */
export function pluralise(count: number, singular: string, plural: string = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/**
 * `text` with its first character upper-cased and every other character untouched.
 *
 * The tail is left alone rather than lower-cased: this puts a word at the start of a sentence, and
 * a transform that also flattened the rest would quietly rewrite anything it was handed.
 */
export function capitalise(text: string): string {
  return text === '' ? text : `${text[0].toUpperCase()}${text.slice(1)}`;
}
