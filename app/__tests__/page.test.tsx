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
 * jsdom has a renderer for. Its own file covers what it draws. `app/projects/__tests__/page.test.tsx`
 * mocked `ProjectsHero` for the same reason until 2026-09-07, when Story 2-14 landed the redirect
 * this docblock anticipates and deleted the route with it.
 *
 * `@/lib/registry` is **not** mocked, here or anywhere: the directory renders from the real
 * Registry, which is what makes the count below a fact about the route rather than about a fixture.
 *
 * **The route became an async server component with Story 2-13**, because it reads the `Save-Data`
 * request header to decide the front door before the document is rendered. `next/headers` throws
 * outside a request, so it is mocked with a `Headers` a case can set, and every case renders
 * `await Home()` rather than `<Home />`: an async component handed to React as an element resolves
 * to a promise, which is not a valid child. Nothing else about these cases changed, and the
 * main-children array below is character for character what it was.
 */

vi.mock('@/components/organisms/HomeLayout/HomeLayout', () => ({
  // The mock carries `servedPath` through, so the header case below can read what the route decided
  // without unmocking a component jsdom has no renderer for. The `data-testid` is unchanged, which
  // is what keeps the main-children array identical.
  default: ({ servedPath }: { servedPath?: string }) => (
    <div data-testid='home-layout' data-served-path={servedPath} />
  ),
}));

/** The request the route is rendered against, reset before each case. */
const request = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(request.headers),
}));

beforeEach(() => {
  request.headers = new Headers();
});

/** `await Home()` in one place, because an async server component is not a JSX element. */
const renderHome = async () => render(await Home());

describe('the home route', () => {
  it('renders the Suite Directory inside main', async () => {
    const { container } = await renderHome();
    const main = container.querySelector('main');
    expect(main, 'the route no longer renders a main landmark').not.toBeNull();
    expect(within(main as HTMLElement).getByRole('heading', { level: 2, name: 'The Suite' })).toBeInTheDocument();
  });

  it('puts the premise between the hero and the directory, so the claim precedes its evidence', async () => {
    // Story 2-11 added the middle row. FR-4 requires the premise to be encountered before or with
    // the Directory, and the mount order is the whole of that: a block rendered after it would
    // satisfy every case in the component's own file and still be read second.
    const { container } = await renderHome();
    const children = [...(container.querySelector('main')?.children ?? [])];
    expect(children.map((child) => child.getAttribute('data-testid') ?? child.className)).toEqual([
      'home-layout',
      'premise',
      'suite-directory',
    ]);
  });

  it('follows the directory with footer content and nothing else', async () => {
    // FR-1: nothing follows the Directory except footer content. Until Story 2-11 there was no
    // footer anywhere in the tree for that to be true of, and Stories 2-12 and 2-17 both assume
    // one exists.
    //
    // **Asserted as an exact list rather than as a position, which is what makes it the FR-1
    // claim.** An earlier version read only "the footer follows the Directory", and a `<div>`
    // planted between `</main>` and the footer, or an `<aside>` planted after it, satisfied that
    // while being exactly the thing FR-1 forbids. The region between the Directory and the footer
    // is what Stories 2-12 and 2-17 edit next, so this is the guard those changes meet.
    //
    // Story 2-13 added the first entry. The A-6 skip-link is rendered ahead of `<main>` because
    // being the first tabbable element is what makes it the accessibility skip-link, and FR-1 is a
    // claim about what follows the Directory, which is still the footer and nothing else.
    const { container } = await renderHome();
    expect([...container.children].map((child) => child.tagName)).toEqual(['A', 'MAIN', 'FOOTER']);

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

  it('gives /#suite a target that resolves', async () => {
    // The fragment Story 2-14 redirects to and Story 2-13's skip control targets. A heading that
    // renders without the id resolves nowhere and both land on the top of the page instead.
    const { container } = await renderHome();
    const target = container.querySelector('#suite');
    expect(target, 'nothing on the home route carries id="suite"').not.toBeNull();
    expect(target?.tagName).toBe('H2');
    expect(target).toHaveAttribute('tabindex', '-1');
  });

  it('renders one row per rendered Registry entry, from the real Registry', async () => {
    const { container } = await renderHome();
    const rows = container.querySelectorAll('.suite-directory__row');
    expect(rows.length, 'the home route renders no directory row').toBeGreaterThan(0);
    expect(rows.length).toBe(renderedApplications.length);
  });

  it('renders no second h1, the hero already carrying the page heading', async () => {
    // A-7: one `<h1>` per document, and heading levels never skip. The directory heads at `<h2>`
    // for that reason, so this fails if it is ever promoted.
    await renderHome();
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });
});

describe('the front door the route serves', () => {
  it('answers flat for a Save-Data request, before anything is rendered to the browser', async () => {
    // Operator ruling of 2026-09-07: every trigger that can be answered before the document paints
    // must be, and this is the one of the four that reaches the server. The verdict travels as a
    // prop rather than being re-derived in the hero, so the served markup and the client's first
    // render cannot disagree about which door this visitor came through.
    request.headers = new Headers({ 'Save-Data': 'on' });
    const { container } = await renderHome();

    expect(container.querySelector('[data-testid="home-layout"]')).toHaveAttribute('data-served-path', 'flat');
  });

  it('answers undecided with no such header, leaving the browser to settle the other three', async () => {
    // The control for the case above, and the ordinary case: the header's absence says nothing
    // about WebGL or the motion preference, so the server settles nothing and the hero starts where
    // it always did, on the default path's geometry.
    const { container } = await renderHome();

    expect(container.querySelector('[data-testid="home-layout"]')).toHaveAttribute(
      'data-served-path',
      'undecided'
    );
  });

  it('reads the header case-insensitively and refuses a value that is not "on"', async () => {
    // `Headers` lower-cases the name for us; the value is ours to normalise, and a client hint is
    // `on` or it is nothing. A truthy-string read would put a visitor sending `Save-Data: off` on
    // the non-3D path permanently.
    request.headers = new Headers({ 'save-data': 'ON' });
    const { container: on } = await renderHome();
    expect(on.querySelector('[data-testid="home-layout"]')).toHaveAttribute('data-served-path', 'flat');

    request.headers = new Headers({ 'Save-Data': 'off' });
    const { container: off } = await renderHome();
    expect(off.querySelector('[data-testid="home-layout"]')).toHaveAttribute('data-served-path', 'undecided');
  });
});
