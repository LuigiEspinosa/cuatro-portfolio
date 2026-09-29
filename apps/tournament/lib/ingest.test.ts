import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseRegisterBody, recordManualUpload } from '@/lib/ingest';

const STORAGE_KEY = 'demos/42/9f8e7d6c5b4a.dem';

/**
 * A chainable + thenable PostgrestFilterBuilder stub (same shape as roster.test.ts). `insert` records
 * its call and returns the builder; awaiting the builder resolves to the configured result. Records
 * each op so tests can assert the exact write shape (or that no write happened).
 */
interface QueryBuilder {
  insert: (...a: unknown[]) => QueryBuilder;
  then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise<unknown>;
}

function makeAdmin(plan: Record<string, Array<{ data?: unknown; error?: unknown }>> = {}) {
  const ops: { table: string; method: string; args: unknown[] }[] = [];
  const queues: Record<string, Array<{ data?: unknown; error?: unknown }>> = {};
  for (const [t, rs] of Object.entries(plan)) queues[t] = [...rs];

  function makeBuilder(table: string, result: { data?: unknown; error?: unknown }): QueryBuilder {
    const builder = {} as QueryBuilder;
    builder.insert = (...args: unknown[]) => {
      ops.push({ table, method: 'insert', args });
      return builder;
    };
    builder.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
    return builder;
  }

  const from = vi.fn((table: string) => {
    const q = queues[table];
    const result = q && q.length ? q.shift()! : { data: null, error: null };
    return makeBuilder(table, result);
  });
  const admin = { from } as unknown as SupabaseClient;
  const opsFor = (table: string, method: string) =>
    ops.filter((o) => o.table === table && o.method === method);
  return { admin, from, opsFor };
}

describe('parseRegisterBody (AC2 — the tiny notify body validation)', () => {
  it('accepts a well-formed { match_id, storage_key }', () => {
    expect(parseRegisterBody({ match_id: 42, storage_key: STORAGE_KEY })).toEqual({
      match_id: 42,
      storage_key: STORAGE_KEY,
    });
  });

  it('rejects a non-object', () => {
    expect(parseRegisterBody(null)).toBeNull();
    expect(parseRegisterBody('nope')).toBeNull();
  });

  it('rejects a missing / non-integer / non-positive match_id', () => {
    expect(parseRegisterBody({ storage_key: STORAGE_KEY })).toBeNull();
    expect(parseRegisterBody({ match_id: 1.5, storage_key: STORAGE_KEY })).toBeNull();
    expect(parseRegisterBody({ match_id: 0, storage_key: STORAGE_KEY })).toBeNull();
    expect(parseRegisterBody({ match_id: -3, storage_key: STORAGE_KEY })).toBeNull();
    expect(parseRegisterBody({ match_id: '42', storage_key: STORAGE_KEY })).toBeNull();
  });

  it('rejects a missing / empty / non-string storage_key', () => {
    expect(parseRegisterBody({ match_id: 42 })).toBeNull();
    expect(parseRegisterBody({ match_id: 42, storage_key: '' })).toBeNull();
    expect(parseRegisterBody({ match_id: 42, storage_key: '   ' })).toBeNull();
    expect(parseRegisterBody({ match_id: 42, storage_key: 123 })).toBeNull();
  });
});

describe('recordManualUpload (AC2/AC7 — service-role demo insert; the one app-side demo write)', () => {
  it('inserts the acquisition row shape (source=manual_upload, backend r2; sha256/size NULL shells)', async () => {
    const { admin, opsFor } = makeAdmin({ demo: [{ error: null }] });
    const result = await recordManualUpload(admin, { matchId: 42, storageKey: STORAGE_KEY });
    expect(result).toEqual({ ok: true });

    const insert = opsFor('demo', 'insert');
    expect(insert).toHaveLength(1);
    // The wire field is still `match_id` (the worker's presign→register contract is unchanged), but it
    // lands in `matchzy_match_id` — the EXTERNAL ingest id. `demo.match_id` is the bracket FK added by
    // migration 0010 and stays NULL until Story 4.6 (Aprobar) binds this demo to the match it decided;
    // writing the MatchZy id into it would 23503 on every single ingest.
    expect(insert[0].args[0]).toEqual({
      matchzy_match_id: 42,
      storage_backend: 'r2',
      storage_key: STORAGE_KEY,
      source: 'manual_upload',
    });
    expect(insert[0].args[0]).not.toHaveProperty('match_id');
  });

  it('maps a write error to write_failed (the route maps it to 500)', async () => {
    const { admin } = makeAdmin({ demo: [{ error: { code: 'XYZ', message: 'boom' } }] });
    expect(await recordManualUpload(admin, { matchId: 42, storageKey: STORAGE_KEY })).toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});
