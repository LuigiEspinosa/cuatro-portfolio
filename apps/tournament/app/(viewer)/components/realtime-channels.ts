import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { Clock } from '@/lib/realtime/status';
import { type ChannelLike, type ChannelRuntime, createChannelStore } from '@/lib/realtime/channels';

/**
 * The BROWSER binding of the topic-keyed realtime store (Story 6.10, DECISION W).
 *
 * ⭐ GLUE ONLY — every decision lives in `lib/realtime/channels.ts` (DECISION X). This file exists
 * because `createSupabaseBrowserClient()` and `window` are browser facts and the store must stay
 * testable without either. ⛔ Do not add logic here: anything with a branch worth asserting belongs in
 * the `lib/` module, where `vitest.config.ts` can actually collect it.
 */

/** The real browser clock (`window.setTimeout` returns `number` = our `TimerHandle`). */
const browserClock: Clock = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

const browserRuntime: ChannelRuntime = {
  clock: browserClock,
  // ⚠ `private: false` is the default and is correct for BOTH topics: `tournament:<id>` is public,
  // and `ceremony:<id>` is "public once started" (`SPINE:133`) — `reveal_spin` emits with
  // `private => false` (`0028:885`) and only ever while the ceremony is `spinning`.
  createChannel: (topic) => createSupabaseBrowserClient().channel(topic) as unknown as ChannelLike,
  removeChannel: (channel) => createSupabaseBrowserClient().removeChannel(channel as never),
  log: (topic, event) => {
    if (process.env.NODE_ENV !== 'production') console.debug('[realtime] nudge', topic, event);
  },
};

const store = createChannelStore(browserRuntime);

export const retainChannel = store.retainChannel;
export const releaseChannel = store.releaseChannel;
export const subscribeChannelStatus = store.subscribeChannelStatus;
export const channelStatus = store.channelStatus;
