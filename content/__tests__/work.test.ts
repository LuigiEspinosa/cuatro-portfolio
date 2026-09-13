import { work } from '../work';

/**
 * The period strings in `content/work.ts`.
 *
 * Story 2-1 closed a typo that had shipped to the page: `content/work.ts:18` read `Dev. 2025`
 * where it meant `Dec.`, and `WorkItem.tsx:76` renders `period` inside the `work-item__header`
 * button, so the typo was part of that button's accessible name. The other three entries were
 * verified by reading in the same pass, and a reading does not survive the next edit.
 *
 * The checks run over the whole `work` array rather than entry by entry, so a fifth entry is
 * checked the moment it is added. The **count** is a separate matter and is pinned rather than
 * bounded: a bounded list goes quiet when an entry is deleted, because every loop simply runs
 * one time fewer and reports nothing. Adding an entry is therefore a deliberate one-line update
 * to `ENTRY_COUNT` here, and that is the intended cost.
 */

/** The entries `content/work.ts` carries. Pinned, so a deleted entry is loud. */
const ENTRY_COUNT = 4;

/**
 * The twelve month abbreviations, **in calendar order**.
 *
 * The order is load-bearing: an index into this list is the month number, and that is what
 * `runsForwards` compares. Sorting this alphabetically would leave every case green and stop
 * the ordering check from meaning anything.
 *
 * `May.` is in the list for the same shape as the other eleven. May is not normally
 * abbreviated, so an entry written `May 2026` fails here rather than passing. That is
 * deliberate: one shape across twelve months is what makes the parse exact, and this is the
 * line to change if the house style ever admits the undotted form.
 */
const MONTHS: readonly string[] = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May.',
  'Jun.',
  'Jul.',
  'Aug.',
  'Sep.',
  'Oct.',
  'Nov.',
  'Dec.',
];

/** The closing form an ongoing role takes. `WorkItem.tsx:76` renders it like any other. */
const PRESENT = 'Present';

const MONTH_YEAR = /^([A-Z][a-z]{2}\.) (\d{4})$/;

interface Endpoint {
  month: string;
  year: number;
}

interface ParsedPeriod {
  start: Endpoint;
  /** `null` for an open-ended `Mon. YYYY - Present`. */
  end: Endpoint | null;
}

/**
 * `period` split into its two endpoints, or `null` when it is neither
 * `Mon. YYYY - Mon. YYYY` nor `Mon. YYYY - Present`.
 *
 * The shape and the month are two separate questions and the defect only failed the second:
 * `Dev.` is a perfectly well-formed `[A-Z][a-z]{2}\.`, so a parse that stopped at the shape
 * would have shipped it. The years are kept rather than discarded, because a period that runs
 * backwards is the same class of wrong data in the same accessible name.
 */
const parsePeriod = (period: string): ParsedPeriod | null => {
  const halves = period.split(' - ');
  if (halves.length !== 2) return null;

  const start = MONTH_YEAR.exec(halves[0]);
  if (!start) return null;

  const from: Endpoint = { month: start[1], year: Number(start[2]) };

  if (halves[1] === PRESENT) return { start: from, end: null };

  const end = MONTH_YEAR.exec(halves[1]);
  if (!end) return null;

  return { start: from, end: { month: end[1], year: Number(end[2]) } };
};

/**
 * Whether `parsed` runs forwards in time. An open end always does.
 *
 * Only meaningful once both months are known to be real, because an unknown month indexes to
 * `-1`. The loop below checks the months first and skips this when one of them failed.
 */
const runsForwards = (parsed: ParsedPeriod): boolean => {
  if (!parsed.end) return true;
  if (parsed.end.year !== parsed.start.year) return parsed.end.year > parsed.start.year;
  return MONTHS.indexOf(parsed.end.month) >= MONTHS.indexOf(parsed.start.month);
};

const SHAPE = `"Mon. YYYY - Mon. YYYY" or "Mon. YYYY - ${PRESENT}"`;

