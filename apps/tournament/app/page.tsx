/**
 * Home (AC5 landing). Minimal Spanish login affordance using Valve's official
 * "Sign in through Steam" button asset (Steam brand guidelines). The UX docs do not spec
 * a login screen — this is a documented minimal placeholder (Dev Notes §UX). Viewing is
 * public/read-only; login gates admin capability, not read access.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const { login } = await searchParams;
  const loginFailed = login === 'error';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.02em' }}>InclusivCup</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Torneo CS2</p>

      {loginFailed ? (
        <p role="alert" style={{ color: '#ff6b6b', margin: 0 }}>
          No pudimos verificar tu sesión de Steam. Inténtalo de nuevo.
        </p>
      ) : null}

      <a href="/auth/steam/login" aria-label="Iniciar sesión con Steam">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://community.fastly.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
          alt="Iniciar sesión con Steam"
          width={180}
          height={35}
        />
      </a>
    </main>
  );
}
