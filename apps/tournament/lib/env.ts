import 'server-only';

/**
 * Server-only environment access + validation (AC6, AD-25).
 *
 * Every value here is read from `process.env` on the Node.js runtime only. The
 * `import 'server-only'` above makes any accidental import from a Client Component a
 * build error. Values are exposed as lazy getters (not eager module constants) so
 * that importing this module never throws just for being loaded — a missing var only
 * blows up when a handler actually needs it.
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required server env var: ${name}`);
  }
  return value;
}

// A secret must NEVER be exposed to the browser via a NEXT_PUBLIC_ mirror.
// This runs at module load and fails the build/boot loudly if the discipline slips.
// (Only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY may be public.)
const FORBIDDEN_PUBLIC_MIRRORS = [
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_JWT_SECRET',
  'NEXT_PUBLIC_STEAM_API_KEY',
  'NEXT_PUBLIC_STEAM_REALM',
  'NEXT_PUBLIC_STEAM_RETURN_URL',
  'NEXT_PUBLIC_AUTH_NONCE_SECRET',
  'NEXT_PUBLIC_SUPABASE_DB_PASSWORD',
  'NEXT_PUBLIC_ADMIN_STEAMIDS',
];

export function assertNoLeakedSecrets(): void {
  const leaked = FORBIDDEN_PUBLIC_MIRRORS.filter((name) => Boolean(process.env[name]));
  if (leaked.length > 0) {
    throw new Error(
      `Server secret exposed via NEXT_PUBLIC_ (would ship to the browser): ${leaked.join(', ')}`,
    );
  }
}

assertNoLeakedSecrets();

export const env = {
  /** Server-side Supabase URL (may equal the public one but read server-only here). */
  supabaseUrl: () => required('SUPABASE_URL'),
  /** Service-role key — the single server-side writer. Never client-exposed. */
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  /** Public Supabase URL used by the SSR session client (browser-safe). */
  publicSupabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL'),
  /** Public anon key used by the SSR session client (browser-safe). */
  supabaseAnonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  /** Steam Web API key — only needed for cosmetic profile hydration (AC2). */
  steamApiKey: () => process.env.STEAM_API_KEY ?? '',
  /** OpenID realm bound to the configured domain (AC4). */
  steamRealm: () => required('STEAM_REALM'),
  /** OpenID return_to (the callback URL) bound to the configured domain (AC4). */
  steamReturnUrl: () => required('STEAM_RETURN_URL'),
  /** HMAC secret used to sign the CSRF nonce cookie (AC4). */
  authNonceSecret: () => required('AUTH_NONCE_SECRET'),
  /**
   * Comma-separated admin SteamID64 allowlist that bootstraps the first admin(s) at
   * login (Story 2.2). Optional/server-only: unset ⇒ empty allowlist ⇒ everyone defaults
   * to `viewer` (fail-closed). Never `required()` — a missing var must not break login.
   */
  adminSteamIds: () => process.env.ADMIN_STEAMIDS ?? '',
} as const;
