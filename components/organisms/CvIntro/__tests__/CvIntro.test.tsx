import { render, cleanup } from '@testing-library/react';
import { CvIntro } from '../CvIntro';

/**
 * The `/cv` intro block's copy, at the counts the committed data does not reach (Story 2-16).
 *
 * `app/cv/__tests__/page.test.tsx` renders this block against the real `content/work.ts` and the
 * real Registry, which is what makes the counts there facts about the route. It can therefore only
 * ever see the arm those two lengths happen to be on: four and six today, both plural. The sentence
 * carries a noun **and a verb** that follow the Registry's length, and neither singular form is
 * reachable from that file.
 *
 * That is the gap `Premise.test.tsx:38-46` names for its own block and closes over fixtures in
 * `lib/__tests__/registry.test.ts`. This file closes it here, by driving both sources to a length of
 * one and reading the rendered line. `The one personal project are in the suite` is the shape it
 * refuses, and it is the shape this block shipped with before review found it.
 *
 * **Both modules are mocked and nothing else is.** `PlateMark`, `lib/words` and the markup are the
 * real ones, so what is being read is the block's own composition rather than a restatement of it.
 */

/** The two lengths the copy agrees with, driven per case. */
const { data } = vi.hoisted(() => ({ data: { work: [] as unknown[], rendered: [] as unknown[] } }));

vi.mock('@/content/work', () => ({ get work() { return data.work; } }));

vi.mock('@/lib/registry', () => ({ get renderedApplications() { return data.rendered; } }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** `count` entries, shaped only as far as this block reads them, which is not at all. */
const entries = (count: number): unknown[] => Array.from({ length: count }, (_, index) => ({ id: index }));

/** The rendered lede for one pair of lengths. */
const ledeFor = (employers: number, projects: number): string => {
  cleanup();
  data.work = entries(employers);
  data.rendered = entries(projects);

  const { container } = render(<CvIntro />);
  const text = container.querySelector('.cv-intro__lede')?.textContent ?? '';

  expect(text, `the block rendered no lede for ${employers} and ${projects}`).not.toBe('');
  return text;
};

describe('the lede agrees with both counts, in either number', () => {
  it('reads singular throughout when each source holds one', () => {
    // The noun and the verb both follow the Registry's length, and only the noun was derived before
    // review. `are` beside `one personal project` is the defect; it is unreachable from the page
    // test and would have shipped the day the Registry held a single rendered entry.
    const text = ledeFor(1, 1);

    expect(text, `the company noun does not agree with a count of one: "${text}"`).toContain('One company,');
    expect(text, `the Registry clause does not agree with a count of one: "${text}"`).toContain(
      'The one personal project is in'
    );
    expect(text, 'the lede reads a plural verb beside a count of one').not.toContain('project are');
  });

  it('reads plural throughout when each source holds more, so the arm above is a branch', () => {
    // Without this the singular reading is indistinguishable from a block that says `is` always.
    const text = ledeFor(4, 6);

    expect(text, `the company noun does not agree with a count of four: "${text}"`).toContain('Four companies,');
    expect(text, `the Registry clause does not agree with a count of six: "${text}"`).toContain(
      'The six personal projects are in'
    );
    expect(text, 'the lede reads a singular verb beside a count of six').not.toContain('projects is');
  });

  it('spells every count and prints no digit at either length', () => {
    // `EXPERIENCE.md:299-300`. `lib/words` falls back to digits past twenty, which is deliberate and
    // is meant to turn a suite red rather than quietly change the copy's register.
    for (const [employers, projects] of [
      [1, 1],
      [2, 3],
      [4, 6],
    ] as const) {
      expect(ledeFor(employers, projects), `the lede prints a digit at ${employers} and ${projects}`).not.toMatch(
        /\d/
      );
    }
  });
});
