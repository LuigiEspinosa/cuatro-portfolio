import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import CvPage, { metadata } from '../page';
import { work } from '@/content/work';

/**
 * The `/cv` route (Story 2-16).
 *
 * **Nothing in the repository had ever rendered this page.** `next.config.js` answered the route
 * with a 308 to `/pdf/cv.pdf`, which shadows a route file rather than replacing it, so the stub
 * that stood here was compiled and unreachable. The composition is the payload of this story and
 * neither component's own file opens it: deleting the timeline mount would leave
 * `WorkTimeline.test.tsx` green while `/cv` shipped an intro block with nothing under it.
 *
 * `gsap` and `gsap/ScrollTrigger` are mocked for the same reason
 * `components/organisms/WorkTimeline/__tests__/WorkTimeline.test.tsx` mocks them: jsdom has no
 * layout for a tween to read. `next/link` is mocked the way
 * `components/atoms/Navbar/__tests__/Navbar.test.tsx` mocks it, so the anchor is real markup
 * rendered outside the App Router rather than a router context assembled for one `href`.
 *
 * **`@/lib/registry` and `@/content/work` are not mocked.** The lede's counts and the four
 * companies are read from the committed sources, which is what makes the assertions below facts
 * about the route rather than about a fixture.
 */

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((fn: (context: unknown) => void) => {
      fn({});
      return { revert: vi.fn() };
    }),
    to: vi.fn(() => ({ kill: vi.fn() })),
    set: vi.fn(),
    fromTo: vi.fn(),
    registerPlugin: vi.fn(),
  };
  return { gsap: gsapMock, default: gsapMock };
});

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { batch: vi.fn(), update: vi.fn() },
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** The panel id `WorkItem` builds for one entry, which is the whole of its `aria-controls`. */
const panelId = (index: number): string => `${work[index].id}-content`;

