import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { Logo } from '../Logo';

/**
 * The wordmark (Story 2-32): text where a raster stood, named by its own words.
 *
 * What it looks like (the display face at `wdth 75`, the black weight, uppercase) is the compiled
 * stylesheet's question, answered in `components/molecules/Header/__tests__/Header.test.tsx`, and the
 * rendered face and box are `tests/e2e/chrome-nav.pw.ts`'s.
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** The site's name as the wordmark sets it. Which string that is, is filed for the Operator (DW-117). */
const SITE_NAME = 'Cuatro';

describe('Logo', () => {
  it('is one link home, named by its text alone', () => {
    const { container } = render(<Logo />);
    const link = screen.getByRole('link', { name: SITE_NAME });
    expect(link).toHaveAttribute('href', '/');
    expect(link.className).toBe('logo');
    expect(container.children, 'the wordmark renders more than its one link').toHaveLength(1);

    // Sentence case in the markup, uppercase from the stylesheet, so a screen reader reads a word
    // rather than letters.
    expect(link.textContent).toBe(SITE_NAME);
    expect(link.textContent).not.toBe(SITE_NAME.toUpperCase());
  });

  it('carries no image, no alternative text and no name by attribute', () => {
    // `EXPERIENCE.md` § Chrome: the raster retires, and the name is the site's rather than a
    // description of a picture ("Numero Cuatro Logo in white" until this story).
    const { container } = render(<Logo />);
    expect(container.querySelectorAll('img, svg, picture')).toHaveLength(0);
    expect(container.querySelectorAll('[alt], [aria-label], [aria-labelledby], [title]')).toHaveLength(0);
  });

  it('imports no image component, so the raster cannot come back through the source', () => {
    const source = readFileSync(resolve(__dirname, '..', 'Logo.tsx'), 'utf8');
    expect(source).not.toMatch(/next\/image|logo\.png/);
    // The same predicate on the line this story removed, so the clean read above is a measurement.
    expect("import Image from 'next/image';").toMatch(/next\/image|logo\.png/);
  });
});
