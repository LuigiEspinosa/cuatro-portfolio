// The compose healthcheck's endpoint, which `docker-rollout` waits on before it drains the serving
// container (AD-8). Liveness only: it answers 200 once the server serves, and asks nothing of
// Supabase, which no CI run here can reach. A readiness probe that does is chosen with the data's
// home at placement (Story 3-7, DW-280).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
