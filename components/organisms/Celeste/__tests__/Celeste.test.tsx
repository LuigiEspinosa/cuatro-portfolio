import { render, screen } from '@testing-library/react';
import CelesteComponent from '../Celeste';

/**
 * The regression guard for the defect Story 2-1 closes.
 *
 * This component used to hide the site header by writing `display: none` onto another
 * component's DOM node inside an effect, and restore it from that effect's cleanup. A cleanup
 * that never ran left the header hidden for the rest of the session. The suppression is now
 * `#celeste header` in `celeste.scss`, keyed on the id `Body` already writes onto `<body>`, so
 * no node is mutated and nothing has to be restored.
 *
 * jsdom applies no stylesheet, so what this file can assert is the **absence of the mutation**,
 * which is the defect itself. That the header is actually hidden is asserted in a real browser
 * by `tests/e2e/celeste-header.pw.ts`.
 */

/**
 * The heading, byte for byte.
 *
 * Every non-ASCII character is written as an escape, so the bytes this compares against do not
 * depend on how an editor normalised the file: U+00ED LATIN SMALL LETTER I WITH ACUTE, which is
 * the precomposed form rather than `i` followed by U+0301 COMBINING ACUTE ACCENT and compares
 * unequal to it; U+1F499 BLUE HEART; U+1F98B BUTTERFLY. The leading space is inside the `<h1>`
 * in the source and is part of what "unchanged" means here.
 */
const HEADING = ' Te amo much\u00EDsimo hermosa \u{1F499}\u{1F98B}';

describe('CelesteComponent', () => {
  let header: HTMLElement;

  beforeEach(() => {
    header = document.createElement('header');
    document.body.appendChild(header);
  });

  afterEach(() => {
    header.remove();
  });

  it('leaves a header already in the document untouched, on mount and on unmount', () => {
    // The control. `outerHTML` is read after a real mutation and again after undoing it, so a
    // case where the read answered the same string regardless would not look like a pass.
    header.style.display = 'none';
    expect(header.outerHTML).toBe('<header style="display: none;"></header>');
    header.removeAttribute('style');

    const pristine = header.outerHTML;
    expect(pristine).toBe('<header></header>');

    const { unmount } = render(<CelesteComponent />);

    // **The whole node, not one property.** The defect was an inline style, but an effect
    // reintroduced here could as easily set `header.hidden`, add a class, or take the node out
    // of the document, and a check that only read `style.display` would pass all three.
    // `outerHTML` covers every attribute and any injected child, and `contains` covers a
    // `remove()`, which `outerHTML` alone still reads happily off a detached node.
    expect(document.body.contains(header), 'the header was taken out of the document').toBe(true);
    expect(header.outerHTML, 'the header node was modified on mount').toBe(pristine);

    // The named defect, kept as its own read so a failure says which mutation came back.
    expect(header.style.display, 'the header carries an inline display again').toBe('');

    // The other half of the same claim: the restore is structural, so there is no cleanup
    // writing anything back either.
    unmount();

    expect(document.body.contains(header), 'the header was taken out of the document on unmount').toBe(
      true
    );
    expect(header.outerHTML, 'the header node was modified on unmount').toBe(pristine);
    expect(header.style.display).toBe('');
  });

  it('renders its heading unchanged', () => {
    render(<CelesteComponent />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(HEADING);
  });
});
