import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { compile } from 'sass';
import { WorkTimeline } from '../WorkTimeLine';
import { work } from '@/content/work';

/**
 * The work timeline (Stories 2-16 and 2-33).
 *
 * **Its behaviour is Story 2-16's and is unchanged**: four entries, the first open on arrival, one
 * open at a time, a click on the open one closing it. Story 2-33 restyled the list and deleted the
 * scroll-triggered fade-up that batched every row into a `y: 40` entrance on scroll (review A-3,
 * ruled a presentation change on 2026-09-15), so the rows simply exist. The browser half (the rows
 * read at rest in the frames after a scroll, the separators as pixels) is
 * `tests/e2e/plate-mark-and-work-item.pw.ts` and `tests/e2e/work-hero.pw.ts`.
 *
 * GSAP is mocked because `WorkItem`'s disclosure tweens height and jsdom has no layout for it; the
 * mock records the calls, so a scroll batch or an entrance tween coming back is seen here.
 */

const mocks = vi.hoisted(() => ({ batch: vi.fn(), from: vi.fn(), fromTo: vi.fn() }));

vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
    to: vi.fn(),
    set: vi.fn(),
    from: mocks.from,
    fromTo: mocks.fromTo,
    registerPlugin: vi.fn(),
  };
  return {
    gsap: gsapMock,
    default: gsapMock,
  };
});

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { batch: mocks.batch, update: vi.fn() },
}));

// Mock useReduceMotion so tests are not affected by jsdom matchMedia absence.
vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

/** The component's directory, and the repository root the contract is read from. */
const HERE = resolve(__dirname, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const TOKENS = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');

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

describe('the rows simply exist (Story 2-33)', () => {
  it('batches no row into a scroll entrance and tweens no row in', () => {
    mocks.batch.mockClear();
    mocks.from.mockClear();
    mocks.fromTo.mockClear();
    render(<WorkTimeline />);
    expect(mocks.batch, 'a scroll-triggered batch is back: EXPERIENCE.md § Motion bans the fade-up').not.toHaveBeenCalled();
    expect(mocks.from, 'a from-tween is back on the timeline').not.toHaveBeenCalled();
    expect(mocks.fromTo, 'a fromTo-tween is back on the timeline').not.toHaveBeenCalled();
  });

  it('is a list of one item per entry, exposed as a list although its markers are off', () => {
    // `list-style: none` drops list semantics in WebKit, so the role is stated (the Story 2-31 and
    // 2-32 precedent). The elements are the ones Story 2-16 built, one `li` per entry.
    const { container } = render(<WorkTimeline />);
    const list = container.querySelectorAll('ul.work-timeline');
    expect(list, 'the timeline is not one list').toHaveLength(1);
    expect(list[0].getAttribute('role'), 'the list does not state its role').toBe('list');
    expect(list[0].querySelectorAll(':scope > li'), 'the list does not carry one item per entry').toHaveLength(work.length);
  });
});

describe('the stylesheet names contract roles and nothing else', () => {
  const css = compile(resolve(HERE, 'WorkTimeline.scss'), { style: 'compressed' }).css;

  it('reads the two spacing steps it pins, from the contract, and nothing else', () => {
    const ROLES = ['--s-3xl', '--s-xl'] as const;
    for (const role of ROLES) {
      expect(TOKENS, `${role} is pinned here but the published contract no longer declares it`).toMatch(new RegExp(`^\\s*${role}\\s*:`, 'm'));
    }
    const read = [...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]))].sort();
    expect(read, 'the stylesheet reads a name this file does not pin, an alias among them').toEqual([...ROLES].sort());
    expect([...new Set([...'.a{padding:2rem var(--page-gutter) 8rem}'.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))]).toEqual([
      '--page-gutter',
    ]);
  });

  it('pads the list block-wise only, flush in the container, and lays it out as ordinary flow', () => {
    expect(css, 'the list is not reset and padded on the two steps').toContain(
      '.work-timeline{list-style:none;padding-block:var(--s-xl) var(--s-3xl)}'
    );
    expect(css, 'the list pads inline, which the container already does').not.toMatch(/padding(?:-inline)?:[^;}]*var\(--page/);
    expect(css, 'a flex column with no gap, which is block flow').not.toContain('display:flex');
    expect(css, 'a length literal').not.toMatch(/(?<![\w-])\d*\.?\d+(px|rem|em)\b/);
  });

  it('drops the separator under the last row, and under no other', () => {
    expect(css, 'the last row keeps the separator WorkItem.scss draws').toContain('.work-timeline>li:last-child>.work-item{border-block-end:0}');
    expect([...css.matchAll(/border/g)], 'the list draws a rule of its own').toHaveLength(1);
  });
});
