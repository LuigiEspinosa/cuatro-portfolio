import { render, screen } from '@testing-library/react';
import GemComponent from '../GemComponent';

/**
 * The WebGL probe and its fallback, after Story 2-12 moved the narrative behind one boundary.
 *
 * **What is not asserted here.** Whether the boundary actually defers anything is a fact about the
 * served document, not about the import graph, and `tests/e2e/narrative.pw.ts` settles it by
 * fetching every script `/` references and scanning for a WebGL fingerprint. A jsdom case reading
 * the import graph would prove the thing that was already true before this story and missed the
 * defect: `GemComponent.tsx:8-10` wrapped `Scene` in `next/dynamic` the whole time while `:5-6`
 * pulled `@react-three/postprocessing` and `ParticleWave` in statically beside it.
 *
 * What is settled here is the shape the move must not break: both branches of the probe still
 * render, the fallback still carries its image, and neither branch announces a wait.
 *
 * The mock replaces `next/dynamic` wholesale, which is what keeps jsdom from needing a WebGL
 * context. The mocks for `@/components/atoms/Gem/Gem`, `@react-three/drei` and
 * `@react-three/postprocessing` that stood here before are gone: none of those modules is reachable
 * from this component any more, and a mock for a module nothing imports is how an orphan survives a
 * green suite (`ops/asset-budget.md:180-183` records the same trap).
 */
vi.mock('next/dynamic', () => ({
  default: () => {
    const MockNarrative = () => <div data-testid='narrative' />;
    MockNarrative.displayName = 'MockNarrative';
    return MockNarrative;
  },
}));

/** jsdom has no WebGL, so the probe is answered by hand, one branch per block below. */
const withWebgl = (available: boolean) => {
  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue(available ? ({} as WebGLRenderingContext) : null);
};

describe('GemComponent with WebGL available', () => {
  beforeEach(() => withWebgl(true));

  it('renders the gem canvas container', () => {
    render(<GemComponent />);
    expect(document.getElementById('gem-canvas')).toBeInTheDocument();
  });

  it('renders the narrative behind the dynamic boundary', () => {
    render(<GemComponent />);
    expect(screen.getByTestId('narrative')).toBeInTheDocument();
  });

  it('announces no wait while the narrative is on its way', () => {
    // `EXPERIENCE.md:658-659` refuses a spinner: on the one path where nothing is missing,
    // announcing a wait is the defect. The dynamic import therefore takes no `loading:` option and
    // no `<Suspense>` fallback, and an empty transparent container is the intended state.
    const { container } = render(<GemComponent />);
    const announcing = container.querySelectorAll(
      '[role="progressbar"], [role="status"], [aria-busy="true"], .spinner, .skeleton, .loading'
    );
    expect(
      [...announcing].map((node) => node.outerHTML),
      'the gem announces a wait while the narrative loads'
    ).toEqual([]);
  });
});

describe('GemComponent with no WebGL', () => {
  beforeEach(() => withWebgl(false));

  it('falls back to the static image, which the boundary move must not strand', () => {
    // The fallback is the branch that survives every failure mode this story could introduce, so
    // it is the one worth pinning: it imports nothing narrative and must render on its own.
    const { container } = render(<GemComponent />);
    const image = container.querySelector('#gem-canvas img');
    expect(image, 'the no-WebGL branch renders no fallback image').not.toBeNull();
    expect(image).toHaveAttribute('src', '/assets/home/gem-fallback.png');
    expect(image, 'the fallback is decoration and needs no name').toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no narrative at all on the fallback path', () => {
    render(<GemComponent />);
    expect(screen.queryByTestId('narrative')).not.toBeInTheDocument();
  });
});
