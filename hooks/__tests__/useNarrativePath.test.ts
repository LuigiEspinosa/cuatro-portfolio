import { act, renderHook } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { useNarrativePath, type NarrativePath, type ServedNarrativePath } from '../useNarrativePath';
import { useReduceMotion } from '../useReduceMotion';

/**
 * The one decision behind the two front doors (Story 2-13).
 *
 * **Every arm is driven through the real environment rather than through a mock of the hook.** The
 * WebGL probe is answered by stubbing the canvas the way `GemComponent`'s own suite does,
 * `prefers-reduced-motion` by the `matchMedia` stub `vitest.setup.ts` installs, and the connection
 * by defining `navigator.connection`, which jsdom does not implement at all. That last absence is
 * itself a case: it is what most desktop browsers report, and it must take the default path rather
 * than throw or read as data-saving.
 *
 * **What is not settled here.** Whether the flat path really requests no narrative chunk is a fact
 * about the served document, and `tests/e2e/front-door.pw.ts` settles it in a browser. This file
 * settles which answer each input produces.
 */

/**
 * jsdom has no WebGL, so the probe is answered by hand, one arm per case.
 *
 * The double carries `getExtension`, because the probe hands its context back through
 * `WEBGL_lose_context` rather than leaving it to garbage collection. `lost` records that, so the
 * release can be asserted rather than assumed.
 */
const lost = { count: 0 };

const withWebgl = (available: boolean) => {
  lost.count = 0;
  const context = {
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context'
        ? {
            loseContext: () => {
              lost.count += 1;
            },
          }
        : null,
  } as unknown as WebGLRenderingContext;

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(available ? context : null);
};

/** The other way a probe fails: a browser whose WebGL is disabled by policy throws rather than
 *  answering null. */
const withThrowingWebgl = () => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => {
    throw new Error('WebGL is disabled by policy');
  });
};

/**
 * `vitest.setup.ts` installs a `matchMedia` that answers `false` to everything. This moves it.
 *
 * The change listeners are kept rather than discarded, because `prefers-reduced-motion` is live: a
 * visitor can turn it off while the page is open, and what this hook does then is a decision the
 * story took deliberately. `flipReduceMotion` is how that is driven.
 */
const motion = { matches: false, handlers: [] as ((event: MediaQueryListEvent) => void)[] };

const withReduceMotion = (reduce: boolean) => {
  motion.matches = reduce;
  motion.handlers = [];
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: motion.matches && query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: (_event: string, handler: (event: MediaQueryListEvent) => void) => {
          motion.handlers.push(handler);
        },
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
};

/** The preference changing under a page that is already open. */
const flipReduceMotion = (matches: boolean) => {
  motion.matches = matches;
  act(() => {
    for (const handler of [...motion.handlers]) handler({ matches } as MediaQueryListEvent);
  });
};

/** `navigator.connection` is absent in jsdom, so it is defined and removed rather than assigned. */
const withConnection = (connection: { saveData?: boolean; effectiveType?: string } | undefined) => {
  if (connection === undefined) {
    Reflect.deleteProperty(navigator, 'connection');
    return;
  }
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
};

const path = (served?: ServedNarrativePath): NarrativePath =>
  renderHook(() => useNarrativePath(served)).result.current;

beforeEach(() => {
  withWebgl(true);
  withReduceMotion(false);
  withConnection(undefined);
});

afterEach(() => {
  withConnection(undefined);
});

describe('before anything has been read', () => {
  it('answers undecided on the server, where no effect ever runs', () => {
    // The half of this hook that cannot be observed through `renderHook`, which flushes effects
    // before it hands the result back. It matters for hydration rather than for payload: the
    // server always renders this value, so the client's first render has to render it too, and
    // `useReduceMotion`'s docblock records what happens to a consumer that breaks that.
    const Probe = () => createElement('i', null, useNarrativePath());
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<i>undecided</i>');
  });

  it('and that read is not a constant, measured against the same hook once it has decided', () => {
    // The control for the case above. `undecided` twice proves nothing unless the same hook is
    // seen answering something else.
    expect(path()).toBe('narrative');
  });
});

describe('the default path', () => {
  it('is taken when WebGL answers, motion is unset and there is no connection object', () => {
    // The path the whole homepage was built around, and the one every Story 2-12 assertion
    // assumes. An absent `navigator.connection` is the common desktop case and is not a signal.
    expect(path()).toBe('narrative');
  });

  it('survives a connection that reports 4g and no data-saving preference', () => {
    withConnection({ saveData: false, effectiveType: '4g' });
    expect(path()).toBe('narrative');
  });
});

describe('the non-3D path', () => {
  it('is taken when the visitor asks for reduced motion', () => {
    withReduceMotion(true);
    expect(path()).toBe('flat');
  });

  it('is taken when the visitor asks for reduced motion even where WebGL is available', () => {
    // The order matters and is asserted rather than assumed: a reduced-motion visitor is never
    // asked for a WebGL context at all, which is what `EXPERIENCE.md:656` means by never
    // requested. The probe is watched rather than the answer.
    withReduceMotion(true);
    const probe = vi.mocked(HTMLCanvasElement.prototype.getContext);
    expect(path()).toBe('flat');
    expect(probe, 'a reduced-motion visitor was asked for a WebGL context anyway').not.toHaveBeenCalled();
  });

  it('is taken when the connection reports saveData, with motion unset', () => {
    withConnection({ saveData: true, effectiveType: '4g' });
    expect(path()).toBe('flat');
  });

  for (const effectiveType of ['slow-2g', '2g', '3g']) {
    it(`is taken on effectiveType ${effectiveType}, with no data-saving preference`, () => {
      withConnection({ saveData: false, effectiveType });
      expect(path()).toBe('flat');
    });
  }

  it('is taken when the WebGL probe answers null', () => {
    withWebgl(false);
    expect(path()).toBe('flat');
  });

  it('is taken when the WebGL probe throws rather than answering', () => {
    // A browser with WebGL disabled by policy throws from `getContext`. Unhandled, that is not a
    // fallback but an exception inside an effect, which takes the route with it.
    withThrowingWebgl();
    expect(path()).toBe('flat');
  });
});

