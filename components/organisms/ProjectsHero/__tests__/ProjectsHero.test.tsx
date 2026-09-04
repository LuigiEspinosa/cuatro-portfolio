import { render } from '@testing-library/react';
import { ProjectsHero } from '../ProjectsHero';

vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: vi.fn(),
    to: vi.fn(),
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { rever: vi.fn() };
    }),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { update: vi.fn() },
}));

vi.mock('@/hooks/useGsapContext', () => ({
  useGsapContext: (_fn: () => void) => {
    return { current: document.createElement('section') };
  },
}));

vi.mock('@/components/molecules/TorusKnotCanvas/TorusKnotCanvas', () => ({
  TorusKnotCanvas: () => <div data-testid='torus-knot-canvas' />,
}));

describe('ProjectsHero', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProjectsHero count={3} />);
    expect(container.querySelector('.projects-hero')).toBeInTheDocument();
  });

  it('renders the label column', () => {
    const { container } = render(<ProjectsHero count={3} />);
    expect(container.querySelector('.projects-hero__heading')).toBeInTheDocument();
    expect(container.querySelector('.projects-hero__text')).toHaveTextContent('// PROJECTS');
  });

  it('renders the torus knot canvas', () => {
    const { getByTestId } = render(<ProjectsHero count={3} />);
    expect(getByTestId('torus-knot-canvas')).toBeInTheDocument();
  });

  // The count is the one thing the Registry swap made data-driven, and the route's own test asserts
  // it against a mock of this component, so without these two cases a hero that ignored the prop
  // and printed a literal would ship green under six cards. Two different values, neither of them
  // today's live count, so a hardcoded number fails whatever it is.
  it.each([3, 11])('paints the count it is given (%i)', (count) => {
    const { container } = render(<ProjectsHero count={count} />);
    expect(container.querySelector('.projects-hero__meta')).toHaveTextContent(`${count} PROJECTS`);
  });
});
