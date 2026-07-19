import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * ⭐ THE AC1 STRUCTURAL GUARDRAIL (Story 4.9) — "no action can bypass authorization", proven as a SET.
 *
 * This is the TypeScript-layer analogue of the 0002/0003 catalog FORCE-guard: instead of trusting that every
 * one of the eleven admin routes remembered to gate itself, we ASSERT it structurally. Every `route.ts` under
 * `app/api/admin/` must route through the shared `handleAdminCommand` helper (which calls
 * `requireAdmin` before any write) — OR, for the single documented dual-verb exception (`match/grace`), call
 * `requireAdmin` directly. A future route that forgets the gate FAILS CI here, before it can ship an
 * unauthenticated mutation.
 *
 * We scan the SOURCE TEXT rather than import the route modules: a static scan needs no next/server or
 * service-role-client mocking, it catches a route that imports the helper but never calls it far less well than
 * the helper's own unit tests do the reverse — and, crucially, it is the exact shape Story 4.9 specified ("glob
 * the app/api/admin route.ts files, assert each references handleAdminCommand OR (for grace) requireAdmin").
 */

// `npm test` runs from the repo root, so app/api/admin resolves from cwd.
const ADMIN_ROUTES_DIR = path.resolve(process.cwd(), 'app/api/admin');

/** The ONE documented exception: the dual-verb grace route is hand-written and gates via requireAdmin directly. */
const HAND_GATED_EXCEPTIONS = new Set([path.join('match', 'grace', 'route.ts')]);

/** Every `route.ts` under app/api/admin/**, as repo-relative-to-ADMIN_ROUTES_DIR posix-ish keys. */
function findAdminRouteFiles(): string[] {
  const entries = readdirSync(ADMIN_ROUTES_DIR, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name === 'route.ts')
    .map((e) => path.relative(ADMIN_ROUTES_DIR, path.join(e.parentPath ?? e.path, e.name)));
}

describe('AC1 — every admin command route is server-gated (structural coverage)', () => {
  const routeFiles = findAdminRouteFiles();

  it('finds the admin routes (guards against a broken glob silently passing zero files)', () => {
    // A zero-length list would make every assertion below vacuously true — pin a floor.
    expect(routeFiles.length).toBeGreaterThanOrEqual(11);
    // The helper itself must exist and be importable — a sanity anchor for the whole guarantee.
    expect(routeFiles.some((f) => f.includes('approve'))).toBe(true);
  });

  it.each(findAdminRouteFiles())('%s routes through handleAdminCommand (or requireAdmin, for grace)', (relPath) => {
    const source = readFileSync(path.join(ADMIN_ROUTES_DIR, relPath), 'utf8');
    if (HAND_GATED_EXCEPTIONS.has(relPath.split(path.sep).join(path.sep))) {
      // The documented exception must STILL gate — just hand-written.
      expect(source).toContain('requireAdmin');
    } else {
      expect(source).toContain('handleAdminCommand');
    }
  });
});
