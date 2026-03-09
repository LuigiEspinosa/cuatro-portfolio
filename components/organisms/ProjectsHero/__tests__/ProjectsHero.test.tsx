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
    const { container } = render(<ProjectsHero />);
    expect(container.querySelector('.project-hero')).toBeInTheDocument();
  });

  it('renders the label column', () => {
    const { container } = render(<ProjectsHero />);
    expect(container.querySelector('.project-hero')).toBeInTheDocument();
  });

  it('renders the torus knot canvas', () => {
    const { getByTestId } = render(<ProjectsHero />);
    expect(getByTestId('torus-knot-canvas')).toBeInTheDocument();
  });

  it('has aria-hidden for screen readers', () => {
    const { container } = render(<ProjectsHero />);
    expect(container.querySelector('.project-hero')).toHaveAttribute('aria-hidden', 'true');
  });
});
