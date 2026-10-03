import { spawnSync } from 'node:child_process'
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { Prisma, PrismaClient } from '@prisma/client'
import fixture from '@/prisma/demo-fixture.json'
import { DEMO_PRINCIPAL } from '@/lib/demo-principal'
import { demoDatabaseUrl } from '@/lib/demo-scope'
import { RESET_MODELS, fixtureRows, resetDemoScope } from '@/lib/demo-reset'

// `demo:reset` in the tracker (AD-13, Story 5.9, ops/demo-principal.md § The reset), against a real Postgres:
// the Operator's schema `public` and the demo schema `demo` in one database, both migrated as the box
// migrates them. CI's test job provides the database; here, point TRACKER_DEMO_RESET_DATABASE_URL at a
// scratch database whose name ends in `_test`, which this suite drops and remigrates.

const URL_ = process.env.TRACKER_DEMO_RESET_DATABASE_URL ?? ''
const CI = process.env.CI === 'true'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the reset, statically', () => {
  it('runs in CI against a real database, never silently skipped there', () => {
    if (CI) expect(URL_, 'TRACKER_DEMO_RESET_DATABASE_URL').not.toBe('')
  })

  it('places every model in the schema, so a new model fails here until the reset handles it', () => {
    expect([...RESET_MODELS].sort()).toEqual(Object.values(Prisma.ModelName).sort())
  })

  it('seeds only models it resets, with fixed ids and fixed times', () => {
    const delegates = RESET_MODELS.map((m) => m[0].toLowerCase() + m.slice(1))
    for (const [model, rows] of Object.entries(fixtureRows())) {
      expect(delegates).toContain(model)
      for (const row of rows) {
        expect(typeof row.id, model).toBe('string')
        expect(row.created_at, model).toBeInstanceOf(Date)
        expect(row.updated_at, model).toBeInstanceOf(Date)
      }
    }
    expect(fixtureRows().user).toBeUndefined()
  })

  it('answers skipped and reads nothing with demo access off', async () => {
    expect(await resetDemoScope(null)).toEqual({ status: 'skipped', reason: 'demo access is off' })
  })

  it('prints one skipped line and exits 0 with demo access off, opening no client', async () => {
    vi.resetModules()
    vi.stubEnv('DEMO_ENABLED', '')
    const { main } = await import('@/lib/demo-reset')
    const out: string[] = []
    const err: string[] = []
    const code = await main({ write: (s: string) => out.push(s) } as never, { write: (s: string) => err.push(s) } as never)
    expect(code).toBe(0)
    expect(out).toEqual(['demo:reset cuatro-tracker skipped: demo access is off\n'])
    expect(err).toEqual([])
  })
})

type Snapshot = Record<string, unknown[]>

async function snapshot(client: PrismaClient): Promise<Snapshot> {
  const result: Snapshot = {}
  for (const model of RESET_MODELS) {
    const name = model[0].toLowerCase() + model.slice(1)
    const rows = (await (client as unknown as Record<string, { findMany(): Promise<unknown[]> }>)[name].findMany()) as unknown[]
    result[name] = rows.map((r) => JSON.stringify(r)).sort()
  }
  return result
}

const migrate = (url: string) => {
  const run = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  })
  if (run.status !== 0) throw new Error(`migrate deploy failed: ${run.stderr}`)
}

