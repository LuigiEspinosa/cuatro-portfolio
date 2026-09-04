import { render, screen, within } from '@testing-library/react';
import ProjectsPage from '../page';
import { applications, renderedApplications } from '@/lib/registry';

/**
 * `/projects` over the published Registry (Story 2.7).
 *
 * The route swapped its data source and nothing else, so this asserts the wiring: the cards are the
 * entries the Registry marks rendered (FR-35), each link resolves to the field the entry declares,
 * and the hero is told how many there are. What those entries say is not this file's business.
 *
 * `ProjectsHero` is mocked because it mounts a WebGL canvas, which jsdom has no renderer for. Its
 * one prop is asserted here and the component's own file asserts that it paints it. `ProjectCard`
 * renders for real, so a card that stopped emitting a link fails here and not only in its own file.
 *
 * Cards are found through their own `<h2>` rather than by text lookup: the schema does not make
 * `name` unique, so two entries could legitimately share one and a bare `getByText` would throw on
 * valid data.
 */

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
    from: vi.fn(),
    registerPlugin: vi.fn(),
  };
  return { gsap: gsapMock, default: gsapMock };
});

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { update: vi.fn() } }));

vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

vi.mock('@/components/organisms/ProjectsHero/ProjectsHero', () => ({
  ProjectsHero: ({ count }: { count: number }) => <div data-testid='projects-hero'>{count}</div>,
}));

/** The rendered cards, in document order, so a case can index them against the Registry. */
const cards = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.projects-grid > li article')];

describe('the projects route', () => {
  it('renders one card per rendered entry, in Registry order', () => {
    const { container } = render(<ProjectsPage />);
    const rendered = cards(container);
    expect(rendered.length).toBe(renderedApplications.length);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.map((card) => card.querySelector('h2')?.textContent)).toEqual(
      renderedApplications.map((application) => application.name)
    );
  });

  it('gives each card the entry name, description and tech list', () => {
    const { container } = render(<ProjectsPage />);
    cards(container).forEach((card, index) => {
      const application = renderedApplications[index];
      expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(application.name);
      expect(within(card).getByText(application.description)).toBeInTheDocument();
      for (const technology of application.tech) {
        expect(within(card).getByText(technology)).toBeInTheDocument();
      }
    });
  });

  it('links each card to the source and the live hostname the entry declares', () => {
    const { container } = render(<ProjectsPage />);
    cards(container).forEach((card, index) => {
      const application = renderedApplications[index];
      expect(within(card).getByRole('link', { name: /github/i })).toHaveAttribute('href', application.source);
      if (application.live) {
        expect(within(card).getByRole('link', { name: /live/i })).toHaveAttribute('href', application.live);
      } else {
        expect(within(card).queryByRole('link', { name: /live/i })).not.toBeInTheDocument();
      }
    });
  });

  it('renders no entry the Registry holds back', () => {
    const { container } = render(<ProjectsPage />);
    const shown = new Set(renderedApplications.map((application) => application.id));
    const held = applications.filter((application) => !shown.has(application.id));
    expect(held.length, 'every committed entry is rendered, so this case proves nothing today').toBeGreaterThan(0);
    const headings = cards(container).map((card) => card.querySelector('h2')?.textContent);
    for (const application of held) {
      expect(headings, `${application.id} is not rendered by FR-35 and must not appear`).not.toContain(application.name);
    }
  });

  it('tells the hero how many entries it rendered', () => {
    render(<ProjectsPage />);
    expect(screen.getByTestId('projects-hero')).toHaveTextContent(String(renderedApplications.length));
  });
});
