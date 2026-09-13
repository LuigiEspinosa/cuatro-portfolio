import { render, screen } from '@testing-library/react';
import { PlateMark } from '../PlateMark';

/**
 * The Plate mark, Section variant (Story 2-11).
 *
 * **Nothing is mocked and nothing is read off the Registry here.** The mark takes two strings and
 * draws them; which strings the homepage hands it is `Premise`'s claim and is proved there. Keeping
 * the two apart is what lets this file exercise the arm the committed Registry never produces, a
 * mark with no trailing cell, without inventing a Registry state to reach it.
 *
 * **jsdom applies no stylesheets**, so the mono treatment, the tracking, the hairline beneath the
 * label and `tabular-nums` belong to `tests/e2e/premise.pw.ts` and not here. What this file sees is
 * the markup: which cells are drawn, in what order, and that nothing in them is interactive.
 */

describe('the Plate mark draws section identity over a rule', () => {
  it('draws the identity on the leading edge and the domain on the trailing one, in that order', () => {
    const { container } = render(<PlateMark label='A Section' domain='example.test' />);
    const mark = container.querySelector('.plate-mark');
    expect(mark, 'no plate mark was drawn at all').not.toBeNull();
    expect([...(mark?.children ?? [])].map((cell) => cell.className)).toEqual([
      'plate-mark__label',
      'plate-mark__domain',
    ]);
    expect(mark?.querySelector('.plate-mark__label')?.textContent).toBe('A Section');
    expect(mark?.querySelector('.plate-mark__domain')?.textContent).toBe('example.test');
  });

  it('reads both cells as text, neither hidden from assistive technology', () => {
    // **The Section variant's trailing cell is not the Annotated variant's subordinate line.** That
    // line is `--token-accent-muted` at 2.74:1 and is `aria-hidden` in every implementation without
    // exception (`DESIGN.md:701-704`); this cell is ordinary secondary text carrying a domain a
    // reader is meant to read. Hiding it would delete a fact rather than a decoration.
    const { container } = render(<PlateMark label='A Section' domain='example.test' />);
    expect(screen.getByText('A Section')).toBeInTheDocument();
    expect(screen.getByText('example.test')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('draws no trailing cell at all when there is no domain', () => {
    // Absent, never a placeholder. `DESIGN.md:706-707` says a mark appears where a genuine ordinal
    // or domain exists; a dash, an ellipsis or an empty box each state that something is missing,
    // which is a different claim from making none.
    const { container } = render(<PlateMark label='A Section' />);
    const mark = container.querySelector('.plate-mark');
    expect(mark?.querySelector('.plate-mark__domain')).toBeNull();
    expect(mark?.children, 'the mark draws something beside its label').toHaveLength(1);
    expect(mark?.textContent).toBe('A Section');
  });

  it('draws no trailing cell for a domain that is empty or only whitespace', () => {
    // An empty string is a shape a caller can hand it, and rendered it would be a cell with nothing
    // in it: a gap the layout keeps space for and a reader gets nothing from.
    for (const domain of ['', '   ']) {
      const { container } = render(<PlateMark label='A Section' domain={domain} />);
      expect(container.querySelector('.plate-mark__domain'), `"${domain}" drew a cell`).toBeNull();
    }
  });

  it('draws no mark at all for a label that is empty or only whitespace', () => {
    // **The label takes the same treatment as the domain, and until it did the two disagreed.**
    // `contracts/registry.schema.json` constrains `name` to a string rather than to a non-blank
    // one, so whitespace is a shape the Registry itself admits. Rendered, it put a hairline across
    // the page with nothing above it, which reads as a separator this design does not have rather
    // than as a label that failed to arrive.
    for (const label of ['', '   ']) {
      const { container } = render(<PlateMark label={label} domain='example.test' />);
      expect(container.querySelector('.plate-mark'), `"${label}" drew a mark`).toBeNull();
      expect(container.textContent, `"${label}" drew its trailing cell without an identity`).toBe('');
    }
  });

  it('trims the identity it draws rather than rendering the padding around it', () => {
    const { container } = render(<PlateMark label='  A Section  ' domain='  example.test  ' />);
    expect(container.querySelector('.plate-mark__label')?.textContent).toBe('A Section');
    expect(container.querySelector('.plate-mark__domain')?.textContent).toBe('example.test');
  });

  it('draws the trailing cell for the same mark once it carries one, so the absences discriminate', () => {
    // Without this a mark that had stopped drawing the cell under every condition would pass every
    // case above, and the absence they assert would be a defect rather than a rule.
    const { container } = render(<PlateMark label='A Section' domain='example.test' />);
    expect(container.querySelector('.plate-mark__domain')?.textContent).toBe('example.test');
  });

  it('is not interactive, so no hit target arrives on a page with it', () => {
    // `tests/e2e/hit-target-floor.pw.ts` pins an exact count of interactive elements per surface. A
    // mark that grew a link or a tab stop would move that count, and the failure there names a
    // number rather than this component.
    const { container } = render(<PlateMark label='A Section' domain='example.test' />);
    expect(container.querySelectorAll('a, button, input, select, textarea, summary')).toHaveLength(0);
    expect(container.querySelectorAll('[tabindex], [role], [title], [aria-describedby]')).toHaveLength(0);
  });

  it('carries no heading, the page already having one', () => {
    render(<PlateMark label='A Section' domain='example.test' />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
