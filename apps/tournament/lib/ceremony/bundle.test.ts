import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publishBundle } from '@/lib/ceremony/bundle';

/**
 * ⚠ COLOCATED AT `lib/ceremony/bundle.test.ts` ON PURPOSE. `vitest.config.ts:17` collects only
 * `lib/**\/*.test.ts`, so a test written next to the route under `app/` would SILENTLY NEVER RUN.
 * The route's numeric `STATUS_FOR` values stay untested for exactly that reason, as every other
 * route's do (`deferred-work.md:279`, Epic 7's) — that is stated in the route file rather than
 * papered over here.
 */

const ADMIN = '76561198388441171';
/** Deliberately not 1, so an id/index mix-up cannot pass silently (the lib/match/*.test.ts convention). */
const CEREMONY = 77;
/** Deliberately different from the ceremony id AND from the byte count — three adjacent numbers. */
const BUNDLE_ID = 4242;
const SHA = 'a'.repeat(64);
const PAYLOAD = '{"algo_version":"inclusivcup-roulette-1.0.0"}';

const OK = {
  ok: true,
  ceremony_id: CEREMONY,
  bundle_id: BUNDLE_ID,
  bundle_sha256: SHA,
  algorithm_version: 'inclusivcup-roulette-1.0.0',
  payload_bytes: 45,
  spins: 40,
  awards: 12,
  players: 28,
  published_at: '2026-08-08T19:40:17.773739+00:00',
};

