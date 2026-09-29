import { type ChannelStatus, type Clock, type Coalescer, COALESCE_MS, createCoalescer, isReconnect } from './status';

/**
 * The per-tab realtime channel store, TOPIC-KEYED (Story 6.10, DECISION W — AC6).
 *
 * ⭐⭐ THIS IS STORY 5.8's SINGLETON, GENERALISED — NOT A SECOND ONE, AND THE DIFFERENCE MATTERS MORE
 * HERE THAN ANYWHERE ELSE IN THE PROJECT. `RealtimeNudge` kept its channel in module-level state
 * rather than in `useState` for a correctness reason, not for tidiness: `removeChannel()` is ASYNC
 * (it awaits an unsubscribe round-trip) while React StrictMode runs setup→cleanup→setup
 * SYNCHRONOUSLY, so a per-mount `supabase.channel(topic)` on the second mount gets the still-`leaving`
 * channel back from the client's topic-dedup and `subscribe()` skips wiring the callbacks (the
 * `isClosed()` gate) — leaving the live instance with a DEAD subscription. No nudges, no reconnect,
 * and INVISIBLE to lint, to the build and to the whole node suite. That is the one story in this
 * project that bounced `review → in-progress → done` (`epic-5-retro:53`).
 *
 * ⛔ SO `spin.reveal` DOES NOT GET AN AD-HOC `.channel()` OF ITS OWN. The single-channel store becomes
 * a `Map<topic, Entry>`; every property that made it correct — subscribe exactly once, retain by
 * ref-count, tear down on a DEFERRED tick so StrictMode's fake unmount just re-retains — is preserved
 * per topic, and an id change is now simply a different key rather than a special rebuild branch.
 *
 * ⚠ AD-11 IS UNCHANGED AND IS THE REASON THIS IS SO SMALL: a broadcast is a DOORBELL, never the mail.
 * ⛔ The payload is NEVER read as state and a missed event is NEVER replayed — every viewer surface is
 * fully reconstructable from a published-state read alone, so the only action on any event is
 * `router.refresh()`, and a reconnect reconciles by re-reading rather than by replaying a log.
 *
 * ⭐⭐ CODE REVIEW 2026-08-11 — THIS MODULE MOVED FROM `app/(viewer)/components/` TO `lib/`, AND THAT
 * IS DECISION X APPLIED TO THE ONE FILE THAT NEEDED IT MOST. `vitest.config.ts` collects only
 * `lib/**\/*.test.ts`, so while it lived under `app/` the ref-counting, the deferred teardown and the
 * leave ordering — the exact machinery whose failure bounced 5.8 — had ZERO coverage and were
 * unreachable by any suite. The store is now a factory over an injected {@link ChannelRuntime}, so a
 * test drives it with a fake clock and a fake channel instead of a browser.
 */

/** The minimum a channel must do for this store — structural, so a test can fake it without Supabase. */
export interface ChannelLike {
  on(type: 'broadcast', filter: { event: string }, callback: () => void): unknown;
  subscribe(callback: (status: string) => void): unknown;
}

/** Everything the store touches that is not pure. Injected so the store itself is testable. */
export interface ChannelRuntime {
  readonly clock: Clock;
  createChannel(topic: string): ChannelLike;
  /** May be async — the store WAITS for it before reopening the same topic. See {@link leaving}. */
  removeChannel(channel: ChannelLike): unknown;
  /** Dev-log sink; `undefined` in tests. */
  log?(topic: string, event: string): void;
}

interface Entry {
  channel: ChannelLike | null;
  coalescer: Coalescer;
  /**
   * ⭐ MUTABLE ON PURPOSE — see {@link ChannelStore.retainChannel}. The coalescer calls
   * `entry.refresh()` through this field rather than closing over one particular retainer's callback.
   */
  refresh: () => void;
  events: Set<string>;
  status: ChannelStatus | null;
  prevStatus: ChannelStatus | null;
  refCount: number;
  teardownTimer: number | null;
}

export interface ChannelStore {
  retainChannel(topic: string, events: readonly string[], refresh: () => void): void;
  releaseChannel(topic: string): void;
  subscribeChannelStatus(topic: string, listener: () => void): () => void;
  channelStatus(topic: string): ChannelStatus | null;
}

