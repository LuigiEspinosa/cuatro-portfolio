import { render, screen, fireEvent } from '@testing-library/react';
import { WorkTimeline } from '../WorkTimeLine';

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
    to: vi.fn(),
    set: vi.fn(),
    fromTo: vi.fn(),
    registerPlugin: vi.fn(),
  };
  return {
    gsap: gsapMock,
    default: gsapMock,
  };
});

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { batch: vi.fn(), update: vi.fn() },
}));

// Mock useReduceMotion so tests are not affected by jsdom matchMedia absence.
vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

describe('WorkTimeline', () => {
  it('renders all 4 work entries', () => {
    render(<WorkTimeline />);
    expect(screen.getByText('Publicis Global Delivery')).toBeInTheDocument();
    expect(screen.getByText('Crossbridge Global Partners')).toBeInTheDocument();
    expect(screen.getByText('Webcat APP')).toBeInTheDocument();
    expect(screen.getByText('Namecol S.A.S.')).toBeInTheDocument();
  });

  it('renders the first entry expanded by default', () => {
    render(<WorkTimeline />);
    const firstButton = screen.getByRole('button', { name: /publicis global delivery/i });
    expect(firstButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders other entries collapsed by default', () => {
    render(<WorkTimeline />);
    const secondButton = screen.getByRole('button', { name: /crossbridge global partners/i });
    expect(secondButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands a collapsed entry when its header is clicked', () => {
    render(<WorkTimeline />);
    const secondButton = screen.getByRole('button', { name: /crossbridge global partners/i });
    fireEvent.click(secondButton);
    expect(secondButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses the currently open entry when its header is clicked', () => {
    render(<WorkTimeline />);
    const firstButton = screen.getByRole('button', { name: /publicis global delivery/i });
    fireEvent.click(firstButton);
    expect(firstButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses the previously open entry when a new one is opened', () => {
    render(<WorkTimeline />);
    const firstButton = screen.getByRole('button', { name: /publicis global delivery/i });
    const secondButton = screen.getByRole('button', { name: /crossbridge global partners/i });
    fireEvent.click(secondButton);
    expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    expect(secondButton).toHaveAttribute('aria-expanded', 'true');
  });
});
