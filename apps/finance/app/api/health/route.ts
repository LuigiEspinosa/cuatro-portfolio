import { db } from "@/lib/db";

// The compose healthcheck's endpoint, which `docker-rollout` waits on before it drains the serving
// container (AD-8). It answers 200 only when the database answers, so a rollout never replaces a
// working container with one that cannot reach its data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