describe('work entry periods', () => {
  it('carries the pinned number of entries, each with a period', () => {
    // Pinned rather than bounded. With `toBeGreaterThan(0)` a deleted entry leaves every loop
    // below shorter, reporting nothing, and the suite stays green over a shorter list.
    expect(
      work.length,
      'content/work.ts no longer carries the pinned number of entries. If an entry was added or ' +
        'removed on purpose, move ENTRY_COUNT with it.'
    ).toBe(ENTRY_COUNT);

    const missing = work.filter((entry) => typeof entry.period !== 'string' || entry.period === '');
    expect(
      missing.map((entry) => entry.id),
      'an entry carries no period'
    ).toEqual([]);
  });

  it('writes every period with real months that run forwards', () => {
    const wrong: string[] = [];

    for (const entry of work) {
      const parsed = parsePeriod(entry.period);

      if (!parsed) {
        wrong.push(`${entry.id}: "${entry.period}" is not ${SHAPE}`);
        continue;
      }

      const months = [parsed.start.month, ...(parsed.end ? [parsed.end.month] : [])];
      const unreal = months.filter((month) => !MONTHS.includes(month));

      for (const month of unreal) {
        wrong.push(`${entry.id}: "${month}" in "${entry.period}" is not a month abbreviation`);
      }

      // Skipped when a month is unreal, because an unknown month indexes to -1 and the
      // comparison would report a second, invented failure about ordering.
      if (unreal.length === 0 && !runsForwards(parsed)) {
        wrong.push(`${entry.id}: "${entry.period}" ends before it starts`);
      }
    }

    expect(
      wrong,
      `a period string in content/work.ts is wrong. This reaches the page: WorkItem.tsx:76 ` +
        `renders it inside the work-item__header button, so it is part of that button's ` +
        `accessible name:\n${wrong.join('\n')}`
    ).toEqual([]);
  });

  it('fires on the defect it exists to catch, and on the shapes around it', () => {
    // The planted controls, before four agreeing entries are read as good news.
    //
    // **`Dev.` passes the shape check.** It is a capital and two lowercase letters and a dot,
    // like every real abbreviation, which is why membership in `MONTHS` is the half that
    // catches it and why the case above asserts both halves rather than one.
    expect(parsePeriod('Oct. 2023 - Dev. 2025')?.end?.month).toBe('Dev.');
    expect(MONTHS, 'Dev. is being accepted as a month, so the guard would pass the defect').not.toContain(
      'Dev.'
    );

    // The corrected string, through the same two halves.
    expect(parsePeriod('Oct. 2023 - Dec. 2025')?.end).toEqual({ month: 'Dec.', year: 2025 });
    expect(MONTHS).toContain('Dec.');

    // The open-ended form a current role takes. It parses, its start month is still checked,
    // and it is never reported as running backwards.
    const ongoing = parsePeriod(`Jan. 2026 - ${PRESENT}`);
    expect(ongoing?.start).toEqual({ month: 'Jan.', year: 2026 });
    expect(ongoing?.end, 'Present is being read as a closed end').toBeNull();
    expect(runsForwards(ongoing!)).toBe(true);

    // The ordering check, in both directions and in both the across-year and within-year forms.
    expect(runsForwards(parsePeriod('Oct. 2023 - Dec. 2025')!)).toBe(true);
    expect(runsForwards(parsePeriod('Dec. 2025 - Oct. 2023')!), 'a transposed period runs forwards').toBe(
      false
    );
    expect(runsForwards(parsePeriod('Jan. 2024 - Dec. 2024')!)).toBe(true);
    expect(
      runsForwards(parsePeriod('Dec. 2024 - Jan. 2024')!),
      'a period that runs backwards inside one year is accepted'
    ).toBe(false);
    // The boundary: one month, start and end identical, is forwards rather than backwards.
    expect(runsForwards(parsePeriod('Jun. 2021 - Jun. 2021')!)).toBe(true);

    // And the shapes the parse refuses outright, so a `null` answer is known to mean something.
    expect(parsePeriod('Oct 2023 - Dec 2025'), 'the undotted form is accepted').toBeNull();
    expect(parsePeriod('October 2023 - December 2025'), 'the unabbreviated form is accepted').toBeNull();
    expect(parsePeriod('Oct. 2023 - present'), 'a lowercase present is accepted').toBeNull();
    expect(parsePeriod('Oct. 2023'), 'a period with no end at all is accepted').toBeNull();
    expect(parsePeriod('Oct. 23 - Dec. 25'), 'two-digit years are accepted').toBeNull();
    expect(parsePeriod(''), 'an empty period is accepted').toBeNull();
  });
});
