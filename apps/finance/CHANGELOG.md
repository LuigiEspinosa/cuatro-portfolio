# CHANGELOG

## [0.3.0] - 2026-3-31

### Added

- `lib/money.ts` - `formatUVR(Decimal): string` for UVR mortgage balance display.
- `lib/validators/accounts.ts` and `lib/validators/transactions.ts` - Zod v4 schemas with BigInt-from-string transforms.
- `lib/api-auth.ts` - shared `requireAuth()` helper; checks session and `twoFactorVerified`.
- `lib/db/accounts.ts` - BankAccount repository (list, find, create, update, delete).
- `lib/db/transactions.ts` - Transaction repository (list paginated, create manual).
- `lib/utils/group-by-date.ts` - Pure utility to group transactions by calendar day (es-CO labels).
- RES API : `GET/POST /api/accounts`, `GET/PATCH/DELETE /api/accounts/:id`, `GET/POST /api/accounts/:id/transactions`.
- `components/atoms/CurrencyDisplay` - formats BigInt centavos to COP/USD strings; the only place money formatting ocurrs in JSX.
- `components/atoms/AccountBadge` - type badge pill with color coding per account type.
- `components/molecules/AccountCard` - 2-column detail grid card with sync status, UVR dual balance, AFC chip.
- `components/molecules/TransactionRow` - transaction row for grouped date list.
- Storybook (`@storybook/nextjs`) with dark decorator and Tailwind v4 CSS import.
- `app/(app)/layout.tsx` - labeled sidebar shell; added missing `twoFactorVerified` MFA guard.
- `app/(app)/accounts/page.tsx` - account grid with AddAccountModal.
- `app/(app)/accounts/[id]/page.tsx` - account detail with grouped transaction list, AddTransactionModa, and EditAccountModal (with name-typed delete confirmation).
- `app/(app)/dashboard/page.tsx` - net worth total and 4-account preview grid.

### Fixed

- `app/(app)/layout.tsx` - `twoFactorVerified` cehck was missing; users who completed login but skipped TOTP verify could access protected routes.

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
