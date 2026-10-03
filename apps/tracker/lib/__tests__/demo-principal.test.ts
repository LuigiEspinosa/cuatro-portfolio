import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'

// The demo principal contract in this application (AD-13, Story 5.8, ops/demo-principal.md).

const { operatorFindUnique } = vi.hoisted(() => ({ operatorFindUnique: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: operatorFindUnique } } }))

const OPERATOR = 'cuatro@example.test'

let hash: string
beforeAll(async () => {
  hash = await bcrypt.hash('pw', 4)
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  delete (globalThis as { demoPrisma?: unknown }).demoPrisma
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function load() {
  const principal = await import('@/lib/demo-principal')
  const store = await import('@/lib/demo-store')
  const { db } = await import('@/lib/db')
  return { ...principal, ...store, db }
}

describe('the principal', () => {
  it('is the contract address, recognised trimmed and in any case, and nothing else', async () => {
    const { DEMO_PRINCIPAL, isDemoPrincipal } = await load()
    expect(DEMO_PRINCIPAL).toBe('demo@cuatro.dev')
    expect(isDemoPrincipal(' Demo@Cuatro.dev ')).toBe(true)
    for (const other of [OPERATOR, 'demo@cuatro.dev.evil.test', 'demo@cuatro.de', '', null, undefined, 1]) {
      expect(isDemoPrincipal(other)).toBe(false)
    }
  })
})

describe('ownership scopes', () => {
  it('with demo access off (the variable unset or empty), everyone but the demo principal is the Operator store, and the demo principal has none', async () => {
    for (const value of [undefined, '', 'false']) {
      vi.resetModules()
      // Undefined is the suite's own environment, which never sets it (tests/setup.ts).
      if (value !== undefined) vi.stubEnv('DEMO_ENABLED', value)
      const { storeFor, db } = await load()
      expect(storeFor(OPERATOR)).toBe(db)
      expect(storeFor(null)).toBe(db)
      expect(storeFor('demo@cuatro.dev')).toBeNull()
    }
  })

  it('with demo access on, the demo principal owns the demo schema and never the Operator store; the Operator never the demo schema', async () => {
    vi.stubEnv('DEMO_ENABLED', 'true')
    const { storeFor, db } = await load()
    const demo = storeFor('demo@cuatro.dev')
    expect(demo).not.toBeNull()
    expect(demo).not.toBe(db)
    expect(storeFor('DEMO@cuatro.dev')).toBe(demo)
    for (const other of [OPERATOR, 'demo@cuatro.dev.evil.test', '', null, undefined]) {
      expect(storeFor(other)).toBe(db)
    }
  })

  it('derives the demo store from DATABASE_URL: same database and role, schema demo, one connection', async () => {
    const { demoDatabaseUrl } = await load()
    const url = new URL(
      demoDatabaseUrl('postgresql://cuatro_tracker:pw@estate-postgres:5432/cuatro_tracker?connection_limit=4'),
    )
    expect(`${url.username}@${url.host}${url.pathname}`).toBe('cuatro_tracker@estate-postgres:5432/cuatro_tracker')
    expect(url.searchParams.get('schema')).toBe('demo')
    expect(url.searchParams.get('connection_limit')).toBe('1')
  })
})

describe('scopedDb, the store of the request', () => {
  it('answers the Operator store for the Operator and for no session, the demo store for the demo principal', async () => {
    vi.stubEnv('DEMO_ENABLED', 'true')
    const { storeFor, db } = await load()
    const { scopedDb } = await import('@/lib/scoped-db')
    const { getServerSession } = await import('next-auth')
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '1', email: OPERATOR }, expires: '' })
    expect(await scopedDb()).toBe(db)
    vi.mocked(getServerSession).mockResolvedValueOnce(null)
    expect(await scopedDb()).toBe(db)
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '2', email: 'demo@cuatro.dev' }, expires: '' })
    expect(await scopedDb()).toBe(storeFor('demo@cuatro.dev'))
  })

  it('refuses a demo session while demo access is off rather than answer the Operator store', async () => {
    const { scopedDb } = await import('@/lib/scoped-db')
    const { getServerSession } = await import('next-auth')
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '2', email: 'demo@cuatro.dev' }, expires: '' })
    await expect(scopedDb()).rejects.toThrow('demo access off')
  })
})

