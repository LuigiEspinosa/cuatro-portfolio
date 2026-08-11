import { describe, expect, it, vi } from 'vitest';
import { type ChannelLike, type ChannelRuntime, type ChannelStore, createChannelStore } from './channels';
import { type Clock, type TimerHandle, CEREMONY_EVENTS, COALESCE_MS, ceremonyTopic } from './status';

/**
 * The topic-keyed realtime store (Story 6.10, DECISION W/X — AC6/AC12).
 *
 * ⭐⭐ THIS SUITE EXISTS BECAUSE THE CODE REVIEW FOUND THE MODULE HAD NONE. It shipped under
 * `app/(viewer)/components/`, where `vitest.config.ts` (`include: ['lib/**\/*.test.ts']`) cannot reach
 * it — so the ref-counting, the deferred teardown, the leave ordering and the retainer bookkeeping,
 * i.e. the ENTIRE mechanism whose failure bounced Story 5.8 `review → in-progress → done`, were
 * asserted by nothing at all. Moving the module to `lib/` is what made these assertions possible; the
 * assertions are what make DECISION W's claim ("5.8's singleton, generalised") checkable rather than
 * stated.
 */

/** A deterministic clock. ⛔ No `vi.useFakeTimers()`: the store takes a clock, so inject one. */
function testClock() {
  let now = 0;
  let seq = 1;
  const timers = new Map<TimerHandle, { at: number; fn: () => void }>();
  const clock: Clock = {
    setTimeout(fn, ms) {
      const handle = seq++;
      timers.set(handle, { at: now + ms, fn });
      return handle;
    },
    clearTimeout(handle) {
      timers.delete(handle);
    },
  };
  return {
    clock,
    pending: () => timers.size,
    /**
     * ⚠ RE-READS THE MAP EACH ITERATION RATHER THAN ITERATING A SNAPSHOT. A snapshot fires timers
     * that an EARLIER callback in the same flush cancelled — which made this harness report a
     * coalescer refresh that the store had in fact cancelled at teardown. A fake clock that runs
     * cancelled timers turns a real assertion into a false failure (and, in the other direction,
     * would hide a real one).
     */
    advance(ms: number) {
      now += ms;
      for (let guard = 0; guard < 1000; guard++) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= now)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (due === undefined) return;
        timers.delete(due[0]);
        due[1].fn();
      }
      throw new Error('testClock.advance: timers kept rescheduling — runaway loop');
    },
  };
}

interface FakeChannel extends ChannelLike {
  topic: string;
  bindings: Map<string, () => void>;
  statusCb: ((status: string) => void) | null;
  fire(event: string): void;
}

function harness(options: { removeChannel?: (channel: ChannelLike) => unknown } = {}) {
  const clock = testClock();
  const created: FakeChannel[] = [];
  const removed: FakeChannel[] = [];

  const runtime: ChannelRuntime = {
    clock: clock.clock,
    createChannel(topic) {
      const channel: FakeChannel = {
        topic,
        bindings: new Map(),
        statusCb: null,
        on(_type, filter, callback) {
          channel.bindings.set(filter.event, callback);
          return channel;
        },
        subscribe(callback) {
          channel.statusCb = callback;
          return channel;
        },
        fire(event) {
          channel.bindings.get(event)?.();
        },
      };
      created.push(channel);
      return channel;
    },
    removeChannel(channel) {
      removed.push(channel as FakeChannel);
      return options.removeChannel?.(channel);
    },
  };

  const store: ChannelStore = createChannelStore(runtime);
  return { store, clock, created, removed };
}

const TOPIC = ceremonyTopic(77);
const EVENTS = [...CEREMONY_EVENTS];

