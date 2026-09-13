import { render, screen } from '@testing-library/react';
import { SkipLink } from '../SkipLink';

/**
 * The A-6 skip-link (Story 2-13).
 *
 * **What is not asserted here.** Whether it is really the first tabbable element, and whether it
 * really becomes visible when it receives focus, are facts about a document and a stylesheet:
 * `tests/e2e/front-door.pw.ts` presses Tab in a browser and reads the box. jsdom loads no
 * stylesheet, so a case here claiming visibility would be measuring nothing.
 *
 * What is settled here is the contract the browser case depends on: one anchor, a real `href`, and
 * a target that `app/page.tsx` is the other half of.
 */
describe('SkipLink', () => {
  it('renders one link, and it is a real anchor with a real destination', () => {
    // `href` rather than a click handler is the whole design: with scripting off, or before
    // hydration, this still works, and there is no state in which it does nothing.
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#main');
    expect(link.tagName).toBe('A');
  });

  it('carries the class the stylesheet positions it with, and no other markup', () => {
    // The off-screen positioning and the reveal on focus are that one class. A rename that left
    // this component rendering a bare link would ship a permanently visible skip-link, which is
    // the failure mode that looks like a working feature.
    const { container } = render(<SkipLink />);
    expect(container.querySelectorAll('a.skip-link')).toHaveLength(1);
    expect(container.children).toHaveLength(1);
  });
});
