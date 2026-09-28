import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import dynamic from 'next/dynamic';
import GemComponent from '../GemComponent';

/**
 * The narrative's two branches, after Story 2-12 moved it behind one boundary and Story 2-13 moved
 * the decision out into `hooks/useNarrativePath.ts` and deleted the poster frame.
 *
 * **What is not asserted here.** Whether the boundary actually defers anything is a fact about the
 * served document, not about the import graph, and `tests/e2e/narrative.pw.ts` settles it by
 * fetching every script `/` references and scanning for a WebGL fingerprint. Whether the narrative
 * then really mounts is also settled there, by looking for a `<canvas>` in a real browser. A jsdom
 * case reading the import graph would prove the thing that was already true before this story and
 * missed the defect: `GemComponent.tsx` wrapped `Scene` in `next/dynamic` the whole time while
 * pulling `@react-three/postprocessing` and `ParticleWave` in statically beside it.
 *
 * **The path is a prop, so these cases pass it rather than arranging a probe.** The decision is
 * taken once per page, by `HomeLayout`, and this component reads the answer. There is deliberately
 * no case for `'flat'`: the flat front door renders no `.home-gem` wrapper at all, so this
 * component is not mounted on it, and the prop's type says so. Which inputs produce which answer is
 * `hooks/__tests__/useNarrativePath.test.ts`, and that the hero drops this whole subtree on the
 * flat path is `components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx`.
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

describe('GemComponent before the path has been decided', () => {
  it('renders an empty container and nothing else, which is what the server emits', () => {
    // The state the render tree is in on the server and on the first client commit. It matters for
    // payload rather than for pixels: `next/dynamic` starts its import when the component renders,
    // so a `<GemNarrative />` here would fetch the whole narrative before anyone knows whether this
    // visitor is on the narrative path at all.
    //
    // **It is the default path's geometry, not the flat path's, and that is deliberate.** The
    // undecided branch renders the container the gem will fill; resolving to `'flat'` then removes
    // the box this sits in rather than adding one, so the page shrinks late instead of growing late.
    expect(renderToStaticMarkup(<GemComponent path='undecided' />)).toBe('<div id="gem-canvas"></div>');
  });

  it('asks for no narrative while undecided, so the chunk is never fetched early', () => {
    // `next/dynamic` issues its import on first render of the returned component. Not rendering it
    // is therefore the whole of the gate. This is the jsdom half of that claim; the browser half is
    // the request ledger in `tests/e2e/front-door.pw.ts`, which watches all four non-3D triggers.
    render(<GemComponent path='undecided' />);
    expect(screen.queryByTestId('narrative')).not.toBeInTheDocument();
  });
});

describe('GemComponent on the narrative path', () => {
  it('renders the gem canvas container', () => {
    render(<GemComponent path='narrative' />);
    expect(document.getElementById('gem-canvas')).toBeInTheDocument();
  });

  it('renders the narrative behind the dynamic boundary', () => {
    render(<GemComponent path='narrative' />);
    expect(screen.getByTestId('narrative')).toBeInTheDocument();
  });

  it('announces no wait while the narrative is on its way', () => {
    // `EXPERIENCE.md:658-659` refuses a spinner: on the one path where nothing is missing,
    // announcing a wait is the defect. The dynamic import therefore takes no `loading:` option and
    // no `<Suspense>` fallback, and an empty transparent container is the intended state.
    const { container } = render(<GemComponent path='narrative' />);
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

  it('renders no image on any path it can be mounted on', () => {
    // The poster frame is gone. Until Story 2-13 the WebGL-less branch rendered a 1,755,015-byte
    // still of this same scene, which `EXPERIENCE.md:173-176` refuses by name because a still of a
    // 3D scene reads as a broken one. Neither branch left here has an image in it, and the flat
    // front door has no gem at all rather than a picture of one.
    for (const path of ['undecided', 'narrative'] as const) {
      const { container } = render(<GemComponent path={path} />);
      expect(container.querySelector('img'), `the ${path} branch renders an image`).toBeNull();
    }
  });
});
