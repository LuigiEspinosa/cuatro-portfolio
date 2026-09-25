import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { section, table, unticked } from '../contract-adoption.mjs';
import { LIVE_EVENT, SOURCE_EVENT, SuiteDirectoryRow } from '@/components/organisms/SuiteDirectory/SuiteDirectory';
import { REACH_EVENT, SuiteReach, TRACKER_POLL_LIMIT, TRACKER_POLL_MS } from '@/components/organisms/SuiteDirectory/SuiteReach';
import type { RegistryEntry } from '@/lib/registry';

/**
 * The Story 2-24 record, `ops/visitor-instrumentation.md`, held equal to the tree.
 *
 * **The record names the events and the components export them, and neither can see the other.**
 * A name changed in `SuiteReach.tsx` leaves the record stating a name Umami never receives; a row
 * added to the record claims an event nothing sends. So the agreement is asserted here, under the
 * blocking `test` job, in the shape `ops/__tests__/status-mark-axes.test.ts` uses: the markdown
 * parsers are `ops/contract-adoption.mjs`'s, and every parser is shown firing on a planted control
 * before an agreement is read as good news.
 *
 * jsdom rather than node, because the second half renders one row and reads the attributes off it:
 * the record's Data column says `app` and the anchors say `data-umami-event-app`, and the claim is
 * about what a visitor's click carries, not about a string in a source file.
 */

const REPO_ROOT = process.cwd();
const HERE = 'ops/__tests__/visitor-instrumentation.test.ts';
const RECORD_REL = 'ops/visitor-instrumentation.md';
const MONITORING_REL = 'ops/monitoring.md';
const EVENTS_HEADING = 'The events';