describe('sign-in reads each principal from its own store only', () => {
  it('never looks the demo principal up in the Operator store, on or off', async () => {
    operatorFindUnique.mockResolvedValue({ id: 'op', email: 'demo@cuatro.dev', name: null, password: hash })
    const { authorizeCredentials } = await import('@/lib/auth')
    expect(await authorizeCredentials({ email: 'demo@cuatro.dev', password: 'pw' })).toBeNull()

    vi.resetModules()
    vi.stubEnv('DEMO_ENABLED', 'true')
    const { storeFor } = await load()
    const demoFindUnique = vi
      .spyOn(storeFor('demo@cuatro.dev')!.user, 'findUnique')
      .mockResolvedValue({ id: 'demo', email: 'demo@cuatro.dev', name: null, password: hash } as never)
    const auth = await import('@/lib/auth')
    expect(await auth.authorizeCredentials({ email: ' DEMO@cuatro.dev', password: 'pw' })).toEqual({
      id: 'demo',
      email: 'demo@cuatro.dev',
      name: null,
    })
    expect(demoFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'demo@cuatro.dev' } }))
    expect(operatorFindUnique).not.toHaveBeenCalled()
  })

  it('never looks the Operator up in the demo store', async () => {
    vi.stubEnv('DEMO_ENABLED', 'true')
    const { storeFor } = await load()
    const demoFindUnique = vi.spyOn(storeFor('demo@cuatro.dev')!.user, 'findUnique')
    operatorFindUnique.mockResolvedValue({ id: 'op', email: OPERATOR, name: null, password: hash })
    const { authorizeCredentials } = await import('@/lib/auth')
    expect(await authorizeCredentials({ email: OPERATOR, password: 'pw' })).toEqual({
      id: 'op',
      email: OPERATOR,
      name: null,
    })
    expect(demoFindUnique).not.toHaveBeenCalled()
  })
})

// The static half: a scope is only as good as the paths that read through it.

const ROOT = join(__dirname, '..', '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' || name === '__tests__' || name.startsWith('.') ? [] : sources(path)
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const APPLICATION = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'lib')), ...sources(join(ROOT, 'components')), join(ROOT, 'worker.ts')]
const rel = (path: string) => relative(ROOT, path).split(sep).join('/')

describe('every request path reads through the principal’s store', () => {
  // Each entry is a path that may hold the Operator store directly, and why.
  const OPERATOR_ONLY: Record<string, RegExp> = {
    'the store module itself': /^lib\/demo-store\.ts$/,
    'sign-in: the adapter is never called for credentials, lookups go through storeFor': /^lib\/auth\.ts$/,
    'the readiness probe, no principal': /^app\/api\/ready\/route\.ts$/,
    'the worker and its jobs: the Operator store only': /^(worker\.ts|lib\/jobs\/)/,
    'the admin surfaces: the demo principal is refused there (middleware.ts, app/admin/layout.tsx)': /^app\/(api\/)?admin\//,
  }

  it('no other module imports the Operator store', () => {
    const offenders = APPLICATION.map(rel).filter(
      (path) =>
        /from '@\/lib\/db'/.test(readFileSync(join(ROOT, path), 'utf8')) &&
        !Object.values(OPERATOR_ONLY).some((allowed) => allowed.test(path)),
    )
    expect(offenders).toEqual([])
  })
})

describe('the principal cannot be deleted and its credentials cannot be changed from inside the application', () => {
  it('no application code writes a user, an account or a session', () => {
    const writes = /\.(user|account|session|verificationToken)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/
    const offenders = APPLICATION.filter((path) => writes.test(readFileSync(path, 'utf8'))).map(rel)
    expect(offenders).toEqual([])
  })

  it('signs in through credentials alone, so no provider creates or links a user', async () => {
    const { authOptions } = await import('@/lib/auth')
    expect(authOptions.providers.map((p) => p.id)).toEqual(['credentials'])
    expect(authOptions.session?.strategy).toBe('jwt')
  })
})

describe('the admin surfaces refuse the demo principal', () => {
  it('in the admin layout behind it, which answers not found to the demo principal only', async () => {
    const { default: AdminLayout } = await import('@/app/admin/layout')
    const { getServerSession } = await import('next-auth')
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '2', email: 'demo@cuatro.dev' }, expires: '' })
    await expect(AdminLayout({ children: null })).rejects.toThrow()
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: '1', email: OPERATOR }, expires: '' })
    await expect(AdminLayout({ children: null })).resolves.toBeTruthy()
  })

  it('in middleware, for pages and their API, and for no one else', async () => {
    const { refusesDemoPrincipal } = await import('@/middleware')
    for (const path of ['/admin', '/admin/', '/admin/merge', '/api/admin/import', '/api/admin/merge/dismiss']) {
      expect(refusesDemoPrincipal(path, 'demo@cuatro.dev')).toBe(true)
      expect(refusesDemoPrincipal(path, OPERATOR)).toBe(false)
    }
    for (const path of ['/', '/administrator', '/api/media', '/api/progress', '/timeline']) {
      expect(refusesDemoPrincipal(path, 'demo@cuatro.dev')).toBe(false)
    }
  })
})