describe('createChannelStore — the 5.8 singleton, generalised per topic', () => {
  it('opens exactly ONE channel however many islands retain the same topic', () => {
    const h = harness();
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    expect(h.created).toHaveLength(1);
    expect(h.created[0]?.topic).toBe(TOPIC);
  });

  it('opens a SEPARATE channel per topic — an id change is a new key, not a rebuild branch', () => {
    const h = harness();
    h.store.retainChannel(ceremonyTopic(77), EVENTS, () => {});
    h.store.retainChannel(ceremonyTopic(78), EVENTS, () => {});
    expect(h.created.map((c) => c.topic)).toEqual([ceremonyTopic(77), ceremonyTopic(78)]);
  });

  it("⭐ SURVIVES StrictMode's synchronous setup→cleanup→setup — the channel is NOT torn down", () => {
    const h = harness();
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.releaseChannel(TOPIC); // React's fake unmount…
    h.store.retainChannel(TOPIC, EVENTS, () => {}); // …and its immediate re-mount, same tick.
    h.clock.advance(1);
    expect(h.removed).toHaveLength(0);
    expect(h.created).toHaveLength(1);
  });

  it('tears down on a REAL unmount, on the deferred tick and not before', () => {
    const h = harness();
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.releaseChannel(TOPIC);
    expect(h.removed).toHaveLength(0); // ⛔ never synchronous — that is the 5.8 shape
    h.clock.advance(1);
    expect(h.removed).toHaveLength(1);
  });

  it('holds the channel while ANY retainer remains', () => {
    const h = harness();
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.releaseChannel(TOPIC);
    h.clock.advance(1);
    expect(h.removed).toHaveLength(0);
  });
});

describe('the in-flight leave — the navigate-away-and-back race the review found', () => {
  it('⭐⭐ does NOT reopen a topic while its unsubscribe is still in flight', async () => {
    let settle = () => {};
    const leave = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const h = harness({ removeChannel: () => leave });

    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.releaseChannel(TOPIC);
    h.clock.advance(1); // teardown starts; `removeChannel` has NOT resolved
    expect(h.removed).toHaveLength(1);

    // The viewer taps back into /ceremonia inside the phx_leave round-trip.
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    // ⛔ Creating a channel HERE is the bug: the client's topic-dedup would hand back the still
    // `leaving` channel and `subscribe()` would take its `isClosed()` early-out, dead for the tab.
    expect(h.created).toHaveLength(1);

    settle();
    await leave;
    await Promise.resolve();
    await Promise.resolve();

    expect(h.created).toHaveLength(2); // …and only once the old one has actually gone.
  });

  it('a leave that REJECTS still releases the topic rather than wedging it shut forever', async () => {
    const h = harness({ removeChannel: () => Promise.reject(new Error('socket gone')) });
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.releaseChannel(TOPIC);
    h.clock.advance(1);
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(h.created).toHaveLength(2);
  });

  it('a SYNCHRONOUS removeChannel still defers the reopen by exactly one microtask, never dropping it', async () => {
    const h = harness({ removeChannel: () => undefined });
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.releaseChannel(TOPIC);
    h.clock.advance(1);
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(h.created).toHaveLength(2);
    expect(h.created[1]?.statusCb).not.toBeNull(); // ⛔ and it is WIRED, not merely constructed
  });
});

