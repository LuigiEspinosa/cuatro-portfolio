import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import dynamic from 'next/dynamic';
import GemComponent from '../GemComponent';

/**
 * The WebGL probe and its fallback, after Story 2-12 moved the narrative behind one boundary.
 *
 * **What is not asserted here.** Whether the boundary actually defers anything is a fact about the
 * served document, not about the import graph, and `tests/e2e/narrative.pw.ts` settles it by
 * fetching every script `/` references and scanning for a WebGL fingerprint. Whether the narrative
 * then really mounts is also settled there, by looking for a `<canvas>` in a real browser. A jsdom
 * case reading the import graph would prove the thing that was already true before this story and
 * missed the defect: `GemComponent.tsx` wrapped `Scene` in `next/dynamic` the whole time while
 * pulling `@react-three/postprocessing` and `ParticleWave` in statically beside it.
 *
 * What is settled here is the shape the move must not break: three probe branches rather than two,
 * the fallback carrying its image, and neither branch announcing a wait.
 *
 * The `next/dynamic` mock **honours the options object**, which is the point of it. A mock taking
 * only the loader would discard a `loading:` option silently, and the no-spinner case below would
 * then pass against exactly the code it exists to forbid.
 */
interface DynamicOptions {
  loading?: () => ReactNode;
  ssr?: boolean;
}

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options?: DynamicOptions) => {
    const MockNarrative = () =>
      options?.loading ? <>{options.loading()}</> : <div data-testid='narrative' />;
    MockNarrative.displayName = 'MockNarrative';
    return MockNarrative;
  },
}));

/**
 * Anything that would tell a visitor to wait.
 *
 * Kept character for character identical to the list in `tests/e2e/narrative.pw.ts`, so a spinner
 * that one sweep would catch cannot slip past the other. Substring matching on `class` throughout,
 * because `is-loading` and `LoadingRing` are the same defect as `loading`.
 */
const ANNOUNCES_A_WAIT =
  '[role="progressbar"], [role="status"], [aria-busy="true"], [class*="spinner"], ' +
  '[class*="skeleton"], [class*="loading"], [class*="loader"]';

/** jsdom has no WebGL, so the probe is answered by hand, one branch per block below. */
const withWebgl = (available: boolean) => {
  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue(available ? ({} as WebGLRenderingContext) : null);
};

describe('GemComponent before the probe has answered', () => {
  it('renders an empty container and nothing else, which is what the server emits', () => {
    // The state the render tree is in on the server and on the first client commit. It matters for
    // payload rather than for pixels: `next/dynamic` starts its import when the component renders,
    // so a `<GemNarrative />` here would fetch the whole narrative before anyone knows whether the
    // device can use it. `renderToStaticMarkup` is the only way to observe this branch, because
    // Testing Library flushes the probe effect before it hands the tree back.
    expect(renderToStaticMarkup(<GemComponent />)).toBe('<div id="gem-canvas"></div>');
  });
});

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
    const announcing = [...container.querySelectorAll(ANNOUNCES_A_WAIT)].map((node) => node.outerHTML);
    expect(announcing, 'the gem announces a wait while the narrative loads').toEqual([]);
  });

  it('and that sweep fires, measured against a boundary given a loading option', () => {
    // The control for the case above, and it exercises the mock as well as the selector list: a
    // `loading:` option reaches the mock, the mock renders it, and the sweep finds it. Before Story
    // 2-12's review the mock took no options argument, so adding `loading:` to the real component
    // left both this suite and the browser one green.
    const WithSpinner = dynamic(() => Promise.resolve(() => null), {
      loading: () => <div className='spinner' />,
      ssr: false,
    }) as ComponentType;

    const { container } = render(<WithSpinner />);
    expect(
      container.querySelectorAll(ANNOUNCES_A_WAIT).length,
      'a planted loading option was not seen, so the sweep above reports a clean render for the ' +
        'wrong reason'
    ).toBeGreaterThan(0);
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

  it('renders no narrative at all, so the chunk is never asked for', () => {
    // `next/dynamic` issues its import on first render of the returned component. Not rendering it
    // is therefore the whole of the gate: a device that cannot use the narrative does not download
    // it. This is the jsdom half of that claim; the browser half is the request ledger in
    // `tests/e2e/narrative.pw.ts`.
    render(<GemComponent />);
    expect(screen.queryByTestId('narrative')).not.toBeInTheDocument();
  });
});
