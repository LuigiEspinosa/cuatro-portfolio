import { render, screen, within } from '@testing-library/react';
import { SuiteDirectory, SuiteDirectoryRow } from '../SuiteDirectory';
import {
  HUB_ORIGIN,
  applications,
  groupByFamily,
  isCurrentOrigin,
  orderByStatus,
  renderedApplications,
  type RegistryEntry,
} from '@/lib/registry';

/**
 * The Suite Directory against the published Registry (Story 2-9).
 *
 * **Nothing is mocked.** The component is a server component with no hooks and no GSAP, so it
 * renders in jsdom as it renders in production, and `@/lib/registry` is deliberately left alone:
 * a mock here would make the directory render from a fixture and prove nothing about the wiring
 * that actually ships.
 *
 * **The arms the committed Registry cannot reach are split across two files, because they are two
 * different claims.** Whether a `Complete` entry is selected at all belongs to `selectRendered`
 * and is proved over fixtures in `lib/__tests__/registry.test.ts`. **How a row draws one** is this
 * component's, and no amount of filter evidence establishes it, so it is proved here, through
 * `SuiteDirectoryRow`. That export takes one entry and returns one `<li>`, so it cannot change
 * what the section renders; a fixture reaching `SuiteDirectory` itself would.
 *
 * **jsdom applies no stylesheets**, so every claim about a 44x44 box, a hairline, a grid column or
 * horizontal scroll belongs to `tests/e2e/hit-target-floor.pw.ts` and not here. What this file can
 * see is the markup: which entries are drawn, in what order, with what strings, and where each
 * link points.
 *
 * **The Status mark's three structural axes are rendered here and asserted by Story 2-10**, which
 * depends on this one. Nothing below reads a border, a dash or a dot.
 *
 * Rows are found through their own heading rather than by text lookup: the schema does not make
 * `name` unique, so two entries could legitimately share one and a bare `getByText` would throw on
 * valid data.
 */

/**
 * The entries in the order the composed rules put them on the page.
 *
 * Composed here rather than assumed, because grouping moves a family member to its family's
 * position: today the two `tracker-family` entries are already adjacent in file order and the two
 * sequences coincide, and a Registry that reordered them would silently make every indexed case
 * below compare a row against the wrong entry.
 */
const drawn = (): RegistryEntry[] =>
  groupByFamily(orderByStatus(renderedApplications)).flatMap((item) =>
    item.kind === 'entry' ? [item.entry] : [...item.members]
  );

const rows = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.suite-directory__row')];

const nameOf = (row: Element) => row.querySelector('.suite-directory__name')?.textContent;

