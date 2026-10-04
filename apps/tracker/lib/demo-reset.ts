import { Prisma, PrismaClient } from '@prisma/client'
import { DEMO_PRINCIPAL } from '@/lib/demo-principal'
import { demoDatabaseUrl, demoEnabled } from '@/lib/demo-scope'
import { env } from '@/lib/env'
import fixture from '@/prisma/demo-fixture.json'

// `demo:reset` in this application (AD-13, Story 5.9), to the one definition in ops/demo-principal.md
// § The reset: empty the demo scope, keep the demo principal's own `User` row and its credentials, and
// reseed the committed fixture (`prisma/demo-fixture.json`), in one transaction, through the demo store
// only. It never opens the Operator's store and never migrates (AD-23).

export const APP_ID = 'cuatro-tracker'

// Every model in the schema, in the order the reset empties it (children first). A model added to the
// schema fails lib/__tests__/demo-reset.test.ts until it is placed here.
export const RESET_MODELS = [
  'Achievement',
  'MergeSuggestion',
  'UserEntry',
  'MediaItem',
  'Account',
  'Session',
  'VerificationToken',
  'User',
] as const satisfies readonly Prisma.ModelName[]

type Delegate = {
  deleteMany(args?: object): Promise<{ count: number }>
  createMany(args: { data: object[] }): Promise<{ count: number }>
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/** The fixture's rows by delegate name, its ISO times as dates. */
export function fixtureRows(): Record<string, Record<string, unknown>[]> {
  return Object.fromEntries(
    Object.entries(fixture).map(([model, rows]) => [
      model,
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, typeof v === 'string' && ISO_TIME.test(v) ? new Date(v) : v]),
        ),
      ),
    ]),
  )
}

export type ResetOutcome = { status: 'reset'; rows: number } | { status: 'skipped'; reason: string }

/**
 * Resets the scope `store` addresses, which is the demo store or nothing (null: demo access off). The
 * Operator's store is never passed here: `main` builds the demo client from `lib/demo-scope.ts`.
 */
export async function resetDemoScope(store: PrismaClient | null): Promise<ResetOutcome> {
  if (!store) return { status: 'skipped', reason: 'demo access is off' }
  const principal = await store.user.findUnique({ where: { email: DEMO_PRINCIPAL }, select: { id: true } })
  if (!principal) return { status: 'skipped', reason: 'the demo principal is absent' }

  const rows = fixtureRows()
  let seeded = 0
  await store.$transaction(async (tx) => {
    const delegate = (name: string) => (tx as unknown as Record<string, Delegate>)[name]
    for (const model of RESET_MODELS) {
      const name = model[0].toLowerCase() + model.slice(1)
      await delegate(name).deleteMany(model === 'User' ? { where: { id: { not: principal.id } } } : undefined)
    }
    for (const [name, data] of Object.entries(rows)) {
      seeded += (await delegate(name).createMany({ data })).count
    }
  })
  return { status: 'reset', rows: seeded }
}

/** The command: one line out, exit 0 for reset or skipped, one line on stderr and exit 1 for a fault. */
export async function main(out = process.stdout, err = process.stderr): Promise<number> {
  const store = demoEnabled() ? new PrismaClient({ datasourceUrl: demoDatabaseUrl(env.DATABASE_URL) }) : null
  try {
    const outcome = await resetDemoScope(store)
    out.write(
      outcome.status === 'reset'
        ? `demo:reset ${APP_ID} reset rows=${outcome.rows}\n`
        : `demo:reset ${APP_ID} skipped: ${outcome.reason}\n`,
    )
    return 0
  } catch (e) {
    // The error's class and code only: a Prisma message can quote a row's values.
    const reason = e instanceof Prisma.PrismaClientKnownRequestError ? `prisma ${e.code}` : e instanceof Error ? e.name : 'unknown'
    err.write(`demo:reset ${APP_ID} failed: ${reason}\n`)
    return 1
  } finally {
    await store?.$disconnect()
  }
}