/**
 * The `.rpc()` seam mock (lib/ceremony/reveal.test.ts's shape). The wrapper does NO table reads — the
 * RPC is the sole authority — so `from` is wired only to PIN that fact: a convenience pre-read ("does
 * this ceremony already have a bundle?") would run OUTSIDE the RPC's transaction and be stale by the
 * time the RPC took its locks, which is the whole reason the guard lives in SQL.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: OK, error: null }) {
  const from = vi.fn(() => {
    throw new Error('publishBundle must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

const call = (admin: SupabaseClient) =>
  publishBundle(admin, {
    actingAdmin: ADMIN,
    ceremonyId: CEREMONY,
    payload: PAYLOAD,
    bundleSha256: SHA,
  });

describe('publishBundle — the RPC payload (AC4)', () => {
  it('calls publish_bundle with the EXACT snake_case arguments and nothing else', async () => {
    const { admin, rpc, from } = makeAdmin();
    await call(admin);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('publish_bundle');
    expect(args).toEqual({
      p_ceremony_id: CEREMONY,
      p_payload: PAYLOAD,
      p_bundle_sha256: SHA,
      p_actor: ADMIN,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('sends the payload as a STRING, byte-for-byte — the canonical bytes ARE the artifact', async () => {
    // ⛔ Re-serialising a parsed object would reorder keys and change every byte of the hash, so the
    // one thing this seam must never do is touch the payload. Asserting identity (not equality) is
    // what makes "byte-for-byte" falsifiable: a `JSON.stringify(JSON.parse(x))` round trip would
    // produce an equal-looking string that is a different object.
    const weird = '{"b":2,"a":1}'; // deliberately NOT in canonical key order
    const { admin, rpc } = makeAdmin();
    await publishBundle(admin, {
      actingAdmin: ADMIN,
      ceremonyId: CEREMONY,
      payload: weird,
      bundleSha256: SHA,
    });
    expect(rpc.mock.calls[0][1].p_payload).toBe(weird);
  });

  it('surfaces the ok payload with the commitment intact', async () => {
    const { admin } = makeAdmin();
    await expect(call(admin)).resolves.toEqual({
      ok: true,
      ceremonyId: CEREMONY,
      bundleId: BUNDLE_ID,
      bundleSha256: SHA,
      algorithmVersion: 'inclusivcup-roulette-1.0.0',
      payloadBytes: 45,
      spins: 40,
      awards: 12,
      players: 28,
      publishedAt: '2026-08-08T19:40:17.773739+00:00',
    });
  });
});

describe('publishBundle — typed refusals surfaced verbatim, nothing written (AC4)', () => {
  it.each([
    'no_ceremony',
    'ceremony_not_spinning',
    // ⭐ one bundle per ceremony — the commitment is singular or it is not a commitment.
    'already_published',
    // ⭐ the mirror of reveal_spin's `bundle_not_published`: too late, an outcome is already public.
    'reveal_in_progress',
    'snapshot_missing',
    'seed_missing',
    'no_spins',
    // ⭐ B9 — the RPC re-derives the hash. This is the refusal that fires when a producer's own hash
    // does not match its own bytes, i.e. the one bug that publishes a commitment binding nothing.
    'bundle_mismatch',
    'non_ascii_payload',
    'payload_shape',
    'seed_mismatch',
    'algo_version_mismatch',
    // ⭐ closes deferred-work.md:362 — the (spin_id, award_id) UNIQUE is PER SPIN.
    'award_revealed_twice',
    'unknown_actor',
  ])('surfaces `%s` verbatim', async (reason) => {
    const { admin, rpc } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(call(admin)).resolves.toEqual({ ok: false, reason });
    // Exactly one RPC call and no table access: a refusal costs one round trip and writes nothing.
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('carries BOTH hashes out of a bundle_mismatch — which stage drifted, not just that one did', async () => {
    const { admin } = makeAdmin({
      data: {
        ok: false,
        reason: 'bundle_mismatch',
        computed_sha256: 'b'.repeat(64),
        claimed_sha256: SHA,
      },
      error: null,
    });
    await expect(call(admin)).resolves.toEqual({
      ok: false,
      reason: 'bundle_mismatch',
      computedSha256: 'b'.repeat(64),
      claimedSha256: SHA,
    });
  });

  it('carries `detail` out of a payload_shape refusal — eight checks share that one reason', async () => {
    const { admin } = makeAdmin({
      data: { ok: false, reason: 'payload_shape', detail: 'missing top-level keys', keys: 'pity' },
      error: null,
    });
    await expect(call(admin)).resolves.toEqual({
      ok: false,
      reason: 'payload_shape',
      detail: 'missing top-level keys',
    });
  });

  it('a refusal carrying NO context stays exactly {ok:false, reason}', async () => {
    // The context fields are copied ONLY when the RPC actually sent them — otherwise a refusal would
    // sprout `undefined` keys and `toEqual` comparisons downstream would drift.
    const { admin } = makeAdmin({ data: { ok: false, reason: 'no_spins' }, error: null });
    await expect(call(admin)).resolves.toEqual({ ok: false, reason: 'no_spins' });
  });

  it('fails CLOSED on an unrecognised refusal reason (never invents an ok)', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(call(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails closed on a null reply', async () => {
    const { admin } = makeAdmin({ data: null, error: null });
    await expect(call(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it("maps a transport/SQL error to write_failed, including 0029's OWN IC912, and maps no other lib's code", async () => {
    // ⭐ IC912 is 0029's and is deliberately NOT given a friendly reason: it means somebody tried to
    // EDIT an already-published commitment, i.e. to rewrite bytes viewers have already hashed. A 500
    // is the honest answer. IC901–IC911 belong to walkover/approve/rollback/manual-score/fair-seed/
    // ceremony-transition/reveal-order; P0001 is lib/match/format.ts's.
    for (const code of ['IC912', 'IC911', 'IC910', 'P0001', 'IC903', 'IC908', '23514', '42501']) {
      const { admin } = makeAdmin({ data: null, error: { code, message: `boom ${code}` } });
      await expect(call(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
    }
  });
});

describe('the module is SERVER-ONLY', () => {
  it("declares `import 'server-only'` — this module holds the service-role seam that publishes the commitment", () => {
    // `server-only` only throws when a CLIENT component imports it, so the bundler is the real
    // enforcement and no runtime test can exercise it. Deleting the import reddens NOTHING (the 6.1
    // review's finding, and its honest caveat). Asserting on the SOURCE is what makes the guard
    // non-removable in silence.
    const source = readFileSync(new URL('./bundle.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/^\s*import 'server-only';/m);
  });
});

describe('publishBundle — the ok payload is VALIDATED before it is trusted', () => {
  it('rejects an ok reply missing any usable field (no silent success)', async () => {
    // ⛔ THIS MATTERS MORE HERE THAN ANYWHERE THIS PATTERN HAS BEEN APPLIED BEFORE. `bundle_sha256` is
    // the value a viewer hashes against for the life of the tournament; a "successful" publish that
    // returned `undefined` for it would hand the caller nothing to record and no way to know.
    for (const data of [
      { ok: true },
      { ...OK, ceremony_id: undefined },
      { ...OK, bundle_id: undefined },
      { ...OK, bundle_id: '4242' }, // a string id is not an id
      { ...OK, bundle_sha256: undefined },
      { ...OK, bundle_sha256: 42 },
      { ...OK, algorithm_version: undefined },
      { ...OK, payload_bytes: undefined },
      { ...OK, payload_bytes: '45' },
      { ...OK, spins: undefined },
      { ...OK, awards: undefined },
      { ...OK, players: undefined },
      { ...OK, published_at: undefined },
    ]) {
      const { admin } = makeAdmin({ data, error: null });
      await expect(call(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
    }
  });

  it('accepts awards = 0 and players = 0 as a SUCCESS — they are counts, not flags', async () => {
    // ⚠ The one shape a truthiness check gets wrong. A zero-award ceremony is degenerate but it is
    // not a failure, and reading `0` as "missing" would turn a valid publish into an opaque 500.
    const { admin } = makeAdmin({ data: { ...OK, awards: 0, players: 0 }, error: null });
    await expect(call(admin)).resolves.toMatchObject({ ok: true, awards: 0, players: 0 });
  });
});

/**
 * ⭐⭐ GUARD THE GUARDS — the project's signature defect, at its eighth recorded occurrence
 * (`6-8a:909`: "`if len(inputReachable) != 6` measures the size of a map literal written two lines
 * above it, and nothing in the test reads `ceremony.go`"). The `it.each` list above is a HAND-WRITTEN
 * list, so on its own it can only prove that the reasons SOMEBODY THOUGHT OF are handled. This block
 * reads BOTH sides from SOURCE — the reasons the migration actually returns, and the reasons the lib
 * actually trusts — and asserts they are the same set in BOTH directions. Neither side is a copy of
 * anything in this file.
 */