describe.skipIf(!URL_)('the reset, against Postgres', () => {
  let operator: PrismaClient
  let demo: PrismaClient
  let principalId: string

  beforeAll(async () => {
    if (!new URL(URL_).pathname.endsWith('_test')) throw new Error('TRACKER_DEMO_RESET_DATABASE_URL must name a *_test database')
    operator = new PrismaClient({ datasourceUrl: URL_ })
    await operator.$executeRawUnsafe('DROP SCHEMA IF EXISTS demo CASCADE')
    await operator.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE')
    await operator.$executeRawUnsafe('CREATE SCHEMA public')
    migrate(URL_)
    migrate(demoDatabaseUrl(URL_))
    demo = new PrismaClient({ datasourceUrl: demoDatabaseUrl(URL_) })
  }, 120_000)

  afterAll(async () => {
    await operator?.$disconnect()
    await demo?.$disconnect()
  })

  beforeEach(async () => {
    for (const client of [operator, demo]) {
      await client.achievement.deleteMany()
      await client.userEntry.deleteMany()
      await client.mediaItem.deleteMany()
      await client.user.deleteMany()
    }
    // The Operator's rows, one of them under the fixture's own id and TMDB id, which is legal across scopes.
    await operator.user.create({ data: { email: 'admin@tracker.local', password: 'operator-hash' } })
    await operator.mediaItem.create({
      data: { id: 'demo-media-1', type: 'MOVIE', title: 'Operator copy', release_date: new Date('1999-03-31'), tmdb_id: 603 },
    })
    await operator.userEntry.create({ data: { media_item_id: 'demo-media-1', status: 'WATCHING', progress: 3 } })
    // The demo principal, and what Visitors left behind.
    principalId = (await demo.user.create({ data: { email: DEMO_PRINCIPAL, password: 'demo-hash' } })).id
    await demo.user.create({ data: { email: 'stray@example.test' } })
    await demo.mediaItem.create({
      data: {
        id: 'visitor-1',
        type: 'GAME',
        title: 'Visitor game',
        release_date: new Date('2020-01-01'),
        user_entry: { create: { status: 'DROPPED' } },
        achievements: { create: { steam_api_name: 'a', display_name: 'A' } },
      },
    })
  })

  async function expectFixture() {
    const after = await snapshot(demo)
    expect(after.achievement).toEqual([])
    expect(after.mergeSuggestion).toEqual([])
    expect(after.account).toEqual([])
    expect(after.session).toEqual([])
    const users = await demo.user.findMany()
    expect(users).toEqual([expect.objectContaining({ id: principalId, email: DEMO_PRINCIPAL, password: 'demo-hash' })])
    for (const [model, rows] of Object.entries(fixtureRows())) {
      const delegate = (demo as unknown as Record<string, { findMany(a: object): Promise<Record<string, unknown>[]> }>)[model]
      const stored = await delegate.findMany({ orderBy: { id: 'asc' } })
      expect(stored.map((r) => r.id), model).toEqual(rows.map((r) => r.id).sort())
      for (const row of rows) {
        const match = stored.find((r) => r.id === row.id)!
        for (const [k, v] of Object.entries(row)) expect(match[k], `${model}.${row.id}.${k}`).toEqual(v)
      }
    }
    return after
  }

  it('empties the demo scope to the fixture twice over, the second run changing nothing, and never touches the Operator', async () => {
    const operatorBefore = await snapshot(operator)
    const fixtureCount = fixture.mediaItem.length + fixture.userEntry.length

    expect(await resetDemoScope(demo)).toEqual({ status: 'reset', rows: fixtureCount })
    expect(await snapshot(operator)).toEqual(operatorBefore)
    const first = await expectFixture()

    expect(await resetDemoScope(demo)).toEqual({ status: 'reset', rows: fixtureCount })
    expect(await snapshot(operator)).toEqual(operatorBefore)
    expect(await expectFixture()).toEqual(first)
  })

  it('answers skipped and changes nothing when the demo principal is absent', async () => {
    await demo.user.delete({ where: { id: principalId } })
    const before = [await snapshot(operator), await snapshot(demo)]
    expect(await resetDemoScope(demo)).toEqual({ status: 'skipped', reason: 'the demo principal is absent' })
    expect([await snapshot(operator), await snapshot(demo)]).toEqual(before)
  })

  it('applies nothing when the reseed fails part way', async () => {
    const before = [await snapshot(operator), await snapshot(demo)]
    const failing = new Proxy(demo, {
      get(target, key) {
        if (key !== '$transaction') return Reflect.get(target, key)
        return (fn: (tx: unknown) => Promise<unknown>) =>
          target.$transaction((tx) =>
            fn(new Proxy(tx, {
              get(t, k) {
                if (k !== 'userEntry') return Reflect.get(t, k)
                return {
                  deleteMany: (a: object) => (t as PrismaClient).userEntry.deleteMany(a),
                  createMany: async () => { throw new Error('planted') },
                }
              },
            })),
          )
      },
    })
    await expect(resetDemoScope(failing)).rejects.toThrow('planted')
    expect([await snapshot(operator), await snapshot(demo)]).toEqual(before)
  })

  it('prints one failed line, quoting no row, and exits 1 when its database cannot be reached', async () => {
    const url = new URL(URL_)
    url.pathname = '/no_such_database_test'
    vi.resetModules()
    vi.stubEnv('DEMO_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', url.toString())
    const { main } = await import('@/lib/demo-reset')
    const out: string[] = []
    const err: string[] = []
    const code = await main({ write: (s: string) => out.push(s) } as never, { write: (s: string) => err.push(s) } as never)
    expect(code).toBe(1)
    expect(out).toEqual([])
    expect(err).toHaveLength(1)
    expect(err[0]).toMatch(/^demo:reset cuatro-tracker failed: [A-Za-z0-9 ]+\n$/)
  })

  it('prints one reset line and exits 0 through the command, against the demo schema only', async () => {
    const operatorBefore = await snapshot(operator)
    vi.resetModules()
    vi.stubEnv('DEMO_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', URL_)
    const { main } = await import('@/lib/demo-reset')
    const out: string[] = []
    const code = await main({ write: (s: string) => out.push(s) } as never, { write: () => true } as never)
    expect(code).toBe(0)
    expect(out).toEqual([`demo:reset cuatro-tracker reset rows=${fixture.mediaItem.length + fixture.userEntry.length}\n`])
    expect(await snapshot(operator)).toEqual(operatorBefore)
    await expectFixture()
  })
})
