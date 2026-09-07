import { render, screen, within } from '@testing-library/react';
import Home from '../page';
import { renderedApplications } from '@/lib/registry';

/**
 * The home route (Stories 2-9 and 2-11).
 *
 * **This is the story's payload and nothing pinned it.** The directory's own file proves what the
 * component draws, and `tests/e2e/suite-directory.pw.ts` proves how it behaves in a browser, but
 * neither opens `app/page.tsx`. Deleting the mount there would leave both green while `/` shipped
 * a hero and nothing under it, which is the state this story exists to end and the state Story
 * 2-14's redirect would then point at.
 *
 * `HomeLayout` is mocked because it mounts a WebGL canvas and a GSAP timeline, neither of which
 * jsdom has a renderer for. Its own file covers what it draws. The same treatment and the same
 * reason as `ProjectsHero` in `app/projects/__tests__/page.test.tsx`.
 *
 * `@/lib/registry` is **not** mocked, here or anywhere: the directory renders from the real
 * Registry, which is what makes the count below a fact about the route rather than about a fixture.
 */

vi.mock('@/components/organisms/HomeLayout/HomeLayout', () => ({
  default: () => <div data-testid='home-layout' />,
}));

describe('the home route', () => {
  it('renders the Suite Directory inside main', () => {
    const { container } = render(<Home />);
    const main = container.querySelector('main');
    expect(main, 'the route no longer renders a main landmark').not.toBeNull();
    expect(within(main as HTMLElement).getByRole('heading', { level: 2, name: 'The Suite' })).toBeInTheDocument();
  });

  it('puts the premise between the hero and the directory, so the claim precedes its evidence', () => {
    // Story 2-11 added the middle row. FR-4 requires the premise to be encountered before or with
    // the Directory, and the mount order is the whole of that: a block rendered after it would
    // satisfy every case in the component's own file and still be read second.
    const { container } = render(<Home />);
    const children = [...(container.querySelector('main')?.children ?? [])];
    expect(children.map((child) => child.getAttribute('data-testid') ?? child.className)).toEqual([
      'home-layout',
      'premise',
      'suite-directory',
    ]);
  });

  it('follows the directory with footer content and nothing else', () => {
    // FR-1: nothing follows the Directory except footer content. Until Story 2-11 there was no
    // footer anywhere in the tree for that to be true of, and Stories 2-12 and 2-17 both assume
    // one exists.
    //
    // **Asserted as an exact list rather than as a position, which is what makes it the FR-1
    // claim.** An earlier version read only "the footer follows the Directory", and a `<div>`
    // planted between `</main>` and the footer, or an `<aside>` planted after it, satisfied that
    // while being exactly the thing FR-1 forbids. The region between the Directory and the footer
    // is what Stories 2-12 and 2-17 edit next, so this is the guard those changes meet.
    const { container } = render(<Home />);
    expect([...container.children].map((child) => child.tagName)).toEqual(['MAIN', 'FOOTER']);

    const footer = container.querySelector('footer.site-footer');
    expect(footer, 'the home route renders no footer').not.toBeNull();
    // A footer is not main content, so it sits outside the landmark rather than at the end of it.
    expect(footer?.closest('main'), 'the footer is rendered inside main').toBeNull();

    const directory = container.querySelector('.suite-directory');
    expect(directory, 'the home route renders no Suite Directory, so this case measures nothing').not.toBeNull();
    expect(
      (directory?.compareDocumentPosition(footer as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the footer does not follow the Suite Directory in the document'
    ).toBeGreaterThan(0);
  });

  it('gives /#suite a target that resolves', () => {
    // The fragment Story 2-14 redirects to and Story 2-13's skip control targets. A heading that
    // renders without the id resolves nowhere and both land on the top of the page instead.
    const { container } = render(<Home />);
    const target = container.querySelector('#suite');
    expect(target, 'nothing on the home route carries id="suite"').not.toBeNull();
    expect(target?.tagName).toBe('H2');
    expect(target).toHaveAttribute('tabindex', '-1');
  });

  it('renders one row per rendered Registry entry, from the real Registry', () => {
    const { container } = render(<Home />);
    const rows = container.querySelectorAll('.suite-directory__row');
    expect(rows.length, 'the home route renders no directory row').toBeGreaterThan(0);
    expect(rows.length).toBe(renderedApplications.length);
  });

  it('renders no second h1, the hero already carrying the page heading', () => {
    // A-7: one `<h1>` per document, and heading levels never skip. The directory heads at `<h2>`
    // for that reason, so this fails if it is ever promoted.
    render(<Home />);
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });
});
