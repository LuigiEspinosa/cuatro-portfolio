import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import CvPage, { metadata } from '../page';
import { work } from '@/content/work';
import { renderedApplications } from '@/lib/registry';
import { capitalise, spellOut } from '@/lib/words';

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

    // **`download`, because the label says so.** Chrome renders a same-origin PDF inline without it,
    // so a control reading `Download PDF` would open a viewer and the word would be a lie. The
    // in-prose link must not carry it: it goes to a route, and a `download` there would offer the
    // homepage as a file.
    const pdf = container.querySelector('a[href="/pdf/cv.pdf"]');
    const prose = container.querySelector('a[href="/#suite"]');
    expect(pdf?.hasAttribute('download'), 'the Download link does not ask the browser to download').toBe(true);
    expect(prose?.hasAttribute('download'), 'the in-prose route link is marked as a download').toBe(false);
  });

  it('states no number it did not derive, and names no company the content does not', () => {
    // `EXPERIENCE.md:299-300`: a count is never typed. Both counts in the lede are lengths, so the
    // text below has to carry the words for them and would change on its own if either source did.
    //
    // **The expected words are derived here too**, the way `Premise.test.tsx:45-46` derives its
    // opening. A literal `Four` would be this file typing the count the component is forbidden to
    // type, and it would redden on the commit that adds a job to `content/work.ts`, which this
    // story's boundaries forbid it from editing and a later one will not.
    const { container } = render(<CvPage />);
    const lede = container.querySelector('.cv-intro__lede')?.textContent ?? '';

    expect(lede.length, '/cv renders no lede, so this scan is over an empty string').toBeGreaterThan(20);
    expect(lede, 'the lede prints a digit, which is what a typed count looks like').not.toMatch(/\d/);
    expect(
      lede.startsWith(`${capitalise(spellOut(work.length))} `),
      `the lede opens "${lede.slice(0, 48)}", which does not spell the ${work.length} companies ` +
        `content/work.ts holds`
    ).toBe(true);
    expect(
      lede,
      `the lede does not spell the ${renderedApplications.length} entries the Registry renders`
    ).toContain(spellOut(renderedApplications.length));

    for (const entry of work) {
      expect(
        container.textContent,
        `${entry.company} is in content/work.ts and is not on the page`
      ).toContain(entry.company);
    }
  });

  it('agrees between each count and the words that follow it', () => {
    // Read off the rendered line rather than composed, so a plural rule wired into this file and
    // not into the block fails here. `Four company` and `The one personal project are in the suite`
    // are the two shapes this refuses, and the second is the one a Registry of one would produce.
    const { container } = render(<CvPage />);
    const words = (container.querySelector('.cv-intro__lede')?.textContent ?? '').split(/\s+/);

    expect(words.length, '/cv renders no lede, so there are no words to compare').toBeGreaterThan(8);

    const noun = words[1].replace(/[^\w]/g, '');
    expect(
      noun.endsWith('ies'),
      `"${noun}" does not agree with a count of ${work.length}`
    ).toBe(work.length !== 1);

    // The Registry's clause is `The <count> <noun> <verb> in the suite`, and both its ends are found
    // in the sentence rather than counted off: the noun is two words today and a test that assumed
    // one would be pinning the copy it is meant to be reading.
    const at = words.indexOf(spellOut(renderedApplications.length));
    expect(at, 'the Registry count is not in the lede, so nothing after it is its clause').toBeGreaterThan(0);

    const inAt = words.findIndex((word, index) => index > at && word === 'in');
    expect(inAt, 'the Registry clause does not reach its preposition, so its verb has no position').toBeGreaterThan(
      at + 1
    );

    const projectNoun = words.slice(at + 1, inAt - 1).join(' ').replace(/[^\w ]/g, '');
    const verb = words[inAt - 1].replace(/[^\w]/g, '');

    expect(projectNoun, 'the Registry count is followed by no noun at all').not.toBe('');
    expect(
      projectNoun.endsWith('s'),
      `"${projectNoun}" does not agree with a count of ${renderedApplications.length}`
    ).toBe(renderedApplications.length !== 1);
    expect(
      verb,
      `"${verb}" does not agree with a count of ${renderedApplications.length}`
    ).toBe(renderedApplications.length === 1 ? 'is' : 'are');
  });

  it('renders no Education and no Contact section, stubbed, empty or commented out', () => {
    // **Scoped to headings, which is what a section is.** Scanning the whole page text would put
    // `content/work.ts` in this assertion's way: a highlight mentioning a contact centre or an
    // education client would redden the suite for a page that renders neither section, and that
    // file belongs to other stories. A section arrives as a heading or it is not a section.
    const { container } = render(<CvPage />);

    const headings = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
      (node) => node.textContent ?? ''
    );

    expect(headings.length, '/cv rendered no heading at all, so the two scans below pass over nothing').toBeGreaterThan(
      0
    );
    expect(
      headings.filter((heading) => /education/i.test(heading)),
      '/cv heads an Education section this story does not own'
    ).toEqual([]);
    expect(
      headings.filter((heading) => /contact/i.test(heading)),
      '/cv heads a Contact section this story does not own'
    ).toEqual([]);

    // The scan, on a planted control, so an empty result is a measurement rather than a selector
    // that stopped matching headings.
    expect(
      [...headings, 'Education'].filter((heading) => /education/i.test(heading)),
      'the scan no longer fires on a heading that names one'
    ).toEqual(['Education']);
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
