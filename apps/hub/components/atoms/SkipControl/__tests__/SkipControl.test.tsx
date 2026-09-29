import { render, screen } from '@testing-library/react';
import { SkipControl } from '../SkipControl';

/**
 * The skip control (Story 2-13, FR-2).
 *
 * **The focus move is the claim, and it is asserted rather than the scroll.** jsdom implements
 * `focus()` and does not lay anything out, so what can be settled here is that activating the
 * control moves `document.activeElement` onto the Directory heading, that the browser's own default
 * is left alone to write the history entry and do the scrolling, and that a modified click is not
 * intercepted at all. Where the control sits, whether it is above the fold and whether its box
 * clears the floor are browser facts, and `tests/e2e/front-door.pw.ts` measures them.
 */

/** The Directory heading, as `SuiteDirectory` really renders it: the id, and `tabIndex` -1. */
const plantHeading = (): HTMLHeadingElement => {
  const heading = document.createElement('h2');
  heading.id = 'suite';
  heading.tabIndex = -1;
  heading.textContent = 'The Suite';
  document.body.append(heading);
  return heading;
};

/** A real, cancellable click, so `defaultPrevented` can be read afterwards. */
const click = (element: Element, init: MouseEventInit = {}): MouseEvent => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  element.dispatchEvent(event);
  return event;
};

// Testing Library unmounts what it rendered and nothing else, so a planted heading would outlive
// its case and the fall-through case below would find one it never planted.
afterEach(() => {
  document.getElementById('suite')?.remove();
});

describe('SkipControl', () => {
  it('is labelled exactly as the experience document writes it', () => {
    // Character for character, arrow included. The stylesheet uppercases it for display, so what is
    // read here is the authored string rather than its rendering.
    render(<SkipControl />);
    expect(screen.getByRole('link').textContent).toBe('Skip to the suite ↓');
  });

  it('keeps the arrow out of the accessible name, which is the sentence alone', () => {
    // The glyph is decoration: announced, it is "down arrow" appended to the name of a control
    // whose name is already a complete instruction. `getByRole` computes the accessible name the
    // way an assistive technology does, so this fails if the `aria-hidden` wrapper is dropped.
    render(<SkipControl />);
    expect(screen.getByRole('link', { name: 'Skip to the suite' })).toBeInTheDocument();
  });

  it('targets the Directory heading fragment', () => {
    render(<SkipControl />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '#suite');
  });

  it('moves focus to the heading, rather than leaving the browser to guess', () => {
    // `EXPERIENCE.md:723` says moves focus, not only scroll. Browsers agree on the scroll and have
    // never agreed on the focus, so this is done by hand and pinned here.
    const heading = plantHeading();
    render(<SkipControl />);

    click(screen.getByRole('link'));

    expect(document.activeElement, 'activating the skip control left focus where it was').toBe(heading);
  });

  it('and that read is not a constant, measured before the control is activated', () => {
    // The control for the case above. A heading that was already focused, or a `document.body`
    // that answers `activeElement` for everything, would make the assertion above meaningless.
    const heading = plantHeading();
    render(<SkipControl />);
    expect(document.activeElement).not.toBe(heading);
  });

  it('leaves the default action alone, so the fragment reaches the address bar and the history', () => {
    // Preventing it would take two things with it: `#suite` never appears in the URL, and Back
    // stops undoing the jump. Both are the browser's to do and it does them correctly; the only
    // thing it does not reliably do is move focus, which is the one thing this control adds.
    plantHeading();
    render(<SkipControl />);

    const event = click(screen.getByRole('link'));

    expect(event.defaultPrevented, 'the skip control cancelled its own fragment navigation').toBe(false);
  });

  it('does not intercept a modified or non-primary click', () => {
    // Ctrl, Cmd, Shift, Alt and the middle button all mean open elsewhere. Moving focus in this
    // document while a new tab opens in another is a small hostility, and it is the shape of the
    // defect: the handler used to run on every click it received.
    const heading = plantHeading();
    render(<SkipControl />);
    const link = screen.getByRole('link');

    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const event = click(link, modifier);
      expect(event.defaultPrevented, `a click with ${JSON.stringify(modifier)} was cancelled`).toBe(false);
      expect(
        document.activeElement,
        `a click with ${JSON.stringify(modifier)} moved focus in this document anyway`
      ).not.toBe(heading);
    }
  });

  it('does nothing at all when the heading is not in the document', () => {
    // The Directory is rendered by `app/page.tsx` beneath this hero, so the heading is normally
    // there. If it ever is not, the browser's own fragment navigation is still what happens, which
    // at least moves the reader down the page.
    render(<SkipControl />);
    const event = click(screen.getByRole('link'));
    expect(event.defaultPrevented, 'the default was prevented with no heading to focus').toBe(false);
    expect(document.activeElement, 'focus moved with no heading to move it to').toBe(document.body);
  });
});
