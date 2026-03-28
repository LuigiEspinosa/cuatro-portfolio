import { render, screen } from '@testing-library/react';
import HomeLayout from '../HomeLayout';

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
    to: vi.fn(),
    set: vi.fn(),
    timeline: vi.fn(() => ({
      to: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    })),
    registerPlugin: vi.fn(),
  };
  return { gsap: gsapMock, default: gsapMock };
});

vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

vi.mock('@/hooks/useGsapContext', () => ({
  useGsapContext: (_fn: () => void) => ({
    current: document.createElement('div'),
  }),
}));

vi.mock('@/components/molecules/GemComponent/GemComponent', () => ({
  default: () => <div data-testid='gem-component' />,
}));

vi.mock('@/components/atoms/ScanlineOverlay/ScanlineOverlay', () => ({
  default: () => <div data-testid='scanline-overlay' />,
}));

vi.mock('@/components/molecules/GlitchText/GlitchText', () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('@/components/atoms/HudLabel/HudLabel', () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('@/components/molecules/ContactContainer/ContactContainer', () => ({
  default: () => (
    <div>
      <a href='htpps://github.com'>Github</a>
      <a href='htpps://linkedin.com'>LinkdIn</a>
    </div>
  ),
}));

describe('HomeLayout', () => {
  it('renders the name heading', () => {
    render(<HomeLayout />);
    expect(screen.getByText('Luigi Espinosa')).toBeInTheDocument();
  });

  it('renders the role line', () => {
    render(<HomeLayout />);
    expect(screen.getByText('Senior Frontend Engineer / Team Lead')).toBeInTheDocument();
  });

  it('renders the work link with correct href', () => {
    render(<HomeLayout />);
    const link = screen.getByRole('link', { name: /professional experience/i });
    expect(link).toHaveAttribute('href', '/work');
  });

  it('renders the projects link with correct href', () => {
    render(<HomeLayout />);
    const link = screen.getByRole('link', { name: /personal projects/i });
    expect(link).toHaveAttribute('href', '/projects');
  });

  it('renders the gem component', () => {
    render(<HomeLayout />);
    expect(screen.getByTestId('gem-component')).toBeInTheDocument();
  });

  it('renders the scanline overlay', () => {
    render(<HomeLayout />);
    expect(screen.getByTestId('scanline-overlay')).toBeInTheDocument();
  });
});
