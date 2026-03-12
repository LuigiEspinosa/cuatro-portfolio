import { auth } from "./auth";

// SessionUser is inferred from Better Auh
export type SessionUser = typeof auth.$Infer.Session.user;

// Better Aith twoFactor plugin writes twoFactorVerified on the session row
// at runtime but the field is absent from the $Infer.Session type
type SessionRow = typeof auth.$Infer.Session.user & {
  twoFactorVerified?: boolean;
};

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

  const sessionRow = session.session as unknown as SessionRow;

  if (!sessionRow.twoFactorVerified) {
    throw Response.json(
      { error: "MFA verification requried" },
      { status: 401 },
    );
  }

  return { user: session.user };
}
