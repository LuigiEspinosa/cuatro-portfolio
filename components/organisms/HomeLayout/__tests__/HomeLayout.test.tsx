import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NarrativePath, ServedNarrativePath } from '@/hooks/useNarrativePath';
import HomeLayout from '../HomeLayout';

/**
 * The decision is mocked here and nowhere else in this file's subject (Story 2-13).
 *
 * `hooks/__tests__/useNarrativePath.test.ts` proves which inputs produce which answer. What this
 * file is about is what the hero renders for each answer, so the answer is supplied directly:
 * driving it through a canvas stub would make every case below depend on the probe as well as on
 * the layout, and a failure would name neither.
 *
 * **The mock records what it was called with, which is the half that was missing.** A mock that
 * ignored its argument left the whole `servedPath` chain untested: deleting the prop from the route,
 * from this component's signature, or from the call below changed nothing any case here could see.
 * The same holds one level down, so the `GemComponent` mock records the path it was handed.
 */
const decided = vi.hoisted(() => ({
  path: 'narrative' as NarrativePath,
  served: [] as (ServedNarrativePath | undefined)[],
  handedToGem: [] as (NarrativePath | undefined)[],
}));

vi.mock('@/hooks/useNarrativePath', () => ({
  useNarrativePath: (served?: ServedNarrativePath) => {
    decided.served.push(served);
    return decided.path;
  },
}));

beforeEach(() => {
  decided.path = 'narrative';
  decided.served = [];
  decided.handedToGem = [];
});

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
  default: ({ path }: { path?: NarrativePath }) => {
    decided.handedToGem.push(path);
    return <div data-testid='gem-component' data-path={path} />;
  },
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
    expect(screen.getByText('Senior Fullstack Engineer / Team Lead')).toBeInTheDocument();
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
});

describe('HomeLayout on the two front doors', () => {
  it('renders the skip control on the default path, outside every panel', () => {
    // FR-2's one interaction. Outside `.home-panel` deliberately: `HomeLayout.scss:80-82` dims
    // every panel that is not hovered whenever a sibling is, and the entrance fades the panels in
    // over two seconds, neither of which may happen to a control that answers a cold arrival.
    const { container } = render(<HomeLayout />);
    const control = container.querySelector('.skip-control');
    expect(control, 'the default path renders no skip control').not.toBeNull();
    expect(control?.closest('.home-panel'), 'the skip control is inside a panel').toBeNull();
    expect(control?.parentElement?.className).toContain('home-container');
  });

  it('renders neither the gem nor the skip control on the non-3D path, and marks the container', () => {
    // The whole of the flat front door as this layer can see it: no 3D block, and no control,
    // because reaching the Directory costs zero interactions on this path
    // (`EXPERIENCE.md:154-169`). The modifier is what releases the viewport lock in the stylesheet.
    decided.path = 'flat';
    const { container } = render(<HomeLayout />);

    expect(container.querySelector('.home-gem'), 'the non-3D path still renders the gem box').toBeNull();
    expect(screen.queryByTestId('gem-component')).not.toBeInTheDocument();
    expect(container.querySelector('.skip-control'), 'the non-3D path renders a skip control').toBeNull();
    expect(container.querySelector('.home-container')?.className).toContain('home-container--flat');
  });

  it('hands the server verdict to the hook, unchanged and exactly once', () => {
    // Up the chain: the route reads `Save-Data` and this component passes what it was given
    // straight through, or the server's answer never reaches the decision at all. Exactly once,
    // because one page means one decision, and a second call is a second WebGL probe.
    decided.path = 'flat';
    render(<HomeLayout servedPath='flat' />);

    expect(decided.served, 'the served verdict did not reach the hook unchanged, or reached it twice').toEqual([
      'flat',
    ]);
  });

  it('defaults the verdict to undecided when the route passes none', () => {
    // The control for the case above: a component that ignored the prop entirely would pass the
    // first case by accident if the default and the served value were the same string.
    render(<HomeLayout />);
    expect(decided.served).toEqual(['undecided']);
  });

  it('hands the gem the decided path rather than the served one', () => {
    // Down the chain, and this is the one the review found: the gem used to be handed `servedPath`
    // and to call the hook itself, which is two state machines, two probes and three motion
    // subscriptions on one load. Both values are read, because a component that passed a constant
    // would satisfy either one alone.
    render(<HomeLayout />);
    expect(decided.handedToGem, 'the gem was not handed the decided path').toEqual(['narrative']);

    decided.handedToGem = [];
    decided.path = 'undecided';
    render(<HomeLayout />);
    expect(decided.handedToGem, 'the gem is handed a constant rather than the decision').toEqual(['undecided']);
  });

  it('serves the flat hero as markup when the server already answered, with no client render', () => {
    // `renderToStaticMarkup` is the served document: no effects, no hydration. This is what a
    // `Save-Data` visitor's bytes look like, and the whole point of reading the header on the server
    // is that the hero arrives flat rather than arriving whole and being corrected a frame later.
    decided.path = 'flat';
    const served = renderToStaticMarkup(<HomeLayout servedPath='flat' />);

    expect(served, 'the served markup is not the flat hero').toContain('home-container--flat');
    expect(served, 'the served markup carries the gem container').not.toContain('home-gem');
    expect(served, 'the served markup carries the skip control').not.toContain('skip-control');
  });

  it('renders the default path geometry while the decision is undecided', () => {
    // The undecided state renders the geometry the narrative path will keep, so resolving either
    // way never grows the page: it either changes nothing or removes a box. Both boxes are part of
    // that geometry, the skip control included: below 768 it is a static item in the hero's column,
    // and one that arrived a frame after paint would push the page down by its own height.
    decided.path = 'undecided';
    const { container } = render(<HomeLayout />);

    expect(container.querySelector('.home-gem'), 'the undecided state drops the gem box').not.toBeNull();
    expect(container.querySelector('.skip-control'), 'the undecided state drops the skip control').not.toBeNull();
    expect(container.querySelector('.home-container')?.className).not.toContain('home-container--flat');
  });
});
