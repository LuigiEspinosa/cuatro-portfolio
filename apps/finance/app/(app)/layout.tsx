import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Security gate.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // If the user has not set up MFA yet, send them to setup
  if (!session.user.twoFactorEnabled) {
    redirect("/setup-mfa");
  }

  return <>{children}</>;
}
