import { renderToStaticMarkup } from 'react-dom/server';
import Error404 from '../Error404';
import { DESTINATIONS } from '@/components/atoms/Navbar/Navbar';

/**
 * The 404's exits are the header's list (Story 2-17).
 *
 * `RESTYLE-SPEC.md:472` fixes an error surface's exits at exactly the ones the application's
 * header already carries, never more and never fewer. `Error404` maps over the same `DESTINATIONS`
 * the header renders, so this file asserts the consequence rather than a copy of the list: what is
 * compared against is the export, not two literals typed here, and a destination added, dropped or
 * relabelled in `Navbar.tsx` moves both sides of the comparison at once.
 *
 * **Server output, deliberately.** `renderToStaticMarkup` runs no effect, so the GSAP entrance in
 * `useGsapContext` never fires and what is read is the markup a visitor without scripting gets.
 * `gsap` is still mocked, the way `components/organisms/WorkTimeline/__tests__/WorkTimeline.test.tsx`
 * mocks it, because the module is imported at the top of the component and jsdom has no layout
 * for the real one to read. `next/link` is mocked the way `Navbar.test.tsx` mocks it, so the
 * anchor is real markup rendered outside the App Router.
 *
 * The browser half, the two boxes at the floor and the equality against `nav.navbar a` on the same
 * page, is `tests/e2e/secondary-surfaces.pw.ts`.
 */

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((fn: (context: unknown) => void) => {
      fn({});
      return { revert: vi.fn() };
    }),
    from: vi.fn(),
    to: vi.fn(),
    set: vi.fn(),
    fromTo: vi.fn(),
    registerPlugin: vi.fn(),
  };
  return { gsap: gsapMock, default: gsapMock };
});

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** One rendered exit: its label and its `href`, in the shape `Navbar.test.tsx` pins the header in. */
type Exit = readonly [label: string, href: string];

/**
 * Every anchor inside `.error-page`, in document order, read off a markup string.
 *
 * A function over the string rather than an inline query, so the planted control below can drive
 * the same predicate with a third link and be seen to report it.
 */
const exitsIn = (markup: string): { exits: Exit[]; marked: number } => {
  const document_ = new DOMParser().parseFromString(markup, 'text/html');
  const anchors = [...document_.querySelectorAll('.error-page a[href]')];
  return {
    exits: anchors.map((anchor) => [anchor.textContent ?? '', anchor.getAttribute('href') ?? ''] as const),
    marked: anchors.filter((anchor) => anchor.hasAttribute('aria-current')).length,
  };
};

/** What the header renders, as label and `href` pairs, read off the export rather than typed. */
const HEADER: Exit[] = DESTINATIONS.map((destination) => [destination.label, destination.href] as const);

describe('the 404 renders the header’s exits and nothing else', () => {
  it('renders exactly two links, pairwise equal to DESTINATIONS, in the header’s order', () => {
    // The premise, before the comparison means anything: the export is the two the design fixes.
    // `Navbar.test.tsx` pins the same pairs on the header side; here it is the shape of the
    // list that is asserted, so an export that shrank to one would fail this line rather than
    // pass the comparison below against itself.
    expect(HEADER, 'DESTINATIONS no longer carries two destinations').toHaveLength(2);

    const markup = renderToStaticMarkup(<Error404 />);
    const { exits, marked } = exitsIn(markup);

    expect(exits, 'the 404 does not render exactly the header’s destinations, in its order').toEqual(HEADER);
    expect(marked, 'an exit on the 404 announces itself as the current page').toBe(0);
  });

  it('keeps both exits inside the wrapper the stylesheet lays out, each carrying the tween’s class', () => {
    // `error-page.scss` puts the gap on `.error-page__exits` and the floor on `.error-page__back`,
    // and `Error404.tsx` tweens `.error-page__back` in. A link that lost either class would still
    // count above and would measure under the floor, or arrive without fading, in the browser.
    const markup = renderToStaticMarkup(<Error404 />);
    const document_ = new DOMParser().parseFromString(markup, 'text/html');

    const wrapper = document_.querySelectorAll('.error-page__exits');
    expect(wrapper, 'the 404 renders no exits wrapper, or more than one').toHaveLength(1);

    const inside = [...wrapper[0].querySelectorAll('a[href]')];
    expect(inside.length, 'an exit sits outside the wrapper').toBe(HEADER.length);
    for (const anchor of inside) {
      expect(anchor.classList.contains('error-page__back'), `${anchor.textContent} lost the class`).toBe(true);
    }
  });

  it('and the reader reports a third link and a mark, so the clean readings above are measurements', () => {
    // The control, through the same predicate rather than a second reading. A third exit planted
    // into the markup, carrying `aria-current`, has to show up in both numbers, or an empty result
    // above is a selector that stopped matching rather than a surface with two exits.
    //
    // **The plant is asserted to have landed before anything is read off it.** It splices at the
    // markup's closing tail, and Story 2-30 will rebuild that markup: a `replace` whose needle no
    // longer matches returns the string unchanged, and the failures below would then blame the
    // reader for not seeing an exit that was never planted.
    const original = renderToStaticMarkup(<Error404 />);
    const markup = original.replace(
      '</div></div></div>',
      "<a href='/planted' class='error-page__back' aria-current='page'>Planted</a></div></div></div>"
    );
    expect(markup, 'the plant did not land: the markup tail this control splices at has changed').not.toBe(original);
    const { exits, marked } = exitsIn(markup);

    expect(exits, 'the reader did not see the planted third exit').toEqual([...HEADER, ['Planted', '/planted']]);
    expect(marked, 'the reader did not see the planted aria-current').toBe(1);
    expect(exits, 'the planted markup still equals the header, so the equality above discriminates nothing').not.toEqual(
      HEADER
    );
  });
});
