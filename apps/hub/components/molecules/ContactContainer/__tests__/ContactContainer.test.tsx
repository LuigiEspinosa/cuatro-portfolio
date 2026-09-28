import { render, screen, within } from '@testing-library/react';
import ContactContainer from '../ContactContainer';

/**
 * The home hero's contact links, as a list of self-describing links (Story 2-32, A-9).
 *
 * The floor each link meets, and the entrance stagger `HomeLayout.scss` gives the three, are browser
 * questions: `tests/e2e/hit-target-floor.pw.ts`, `tests/e2e/chrome-nav.pw.ts` and
 * `tests/e2e/narrative.pw.ts`.
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/**
 * The destination a link's `href` reaches, as the word a reader would need to hear.
 *
 * A-9's test is that a link names where it goes with the sentence around it removed; the destination
 * is read off the URL rather than typed beside the name, so a link repointed without its words moving
 * fails here.
 */
const destinationOf = (href: string): string => {
  if (href.startsWith('mailto:')) return 'email';
  return new URL(href).hostname.replace(/^www\./, '').split('.')[0];
};

/** Whether a link's accessible name names its destination. */
const namesItsDestination = (name: string, href: string): boolean => name.toLowerCase().includes(destinationOf(href));

describe('ContactContainer', () => {
  it('is one list of three items, each holding exactly one link', () => {
    const { container } = render(<ContactContainer />);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(list.className).toBe('contact-container');
    // Stated rather than implied, because the group is laid out with no markers and WebKit drops the
    // role of a list whose markers are removed.
    expect(list).toHaveAttribute('role', 'list');
    expect(container.children, 'the component renders more than its list').toHaveLength(1);

    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(within(item).getAllByRole('link'), 'a list item holds other than one link').toHaveLength(1);
    }
  });

  it('names every destination out of context, with the words, targets and order unchanged', () => {
    render(<ContactContainer />);
    const links = screen.getAllByRole('link') as HTMLAnchorElement[];
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Github', 'https://www.github.com/LuigiEspinosa'],
      ['LinkedIn', 'https://www.linkedin.com/in/luigiespinosa'],
      ['Email', 'mailto:luigi@cuatro.dev'],
    ]);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(namesItsDestination(link.textContent ?? '', href), `"${link.textContent}" does not name ${href}`).toBe(true);
      // A restyle changes no interaction: each still opens where it opened before.
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('and the predicate refuses a link that does not say where it goes', () => {
    expect(namesItsDestination('click here', 'https://www.github.com/LuigiEspinosa')).toBe(false);
    expect(namesItsDestination('LinkedIn', 'https://www.github.com/LuigiEspinosa')).toBe(false);
    expect(namesItsDestination('Email', 'mailto:someone@example.com')).toBe(true);
  });
});
