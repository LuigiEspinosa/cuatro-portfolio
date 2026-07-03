// Test stub for the `server-only` package. In a real Next.js build `import 'server-only'`
// throws if a Server-only module is pulled into a Client Component; under Vitest (plain
// Node, no react-server condition) that guard would throw on import and make server-only
// modules (lib/auth/session.ts, lib/auth/roles.ts, lib/players.ts, lib/env.ts, …)
// untestable. vitest.config.ts aliases `server-only` to this no-op so they can be unit-tested.
export {};