describe('the trusted reason set is the migration’s reason set — read from source, both directions', () => {
  const MIGRATIONS_DIR = new URL('../../supabase/migrations/', import.meta.url);
  const LIB = new URL('./bundle.ts', import.meta.url);

  /**
   * ⭐ THE **LATEST** DEFINITION WINS, AND FINDING IT IS PART OF THE TEST. Naming a migration file
   * here would compare the live lib against a body a later `create or replace` had superseded — the
   * trap reveal.test.ts walked into the moment 0029 replaced `reveal_spin`. Every migration is
   * scanned and the highest-numbered definition is authoritative, exactly as PostgreSQL's own
   * `create or replace` semantics say.
   */
  function latestPublishBundleSource(): { file: string; sql: string; start: number } {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // zero-padded numeric prefixes, so lexicographic IS numeric order
    expect(files.length).toBeGreaterThan(0);

    // ⛔ 6.9a CODE REVIEW — `lastIndexOf`, and the marker loop takes the latest POSITION rather
    // than the last marker checked. `indexOf` returns the FIRST definition, so a migration that
    // replaces the function twice would have measured the superseded body while staying green —
    // the same trap this helper exists to close, one level in.
    let latest: { file: string; sql: string; start: number } | null = null;
    for (const file of files) {
      const sql = readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8');
      let best = -1;
      for (const marker of [
        'create function public.publish_bundle(',
        'create or replace function public.publish_bundle(',
      ]) {
        const start = sql.lastIndexOf(marker);
        if (start > best) best = start;
      }
      if (best > -1) latest = { file, sql, start: best };
    }
    expect(latest, 'no migration defines public.publish_bundle').not.toBeNull();
    return latest!;
  }

  /** The `publish_bundle` body ONLY — 0029 also replaces three unrelated RPCs whose reasons are not ours. */
  function publishBundleBody(): string {
    const { sql, start } = latestPublishBundleSource();
    const end = sql.indexOf('comment on function public.publish_bundle(', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return (
      sql
        .slice(start, end)
        .split('\n')
        // Strip comment lines: the header lists the closed set in prose, and a prose list is not evidence.
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
    );
  }

  function migrationReasons(): string[] {
    const matches = [...publishBundleBody().matchAll(/'reason',\s*'([a-z_]+)'/g)].map((m) => m[1]);
    // ⚠ ASSERT THE COUNT BEFORE THE SET. "All of these are present" assertions pass vacuously over an
    // EMPTY match list (6.8a's review), and so would a set comparison of [] against [] if the slice
    // above ever stopped matching. A non-trivial count is what makes the comparison mean anything.
    expect(matches.length).toBeGreaterThanOrEqual(14);
    return [...new Set(matches)].sort();
  }

  function libReasons(): string[] {
    const src = readFileSync(LIB, 'utf8');
    const block = /const PUBLISH_REASONS = new Set\(\[([\s\S]*?)\]/.exec(src);
    expect(block).not.toBeNull();
    const found = [
      ...block![1]
        .split('\n')
        // Strip comment lines, exactly as publishBundleBody() does for the SQL side: a reason named in
        // prose beside the list is not evidence that the list contains it.
        .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
        .join('\n')
        .matchAll(/'([a-z_]+)'/g),
    ].map((m) => m[1]);
    expect(found.length).toBeGreaterThanOrEqual(14);
    return [...new Set(found)].sort();
  }

  it('every reason publish_bundle RETURNS is trusted by the lib (a new SQL refusal cannot fail closed silently)', () => {
    expect(libReasons()).toEqual(expect.arrayContaining(migrationReasons()));
  });

  it('every reason the lib trusts is one publish_bundle can actually RETURN (no phantom reason)', () => {
    expect(migrationReasons()).toEqual(expect.arrayContaining(libReasons()));
  });

  it('the two sets are EXACTLY equal, and non-empty', () => {
    const sql = migrationReasons();
    expect(sql.length).toBeGreaterThan(0);
    expect(libReasons()).toEqual(sql);
  });

  it('`write_failed` is the lib’s OWN fail-closed reason and is NOT in the SQL set', () => {
    // It is the reason a transport error, a null reply, an unrecognised refusal or a malformed ok maps
    // to. If it ever appeared in the migration, the two-direction equality above would silently start
    // allowing the lib to pass a database refusal through as its own fail-closed value.
    expect(migrationReasons()).not.toContain('write_failed');
    expect(libReasons()).not.toContain('write_failed');
  });

  it('the it.each list above covers every reason the migration returns (no hand-written gap)', () => {
    // ⚠ The hand-written list is still worth having — it proves each reason survives the round trip —
    // but only if it stays complete. This is what keeps it honest.
    const src = readFileSync(new URL('./bundle.test.ts', import.meta.url), 'utf8');
    const block = /it\.each\(\[([\s\S]*?)\]\)\('surfaces/.exec(src);
    expect(block).not.toBeNull();
    const listed = [
      ...block![1]
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n')
        .matchAll(/'([a-z_]+)'/g),
    ].map((m) => m[1]);
    expect([...new Set(listed)].sort()).toEqual(migrationReasons());
  });
});
