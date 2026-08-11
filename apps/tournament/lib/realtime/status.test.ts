import { describe, it, expect, vi } from 'vitest';
import type { TournamentState } from '@/lib/feed/read';
import {
  type ChannelStatus,
  type Clock,
  type TimerHandle,
  CEREMONY_EVENTS,
  ceremonyTopic,
  COALESCE_MS,
  createCoalescer,
  indicatorToken,
  isReconnect,
  NUDGE_EVENTS,
  tournamentTopic,
} from '@/lib/realtime/status';

/** A controllable fake clock: queues timeouts, fires them when `advance` crosses their deadline. */
function makeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<TimerHandle, { fn: () => void; at: number }>();
  const clock: Clock = {
    setTimeout(fn, ms) {
      const handle = ++seq as TimerHandle;
      timers.set(handle, { fn, at: now + ms });
      return handle;
    },
    clearTimeout(handle) {
      timers.delete(handle);
    },
  };
  function advance(ms: number) {
    now += ms;
    for (const [handle, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(handle);
        t.fn();
      }
    }
  }
  return { clock, advance, pending: () => timers.size };
}

const DROPPED: ChannelStatus[] = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'];
const ALL_STATES: TournamentState[] = [
  'registration_open',
  'registration_closed',
  'bracket_live',
  'ceremony',
  'closed',
];

describe('indicatorToken (AC5/AC6 — status + state → pill token)', () => {
  it('maps the base state when subscribed (mirrors livePillState: on→live, final, off)', () => {
    expect(indicatorToken('SUBSCRIBED', 'bracket_live')).toBe('live');
    expect(indicatorToken('SUBSCRIBED', 'ceremony')).toBe('final');
    expect(indicatorToken('SUBSCRIBED', 'closed')).toBe('final');
    expect(indicatorToken('SUBSCRIBED', 'registration_open')).toBe('off');
    expect(indicatorToken('SUBSCRIBED', 'registration_closed')).toBe('off');
  });

  it('renders the base state pre-subscribe (channel === null) so the client render EQUALS the server render', () => {
    // no hydration flash: null (SSR / before first callback) must equal the SUBSCRIBED mapping
    for (const state of ALL_STATES) {
      expect(indicatorToken(null, state)).toBe(indicatorToken('SUBSCRIBED', state));
    }
  });

  it('overrides EVERY live/off/final state with reconnecting on any dropped status', () => {
    for (const status of DROPPED) {
      for (const state of ALL_STATES) {
        expect(indicatorToken(status, state)).toBe('reconnecting');
      }
    }
  });

  it('shows reconnecting even in final (decision-final-reconnect — freshness still matters mid-ceremony)', () => {
    expect(indicatorToken('CLOSED', 'ceremony')).toBe('reconnecting');
    expect(indicatorToken('CHANNEL_ERROR', 'closed')).toBe('reconnecting');
  });

  it('maps a null (unresolved) tournament to loading, regardless of channel status', () => {
    expect(indicatorToken(null, null)).toBe('loading');
    expect(indicatorToken('SUBSCRIBED', null)).toBe('loading');
    expect(indicatorToken('CLOSED', null)).toBe('loading');
  });
});

describe('isReconnect (AC4 — fire exactly one refresh on a fresh SUBSCRIBED after a drop)', () => {
  it('is false on the FIRST subscribe (prev === null) — server already rendered current truth', () => {
    expect(isReconnect(null, 'SUBSCRIBED')).toBe(false);
  });

  it('is true only re-subscribing after a drop', () => {
    expect(isReconnect('CLOSED', 'SUBSCRIBED')).toBe(true);
    expect(isReconnect('TIMED_OUT', 'SUBSCRIBED')).toBe(true);
    expect(isReconnect('CHANNEL_ERROR', 'SUBSCRIBED')).toBe(true);
  });

  it('is false for a SUBSCRIBED → SUBSCRIBED repeat (no double refresh)', () => {
    expect(isReconnect('SUBSCRIBED', 'SUBSCRIBED')).toBe(false);
  });

  it('is false for any transition that does not LAND on SUBSCRIBED', () => {
    expect(isReconnect('SUBSCRIBED', 'CLOSED')).toBe(false);
    expect(isReconnect('CLOSED', 'TIMED_OUT')).toBe(false);
    expect(isReconnect(null, 'CHANNEL_ERROR')).toBe(false);
  });
});