describe('the Suite Directory', () => {
  it('renders one row per rendered entry, in the order the rules produce', () => {
    const { container } = render(<SuiteDirectory />);
    const rendered = rows(container);
    expect(rendered.length, 'the Registry renders nothing, which is a defect and not an empty state').toBeGreaterThan(
      0
    );
    expect(rendered.length).toBe(renderedApplications.length);
    expect(rendered.map(nameOf)).toEqual(drawn().map((application) => application.name));
  });

  it('renders no entry the Registry holds back', () => {
    const { container } = render(<SuiteDirectory />);
    const shown = new Set(renderedApplications.map((application) => application.id));
    const held = applications.filter((application) => !shown.has(application.id));
    expect(held.length, 'every committed entry is rendered, so this case proves nothing today').toBeGreaterThan(0);

    const rendered = rows(container).map(nameOf);
    for (const application of held) {
      expect(rendered, `${application.id} is not rendered by FR-35 and must not appear`).not.toContain(
        application.name
      );
    }
  });

  it('heads the section with the string and the real count, never a literal', () => {
    render(<SuiteDirectory />);
    expect(screen.getByRole('heading', { level: 2, name: 'The Suite' })).toBeInTheDocument();
    expect(screen.getByText(`${renderedApplications.length} running`)).toBeInTheDocument();
  });

  it('gives the heading the fragment target and makes it focusable', () => {
    // `/#suite` has to resolve to something, and `EXPERIENCE.md:420` moves focus to the heading
    // rather than only scroll position. Negative, so it never becomes a tab stop of its own.
    render(<SuiteDirectory />);
    const heading = screen.getByRole('heading', { level: 2, name: 'The Suite' });
    expect(heading).toHaveAttribute('id', 'suite');
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('carries a name, a status, a description and a tech line on every row', () => {
    const { container } = render(<SuiteDirectory />);
    for (const [index, row] of rows(container).entries()) {
      const application = drawn()[index];
      expect(nameOf(row)).toBe(application.name);
      expect(row.querySelector('.suite-directory__status')?.textContent).toContain(application.status);
      expect(within(row).getByText(application.description)).toBeInTheDocument();
      expect(row.querySelector('.suite-directory__tech')?.textContent).toBe(application.tech.join(' · '));
    }
  });

  it('reads the entry name, status, description, tech and links in that DOM order', () => {
    // `EXPERIENCE.md:317-320`. Daniela forms an opinion from the first three and never needs the
    // rest, and the source order is also the grid's, so the two cannot disagree.
    const { container } = render(<SuiteDirectory />);
    const [first] = rows(container);
    expect([...first.children].map((child) => child.className)).toEqual([
      'suite-directory__name',
      'suite-directory__status',
      'suite-directory__description',
      'suite-directory__tech',
      'suite-directory__links',
    ]);
  });

  it('links every entry to its source, named so the link stands on its own', () => {
    // A-10: the accessible name names the application, so a list of links read out of context is
    // still a list of destinations rather than six repetitions of the word Source.
    const { container } = render(<SuiteDirectory />);
    for (const [index, row] of rows(container).entries()) {
      const application = drawn()[index];
      const source = within(row).getByRole('link', { name: `Source: ${application.name}` });
      expect(source).toHaveAttribute('href', application.source);
      expect(source.textContent).toBe('Source');
    }
  });

  it('labels every live link with the bare domain, never with View Live', () => {
    const { container } = render(<SuiteDirectory />);
    let labelled = 0;

    for (const [index, row] of rows(container).entries()) {
      const application = drawn()[index];
      const live = row.querySelector<HTMLAnchorElement>('.suite-directory__live');

      if (application.live === undefined || isCurrentOrigin(application)) {
        expect(live, `${application.id} carries a live link it should not`).toBeNull();
        continue;
      }

      expect(live, `${application.id} is Live and carries no link`).not.toBeNull();
      expect(live).toHaveAttribute('href', application.live);

      // Asserted as two properties of the label rather than as a copy of the transform, which
      // would be the transform written twice and would agree with itself however it changed. No
      // committed entry carries a `www.` prefix, so the exact strip is pinned over a fixture below.
      const label = live?.textContent ?? '';
      expect(label, `${application.id} labels its live link with a www. prefix`).not.toMatch(/^www\./);
      expect(
        new URL(application.live).hostname.endsWith(label),
        `${application.id} labels its live link "${label}", which is not the tail of its hostname`
      ).toBe(true);
      labelled += 1;
    }

    expect(labelled, 'no live link was read, so the case above compares nothing').toBeGreaterThan(0);
  });

  it('marks the Hub with You are here, and keeps its Source link', () => {
    // `EXPERIENCE.md:331-332`: Source is present on every entry without exception, the Hub's own
    // included. What the mark replaces is the live link and nothing else.
    const { container } = render(<SuiteDirectory />);
    const hub = renderedApplications.find((application) => isCurrentOrigin(application));
    expect(hub, `no rendered entry serves ${HUB_ORIGIN}, so this case is vacuous`).toBeDefined();

    const row = rows(container).find((candidate) => nameOf(candidate) === hub?.name) as HTMLElement;
    expect(row, "the Hub's own entry is not rendered").toBeDefined();
    expect(within(row).getByText('You are here')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: `Source: ${hub?.name}` })).toHaveAttribute('href', hub?.source);
    expect(
      row.querySelector('.suite-directory__live'),
      'the Hub links a visitor to the page they are already reading'
    ).toBeNull();
  });

  it('marks exactly one row You are here', () => {
    render(<SuiteDirectory />);
    expect(screen.getAllByText('You are here')).toHaveLength(1);
  });

  it('gives every other row two destinations, and never makes the row itself one', () => {
    const { container } = render(<SuiteDirectory />);
    for (const [index, row] of rows(container).entries()) {
      const application = drawn()[index];
      const expected = isCurrentOrigin(application) ? 1 : 2;
      expect(within(row).getAllByRole('link'), `${application.id} does not carry ${expected} links`).toHaveLength(
        expected
      );
      // A whole-row target would have to pick one of the two, and picking the live link silently
      // costs Marcus his path to source.
      expect(row.closest('a'), `${application.id} sits inside a link, making the row wholly clickable`).toBeNull();
    }
  });

  it('is a list of entries, with the family a nested list carrying an accessible name', () => {
    // A-8 (`EXPERIENCE.md:767`).
    const { container } = render(<SuiteDirectory />);
    expect(container.querySelector('.suite-directory__list')?.tagName).toBe('UL');

    const nested = container.querySelector('.suite-directory__family-list');
    expect(nested, 'no family group is rendered, so this case is vacuous').not.toBeNull();
    expect(nested?.tagName).toBe('UL');

    const labelledBy = nested?.getAttribute('aria-labelledby');
    expect(labelledBy, 'the nested list carries no accessible name').toBeTruthy();
    expect(container.querySelector(`#${labelledBy}`)?.textContent).toBe('Tracker Family');
  });

  it('frames the family with the line that names no count', () => {
    const { container } = render(<SuiteDirectory />);
    expect(container.querySelector('.suite-directory__family-line')?.textContent).toBe(
      'One product family, distinct implementations, deliberately not merged.'
    );
  });

  it('draws the family members inside the group and everyone else outside it', () => {
    const { container } = render(<SuiteDirectory />);
    const inside = [...container.querySelectorAll('.suite-directory__family-list .suite-directory__row')].map(nameOf);
    const family = renderedApplications.filter((application) => application.family !== undefined);
    expect(family.length, 'no rendered entry carries a family, so this case is vacuous').toBeGreaterThan(0);
    expect(inside).toEqual(family.map((application) => application.name));
  });

  it('draws one container and no card', () => {
    // The row is the unit and it is never a card. The family group is the one containment layer in
    // the whole directory, which is why this counts it rather than forbidding every box.
    const { container } = render(<SuiteDirectory />);
    expect(container.querySelectorAll('.suite-directory__family')).toHaveLength(1);
    expect(container.querySelectorAll('article')).toHaveLength(0);
  });
});