export function createChannelStore(runtime: ChannelRuntime): ChannelStore {
  const entries = new Map<string, Entry>();

  /**
   * ⛔⛔ THE LISTENER SET IS KEPT OUTSIDE THE ENTRY, AND THAT IS A CORRECTNESS BUG AVOIDED RATHER THAN
   * A STYLE CHOICE. `useSyncExternalStore` subscribes BEFORE passive effects run, so on the very first
   * mount the channel does not exist yet — a listener parked on the entry would be dropped on the
   * floor, the store would never notify, and the pill would freeze on its initial snapshot for the
   * life of the tab. 5.8's single-channel version had the same shape for the same reason.
   */
  const listenersByTopic = new Map<string, Set<() => void>>();

  /**
   * ⭐⭐ TOPICS WITH AN UNSUBSCRIBE STILL IN FLIGHT — CODE REVIEW 2026-08-11, AND THIS IS THE 5.8 BUG
   * ARRIVING BY A SECOND DOOR. The deferred-teardown tick defends against StrictMode's SYNCHRONOUS
   * fake unmount, and that is all it defends against. `SpinRevealNudge` is PAGE-scoped and unmounts on
   * any client navigation — unlike `RealtimeNudge`, which lives in the layout and never unmounts,
   * which is why 5.8 never hit this — so tapping away from `/ceremonia` and back within the
   * `phx_leave` round-trip (tens of ms normally, UNBOUNDED while the socket is reconnecting) used to
   * call `supabase.channel(topic)` while the old channel was still `leaving`. The client's topic-dedup
   * hands the dying channel back, `subscribe()` takes its `isClosed()` early-out, and the reveal stops
   * refreshing for the life of the tab. ⛔ So reopening a topic now WAITS for its leave to settle.
   */
  const leaving = new Map<string, Promise<void>>();

  function emit(topic: string) {
    const listeners = listenersByTopic.get(topic);
    if (listeners === undefined) return;
    for (const listener of listeners) listener();
  }

  function bindEvent(entry: Entry, topic: string, channel: ChannelLike, event: string) {
    channel.on('broadcast', { event }, () => {
      runtime.log?.(topic, event);
      // ⛔ THE PAYLOAD IS NOT READ. `spin.reveal` carries `spin_index`, `revealed_spins` and
      // `ceremony_complete`, and using any of them as state would make the surface depend on a
      // delivery guarantee Broadcast does not offer (`realtime.send` swallows its own errors by
      // design, `0028:863-867`). The refresh re-reads the reveal-gated tables instead.
      entry.coalescer.trigger();
    });
  }

  function wire(entry: Entry, topic: string) {
    const channel = runtime.createChannel(topic);
    entry.channel = channel;
    for (const event of entry.events) bindEvent(entry, topic, channel, event);
    channel.subscribe((next) => {
      const nextStatus = next as ChannelStatus;
      // A FRESH `SUBSCRIBED` after a drop = reconnect ⇒ one silent reconcile, routed through the SAME
      // coalescer as nudges so a reconnect coinciding with a buffered nudge collapses to one refresh.
      // The FIRST subscribe is not a reconnect (the server already rendered current truth).
      if (isReconnect(entry.prevStatus, nextStatus)) entry.coalescer.trigger();
      entry.prevStatus = nextStatus;
      entry.status = nextStatus;
      emit(topic);
    });
  }

  function hardTeardown(topic: string) {
    const entry = entries.get(topic);
    if (entry === undefined) return;
    entry.coalescer.cancel();
    entries.delete(topic);
    const channel = entry.channel;
    if (channel !== null) {
      const settled = Promise.resolve(runtime.removeChannel(channel))
        .catch(() => undefined)
        .then(() => {
          // ⚠ Only clear the marker if it is still OURS — a later teardown of the same topic owns it.
          if (leaving.get(topic) === settled) leaving.delete(topic);
        });
      leaving.set(topic, settled);
    }
    // ⚠ EMITTED AFTER THE DELETE, so a subscriber's `getSnapshot` reads `null` (no channel) rather
    // than the status of a channel that is already gone.
    emit(topic);
  }

  /**
   * Open the channel for `topic` if it is not already open, and ADOPT this retainer's events and
   * refresh either way.
   *
   * ⭐⭐ CODE REVIEW 2026-08-11 — IT USED TO RETURN THE EXISTING ENTRY AND SILENTLY DROP BOTH
   * ARGUMENTS. The coalescer closed over the FIRST retainer's `refresh` forever, so an effect re-run
   * with a new `router` identity kept calling the previous render's closure, and a second island
   * retaining the same topic had its event list never wired to `.on(...)` — with no warning and no
   * lint error. The function's own name promised idempotence; what it delivered was "ignores the new
   * arguments". Generalising the store to take a topic (DECISION W) is precisely what makes two
   * retainers per topic a real case rather than a hypothetical one.
   */
  function ensureChannel(topic: string, events: readonly string[], refresh: () => void): Entry {
    const existing = entries.get(topic);
    if (existing !== undefined) {
      existing.refresh = refresh;
      for (const event of events) {
        if (existing.events.has(event)) continue;
        existing.events.add(event);
        // ⚠ A binding added AFTER `subscribe()` is consulted on the next message — the channel keeps
        // its binding list rather than snapshotting it at subscribe time.
        if (existing.channel !== null) bindEvent(existing, topic, existing.channel, event);
      }
      return existing;
    }

    const entry: Entry = {
      channel: null,
      // ⚠ THE INDIRECTION IS THE POINT: `() => entry.refresh()`, never `refresh`.
      coalescer: createCoalescer(() => entry.refresh(), COALESCE_MS, runtime.clock),
      refresh,
      events: new Set(events),
      status: null,
      prevStatus: null,
      refCount: 0,
      teardownTimer: null,
    };
    entries.set(topic, entry);

    const pending = leaving.get(topic);
    if (pending === undefined) wire(entry, topic);
    // ⛔ DEFERRED UNTIL THE OLD CHANNEL HAS ACTUALLY LEFT. The guard re-checks identity because the
    // entry may have been released and torn down again before the leave settled.
    else void pending.then(() => {
      if (entries.get(topic) === entry && entry.channel === null) wire(entry, topic);
    });

    return entry;
  }

  return {
    /** Retain `topic` for one mounted island, opening the channel on the first retainer. */
    retainChannel(topic, events, refresh) {
      const entry = ensureChannel(topic, events, refresh);
      if (entry.teardownTimer !== null) {
        runtime.clock.clearTimeout(entry.teardownTimer);
        entry.teardownTimer = null;
      }
      entry.refCount++;
    },

    /** Release one retainer. The channel survives a StrictMode remount — see the deferred tick. */
    releaseChannel(topic) {
      const entry = entries.get(topic);
      if (entry === undefined) return;
      entry.refCount--;
      if (entry.refCount > 0) return;
      // ⛔ DEFERRED, NOT IMMEDIATE. StrictMode's synchronous remount re-retains inside this tick and
      // cancels the timer, so the channel survives the FAKE unmount and is only actually removed on a
      // real one. Removing it synchronously is the exact shape that shipped a dead subscription at 5.8.
      entry.teardownTimer = runtime.clock.setTimeout(() => {
        entry.teardownTimer = null;
        if (entry.refCount <= 0) hardTeardown(topic);
      }, 0);
    },

    /** `useSyncExternalStore`'s subscribe half, per topic. See the note on `listenersByTopic`. */
    subscribeChannelStatus(topic, listener) {
      let listeners = listenersByTopic.get(topic);
      if (listeners === undefined) {
        listeners = new Set();
        listenersByTopic.set(topic, listeners);
      }
      listeners.add(listener);
      const set = listeners;
      return () => {
        set.delete(listener);
        // ⚠ CODE REVIEW 2026-08-11 — prune the empty Set rather than leaving one per topic forever.
        if (set.size === 0 && listenersByTopic.get(topic) === set) listenersByTopic.delete(topic);
      };
    },

    /** `useSyncExternalStore`'s snapshot half. `null` = no channel yet ⇒ the reducer's base state. */
    channelStatus(topic) {
      return entries.get(topic)?.status ?? null;
    },
  };
}
