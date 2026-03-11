# CHANGELOG

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