describe('a Complete entry, which the committed Registry does not hold', () => {
  /**
   * FR-35 renders `Complete` beside `Live`, and AD-5 constrains `live` neither way there, so this
   * is the shape a row has to survive and no committed entry produces it. The claim under test is
   * the drawing one: **no live link at all, and not a disabled one. The slot does not render, and
   * it is never a placeholder or a dash.**
   *
   * A dash is the specific failure worth naming. It is what a layout reaches for when a cell is
   * empty, it reads as a destination that is broken rather than one that does not exist, and it
   * would satisfy any check written as "the live href is absent".
   */
  const finished: RegistryEntry = {
    id: 'finished',
    name: 'Finished Thing',
    description: 'One sentence about the thing itself.',
    status: 'Complete',
    tech: ['TypeScript', 'Postgres'],
    source: 'https://github.com/LuigiEspinosa/finished-thing',
    demo: 'none',
    identity: 'none',
  };

  const drawRow = (entry: RegistryEntry) =>
    render(
      <ul>
        <SuiteDirectoryRow entry={entry} />
      </ul>
    );

  it('renders no live link, and leaves Source the only destination', () => {
    const { container } = drawRow(finished);
    expect(container.querySelector('.suite-directory__live')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Source: Finished Thing' })).toHaveAttribute(
      'href',
      finished.source
    );
  });

  it('renders nothing at all in the slot the live link would have taken', () => {
    const { container } = drawRow(finished);
    const links = container.querySelector('.suite-directory__links');
    expect(links, 'the row draws no links container').not.toBeNull();
    expect(links?.children, 'the links container holds something besides the Source link').toHaveLength(1);
    // Not a dash, not an ellipsis, not a space standing in for a destination.
    expect(links?.textContent).toBe('Source');
  });

  it('renders no You are here either, the entry not being the current origin', () => {
    const { container } = drawRow(finished);
    expect(container.querySelector('.suite-directory__here')).toBeNull();
  });

  it('draws the rest of the row exactly as it draws a Live one', () => {
    const { container } = drawRow(finished);
    expect(container.querySelector('.suite-directory__name')?.textContent).toBe('Finished Thing');
    expect(container.querySelector('.suite-directory__status')?.textContent).toContain('Complete');
    expect(container.querySelector('.suite-directory__description')?.textContent).toBe(finished.description);
    expect(container.querySelector('.suite-directory__tech')?.textContent).toBe('TypeScript · Postgres');
  });

  it('draws the live link for the same entry once it carries one, so the cases above discriminate', () => {
    // Without this, a row that had stopped emitting a live link under every condition would pass
    // every case above, and the absence they assert would be a defect rather than a rule.
    const { container } = drawRow({ ...finished, status: 'Live', live: 'https://finished.cuatro.dev' });
    const live = container.querySelector<HTMLAnchorElement>('.suite-directory__live');
    expect(live, 'a Live entry with a hostname draws no live link').not.toBeNull();
    expect(live).toHaveAttribute('href', 'https://finished.cuatro.dev');
    expect(container.querySelector('.suite-directory__links')?.children).toHaveLength(2);
  });

  it('drops a www. prefix from the label while the href keeps it', () => {
    // `EXPERIENCE.md:289`: the live link's text is the bare domain, and the URL is the evidence.
    // The prefix is not part of what the reader is being told, and it is not the Registry's to
    // remove either: the href has to stay exactly what the entry declares, because that is the
    // address FR-32's link check verifies on a schedule.
    const { container } = drawRow({ ...finished, status: 'Live', live: 'https://www.example.com/path' });
    const live = container.querySelector<HTMLAnchorElement>('.suite-directory__live');
    expect(live).toHaveAttribute('href', 'https://www.example.com/path');
    expect(live?.textContent).toBe('example.com');
  });

  it('keeps a subdomain that merely starts like the prefix', () => {
    // The strip is anchored, so `wwwx.` and `www2.` are ordinary subdomains and survive. A bare
    // `replace('www.', '')` would eat the first match anywhere in the hostname.
    const { container } = drawRow({ ...finished, status: 'Live', live: 'https://www2.example.com' });
    expect(container.querySelector('.suite-directory__live')?.textContent).toBe('www2.example.com');
  });

  it('draws no live link for an entry whose hostname is an empty string', () => {
    // `href=""` reloads the page the reader is already on: a link that looks like it works and
    // does not. `live` is optional in the type and only forbidden when `Archived`, so an empty
    // string is a shape the type admits and a presence check on the key alone would render it.
    const { container } = drawRow({ ...finished, status: 'Live', live: '' });
    expect(container.querySelector('.suite-directory__live')).toBeNull();
    expect(container.querySelectorAll('a[href=""]')).toHaveLength(0);
    expect(container.querySelector('.suite-directory__links')?.textContent).toBe('Source');
  });

  it('draws no live link for an entry whose hostname is only whitespace', () => {
    const { container } = drawRow({ ...finished, status: 'Live', live: '   ' });
    expect(container.querySelector('.suite-directory__live')).toBeNull();
    expect(container.querySelector('.suite-directory__links')?.textContent).toBe('Source');
  });

  it('draws no live link for a Live entry that carries no hostname, rather than an empty one', () => {
    // AD-5 forbids this combination and the schema enforces it, so it cannot arrive from the
    // Registry. It can arrive from a hand-built object, and an `href=""` reloads the current page,
    // which is the worst of the three ways to get this wrong.
    const { container } = drawRow({ ...finished, status: 'Live' });
    expect(container.querySelector('.suite-directory__live')).toBeNull();
    expect(container.querySelectorAll('a[href=""]')).toHaveLength(0);
  });
});