describe("the server's verdict", () => {
  it('is the answer on the server, so the served markup is already the flat hero', () => {
    // The `Save-Data` half of the Operator's 2026-09-07 ruling, at the only layer that can prove
    // it here: what this hook returns during a render with no effects is what `app/page.tsx` puts
    // in the document. `undecided` there would be a hero rendered and then taken away.
    const Probe = () => createElement('i', null, useNarrativePath('flat'));
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<i>flat</i>');
  });

  it('is never revisited on the client, even where every browser signal says otherwise', () => {
    // A proxy can set `Save-Data: on` for a client whose `navigator.connection` reports nothing,
    // and Chromium does not always expose the property to a document it sent the header for. The
    // server answered; re-deriving here would move that visitor back onto the narrative path one
    // frame after paint, which is the shift this ruling exists to remove.
    withWebgl(true);
    withReduceMotion(false);
    withConnection({ saveData: false, effectiveType: '4g' });

    expect(path('flat')).toBe('flat');
  });

  it('asks for no WebGL context at all once the server has answered', () => {
    // Same order as the reduced-motion arm: a decision already made is not paid for twice.
    const probe = vi.mocked(HTMLCanvasElement.prototype.getContext);
    expect(path('flat')).toBe('flat');
    expect(probe, 'a Save-Data visitor was asked for a WebGL context anyway').not.toHaveBeenCalled();
  });

  it('leaves the browser to decide when the server answered undecided', () => {
    // The control for the three cases above. `undecided` is what the server sends for everyone
    // else, and it must settle nothing: this is the same reading every case in this file makes.
    withWebgl(false);
    expect(path('undecided')).toBe('flat');

    withWebgl(true);
    expect(path('undecided')).toBe('narrative');
  });
});

describe('the decision, once taken', () => {
  it('does not grow the hero back when reduced motion is turned off mid-session', () => {
    // `prefers-reduced-motion` is live, so this hook's effect re-runs when it changes. Re-deciding
    // there would move a hero that had already collapsed back to `100dvh`, pushing the Directory
    // down the page under someone who was reading it, which is the one direction the browser suite
    // asserts never happens. So the decision is terminal: what a changed preference reaches is the
    // stylesheet, live, and the token contract's durations, live, and not this.
    withReduceMotion(true);
    const { result } = renderHook(() => useNarrativePath());
    expect(result.current, 'a reduced-motion visitor did not take the flat front door').toBe('flat');

    flipReduceMotion(false);

    expect(
      result.current,
      'turning reduced motion off mid-session re-decided the path, which grows the hero back and ' +
        'pushes the Directory down under a reader'
    ).toBe('flat');
  });

  it('does not start the narrative when reduced motion is turned on mid-session either', () => {
    // The same rule read the other way, and the reason it is a rule about the page rather than
    // about motion: a narrative that started mounting a WebGL canvas because a preference changed
    // would be fetching the chunk `EXPERIENCE.md:656` says is never requested, into a document that
    // has been open for a while.
    withReduceMotion(false);
    const { result } = renderHook(() => useNarrativePath());
    expect(result.current).toBe('narrative');

    flipReduceMotion(true);

    expect(result.current, 'the path was re-decided mid-session').toBe('narrative');
  });

  it('and the flip is a real one, measured on the hook that reads the preference', () => {
    // The control. Both cases above assert that something did not change, which proves nothing
    // unless the event they fire is seen changing something: `useReduceMotion` is the hook whose
    // value really does move, and this is the same listener the two cases above drive.
    withReduceMotion(false);
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);

    flipReduceMotion(true);

    expect(result.current, 'the planted media-query change reached no listener at all').toBe(true);
  });
});

describe('the WebGL probe itself', () => {
  it('hands its context back rather than leaving it to the collector', () => {
    // A browser caps live WebGL contexts, around sixteen in Chromium, and silently loses the oldest
    // when the cap is reached. The probe's context is worth nothing once the boolean is read, and
    // `Scene` asks for its own a moment later, so it is released explicitly.
    expect(path()).toBe('narrative');
    expect(lost.count, 'the probe kept its WebGL context').toBe(1);
  });

  it('still answers yes when the context cannot be released', () => {
    // The release is tidying, not detection. An implementation without `WEBGL_lose_context`, or one
    // that throws from it, has WebGL all the same, and answering "no WebGL" because the tidying
    // failed would put a capable visitor on the non-3D front door for good.
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      getExtension: () => {
        throw new Error('extensions are unavailable');
      },
    } as unknown as WebGLRenderingContext);

    expect(path()).toBe('narrative');
  });
});

describe('the connection read itself', () => {
  it('treats a connection object carrying neither field as no signal', () => {
    // The shape a browser that implements the API partially reports. Neither field is a promise,
    // and reading `undefined` as slow would put a fast visitor on the non-3D path forever.
    withConnection({});
    expect(path()).toBe('narrative');
  });

  it('does not throw when navigator.connection is absent, which is most desktop browsers', () => {
    withConnection(undefined);
    expect(() => path()).not.toThrow();
    expect(path()).toBe('narrative');
  });
});
