import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchVerificationBundle, fetchViewerCeremony } from '@/lib/ceremony/verification';

/**
 * The viewer's read of the published verification bundle (Story 6.9b, AC5/AC6).
 *
 * ⚠ COLOCATED UNDER `lib/` ON PURPOSE — `vitest.config.ts:17` restricts collection to test files
 * under `lib`, so a test written beside the page under `app/` would SILENTLY NEVER RUN.
 */

/** Deliberately not 1, so an id/index mix-up cannot pass silently (the lib/match/*.test.ts convention). */
const CEREMONY = 77;
/** A third distinct number, so a tournament/ceremony mix-up cannot pass silently either. */
const TOURNAMENT = 9;
const SHA = 'a'.repeat(64);
const SEED = 'b'.repeat(64);

const BUNDLE = { algo_version: 'inclusivcup-roulette-1.0.0', seed_hex: SEED };

const OK = {
  ok: true,
  ceremony_id: CEREMONY,
  ceremony_state: 'spinning',
  bundle_sha256: SHA,
  published_at: '2026-08-10T19:40:17.773739+00:00',
  released_at: null,
  complete: false,
  revealed_spins: 3,
  total_spins: 40,
  bundle: BUNDLE,
};

function makeClient(rpcResult: { data?: unknown; error?: unknown } = { data: OK, error: null }) {
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const from = vi.fn(() => {
    throw new Error('fetchVerificationBundle must not read tables — the RPC is the authority');
  });
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe('fetchVerificationBundle — the RPC call (AC5)', () => {
  it('calls verification_bundle_read with ONE argument and nothing else', async () => {
    const { client, rpc } = makeClient();
    await fetchVerificationBundle(client, CEREMONY);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe('verification_bundle_read');
    // ⛔ `0029:1391-1393` FORBIDS A SECOND PARAMETER, and `0029:1638` says why in the function's own
    // comment: "IF YOU EVER WIDEN THIS, YOU HAVE BROKEN AD-22." A reader that grew a
    // `p_include_unrevealed` would be the widening, in the one place nobody would look for it.
    expect(args).toEqual({ p_ceremony_id: CEREMONY });
    expect(Object.keys(args as object)).toHaveLength(1);
  });

  it('returns the envelope, field by field', async () => {
    const { client } = makeClient();
    const result = await fetchVerificationBundle(client, CEREMONY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope).toEqual({
      ceremonyId: CEREMONY,
      ceremonyState: 'spinning',
      bundleSha256: SHA,
      publishedAt: OK.published_at,
      releasedAt: null,
      complete: false,
      revealedSpins: 3,
      totalSpins: 40,
      bundle: BUNDLE,
    });
  });

  it('does not read tables — the projection is the sole authority', async () => {
    const { client, from } = makeClient();
    await fetchVerificationBundle(client, CEREMONY);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('fetchVerificationBundle — the closed refusal set (AC6)', () => {
  const SQL_REASONS = ['no_ceremony', 'not_published'] as const;

  it('the refusal table is non-empty', () => {
    expect(SQL_REASONS.length).toBeGreaterThan(0);
  });

  it.each(SQL_REASONS)('surfaces the RPC refusal %s verbatim', async (reason) => {
    const { client } = makeClient({ data: { ok: false, reason, ceremony_id: CEREMONY }, error: null });
    const result = await fetchVerificationBundle(client, CEREMONY);
    expect(result).toEqual({ ok: false, reason });
  });

  /**
   * ⛔⛔ THE CROSS-CHECK, READ FROM THE MIGRATION ITSELF. The lib's set and the SQL's set are two
   * halves of one contract, and a hand-copied expected list would pass for whatever the lib happens
   * to say. `reveal.test.ts` established this shape; the failure it exists to catch is a reason
   * added on ONE side, which compiles, ships, and reaches the route's `?? 500` backstop as an opaque
   * error on exactly the path the typed set was written for.
   */
  it('the SQL function returns exactly the reasons this lib models', () => {
    const sql = readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '0029_verification_bundle.sql'),
      'utf8',
    );
    const start = sql.indexOf('create function public.verification_bundle_read');
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf('comment on function public.verification_bundle_read', start);
    expect(end).toBeGreaterThan(start);
    const body = sql.slice(start, end);

    // Every `'reason', '<token>'` the function can return.
    const found = [...body.matchAll(/'reason',\s*'([a-z_]+)'/g)].map((m) => m[1] as string);
    expect(found.length).toBeGreaterThan(0);
    expect([...new Set(found)].sort()).toEqual([...SQL_REASONS].sort());
  });

  it("`read_failed` is the lib's OWN reason and the SQL never returns it", () => {
    const sql = readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '0029_verification_bundle.sql'),
      'utf8',
    );
    const start = sql.indexOf('create function public.verification_bundle_read');
    const end = sql.indexOf('comment on function public.verification_bundle_read', start);
    expect(sql.slice(start, end)).not.toContain('read_failed');
  });
});

describe('fetchVerificationBundle — fails CLOSED', () => {
  const CLOSED: readonly (readonly [string, { data?: unknown; error?: unknown }])[] = [
    ['a transport error', { data: null, error: { message: 'boom' } }],
    ['a null reply', { data: null, error: null }],
    ['a non-object reply', { data: 42, error: null }],
    ['an array reply', { data: [], error: null }],
    ['an unrecognised refusal', { data: { ok: false, reason: 'something_new' }, error: null }],
    ['a refusal with no reason', { data: { ok: false }, error: null }],
    // ⛔⛔ THE ONE THAT MATTERS MOST. `bundleSha256` is what a viewer hashes against for the life of
    // the tournament; an ok reply missing it would hand the island nothing to compare with, and the
    // strip would render a verification that checked nothing while looking exactly like one that
    // checked everything.
    ['an ok reply with no bundle_sha256', { data: { ...OK, bundle_sha256: undefined }, error: null }],
    ['an ok reply with an EMPTY bundle_sha256', { data: { ...OK, bundle_sha256: '' }, error: null }],
    ['an ok reply with no bundle', { data: { ...OK, bundle: undefined }, error: null }],
    ['an ok reply with a null bundle', { data: { ...OK, bundle: null }, error: null }],
    ['an ok reply with a non-numeric ceremony_id', { data: { ...OK, ceremony_id: '77' }, error: null }],
    ['an ok reply with a non-boolean complete', { data: { ...OK, complete: 'no' }, error: null }],
    ['an ok reply with a non-numeric revealed_spins', { data: { ...OK, revealed_spins: null }, error: null }],
    ['an ok reply with a released_at that is neither text nor null', { data: { ...OK, released_at: 7 }, error: null }],
    // ⚠ `complete` and `ceremony_state` are two spellings of one fact (`0029:1498`), so a
    // disagreement means this is not the projection the reader was written against.
    ['complete disagreeing with ceremony_state', { data: { ...OK, complete: true }, error: null }],
    ['ceremony_state complete while complete is false', { data: { ...OK, ceremony_state: 'complete' }, error: null }],

    // ── 6.9b CODE REVIEW — the shape checks that were weaker than the rest of the tree ──
    //
    // ⛔ `bundle` WAS THE ONE FIELD WITH NO TYPE CHECK AT ALL, only `!== undefined && !== null`. A
    // scalar or array `payload` passed, the strip rendered a real-looking commitment, and the tap
    // came back `bundle_shape` → *"No coincide"* — the viewer told the ceremony does not match
    // ITSELF, where this reader's own fail-closed doctrine wants `read_failed` and the Placeholder.
    ['an ok reply whose bundle is a scalar', { data: { ...OK, bundle: 42 }, error: null }],
    ['an ok reply whose bundle is a string', { data: { ...OK, bundle: 'x' }, error: null }],
    ['an ok reply whose bundle is an array', { data: { ...OK, bundle: [] }, error: null }],
    // ⚠ `bundle_sha256` was only checked NON-EMPTY. `verify.ts` compares it with `===` against a
    // lowercase hex digest, so anything that is not 64 lowercase hex can only ever produce a FALSE
    // mismatch — the ceremony accused of tampering because the read was malformed.
    ['an ok reply with a short bundle_sha256', { data: { ...OK, bundle_sha256: 'abc123' }, error: null }],
    ['an ok reply with an UPPERCASE bundle_sha256', { data: { ...OK, bundle_sha256: 'A'.repeat(64) }, error: null }],
    ['an ok reply with a non-hex bundle_sha256', { data: { ...OK, bundle_sha256: 'z'.repeat(64) }, error: null }],
    // ⚠ The three numerics accepted NaN, Infinity, fractions and negatives, where the engine uses
    // `Number.isSafeInteger` throughout.
    ['an ok reply with a NaN revealed_spins', { data: { ...OK, revealed_spins: Number.NaN }, error: null }],
    ['an ok reply with an Infinite total_spins', { data: { ...OK, total_spins: Number.POSITIVE_INFINITY }, error: null }],
    ['an ok reply with a fractional revealed_spins', { data: { ...OK, revealed_spins: 1.5 }, error: null }],
    ['an ok reply with a negative total_spins', { data: { ...OK, total_spins: -1 }, error: null }],
  ];

  it('the fail-closed table is non-empty and every row is distinct', () => {
    expect(CLOSED.length).toBeGreaterThan(0);
    expect(new Set(CLOSED.map(([n]) => n)).size).toBe(CLOSED.length);
  });

  it.each(CLOSED.map(([n, r]) => [n, r] as const))('%s becomes read_failed', async (_name, rpcResult) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { client } = makeClient(rpcResult);
      const result = await fetchVerificationBundle(client, CEREMONY);
      expect(result).toEqual({ ok: false, reason: 'read_failed' });
      // ⚠ AND IT SAYS SO. A silent fail-closed is indistinguishable from a working read that found
      // nothing, which is how a broken projection stays broken.
      expect(errorSpy).toHaveBeenCalled();
      expect(String(errorSpy.mock.calls[0]![0])).toContain('[fetchVerificationBundle]');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('a complete ceremony with both fields agreeing is accepted', () => {
    // The positive control for the cross-check above: it must not be refusing every complete
    // ceremony, which would make the whole verify surface unreachable at the one moment it matters.
    const { client } = makeClient({
      data: { ...OK, complete: true, ceremony_state: 'complete', released_at: OK.published_at },
      error: null,
    });
    return fetchVerificationBundle(client, CEREMONY).then((r) => {
      expect(r.ok).toBe(true);
    });
  });
});

// ── the anon ceremony read (DECISION P) ───────────────────────────────────────

function makeTableClient(result: { data?: unknown; error?: unknown }) {
  const maybeSingle = vi.fn(() => Promise.resolve(result));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, eq, maybeSingle };
}

describe('fetchViewerCeremony — the anon column grant (DECISION P)', () => {
  it('names the granted columns EXPLICITLY and never selects *', async () => {
    const { client, from, select, eq } = makeTableClient({
      data: { id: CEREMONY, state: 'spinning', seed_demo_sha256: SEED },
      error: null,
    });
    await fetchViewerCeremony(client, TOURNAMENT);
    expect(from).toHaveBeenCalledWith('ceremony');
    const columns = select.mock.calls[0]![0] as string;
    // ⛔⛔ `0028:485-490` — PostgREST's default `select=*` asks for EVERY column, so an anon request
    // 42501s on the four UNGRANTED ones even though the row is visible. `spin_plan` alone names each
    // spin's candidate award POOL, which IS the "per-spin live-category sets" AD-22 gates by name.
    expect(columns).not.toContain('*');
    for (const granted of ['id', 'state', 'seed_demo_sha256']) {
      expect(columns).toContain(granted);
    }
    for (const ungranted of ['snapshot_id', 'spin_plan', 'luck_weight_table', 'algorithm_version']) {
      expect(columns).not.toContain(ungranted);
    }
    expect(eq).toHaveBeenCalledWith('tournament_id', TOURNAMENT);
  });

  it('carries the published seed so the verifier can cross-check it', async () => {
    const { client } = makeTableClient({
      data: { id: CEREMONY, state: 'spinning', seed_demo_sha256: SEED },
      error: null,
    });
    const result = await fetchViewerCeremony(client, TOURNAMENT);
    expect(result).toEqual({ ok: true, ceremony: { id: CEREMONY, state: 'spinning', seedDemoSha256: SEED } });
  });

  it('a NULL seed is carried as null rather than substituted', async () => {
    // ⚠ A null means DECISION P's cross-check has nothing to compare. Saying so by omission is the
    // honest answer; substituting a value would make the verifier compare the seed against itself.
    const { client } = makeTableClient({
      data: { id: CEREMONY, state: 'locked', seed_demo_sha256: null },
      error: null,
    });
    const result = await fetchViewerCeremony(client, TOURNAMENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ceremony.seedDemoSha256).toBeNull();
  });

  it('no row is no_ceremony — the reveal gate working, not an error', async () => {
    const { client } = makeTableClient({ data: null, error: null });
    expect(await fetchViewerCeremony(client, TOURNAMENT)).toEqual({ ok: false, reason: 'no_ceremony' });
  });

  const BAD_ROWS: readonly (readonly [string, unknown])[] = [
    ['a transport error', undefined],
    ['a non-numeric id', { id: '77', state: 'spinning', seed_demo_sha256: SEED }],
    ['a non-string state', { id: CEREMONY, state: 7, seed_demo_sha256: SEED }],
    ['a seed that is neither text nor null', { id: CEREMONY, state: 'spinning', seed_demo_sha256: 7 }],
  ];
  it('the bad-row table is non-empty', () => {
    expect(BAD_ROWS.length).toBeGreaterThan(0);
  });
  it.each(BAD_ROWS)('%s becomes read_failed', async (name, data) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { client } = makeTableClient(
        name === 'a transport error' ? { data: null, error: { message: 'boom' } } : { data, error: null },
      );
      expect(await fetchViewerCeremony(client, TOURNAMENT)).toEqual({ ok: false, reason: 'read_failed' });
      expect(String(errorSpy.mock.calls[0]![0])).toContain('[fetchViewerCeremony]');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
