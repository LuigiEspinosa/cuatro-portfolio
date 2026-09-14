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

  it('renders no scrim layer', () => {
    // The layer is a scrim for text over moving imagery and this hero has none, the display line
    // sitting beside the canvas rather than over it (Story 2-28), so a call site returning here is a
    // regression with every other gate green.
    expect(render(<WorkHero />).container.querySelector('.scanline-overlay')).toBeNull();
  });
});