describe('createCoalescer (AC2 — a burst collapses to one action)', () => {
  it('collapses N rapid triggers within the window into a single action', () => {
    const { clock, advance } = makeClock();
    const action = vi.fn();
    const c = createCoalescer(action, COALESCE_MS, clock);

    c.trigger();
    advance(100);
    c.trigger();
    advance(100);
    c.trigger();
    expect(action).not.toHaveBeenCalled(); // still inside the window after the last trigger

    advance(COALESCE_MS);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('fires once the window elapses after the last trigger', () => {
    const { clock, advance } = makeClock();
    const action = vi.fn();
    const c = createCoalescer(action, COALESCE_MS, clock);

    c.trigger();
    advance(COALESCE_MS - 1);
    expect(action).not.toHaveBeenCalled();
    advance(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('fires separately for two bursts spaced beyond the window', () => {
    const { clock, advance } = makeClock();
    const action = vi.fn();
    const c = createCoalescer(action, COALESCE_MS, clock);

    c.trigger();
    advance(COALESCE_MS);
    c.trigger();
    advance(COALESCE_MS);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('cancel() drops a pending action and clears the timer', () => {
    const { clock, advance, pending } = makeClock();
    const action = vi.fn();
    const c = createCoalescer(action, COALESCE_MS, clock);

    c.trigger();
    expect(pending()).toBe(1);
    c.cancel();
    expect(pending()).toBe(0);
    advance(COALESCE_MS * 2);
    expect(action).not.toHaveBeenCalled();
  });
});

/**
 * ⭐⭐ STORY 6.10, AC6 / DECISION F — THE TWO EVENT VOCABULARIES ARE SEPARATE, AND THE SEPARATION IS
 * ASSERTED IN BOTH DIRECTIONS RATHER THAN TRUSTED TO A COMMENT.
 *
 * `0028:869-871` states the rule inside the migration that emits the event: *"DO NOT add
 * `spin.reveal` to `lib/realtime/status.ts`'s NUDGE_EVENTS — that list is the `tournament:<id>`
 * vocabulary 5.8's surfaces consume, and the consumer for this one is 6.10's, with the UI that needs
 * it."* They ride DIFFERENT CHANNELS: merging them would subscribe every viewer surface to a ceremony
 * topic it has no reason to hear, and would make the shell `router.refresh()` on all 40 reveals.
 */
describe('the tournament and ceremony vocabularies are disjoint (Story 6.10, AC6)', () => {
  it('NUDGE_EVENTS is still exactly the four SHIPPED tournament events', () => {
    expect([...NUDGE_EVENTS]).toEqual([
      'match.approved',
      'bracket.advanced',
      'match.rolled_back',
      'match.manual_resolved',
    ]);
  });

  it('⛔ `spin.reveal` is NOT in NUDGE_EVENTS', () => {
    expect(NUDGE_EVENTS as readonly string[]).not.toContain('spin.reveal');
  });

  it('CEREMONY_EVENTS is exactly the one event `reveal_spin` emits', () => {
    expect([...CEREMONY_EVENTS]).toEqual(['spin.reveal']);
  });

  it('⛔ no event appears in BOTH lists', () => {
    const shared = (NUDGE_EVENTS as readonly string[]).filter((e) =>
      (CEREMONY_EVENTS as readonly string[]).includes(e),
    );
    expect(shared).toEqual([]);
    // Non-vacuity: both lists are non-empty, so an empty intersection means something.
    expect(NUDGE_EVENTS.length).toBeGreaterThan(0);
    expect(CEREMONY_EVENTS.length).toBeGreaterThan(0);
  });

  it('the topics are spelled once, and ⚠ `<id>` is the CEREMONY id, not the tournament id', () => {
    // `0028:857-859` — `tournament:<id>` already carries the tournament axis, and a viewer learns the
    // ceremony id from the published `ceremony` row, so the channel is reachable from a published
    // read alone (AD-11).
    expect(ceremonyTopic(77)).toBe('ceremony:77');
    expect(tournamentTopic(9)).toBe('tournament:9');
    expect(ceremonyTopic(9)).not.toBe(tournamentTopic(9));
  });
});