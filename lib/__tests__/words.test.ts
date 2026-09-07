import { capitalise, pluralise, spellOut } from '../words';

/**
 * The prose machinery behind three lines of copy (Story 2-11).
 *
 * `lib/words.ts` exists so a count on the page is a length rather than a word somebody typed, which
 * is what `EXPERIENCE.md:299-300` requires and what `EXPERIENCE.md:295` was going to make somebody
 * remember. This file asserts the properties the surfaces depend on: the word follows the number,
 * the noun beside it agrees with the same number, and a number the table cannot spell still
 * produces something legible instead of nothing.
 *
 * The composed rules, the premise's opening words and the footer's two figures, are proved over
 * Registry fixtures in `lib/__tests__/registry.test.ts`. What is proved here is the table itself.
 *
 * No environment pragma and no `vitest` import: `vitest.config.ts` sets `environment: 'jsdom'` and
 * `globals: true` for the suite, and nothing here touches either the DOM or the filesystem, so the
 * defaults are what this file wants. `lib/__tests__/registry.test.ts` opts into `node` because it
 * reads `contracts/` off disk, which is a reason this file does not have.
 */

describe('a count is spelled from the number', () => {
  it.each([
    [0, 'zero'],
    [1, 'one'],
    [5, 'five'],
    [6, 'six'],
    [7, 'seven'],
    [14, 'fourteen'],
    [15, 'fifteen'],
    [20, 'twenty'],
  ])('spells %i as %s', (count, word) => {
    expect(spellOut(count)).toBe(word);
  });

  it('spells every number in its range, with no gap and no repeat', () => {
    // A table with a hole in it would answer digits for one number in the middle of its own range,
    // and every case above would still pass. Reading the whole range is what closes that: twenty
    // one distinct words, none of them digits.
    const spelled = Array.from({ length: 21 }, (_, count) => spellOut(count));
    for (const [count, word] of spelled.entries()) {
      expect(word, `${count} is not spelled at all`).not.toMatch(/\d/);
    }
    expect(new Set(spelled).size, 'two numbers in the range spell the same word').toBe(spelled.length);
  });

  it('answers lowercase, so the caller decides where the word sits', () => {
    for (let count = 0; count <= 20; count += 1) {
      expect(spellOut(count), `${count} is not spelled in lowercase`).toBe(spellOut(count).toLowerCase());
    }
  });

  it('falls back to digits past the table rather than throwing', () => {
    // The bound is a decision, not a limit: past twenty English needs a hyphen and the words stop
    // being a fixed list. The fallback keeps this function total, so it is never the thing that
    // breaks; the suites that assert no digit reaches the copy are, which is what makes a person
    // extend the table in the change that grew the estate past it.
    expect(spellOut(21)).toBe('21');
    expect(spellOut(100)).toBe('100');
  });

  it('and the digit fallback is what three other suites refuse, which is why it is a red suite', () => {
    // Stated here rather than only in the module's docblock, so the relationship is visible from
    // the test that pins the fallback. The three surface cases match on `/\d/`, and this shows the
    // twenty-first count producing exactly what they refuse.
    expect(spellOut(21)).toMatch(/\d/);
    expect(spellOut(20)).not.toMatch(/\d/);
  });

  it('falls back to digits for a number that is not a count at all', () => {
    expect(spellOut(-1)).toBe('-1');
    expect(spellOut(6.5)).toBe('6.5');
  });

  it('moves when the number moves, which is the only property the surfaces rely on', () => {
    // The whole argument for the module, stated as one case: the word is a function of the number,
    // so a length that changes carries its word with it and nothing has to be edited.
    expect(spellOut(6)).not.toBe(spellOut(7));
    expect(spellOut(14)).not.toBe(spellOut(15));
  });
});

describe('a word at the start of a sentence', () => {
  it('takes an initial capital', () => {
    expect(capitalise('six')).toBe('Six');
    expect(capitalise(spellOut(14))).toBe('Fourteen');
  });

  it('leaves the rest of the text exactly as it found it', () => {
    // Not a title-caser and not a lower-caser. A transform that flattened the tail would quietly
    // rewrite whatever it was handed, which is a different job from putting a word at the start of
    // a sentence.
    expect(capitalise('one operator')).toBe('One operator');
    expect(capitalise('McCoy')).toBe('McCoy');
  });

  it('returns an empty string unchanged rather than reaching past the end of it', () => {
    expect(capitalise('')).toBe('');
  });
});

describe('the noun beside a derived count agrees with it', () => {
  it('is singular at one and plural at everything else, zero included', () => {
    // English pluralises everything but one, so the test is equality with one rather than a
    // threshold. Zero is the case a threshold gets wrong.
    expect(pluralise(1, 'application')).toBe('application');
    expect(pluralise(0, 'application')).toBe('applications');
    expect(pluralise(2, 'application')).toBe('applications');
    expect(pluralise(14, 'personal project')).toBe('personal projects');
  });

  it('takes an irregular plural as an argument rather than guessing one', () => {
    // The three nouns these lines carry are regular, and the parameter is what keeps an irregular
    // one from arriving as a special case inside the helper.
    expect(pluralise(2, 'entity', 'entities')).toBe('entities');
    expect(pluralise(1, 'entity', 'entities')).toBe('entity');
  });

  it('moves with the count, which is the whole reason it exists', () => {
    // The failure it closes: both the count and the noun are decided by a length nobody types, so
    // `One applications` was reachable and nothing on the page drew attention to it.
    expect(pluralise(1, 'application')).not.toBe(pluralise(6, 'application'));
  });

  it('composes with the spelled count into the line the footer renders', () => {
    // The composition, not the parts. A helper that was correct in isolation and never wired into
    // the copy would pass every case above.
    const figure = (count: number): string => `${capitalise(spellOut(count))} ${pluralise(count, 'application')}`;
    expect(figure(1)).toBe('One application');
    expect(figure(6)).toBe('Six applications');
    expect(figure(0)).toBe('Zero applications');
  });
});
