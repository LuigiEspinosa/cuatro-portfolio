// The demo principal contract (AD-13, Story 5.8, ops/demo-principal.md). The address is the contract's,
// never this application's: ops/__tests__/demo-principal.test.ts holds it equal to the record. This
// module imports nothing, so the middleware can read it.
export const DEMO_PRINCIPAL = 'demo@cuatro.dev'

export function isDemoPrincipal(email: unknown): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === DEMO_PRINCIPAL
}