describe('the /cv route', () => {
  it('renders one h1, an h2 per company, and no level between them', () => {
    // A-7: one `<h1>` per document and no skipped level. `WorkItem` renders each company as an
    // `<h2>`, so a section label above the list could only be another `<h2>`, and an `<h3>` here
    // would be the skip. `WorkHero` is deliberately not mounted: it carries the `<h1>` on `/work`
    // and two routes cannot both claim the same heading.
    render(<CvPage />);

    const first = screen.getAllByRole('heading', { level: 1 });
    expect(first.map((heading) => heading.textContent), '/cv does not carry exactly one h1').toEqual([
      'Luigi Espinosa',
    ]);
    expect(
      screen.getAllByRole('heading', { level: 2 }).length,
      'the companies are not the second level of this outline'
    ).toBe(work.length);
    expect(screen.queryAllByRole('heading', { level: 3 }), '/cv renders an h3, which skips no level ' +
      'only because something above it moved').toEqual([]);
  });

  it('mounts the timeline exactly once, so every panel id stays unique', () => {
    // `WorkItem` builds each panel id as `${entry.id}-content`, so a second `<WorkTimeline />` in
    // one document duplicates all four and breaks `aria-controls` on both copies.
    const { container } = render(<CvPage />);

    expect(container.querySelectorAll('.work-timeline').length, '/cv does not mount one timeline').toBe(1);

    const controls = [...container.querySelectorAll('[aria-controls]')].map((node) =>
      node.getAttribute('aria-controls')
    );
    expect(controls.length, 'no accordion trigger rendered').toBe(work.length);
    expect(new Set(controls).size, 'two triggers point at the same panel id').toBe(controls.length);
  });

  it('renders the intro block inside a main landmark, above the timeline', () => {
    // The header is sticky at 140px since Story 2-15 and this surface renders no skip link, so the
    // landmark is the only way past the chrome. The order is the claim: an intro rendered after the
    // timeline would satisfy every other case here and be read second.
    const { container } = render(<CvPage />);

    const main = container.querySelector('main');
    expect(main, '/cv renders no main landmark').not.toBeNull();

    const intro = container.querySelector('.cv-intro');
    const timeline = container.querySelector('.work-timeline');
    expect(intro, '/cv renders no intro block').not.toBeNull();
    expect(intro?.closest('main'), 'the intro block is outside the landmark').not.toBeNull();
    expect(timeline?.closest('main'), 'the timeline is outside the landmark').not.toBeNull();
    expect(
      (intro?.compareDocumentPosition(timeline as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the timeline does not follow the intro block in the document'
    ).toBeGreaterThan(0);
  });

  it('keeps the PDF the redirect used to serve, and links the Directory in prose', () => {
    // `cuatro.dev/cv` served `/pdf/cv.pdf` before this story and people hold that URL. Removing the
    // redirect must not remove the artefact, and the file is neither moved nor renamed.
    const { container } = render(<CvPage />);

    const hrefs = [...container.querySelectorAll('a[href]')].map((node) => node.getAttribute('href'));
    expect(hrefs, '/cv no longer offers the PDF the redirect used to hand a visitor').toContain('/pdf/cv.pdf');
    expect(hrefs, '/cv carries no way back to the Suite Directory').toContain('/#suite');
    expect(hrefs, '/cv links the route it is').not.toContain('/cv');
  });

  it('states no number it did not derive, and names no company the content does not', () => {
    // `EXPERIENCE.md:299-300`: a count is never typed. Both counts in the lede are lengths, so the
    // text below has to carry the words for them and would change on its own if either source did.
    const { container } = render(<CvPage />);
    const lede = container.querySelector('.cv-intro__lede')?.textContent ?? '';

    expect(lede.length, '/cv renders no lede, so this scan is over an empty string').toBeGreaterThan(20);
    expect(lede, 'the lede prints a digit, which is what a typed count looks like').not.toMatch(/\d/);
    expect(lede, "the lede does not spell the number of companies content/work.ts holds").toContain('Four');

    for (const entry of work) {
      expect(
        container.textContent,
        `${entry.company} is in content/work.ts and is not on the page`
      ).toContain(entry.company);
    }
  });

  it('renders no Education and no Contact section, stubbed, empty or commented out', () => {
    const { container } = render(<CvPage />);
    const text = container.textContent ?? '';

    expect(text, '/cv rendered nothing, so the two scans below pass over an empty page').toContain(
      'Curriculum Vitae'
    );
    expect(text, '/cv renders an Education section this story does not own').not.toMatch(/education/i);
    expect(text, '/cv renders a Contact section this story does not own').not.toMatch(/contact/i);
  });

  it('leaves the open entry uncollapsed in the server output', () => {
    // **The flash is in the markup, not in the effect.** `WorkItem`'s mount effect sets the open
    // panel to `height: auto`, and that runs after hydration: `height: 0` used to be written into
    // every panel unconditionally, so a statically rendered document showed the first entry
    // collapsed until JavaScript ran, and with scripting off it never opened at all.
    //
    // Asserted on server output rather than in a browser, because a browser fast enough to hydrate
    // before the first paint would hide the defect rather than report it.
    //
    // **Seen once, in the medium the defect actually shows in.** Measured 2026-09-10 in
    // `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800 with `javaScriptEnabled: false`:
    // `/cv` answers 200 and the four panels measure 1468.25, 0, 0 and 0, the open one carrying 1132
    // characters of readable text, with `document.documentElement.scrollWidth` at 360. That was a
    // one-time reading and is not in this tree; this case is the standing one.
    const markup = renderToStaticMarkup(<CvPage />);
    const document_ = new DOMParser().parseFromString(markup, 'text/html');

    const open = document_.getElementById(panelId(0));
    expect(open, 'the first entry rendered no panel, so this reads nothing').not.toBeNull();
    expect(
      open?.getAttribute('style') ?? '',
      'the open entry ships collapsed, so it is invisible until hydration'
    ).not.toMatch(/height/);

    // **The control, and it is the other three entries.** They are closed and must still carry the
    // collapsed style, or the reading above is a component that stopped writing any style at all
    // and the accordion opens with every panel already showing.
    const closed = document_.getElementById(panelId(1));
    expect(closed, 'the second entry rendered no panel').not.toBeNull();
    expect(
      closed?.getAttribute('style') ?? '',
      'a closed entry ships uncollapsed, so the reading above is not about the open one'
    ).toContain('height:0');
  });

  it('names itself once, the layout template supplying the rest', () => {
    // `app/layout.tsx:15-18` applies `'%s | Luigi Espinosa'`. The stub this replaced exported the
    // whole string, so the first render this page ever got would have read
    // `CV | Luigi Espinosa - Frontend Developer | Luigi Espinosa`.
    expect(metadata.title, 'the title re-states what the layout template already appends').toBe('CV');
    expect(metadata.openGraph?.url, 'the Open Graph URL is absolute or absent').toBe('/cv');
  });
});