/** Read a tracked file, with line endings normalised to `\n`. Same reason as `status-mark-axes.test.ts:37-52`. */
const read = (relative: string): string => {
  try {
    return readFileSync(resolve(REPO_ROOT, relative), 'utf8').replace(/\r\n/g, '\n');
  } catch (error) {
    throw new Error(`${HERE}: ${relative} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const record = read(RECORD_REL);

/** The `Event` and `Data` columns of the record's events table. */
const recordEvents = (markdown: string): { event: string; data: string }[] => {
  const { headers, rows } = table(section(markdown, EVENTS_HEADING), 'Event');
  const data = headers.indexOf('Data');
  if (data === -1) throw new Error(`the events table has no "Data" column`);
  return rows.map((row) => ({ event: unticked(row[0]), data: unticked(row[data]) }));
};

/**
 * The body of every fenced block in the record, which is where the SQL lives. The inverse of
 * `contract-adoption.mjs`'s `withoutFences`, same pattern, so what one strips the other reads.
 */
const fencedBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(/^[ \t]*```[^\n]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/gm)].map((match) => match[1]);

/**
 * The data one `suite-reach` carries, read off the component rather than restated: a fake observer,
 * a stub tracker and one notification, the way the record's Data column is about what a visitor's
 * event carries and not about a string in a source file.
 */
const reachData = (): Record<string, unknown> => {
  const sent: unknown[][] = [];
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    }
  );
  window.umami = { track: (...args: unknown[]) => void sent.push(args) };
  const heading = document.createElement('h2');
  heading.id = 'reach-probe';
  document.body.append(heading);
  try {
    const { unmount } = render(createElement(SuiteReach, { target: 'reach-probe', door: 'flat' }));
    callbacks[0]?.([{ isIntersecting: true, boundingClientRect: { bottom: 1 } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    unmount();
  } finally {
    heading.remove();
    sessionStorage.clear();
    delete window.umami;
    vi.unstubAllGlobals();
  }
  if (sent.length !== 1) throw new Error(`${HERE}: the reach component sent ${sent.length} events to a stub, so its data cannot be read`);
  return (sent[0][1] ?? {}) as Record<string, unknown>;
};

/** One Live row with a hostname, so both anchors render. */
const probe: RegistryEntry = {
  id: 'probe',
  name: 'Probe',
  description: 'One sentence about the thing itself.',
  status: 'Live',
  live: 'https://probe.cuatro.dev',
  tech: ['TypeScript'],
  source: 'https://github.com/LuigiEspinosa/probe',
  demo: 'none',
  identity: 'none',
};

describe('the record names the events the components export', () => {
  const events = recordEvents(record);

  it('names exactly the three exported names, in the order they are sent in a session', () => {
    expect(events.map((row) => row.event)).toEqual([REACH_EVENT, LIVE_EVENT, SOURCE_EVENT]);
  });

  it('states the door on reach and app on both link events, each the key the component sends', () => {
    // The tracker reads `data-umami-event-app`, so `app` is the key SM-2 and SM-3 group by. Reach
    // carried nothing until the Operator's ruling of 2026-09-24 (DW-88), and carries the front door
    // since: its key is read off the component, so a rename there fails here by name.
    const keys = Object.keys(reachData());
    expect(keys, 'the reach event carries some other data than the one door').toEqual(['door']);
    const byName = new Map(events.map((row) => [row.event, row.data]));
    expect(byName.get(REACH_EVENT)).toMatch(new RegExp(`^${keys[0]}:`));
    expect(byName.get(LIVE_EVENT)).toMatch(/^app:/);
    expect(byName.get(SOURCE_EVENT)).toMatch(/^app:/);
  });

  it('joins the door onto reach in a fenced SM-1 query, on the key the component sends (DW-88)', () => {
    // The split SM-1 exists for: which front door the reaching visits came through. A query that
    // named a key the component does not send would read every visit as unrecorded, forever.
    const [key] = Object.keys(reachData());
    const joined = fencedBlocks(record).filter(
      (block) => block.includes(`'${REACH_EVENT}'`) && block.includes(`d.data_key = '${key}'`) && /\bleft join event_data\b/.test(block)
    );
    expect(joined, `no fenced block in ${RECORD_REL} joins '${key}' onto '${REACH_EVENT}'`).toHaveLength(1);
    expect(joined[0], 'the joined query counts something other than distinct visits').toContain('count(distinct e.visit_id)');
  });

  it('matches the attributes a rendered row carries', () => {
    const { container } = render(createElement('ul', null, createElement(SuiteDirectoryRow, { entry: probe })));
    const carried = [...container.querySelectorAll('[data-umami-event]')].map((anchor) => ({
      event: anchor.getAttribute('data-umami-event'),
      data: anchor.getAttribute('data-umami-event-app') === null ? 'none' : 'app',
    }));
    expect(carried, 'the row carries no event attribute, so this compares nothing').toHaveLength(2);

    const stated = events.filter((row) => row.event !== REACH_EVENT).map((row) => ({ event: row.event, data: 'app' }));
    expect(carried).toEqual(stated);
    // And the row's `app` is the entry's id, not a literal.
    for (const anchor of container.querySelectorAll('[data-umami-event]')) {
      expect(anchor.getAttribute('data-umami-event-app')).toBe(probe.id);
    }
  });

  it('states the poll the component runs, period and bound, and the bound in seconds', () => {
    // The two figures the reach row states. `20 s` is their product and is what the reader is
    // told a blocked tracker costs, so it is held to the same two exports.
    const { headers, rows } = table(section(record, EVENTS_HEADING), 'Event');
    const fires = rows.find((row) => unticked(row[0]) === REACH_EVENT)?.[headers.indexOf('Fires when')] ?? '';
    expect(fires).toContain(`${TRACKER_POLL_MS} ms`);
    expect(fires).toContain(`at most ${TRACKER_POLL_LIMIT} ticks`);
    expect(record).toContain(`${(TRACKER_POLL_MS * TRACKER_POLL_LIMIT) / 1000} s`);
  });

  it('queries the same names in every fenced SQL block, by visit and never by session id', () => {
    // The table above is held to the exports; the queries are literals no parser reaches. A rename
    // that moved the table and the component would leave the recorded SQL counting zero forever,
    // which is a reading nobody would question. Each name appears quoted in at least one block,
    // and no block counts or distincts `session_id`, which is a visitor for a month.
    const blocks = fencedBlocks(record);
    expect(blocks.length, `${RECORD_REL} carries no fenced block, so there is no SQL to hold`).toBeGreaterThan(0);
    for (const name of [REACH_EVENT, LIVE_EVENT, SOURCE_EVENT]) {
      expect(
        blocks.some((block) => block.includes(`'${name}'`)),
        `no fenced block in ${RECORD_REL} quotes '${name}', so the recorded SQL cannot count it`
      ).toBe(true);
    }
    for (const block of blocks) {
      expect(block, 'a recorded query counts session_id, which folds a visitor into one row a month').not.toMatch(
        /(distinct|count\()\s*(\w+\.)?session_id/
      );
    }
    // The reader on planted controls, so an empty list is never a pass.
    expect(fencedBlocks('no fence here\n')).toEqual([]);
    expect(fencedBlocks('```\nselect 1;\n```\n')).toEqual(['select 1;']);
    expect(fencedBlocks('```sql\na\nb\n```\ntext\n```\nc\n```\n')).toEqual(['a\nb', 'c']);
  });

  it('refuses a record it could not read', () => {
    // The parser on planted controls, so an agreement is never the result of an empty list.
    expect(() => recordEvents('# nothing\n')).toThrow(/no "## The events" section/);
    expect(() => recordEvents('## The events\n\n| Other |\n|---|\n| x |\n')).toThrow(
      /no table whose header begins with "Event"/
    );
    expect(() => recordEvents('## The events\n\n| Event | Fires when |\n|---|---|\n| `x` | y |\n')).toThrow(
      /no "Data" column/
    );
    expect(
      recordEvents('## The events\n\n| Event | Fires when | Data | Nature |\n|---|---|---|---|\n| `x` | y | none | z |\n')
    ).toEqual([{ event: 'x', data: 'none' }]);
  });
});

describe('the record carries what the story requires of it', () => {
  it('carries the SM-C1 sentence verbatim, under its own heading', () => {
    // The story's fourth acceptance criterion. `prd.md` § SM-C1, character for character.
    const text = section(record, 'Time on site is not a target');
    expect(text).toContain('Time-on-site must never');
    expect(text).toContain('a fall in it alongside a rise in SM-2 is a good outcome');
  });

  it('states the baseline date the monitoring record fixes', () => {
    expect(record).toContain('2026-08-17');
  });

  it('carries the sections the Operator reads, once each', () => {
    // `section` throws on a heading that is absent or repeated, so this is both checks at once.
    for (const heading of [
      EVENTS_HEADING,
      'How each metric is read',
      'Time on site is not a target',
      'Stated limits',
      'Readings',
      'Verification session',
      'Pending Operator actions',
    ]) {
      expect(() => section(record, heading), `${RECORD_REL} has no single "## ${heading}"`).not.toThrow();
    }
  });

  it('reads every metric as distinct visits, never as event rows or monthly session ids', () => {
    // SM-1 to SM-3 are shares of sessions in the PRD's sense, one sitting: Umami's `visit_id`. An
    // event count would double-count a two-tab visitor, and `session_id` rotates monthly by default,
    // so it would fold a returning visitor's month into one row.
    const how = section(record, 'How each metric is read');
    expect(how).toContain('SM-1');
    expect(how).toContain('SM-2');
    expect(how).toContain('SM-3');
    // The raw record, because `section` strips the fenced SQL the claim is about.
    expect(record, 'the SQL no longer counts distinct visits').toContain('count(distinct e.visit_id)');
    expect(record, 'the SQL counts session_id, which is a visitor for a month').not.toMatch(/distinct (e\.)?session_id/);
  });

  it('holds its readings table to the shape the maintenance rule names', () => {
    const { headers } = table(section(record, 'Readings'), 'Month (ISO 8601)');
    expect(headers).toEqual([
      'Month (ISO 8601)',
      'Sessions',
      'Reached',
      'Share',
      'Opened live',
      'Live share',
      'Opened source',
      'Source share',
      'Taken by',
    ]);
  });

  it('is pointed at by the monitoring record beside the baseline paragraph', () => {
    const monitoring = read(MONITORING_REL);
    const baseline = monitoring.indexOf('The Umami database was discarded on 2026-08-17');
    const pointer = monitoring.indexOf(RECORD_REL);
    expect(baseline, `${MONITORING_REL} no longer carries the baseline paragraph`).toBeGreaterThan(-1);
    expect(pointer, `${MONITORING_REL} does not point at ${RECORD_REL}`).toBeGreaterThan(baseline);
  });
});
