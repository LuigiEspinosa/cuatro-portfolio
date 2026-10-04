import { env } from '@/lib/env'

// The demo principal's ownership scope is its own Postgres schema in this application's own database
// (AD-10: same database, same role). Every row it owns lives there and no Operator row ever does. Kept apart
// from `lib/demo-store.ts` so the reset (`lib/demo-reset.ts`) reaches it without loading the Operator's
// store, whose module starts a Redis client.
export const DEMO_SCHEMA = 'demo'

export function demoEnabled(): boolean {
  return env.DEMO_ENABLED === 'true'
}

// Derived from DATABASE_URL, so the demo scope needs no credential of its own. One connection: it sits
// beside the Operator's pool under the role's limit (ops/demo-principal.md § cuatro-tracker).
export function demoDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  url.searchParams.set('schema', DEMO_SCHEMA)
  url.searchParams.set('connection_limit', '1')
  return url.toString()
}
