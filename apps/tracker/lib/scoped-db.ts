import type { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { storeFor } from '@/lib/demo-store'

// The store for the signed-in principal of the current request (ops/demo-principal.md). Every request
// path reads through this, never through `db` directly (held by lib/__tests__/demo-principal.test.ts).
// A demo session with demo access off throws rather than falling back to the Operator's data.
export async function scopedDb(): Promise<PrismaClient> {
  const session = await getServerSession(authOptions)
  const store = storeFor(session?.user?.email)
  if (!store) throw new Error('demo principal session with demo access off')
  return store
}
