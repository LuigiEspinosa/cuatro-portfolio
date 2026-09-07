import { render, screen } from '@testing-library/react';
import ProjectsPage from '../page';
import { renderedApplications } from '@/lib/registry';

/**
 * `/projects` over the Suite Directory (Story 2-9, rewritten from the Story 2-7 card-grid file).
 *
 * The route swapped what it renders and nothing else, so this asserts the wiring: the same
 * component the homepage mounts, the hero still told how many entries there are, and the directory
 * outside `Container` rather than inside it. **What the directory itself renders is
 * `components/organisms/SuiteDirectory/__tests__` business**, and duplicating those cases here
 * would put the same claim in two files that could disagree.
 *
 * `ProjectsHero` is mocked because it mounts a WebGL canvas, which jsdom has no renderer for. Its
 * one prop is asserted here and the component's own file asserts that it paints it. The directory
 * renders for real and reads the real Registry: mocking `@/lib/registry` to make it render would
 * leave the wiring this file exists to check unproven.
 *
 * The route is not deleted. Story 2-14 redirects it, at which point the two mount points collapse
 * to one.
 */

vi.mock('@/components/organisms/ProjectsHero/ProjectsHero', () => ({
  ProjectsHero: ({ count }: { count: number }) => <div data-testid='projects-hero'>{count}</div>,
}));

describe('the projects route', () => {
  it('renders the Suite Directory, one row per rendered entry', () => {
    const { container } = render(<ProjectsPage />);
    const rows = container.querySelectorAll('.suite-directory__row');
    expect(rows.length, 'the route renders no directory row').toBeGreaterThan(0);
    expect(rows.length).toBe(renderedApplications.length);
    expect(screen.getByRole('heading', { level: 2, name: 'The Suite' })).toBeInTheDocument();
  });

  it('tells the hero how many entries it rendered', () => {
    render(<ProjectsPage />);
    expect(screen.getByTestId('projects-hero')).toHaveTextContent(String(renderedApplications.length));
  });

  it('renders no card grid, the component the grid was replaced by drawing rows', () => {
    const { container } = render(<ProjectsPage />);
    expect(container.querySelector('.projects-grid')).toBeNull();
  });

  it('keeps the directory outside Container, which the directory pads for itself', () => {
    // `container.scss:2-4` is `width: min(80%, 1920px)`, which leaves 288px of content at 360px and
    // is what `ops/known-violations.md:399` blames for the hero overflow beside it. jsdom applies
    // no stylesheets, so this is asserted on the tree rather than on a measurement.
    const { container } = render(<ProjectsPage />);
    const directory = container.querySelector('.suite-directory');
    expect(directory, 'the route renders no directory').not.toBeNull();
    expect(directory?.closest('.container'), 'the directory is inside Container').toBeNull();
  });
});
