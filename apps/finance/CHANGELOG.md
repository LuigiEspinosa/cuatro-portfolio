# CHANGELOG

## [0.2.0] - 2026-3-11

- `lib/crypto` - AES-256-GCM authenticated encryption with typed `CryptoError`; 100% test coverage.
- `lib/__tests__/crypto.test.ts` - 11 unit tests covering round-trip, non-deterministic, tamper detection, and fall-fast key validation.
- `lib/auth.ts` - Better Auth config with email/password provider and mandatory TOTP 2FA (backup codes enabled)
- `lib/auth-client.ts` - Browser-side Better Auth client with `twoFactorClient` plugin.
- `app/api/auth/[...all]/route.ts` - Better Auth catch-all route handler.
- `middleware.ts` - Edge-compatible session cookie check for fast UX redirects (UX layer only).
- `app/(app)/layout.tsx` - Full DB session validation plus MFA enforcement (real security gate)
- shadcn/ui with zinc base, dark-only theme, OKLCH purple primary accent.
- `app/(auth)/login/` - Dark themed login form with error handling and loading stats.
- `app/(auth)/setup-mfa/` - TOTP setup with QR code, manual key, backup codes, OTP confirmation.
- `app/(auth)/verify-mfa` - TOTP and backup code verification with toggle.
- `prisma/seed/admin.ts` - Idempotent admin user seed via Better Auth server API.
- Better Auth database tables: `auth_user`, `auth_session`, `auth_account`, `auth_verification`, `auth_two_factor`
- `vitest.config.ts` - Added `ENCRYPTION_KEY` env for test isolation.

## [0.1.0] - 2026-3-11

### Added

- Next.js 15 (App Router) project scaffold with TypeScript 5.7, Tailwind v4, ESLINT
- `vitest.config.ts` with path alias and v8 coverage provider.
- ESLint rule banning arithmetic operators on monetary variables (`amount`, `balance`, `centavos`)
- `lib/money.ts` - complete money artihmetic layer using `decima.js` with banker's rounding; 100% test coverage.
- `lib/__tests__/money.test.ts` - 40+ unit tests covering all edge cases including large COP amounts and float-drift verification
- `prisma/schema.prisma` - full schema with all core models upfront: `Account`, `Transaction`, `Budget`, `Debt`, `Investment`, `FxRate`, `Subscription`, `Category`, `CashFlowPoint`
- `prisma.config.ts` - Prisma 7 datasource configuration (URL moved out of schema)
- `lib/db.ts` - Prisma singleton using `globalThis` guard and `PrismaPg` adapter (Prisma 7)
  0 `lib/db/` - Repository scaffolds for all domains (`accounts`, `transactions`, `budgets`, `debts`, `investments`, `fx-rates`, `subscriptions`, `categories`)
- `docker-compose.yml` - local services: PostgreSQL 16, Redis 7, Caddy
- `docker/Caddyfile` - local reverse proxy for `finance.localhost`
- `.env.example` - environment variable template
- `.vscode/extensions.json` - Workspace extensions recommendations
- `.vscode/settings.json` - Editor settings for Prisma, Tailwind, ESLint
- Initial Prisma migration (`prisma/migrations/`)
