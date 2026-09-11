import { render, screen } from '@testing-library/react';
import { Navbar } from '../Navbar';

/**
 * The header's two destinations (Story 2-15).
 *
 * **The pathname is driven, not mocked away.** `Navbar` takes it as a prop, so every case below
 * renders the real component against a real pathname and reads the real attribute. There is no
 * `usePathname` stub, and nothing here asserts a value it supplied to the assertion itself.
 *
 * **`aria-current` had no live instance on the shipped Hub until 2026-09-10.** `Suite` is current
 * only on `/`, where `Header.tsx:12` renders no header at all, and `CV` is current only on `/cv`,
 * which answered a 308 to a PDF until Story 2-16 built the page. So the mechanism was asserted here
 * at the unit level and again as a planted browser control in `tests/e2e/chrome-nav.pw.ts`, and the
 * first live instance arrived needing nothing here to change: `tests/e2e/cv.pw.ts` reads it on the
 * real surface, and every case below is what it was.
 */

//  mock Next.js router so tests run outside the App Router context.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** Every anchor the nav renders, in document order. */
const links = (): HTMLAnchorElement[] => [...screen.getAllByRole('link')] as HTMLAnchorElement[];

describe('Navbar', () => {
  it('renders exactly two destinations, in the order the design fixes', () => {
    // `EXPERIENCE.md:115-123` and `:285`: `Suite` primary, `CV` secondary, and nothing else. The
    // order is asserted as a list rather than as two lookups, because two `getByRole` calls pass
    // in either order and the order is the half PRD Q8 closed.
    render(<Navbar pathname='/work' />);

    expect(links().map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Suite', '/#suite'],
      ['CV', '/cv'],
    ]);
  });

  it('points CV at the route and never at the PDF behind the redirect', () => {
    // `/cv` answered a 308 to `/pdf/cv.pdf` until Story 2-16 built the page on 2026-09-10. Naming
    // the PDF here would have been a link that worked and then had to be moved back the day the
    // page landed, and it would still be a header label pointing at a file rather than a route.
    render(<Navbar pathname='/work' />);

    const cv = screen.getByRole('link', { name: 'CV' });
    expect(cv).toHaveAttribute('href', '/cv');
    expect(cv.getAttribute('href')).not.toMatch(/\.pdf$/);
  });

  it('renders no external link and no mailto:', () => {
    // The six-links-plus-a-mailto shape this replaced is the AI-nav tell `EXPERIENCE.md:126`
    // names. Asserted over every rendered anchor rather than over a filtered subset, so a third
    // link that arrived carrying either would fail here as well as in the count above.
    render(<Navbar pathname='/work' />);

    for (const link of links()) {
      expect(link.getAttribute('target'), `${link.textContent} opens in a new tab`).toBeNull();
      expect(link.getAttribute('href'), `${link.textContent} is not a same-origin route`).toMatch(/^\//);
    }
  });

  it('marks the current route with aria-current and leaves the other unmarked', () => {
    render(<Navbar pathname='/cv' />);

    expect(screen.getByRole('link', { name: 'CV' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Suite' })).not.toHaveAttribute('aria-current');
  });

  it('marks the Suite destination on the home pathname, which the fragment does not defeat', () => {
    // The other side of the same mechanism, and the reason `Navbar` compares a route rather than
    // the whole `href`: `/#suite` never equals `/`, so a comparison against the `href` would leave
    // this link permanently unmarked and would start marking it the day the fragment was dropped.
    render(<Navbar pathname='/' />);

    expect(screen.getByRole('link', { name: 'Suite' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'CV' })).not.toHaveAttribute('aria-current');
  });

  it('marks neither link on a route that is neither destination', () => {
    // `/work` and the 404 are the two surfaces that actually render this header today, so this is
    // the shipped case rather than an edge one. Without it the two cases above would be satisfied
    // by a component that marked whichever link it was asked about.
    for (const pathname of ['/work', '/a-route-that-does-not-exist']) {
      const { unmount } = render(<Navbar pathname={pathname} />);
      expect(
        links().filter((link) => link.hasAttribute('aria-current')),
        `${pathname} marks a destination as the current page`
      ).toEqual([]);
      unmount();
    }
  });

  it('wraps each label in the span the current-route rule is drawn on', () => {
    // `RESTYLE-SPEC.md:198-199`: the underline is drawn on an inner span, not on the `--tap` box,
    // or it floats away from the text by the height of the padding. `navbar.scss` selects
    // `.navbar__label`, so a label rendered as a bare text node leaves that rule matching nothing
    // and the current route unmarked while every assertion above stays green.
    const { container } = render(<Navbar pathname='/cv' />);

    const labels = [...container.querySelectorAll('.navbar__label')];
    expect(labels.map((label) => label.textContent)).toEqual(['Suite', 'CV']);
    for (const label of labels) {
      expect(label.closest('a'), 'a label is not inside its own link').not.toBeNull();
    }
  });
});
