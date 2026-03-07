import { render, screen } from '@testing-library/react';
import { Navbar } from '../Navbar';

//  mock Next.js router so tests run outside the App Router context.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Navbar', () => {
  beforeEach(() => {
    render(<Navbar />);
  });

  it('renders a /work link', () => {
    const link = screen.getByRole('link', { name: /work/i });
    expect(link).toHaveAttribute('href', '/work');
  });

  it('renders a /projects link', () => {
    const link = screen.getByRole('link', { name: /projects/i });
    expect(link).toHaveAttribute('href', '/projects');
  });

  it('does not render a /blog link', () => {
    const link = screen.queryByRole('link', { name: /blog/i });
    expect(link).not.toBeInTheDocument();
  });

  it('external links have target _blank', () => {
    const externalLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('target') === '_blank');
    expect(externalLinks.length).toBeGreaterThan(0);
  });
});

