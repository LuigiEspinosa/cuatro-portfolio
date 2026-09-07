import { render, screen, within } from '@testing-library/react';
import Home from '../page';
import { renderedApplications } from '@/lib/registry';

/**
 * The home route (Story 2-9).
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

  it('puts the directory after the hero, so the fold is the hero and the payload follows it', () => {
    const { container } = render(<Home />);
    const children = [...(container.querySelector('main')?.children ?? [])];
    expect(children.map((child) => child.getAttribute('data-testid') ?? child.className)).toEqual([
      'home-layout',
      'suite-directory',
    ]);
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
