import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { compile } from 'sass';
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

/**
 * The stylesheet's two repairs (Story 2-32), read as it compiles, which is what ships.
 *
 * Whether the ring really lands whole, and whether a tap really paints no hover, are the browser's
 * questions: `tests/e2e/accessibility-floor.pw.ts` reads the ring against the viewport's edge on every
 * Tab stop, and the `clip-skip-link` row that sweep carried is what this story deleted.
 */
describe('SkipLink.scss', () => {
  const css = compile(resolve(__dirname, '..', 'SkipLink.scss'), { style: 'compressed' }).css;

  /** A compiled sheet with every `@media (hover: hover)` block cut out. */
  const ungated = (source: string): string => source.replace(/@media\(hover: hover\)\{(?:[^{}]*\{[^{}]*\})*\}/g, '');

  it('parks the link one ring-reach inside the corner, and hides it by its height plus that inset', () => {
    // The reach is the global ring's offset plus its stroke, summed from the roles rather than
    // written: parked at the corner itself, the ring's top and left sides fell past the viewport.
    const reach = 'calc(var(--focus-offset) + var(--stroke-focus))';
    expect(css).toContain(`inset-block-start:${reach}`);
    expect(css).toContain(`inset-inline-start:${reach}`);
    expect(css).toContain('transform:translateY(calc(-100% - var(--focus-offset) - var(--stroke-focus)))');
    expect(css, 'the reveal no longer brings the box back to its parked place').toContain('.skip-link:focus{transform:translateY(0)}');
    expect(css, 'a corner parking came back').not.toMatch(/inset-(block|inline)-start:0[;}]/);
  });

  it('gates its hover on a pointer that can hover, and still has one to gate', () => {
    expect(ungated(css), 'a :hover rule sits outside @media (hover: hover) (DW-115)').not.toContain(':hover');
    expect(css).toContain('@media(hover: hover){.skip-link:hover{border-block-end-color:var(--token-accent-hover)}}');
    expect(ungated('.skip-link:hover{color:red}'), 'the gate strip removes an ungated rule').toContain(':hover');
  });
});
