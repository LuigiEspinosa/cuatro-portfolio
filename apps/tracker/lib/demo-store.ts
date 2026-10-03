import { PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { isDemoPrincipal } from '@/lib/demo-principal'

// The demo principal's ownership scope is its own Postgres schema in this application's own database
// (AD-10: same database, same role). Every row it owns lives there and no Operator row ever does.
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

const globalForDemo = globalThis as unknown as { demoPrisma?: PrismaClient }

function demoDb(): PrismaClient {
  globalForDemo.demoPrisma ??= new PrismaClient({
    datasourceUrl: demoDatabaseUrl(env.DATABASE_URL),
  })
  return globalForDemo.demoPrisma
}

// The store a principal owns. The demo principal resolves to the demo schema and never to the
// Operator's; anyone else resolves to the Operator's and never to the demo schema. With demo access
// off, the demo principal has no store at all (null), so it cannot sign in and owns nothing.
export function storeFor(email: unknown): PrismaClient | null {
  if (!isDemoPrincipal(email)) return db
  return demoEnabled() ? demoDb() : null
}