describe('retainer bookkeeping — the arguments ensureChannel used to discard', () => {
  it('⭐ routes the coalesced refresh to the LATEST retainer, not the first', () => {
    const h = harness();
    const first = vi.fn();
    const second = vi.fn();
    h.store.retainChannel(TOPIC, EVENTS, first);
    h.store.retainChannel(TOPIC, EVENTS, second);

    h.created[0]?.fire('spin.reveal');
    h.clock.advance(COALESCE_MS);

    // The stale closure is the defect: an effect re-run with a new `router` identity must not keep
    // calling the previous render's callback for the life of the tab.
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('⭐ wires an event a LATER retainer brings that the first did not', () => {
    const h = harness();
    const refresh = vi.fn();
    h.store.retainChannel(TOPIC, ['spin.reveal'], () => {});
    h.store.retainChannel(TOPIC, ['ceremony.locked'], refresh);

    expect([...(h.created[0]?.bindings.keys() ?? [])]).toEqual(['spin.reveal', 'ceremony.locked']);
    h.created[0]?.fire('ceremony.locked');
    h.clock.advance(COALESCE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not rebind an event the channel already carries', () => {
    const h = harness();
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    expect(h.created[0]?.bindings.size).toBe(1);
  });
});

describe('the doorbell contract (AD-11)', () => {
  it('collapses a burst into ONE refresh, at the trailing edge', () => {
    const h = harness();
    const refresh = vi.fn();
    h.store.retainChannel(TOPIC, EVENTS, refresh);

    h.created[0]?.fire('spin.reveal');
    h.created[0]?.fire('spin.reveal');
    h.created[0]?.fire('spin.reveal');
    expect(refresh).not.toHaveBeenCalled();
    h.clock.advance(COALESCE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes on RECONNECT but not on the first SUBSCRIBED', () => {
    const h = harness();
    const refresh = vi.fn();
    h.store.retainChannel(TOPIC, EVENTS, refresh);
    const channel = h.created[0];

    channel?.statusCb?.('SUBSCRIBED'); // the server already rendered current truth
    h.clock.advance(COALESCE_MS);
    expect(refresh).not.toHaveBeenCalled();

    channel?.statusCb?.('CHANNEL_ERROR');
    channel?.statusCb?.('SUBSCRIBED');
    h.clock.advance(COALESCE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    channel?.statusCb?.('TIMED_OUT');
    channel?.statusCb?.('SUBSCRIBED');
    h.clock.advance(COALESCE_MS);
    expect(refresh).toHaveBeenCalledTimes(2); // exactly one per drop→recover cycle
  });

  it('cancels a buffered refresh on teardown rather than firing into an unmounted tree', () => {
    const h = harness();
    const refresh = vi.fn();
    h.store.retainChannel(TOPIC, EVENTS, refresh);
    h.created[0]?.fire('spin.reveal');
    h.store.releaseChannel(TOPIC);
    h.clock.advance(COALESCE_MS + 1);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('status subscription', () => {
  it('reports null before the channel exists, then the live status', () => {
    const h = harness();
    expect(h.store.channelStatus(TOPIC)).toBeNull();
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.created[0]?.statusCb?.('SUBSCRIBED');
    expect(h.store.channelStatus(TOPIC)).toBe('SUBSCRIBED');
  });

  it('is per-topic — a ceremony CHANNEL_ERROR does not read as the tournament topic being healthy', () => {
    const h = harness();
    const ceremony = ceremonyTopic(77);
    const tournament = 'tournament:9';
    h.store.retainChannel(ceremony, EVENTS, () => {});
    h.store.retainChannel(tournament, EVENTS, () => {});
    h.created[0]?.statusCb?.('CHANNEL_ERROR');
    h.created[1]?.statusCb?.('SUBSCRIBED');
    expect(h.store.channelStatus(ceremony)).toBe('CHANNEL_ERROR');
    expect(h.store.channelStatus(tournament)).toBe('SUBSCRIBED');
  });

  it('notifies listeners on every status change, and stops after unsubscribe', () => {
    const h = harness();
    const listener = vi.fn();
    const unsubscribe = h.store.subscribeChannelStatus(TOPIC, listener);
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.created[0]?.statusCb?.('SUBSCRIBED');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    h.created[0]?.statusCb?.('CHANNEL_ERROR');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a listener registered BEFORE the channel exists still receives the first status', () => {
    // The `useSyncExternalStore` ordering: subscribe runs before passive effects, so this is the
    // real first-mount sequence rather than a contrived one.
    const h = harness();
    const listener = vi.fn();
    h.store.subscribeChannelStatus(TOPIC, listener);
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.created[0]?.statusCb?.('SUBSCRIBED');
    expect(listener).toHaveBeenCalled();
  });

  it('emits after teardown so a snapshot reads null rather than a dead channel status', () => {
    const h = harness();
    h.store.retainChannel(TOPIC, EVENTS, () => {});
    h.created[0]?.statusCb?.('SUBSCRIBED');
    const listener = vi.fn();
    h.store.subscribeChannelStatus(TOPIC, listener);
    h.store.releaseChannel(TOPIC);
    h.clock.advance(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(h.store.channelStatus(TOPIC)).toBeNull();
  });
});
