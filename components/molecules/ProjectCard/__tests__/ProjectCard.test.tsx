import { render, screen } from '@testing-library/react';
import { ProjectCard } from '../ProjectCard';
import type { RegistryEntry } from '@/lib/registry';

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

const mockProject: RegistryEntry = {
  id: 'test-porject',
  name: 'Test Project',
  description: 'A test project description.',
  status: 'Live',
  tech: ['TypeScript', 'React'],
  source: 'https://github.com/LuigiEspinosa/LuigiEspinosa',
  demo: 'none',
  identity: 'none',
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

  it('renders a Github link pointing at the entry source', () => {
    render(<ProjectCard project={mockProject} />);
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/LuigiEspinosa/LuigiEspinosa');
    expect(link).toHaveAttribute('target', '_blank');
  });

  // `source` is required on every Registry entry and keeps the repository's real capitalisation,
  // so the link is unconditional and a lowercased copy of the id would 404 for four of the
  // fourteen. Both halves are asserted here rather than left to the type.
  it('renders the Github link for an entry whose source is capitalised unlike its id', () => {
    render(<ProjectCard project={{ ...mockProject, id: 'streamvault', source: 'https://github.com/LuigiEspinosa/StreamVault' }} />);
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      'https://github.com/LuigiEspinosa/StreamVault'
    );
  });

  it('renders a live link with correct href', () => {
    render(<ProjectCard project={mockProject} />);
    const link = screen.getByRole('link', { name: /live/i });
    expect(link).toHaveAttribute('href', 'https://cuatro.dev');
  });

  // The case the retired `github` field used to cover, moved to the field that is genuinely
  // optional. The route renders no such entry today, since AD-5 requires `live` on every `Live`
  // one, but `Complete` is constrained neither way (FR-35 renders it, the schema lets it carry no
  // hostname), so this is the shape the card must survive: the link is omitted rather than
  // rendered with an empty href.
  it('does not render a live link when the entry has no live hostname', () => {
    const { live: _live, ...noLive } = mockProject;
    render(<ProjectCard project={{ ...noLive, status: 'Complete' }} />);
    expect(screen.queryByRole('link', { name: /live/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /github/i })).toBeInTheDocument();
  });
});
