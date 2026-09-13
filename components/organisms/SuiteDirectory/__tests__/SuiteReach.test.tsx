import { render } from '@testing-library/react';
import { REACH_EVENT, ROOT_MARGIN, SuiteReach, TRACKER_POLL_LIMIT, TRACKER_POLL_MS } from '../SuiteReach';

/**
 * The `suite-reach` event (Story 2-24, FR-34).
 *
 * **jsdom has no `IntersectionObserver` and lays nothing out, so the observer is a fake the test
 * drives.** What is proved here is the component's own logic: it observes at once when the tracker
 * is already there and waits for it otherwise, asks for the root extended upward so a jump past the
 * heading is a crossing it can see, counts a heading in view and a heading already scrolled past,
 * sends once and remembers that in `sessionStorage`, stops polling at the bound, survives a storage
 * or a tracker that throws, and leaves no timer or observer behind on unmount. Whether a real
 * browser's observer fires on a real scroll, and on a real jump, is
 * `tests/e2e/visitor-instrumentation.pw.ts`.
 *
 * Fake timers throughout, because the poll is the one thing here that takes time, and 20 s of real
 * waiting per case would be a suite nobody runs.
 */

/** The observers constructed since the case began, newest last. */
const observers: FakeObserver[] = [];

class FakeObserver {
  readonly targets: Element[] = [];
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    observers.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** Drive one notification, shaped as the two fields the component reads. */
  notify(entry: { isIntersecting: boolean; bottom: number }): void {
    this.callback(
      [{ isIntersecting: entry.isIntersecting, boundingClientRect: { bottom: entry.bottom } } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

const HEADING_ID = 'suite';

const heading = (): HTMLElement => document.getElementById(HEADING_ID) as HTMLElement;

const track = vi.fn();

/** The tracker as the script leaves it: `window.umami` with a `track`. */
const installTracker = (): void => {
  window.umami = { track };
};

/** One poll tick. */
const tick = (): void => {
  vi.advanceTimersByTime(TRACKER_POLL_MS);
};

const mount = () => render(<SuiteReach target={HEADING_ID} />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  observers.length = 0;
  track.mockReset();
  document.body.insertAdjacentHTML('beforeend', `<h2 id="${HEADING_ID}">The Suite</h2>`);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.umami;
  sessionStorage.clear();
  document.getElementById(HEADING_ID)?.remove();
});

describe('SuiteReach', () => {
  it('observes at once with the tracker already present, sends nothing on mount, and one when the heading enters the viewport', () => {
    // A client navigation back to `/` finds the tracker already there, so no tick is spent. The
    // observer's initial notification is "not intersecting, below", which is not reach.
    installTracker();
    mount();

    expect(observers, 'the tracker was present at mount and nothing was observed').toHaveLength(1);
    expect(vi.getTimerCount(), 'a poll was started with the tracker already present').toBe(0);
    const [observer] = observers;
    expect(observer.targets, 'the observer watches something other than the heading').toEqual([heading()]);

    observer.notify({ isIntersecting: false, bottom: 400 });
    expect(track, 'an event was sent for a heading still below the fold').not.toHaveBeenCalled();

    observer.notify({ isIntersecting: true, bottom: 300 });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track, 'the event carries a name or data other than the bare reach name').toHaveBeenCalledWith(REACH_EVENT);
    expect(sessionStorage.getItem(REACH_EVENT), 'the send left no flag behind').not.toBeNull();
    // Disconnected, so the browser delivers nothing more: `disconnect()` empties the queue as well
    // as the target list, which is what makes one send per observer a platform fact.
    expect(observer.disconnected, 'the observer keeps watching after the send').toBe(true);
  });

  it('asks for the root extended upward and only upward, so a jump past the heading is a crossing', () => {
    // Against the bare viewport a heading that jumped from below to above between two frames is
    // "not intersecting" on both sides and the observer never notifies (`EXPERIENCE.md:696` allows
    // no scroll listener to catch it). With the top edge a hundred thousand pixels up, "above" is
    // inside the root, and the jump is a crossing into it. The bottom edge stays the viewport's:
    // a margin there would count a heading the visitor has not reached.
    installTracker();
    mount();
    expect(observers[0].options?.rootMargin).toBe(ROOT_MARGIN);
    expect(ROOT_MARGIN).toMatch(/^[1-9][0-9]*px 0px 0px 0px$/);

    // The crossing, as a browser reports it under that root: intersecting, rect above the viewport.
    observers[0].notify({ isIntersecting: true, bottom: -10 });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(REACH_EVENT);
  });

  it('counts a heading already scrolled past, which is bottom below zero and not intersecting', () => {
    // A visitor who flicked past the heading before the tracker loaded reached the suite. The
    // frozen arm: a notification "not intersecting" with the rect above the viewport still counts,
    // whatever root the browser measured it against.
    installTracker();
    mount();
    observers[0].notify({ isIntersecting: false, bottom: -10 });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(REACH_EVENT);
  });

  it('waits for the tracker, then observes, so the initial notification covers a heading already in view', () => {
    // `afterInteractive` puts the script after hydration, so the effect runs first. The observer
    // is created only once the tracker exists, and its initial notification is the only path.
    mount();
    tick();
    tick();
    expect(observers, 'observed before the tracker existed').toHaveLength(0);

    installTracker();
    tick();
    expect(observers, 'the tracker arrived and the poll did not notice').toHaveLength(1);
    expect(vi.getTimerCount(), 'the poll keeps running after the tracker was found').toBe(0);

    observers[0].notify({ isIntersecting: true, bottom: 200 });
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('does not take a window.umami without a track function for the tracker', () => {
    // Something else may own the name. The poll goes on until a `track` function is there, rather
    // than observing and throwing inside the observer callback on the first notification.
    window.umami = {} as Window['umami'];
    mount();
    expect(observers, 'a window.umami with no track was observed at mount').toHaveLength(0);
    tick();
    tick();
    expect(observers, 'a window.umami with no track was taken for the tracker by the poll').toHaveLength(0);
    expect(vi.getTimerCount(), 'the poll stopped on a window.umami with no track').toBe(1);

    installTracker();
    tick();
    expect(observers).toHaveLength(1);
  });

  it('contains a tracker that throws, and still sets the flag', () => {
    track.mockImplementation(() => {
      throw new Error('tracker broke');
    });
    installTracker();
    mount();
    expect(() => observers[0].notify({ isIntersecting: true, bottom: 200 }), 'the throw escaped the callback').not.toThrow();
    expect(track).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(REACH_EVENT), 'a throwing tracker stopped the flag').not.toBeNull();
  });

  it('observes nothing and sends nothing on a reload in the same tab, the flag being present', () => {
    sessionStorage.setItem(REACH_EVENT, '1');
    installTracker();
    mount();
    vi.advanceTimersByTime(TRACKER_POLL_MS * (TRACKER_POLL_LIMIT + 1));

    expect(observers, 'a session that already sent reach observed the heading again').toHaveLength(0);
    expect(track).not.toHaveBeenCalled();
    expect(vi.getTimerCount(), 'a flagged session still polls for the tracker').toBe(0);
  });

  it('gives up after the poll limit and never observes, so a blocked tracker costs 80 ticks and silence', () => {
    // The bound is interval ticks after the immediate check: 80 of them, 20 s.
    mount();
    vi.advanceTimersByTime(TRACKER_POLL_MS * TRACKER_POLL_LIMIT);
    expect(observers).toHaveLength(0);
    expect(vi.getTimerCount(), 'the poll outlives its limit').toBe(0);

    // A tracker arriving after the bound is not noticed: the poll has stopped, by design.
    installTracker();
    vi.advanceTimersByTime(TRACKER_POLL_MS * 4);
    expect(observers, 'a tracker arriving after the limit was still picked up, so the poll is unbounded').toHaveLength(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('still finds a tracker on the last tick, which is the bound and not one short of it', () => {
    // The control for the bound: the same poll, the tracker arriving on tick 80 exactly, observes.
    // Without it the case above would pass a poll that stopped at 79, or at 1.
    mount();
    vi.advanceTimersByTime(TRACKER_POLL_MS * (TRACKER_POLL_LIMIT - 1));
    expect(observers).toHaveLength(0);
    installTracker();
    tick();
    expect(observers, 'a tracker present on the last tick was missed').toHaveLength(1);
  });

  it('returns at once when IntersectionObserver is absent', () => {
    vi.unstubAllGlobals();
    expect(typeof IntersectionObserver, 'jsdom grew an IntersectionObserver, so this case measures nothing').toBe(
      'undefined'
    );
    installTracker();
    mount();
    expect(vi.getTimerCount(), 'the effect started polling with nothing to observe with').toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('sends anyway when sessionStorage throws on read and on write', () => {
    // Storage disabled, private mode on an old engine, a quota of zero: every access throws.
    // Once per session is a nicety; the send is the point.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    installTracker();
    mount();
    expect(observers, 'a throwing storage stopped the observer').toHaveLength(1);
    observers[0].notify({ isIntersecting: true, bottom: 200 });
    expect(track, 'a throwing storage blocked the send').toHaveBeenCalledTimes(1);
  });

  it('clears the poll on unmount before the tracker arrives', () => {
    const { unmount } = mount();
    tick();
    expect(vi.getTimerCount(), 'no poll was running, so there is nothing to clear').toBe(1);
    unmount();
    expect(vi.getTimerCount(), 'the poll survives the component').toBe(0);
    installTracker();
    vi.advanceTimersByTime(TRACKER_POLL_MS * 4);
    expect(observers, 'an unmounted component went on to observe').toHaveLength(0);
  });

  it('disconnects the observer on unmount after the tracker arrived', () => {
    installTracker();
    const { unmount } = mount();
    expect(observers[0].disconnected).toBe(false);
    unmount();
    expect(observers[0].disconnected, 'the observer survives the component').toBe(true);
  });

  it('observes nothing when the heading is not in the document', () => {
    heading().remove();
    installTracker();
    mount();
    expect(observers, 'an observer was created with no element to watch').toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
