import { render } from '@testing-library/react';
import { WorkHero } from '../WorkHero';

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

vi.mock('@/components/molecules/TorusCanvas/TorusCanvas', () => ({
  TorusCanvas: () => <div data-testid='torus-canvas' />,
}));

describe('WorkHero', () => {
  it('renders without crashing', () => {
    const { container } = render(<WorkHero />);
    expect(container.querySelector('.work-hero')).toBeInTheDocument();
  });

  it('renders the label column', () => {
    const { container } = render(<WorkHero />);
    expect(container.querySelector('.work-hero')).toBeInTheDocument();
  });

  it('renders the torus canvas', () => {
    const { getByTestId } = render(<WorkHero />);
    expect(getByTestId('torus-canvas')).toBeInTheDocument();
  });

  it('has aria-hidden for screen readers', () => {
    const { container } = render(<WorkHero />);
    expect(container.querySelector('.work-hero')).toHaveAttribute('aria-hidden', 'true');
  });
});
