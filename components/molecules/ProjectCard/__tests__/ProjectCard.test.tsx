import { render, screen } from '@testing-library/react';
import { ProjectCard } from '../ProjectCard';
import type { ProjectEntry } from '@/content/projects';

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
    from: vi.fn(),
    registerPlugin: vi.fn(),
  };
  return {
    gsap: gsapMock,
    default: gsapMock,
  };
});

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { update: vi.fn() },
}));

vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

const mockProject: ProjectEntry = {
  id: 'test-porject',
  name: 'Test Project',
  description: 'A test project description.',
  tech: ['TypeScript', 'React'],
  github: 'https://github.com/LuigiEspinosa/LuigiEspinosa',
  live: 'https://cuatro.dev',
};

describe('ProjectCard', () => {
  it('renders the project name', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders the project description', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('A test project description.')).toBeInTheDocument();
  });

  it('renders all tech tags', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders a Github link with correct href', () => {
    render(<ProjectCard project={mockProject} />);
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/LuigiEspinosa/LuigiEspinosa');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders a live link with correct href', () => {
    render(<ProjectCard project={mockProject} />);
    const link = screen.getByRole('link', { name: /live/i });
    expect(link).toHaveAttribute('href', 'https://cuatro.dev');
  });

  it('does not render a Github link when github prop is absent', () => {
    const { github: _, ...noGithub } = mockProject;
    render(<ProjectCard project={noGithub} />);
    expect(screen.queryByRole('link', { name: /github/i })).not.toBeInTheDocument();
  });
});
