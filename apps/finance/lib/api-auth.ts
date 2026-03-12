import { auth } from "@/lib/auth";

// SessionUser is inferred from Better Auh
export type SessionUser = typeof auth.$Infer.Session.user;

// Shared auth guard for all route handlers.
export async function requireAuth(
  request: Request,
): Promise<{ user: SessionUser }> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user: session.user };
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, bigIntReplacer), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}
