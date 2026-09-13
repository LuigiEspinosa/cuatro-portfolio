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

  // Story 2-26. The inner element is hidden because the entrance rewrites its characters, so the
  // wrapper has to be the heading the accessibility tree sees: a bare `<div>` is `generic`, which
  // prohibits the `aria-label`, and the home route shipped no page heading at all (the
  // `aria-prohibited-attr` audit Story 2-11 filed). The level follows the tag, and a tag with no
  // level gets neither attribute rather than a heading at an invented level.
  it('announces the wrapper as a level-1 heading by default, the inner h1 being hidden', () => {
    render(<GlitchText text='Luigi Espinosa' />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Luigi Espinosa' });
    expect(heading).toHaveClass('glitch-text');
    expect(heading.tagName).toBe('DIV');
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('derives the level from the tag prop', () => {
    render(<GlitchText text='Hello' tag='h2' />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Hello' });
    expect(heading).toHaveAttribute('role', 'heading');
    expect(heading).toHaveAttribute('aria-level', '2');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('gives a tag with no heading level neither the role nor a level', () => {
    for (const tag of ['p', 'span'] as const) {
      const { container, unmount } = render(<GlitchText text='Hello' tag={tag} />);
      const wrapper = container.querySelector('.glitch-text');
      expect(wrapper, `no wrapper rendered for ${tag}`).not.toBeNull();
      expect(wrapper).not.toHaveAttribute('role');
      expect(wrapper).not.toHaveAttribute('aria-level');
      expect(wrapper, 'the label moved with the role, and it is meant to stay').toHaveAttribute('aria-label', 'Hello');
      expect(container.querySelector(`${tag}.glitch-text__inner`)).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryAllByRole('heading')).toHaveLength(0);
      unmount();
    }
  });
});
