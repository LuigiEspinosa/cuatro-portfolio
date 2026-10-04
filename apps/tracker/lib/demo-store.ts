import { PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { isDemoPrincipal } from '@/lib/demo-principal'
import { demoDatabaseUrl, demoEnabled } from '@/lib/demo-scope'

export { DEMO_SCHEMA, demoDatabaseUrl, demoEnabled } from '@/lib/demo-scope'

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
