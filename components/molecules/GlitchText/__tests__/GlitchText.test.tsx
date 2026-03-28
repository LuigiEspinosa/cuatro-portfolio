import { render, screen } from '@testing-library/react';
import GlitchText from '../GlitchText';

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
    to: vi.fn(),
    set: vi.fn(),
    registerPlugin: vi.fn(),
  };
  return { gsap: gsapMock, default: gsapMock };
});

vi.mock('gsap/SplitText', () => ({
  SplitText: class {
    chars: Element[] = [];
    constructor() {}
  },
}));

vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

vi.mock('@/hooks/useGsapContext', () => ({
  useGsapContext: (_fn: () => void) => ({
    current: document.createElement('div'),
  }),
}));

describe('GlitchText', () => {
  it('renders the text content', () => {
    render(<GlitchText text='Luigi Espinosa' />);
    expect(screen.getByText('Luigi Espinosa')).toBeInTheDocument();
  });

  it('sets aria-label to the text prop so screen readers get the full string', () => {
    const { container } = render(<GlitchText text='Luigi Espinosa' />);
    expect(container.querySelector('.glitch-text')).toHaveAttribute('aria-label', 'Luigi Espinosa');
  });

  it('renders an h1 by default', () => {
    const { container } = render(<GlitchText text='Hello' />);
    expect(container.querySelector('h1.glitch-text__inner')).toBeInTheDocument();
  });

  it('renders the tag specified by the tag prop', () => {
    const { container } = render(<GlitchText text='Hello' tag='h2' />);
    expect(container.querySelector('h2.glitch-text__inner')).toBeInTheDocument();
  });

  it('accepts a delay prop without throwing', () => {
    expect(() => render(<GlitchText text='Hello' delay={1.5} />)).not.toThrow();
  });

  it('marks the inner header as aria-hidden', () => {
    const { container } = render(<GlitchText text='Hello' />);
    expect(container.querySelector('.glitch-text__inner')).toHaveAttribute('aria-hidden', 'true');
  });
});
